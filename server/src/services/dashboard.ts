import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agents, approvals, companies, issues } from "@clawdev/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

/**
 * Continuous aggregate view references.
 * costs_monthly: monthly cost totals per company + provider + biller (006).
 * The aggregate has a 1-day end_offset, so we combine it with recent base-table data.
 */
const CAGG_COSTS_MONTHLY = sql.raw("costs_monthly");
const MONTHLY_LAG_HOURS = 24;

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      // Month spend: use costs_monthly aggregate for the materialized portion
      // and the base table for the recent unmaterialized tail (1-day lag).
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const lagBoundary = new Date(Date.now() - MONTHLY_LAG_HOURS * 60 * 60 * 1000);

      const [monthRow] = await db.execute<{ total: number }>(sql`
        SELECT coalesce(agg.total, 0) + coalesce(recent.total, 0) AS total
        FROM (
          SELECT sum(total_cost_cents)::int AS total
          FROM ${CAGG_COSTS_MONTHLY}
          WHERE company_id = ${companyId}
            AND bucket >= ${monthStart}
        ) agg,
        (
          SELECT coalesce(sum(cost_cents), 0)::int AS total
          FROM cost_events
          WHERE company_id = ${companyId}
            AND occurred_at >= ${lagBoundary}
        ) recent
      `);

      const monthSpendCents = Number(monthRow?.total ?? 0);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
      };
    },
  };
}
