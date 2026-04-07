/**
 * Sidebar badges routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { and, eq, sql } from "drizzle-orm";
import { joinRequests } from "@clawdev/db";
import { accessService } from "../services/access.js";
import { issueService } from "../services/issues.js";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { dashboardService } from "../services/dashboard.js";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { logger } from "../middleware/logger.js";

export function sidebarBadgeRoutes(db: Db) {
  const svc = sidebarBadgeService(db);
  const dashboard = dashboardService(db);
  const access = accessService(db);
  const issues = issueService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/sidebar-badges",
      async (ctx: any) => {
        try {
          const companyId = ctx.params.companyId;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, companyId);

          let canApproveJoins = false;
          if (actor.type === "board") {
            canApproveJoins =
              actor.source === "local_implicit" ||
              Boolean(actor.isInstanceAdmin) ||
              Boolean(actor.userId && (await access.canUser(companyId, actor.userId, "joins:approve")));
          } else if (actor.type === "agent" && actor.agentId) {
            canApproveJoins = await access.hasPermission(companyId, "agent", actor.agentId, "joins:approve");
          }

          const joinRequestCount = canApproveJoins
            ? await db
                .select({ count: sql<number>`count(*)` })
                .from(joinRequests)
                .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.status, "pending_approval")))
                .then((rows) => Number(rows[0]?.count ?? 0))
            : 0;

          const unreadTouchedIssues =
            actor.type === "board" && actor.userId
              ? await issues.countUnreadTouchedByUser(companyId, actor.userId, "backlog,todo,in_progress,in_review,blocked,done")
              : 0;

          const badges = await svc.get(companyId, { joinRequests: joinRequestCount, unreadTouchedIssues });
          const summary = await dashboard.summary(companyId);
          const hasFailedRuns = badges.failedRuns > 0;
          const alertsCount =
            (summary.agents.error > 0 && !hasFailedRuns ? 1 : 0) +
            (summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80 ? 1 : 0);
          badges.inbox = badges.approvals + badges.failedRuns + joinRequestCount + unreadTouchedIssues + alertsCount;

          return badges;
        } catch (err) {
          logger.error("GET /companies/:companyId/sidebar-badges error", err);
          throw err;
        }
      },
      { params: companyIdParam },
    );
}
