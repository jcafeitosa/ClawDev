/**
 * Cost tracking routes — Elysia port.
 *
 * Provides LLM cost tracking per agent, company, and time period.
 * Also includes budget management endpoints.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  agentService,
  budgetService,
  companyService,
  costService,
  financeService,
  heartbeatService,
  logActivity,
} from "../services/index.js";
// Note: we use inline t.Object({ companyId: t.String() }) instead of companyIdParam
// because companyIdParam enforces UUID format which some callers don't use.
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { badRequest, forbidden } from "../errors.js";

export function costRoutes(db: Db) {
  const costs = costService(db);
  const finance = financeService(db);
  const companies = companyService(db);
  const agents = agentService(db);
  const budgets = budgetService(db);
  const heartbeats = heartbeatService(db);

  function parseDateParam(value: unknown, label: string): Date | undefined {
    if (!value || typeof value !== "string") return undefined;
    const d = new Date(value);
    if (isNaN(d.getTime())) throw badRequest(`Invalid '${label}' date: ${value}`);
    return d;
  }

  return new Elysia()
    // Company cost summary (primary)
    .get(
      "/companies/:companyId/costs",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const from = parseDateParam(query.from, "from");
        const to = parseDateParam(query.to, "to");
        return costs.summary(params.companyId, { from, to });
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Agent cost breakdown
    .get(
      "/companies/:companyId/costs/by-agent",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const from = parseDateParam(query.from, "from");
        const to = parseDateParam(query.to, "to");
        return costs.byAgent(params.companyId, { from, to });
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Cost summary alias (dashboard widgets)
    .get(
      "/companies/:companyId/costs/summary",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const from = parseDateParam(query.from, "from");
        const to = parseDateParam(query.to, "to");
        return costs.summary(params.companyId, { from, to });
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Daily cost trend
    .get(
      "/companies/:companyId/costs/daily",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const _days = Number(query.days) || 30;
        return costs.byProvider(params.companyId);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Finance summary
    .get(
      "/companies/:companyId/costs/finance-summary",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const from = parseDateParam(query.from, "from");
        const to = parseDateParam(query.to, "to");
        return finance.summary(params.companyId, { from, to });
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Finance events list
    .get(
      "/companies/:companyId/costs/finance-events",
      async (ctx: any) => {
        const { params, query, set } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const from = parseDateParam(query.from, "from");
        const to = parseDateParam(query.to, "to");
        const limitStr = query.limit as string | undefined;
        let limit = 100;
        if (limitStr !== undefined) {
          limit = parseInt(limitStr, 10);
          if (isNaN(limit) || limit < 1) {
            throw badRequest("Invalid 'limit': must be a positive integer");
          }
        }
        return finance.list(params.companyId, from || to ? { from, to } : undefined, limit);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Budget management ───────────────────────────────────────────

    // Update company budget
    .patch(
      "/companies/:companyId/budgets",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const updated = await companies.update(params.companyId, body as any);
        return updated;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Update agent budget
    .patch(
      "/agents/:id/budgets",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        const agent = await agents.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);
        const updated = await agents.update(params.id, body as any);
        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    );
}
