import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { and, eq, sql } from "drizzle-orm";
import { joinRequests } from "@clawdev/db";
import { sidebarBadgeService } from "../services/sidebar-badges.js";
import { accessService } from "../services/access.js";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";
import { elysiaAuth } from "../elysia-plugins/auth.js";

export function elysiaSidebarBadgeRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = sidebarBadgeService(db);
  const access = accessService(db);
  const dashboard = dashboardService(db);

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/sidebar-badges", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const { companyId } = params;

      let canApproveJoins = false;
      if (actor.type === "board") {
        canApproveJoins =
          actor.source === "local_implicit" ||
          Boolean(actor.isInstanceAdmin) ||
          (await access.canUser(companyId, actor.userId!, "joins:approve"));
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

      const badges = await svc.get(companyId, { joinRequests: joinRequestCount });
      const summary = await dashboard.summary(companyId);
      const hasFailedRuns = badges.failedRuns > 0;
      const alertsCount =
        (summary.agents.error > 0 && !hasFailedRuns ? 1 : 0) +
        (summary.costs.monthBudgetCents > 0 && summary.costs.monthUtilizationPercent >= 80 ? 1 : 0);
      badges.inbox = badges.failedRuns + alertsCount + joinRequestCount + badges.approvals;

      return badges;
    });
}
