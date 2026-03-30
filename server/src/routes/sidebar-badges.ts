/**
 * Sidebar badges routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { and, eq, sql } from "drizzle-orm";
import { joinRequests } from "@clawdev/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { dashboardService } from "../services/dashboard.js";
import { companyIdParam } from "../middleware/index.js";

export function sidebarBadgeRoutes(db: Db) {
  const svc = sidebarBadgeService(db);
  const dashboard = dashboardService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/sidebar-badges",
      async (ctx: any) => {
        const companyId = ctx.params.companyId;

        const actor = ctx.actor;
        const canApproveJoins = actor?.type === "board";

        const joinRequestCount = canApproveJoins
          ? await db
              .select({ count: sql<number>`count(*)` })
              .from(joinRequests)
              .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.status, "pending_approval")))
              .then((rows) => Number(rows[0]?.count ?? 0))
          : 0;

        const badges = await svc.get(companyId, { joinRequests: joinRequestCount });
        const summary = await dashboard.summary(companyId);
        const hasFailedRuns = badges.failedRuns > 0;
        const alertsCount =
          (summary.agents.error > 0 && !hasFailedRuns ? 1 : 0) +
          (summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80 ? 1 : 0);
        badges.inbox = badges.failedRuns + alertsCount + joinRequestCount + badges.approvals;

        return badges;
      },
      { params: companyIdParam },
    );
}
