/**
 * Inbox routes — Elysia.
 *
 * Provides company-scoped inbox badge totals. The page-level inbox UI
 * composes its own feed from dedicated endpoints, while the sidebar relies
 * on this route for the aggregate count.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { joinRequests } from "@clawdev/db";
import { and, eq, sql } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { accessService, dashboardService, issueService, sidebarBadgeService } from "../services/index.js";

const INBOX_ISSUE_STATUSES = "backlog,todo,in_progress,in_review,blocked,done";

export function inboxRoutes(db: Db) {
  const access = accessService(db);
  const dashboard = dashboardService(db);
  const issues = issueService(db);
  const badges = sidebarBadgeService(db);

  return new Elysia()

    // ── GET /companies/:id/inbox ────────────────────────────────────
    .get(
      "/companies/:companyId/inbox",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        let canApproveJoins = false;
        if (actor.type === "board") {
          canApproveJoins =
            actor.source === "local_implicit" ||
            Boolean(actor.isInstanceAdmin) ||
            Boolean(actor.userId && (await access.canUser(params.companyId, actor.userId, "joins:approve")));
        } else if (actor.type === "agent" && actor.agentId) {
          canApproveJoins = await access.hasPermission(params.companyId, "agent", actor.agentId, "joins:approve");
        }

        const joinRequestCount = canApproveJoins
          ? await db
              .select({ count: sql<number>`count(*)` })
              .from(joinRequests)
              .where(and(eq(joinRequests.companyId, params.companyId), eq(joinRequests.status, "pending_approval")))
              .then((rows) => Number(rows[0]?.count ?? 0))
          : 0;

        const unreadTouchedIssues =
          actor.type === "board" && actor.userId
            ? await issues.countUnreadTouchedByUser(params.companyId, actor.userId, INBOX_ISSUE_STATUSES)
            : 0;

        const inboxBadges = await badges.get(params.companyId, {
          joinRequests: joinRequestCount,
          unreadTouchedIssues,
        });
        const summary = await dashboard.summary(params.companyId);
        const alerts = Number(summary.agents.error > 0 && inboxBadges.failedRuns === 0) +
          Number(summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80);

        const total = inboxBadges.inbox + alerts;
        return {
          total,
          count: total,
          inbox: total,
          approvals: inboxBadges.approvals,
          failedRuns: inboxBadges.failedRuns,
          joinRequests: inboxBadges.joinRequests,
          unreadTouchedIssues,
          alerts,
        };
      },
      { params: companyIdParam },
    );
}
