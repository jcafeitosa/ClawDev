/**
 * Activity routes — Elysia port.
 *
 * Provides activity feed for companies and issue-level activity.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { activityLog } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam, paginationQuery } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { activityService } from "../services/activity.js";
import { issueService } from "../services/index.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function activityRoutes(db: Db) {
  const activity = activityService(db);
  const issues = issueService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/activity",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const limit = Number(query.limit) || 50;
        const offset = ((Number(query.page) || 1) - 1) * limit;

        const rows = await db
          .select()
          .from(activityLog)
          .where(eq(activityLog.companyId, params.companyId))
          .orderBy(desc(activityLog.createdAt))
          .limit(limit)
          .offset(offset);

        return rows;
      },
      { params: companyIdParam },
    )

    // ── Runs for an issue (by UUID or identifier like PAP-475) ──────
    .get(
      "/issues/:id/runs",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        let issueId = params.id;
        let companyId: string | undefined;

        if (UUID_RE.test(issueId)) {
          const issue = await issues.getById(issueId);
          if (!issue) {
            set.status = 404;
            return { error: "Issue not found" };
          }
          companyId = issue.companyId;
        } else {
          const issue = await issues.getByIdentifier(issueId);
          if (!issue) {
            set.status = 404;
            return { error: "Issue not found" };
          }
          issueId = issue.id;
          companyId = issue.companyId;
        }

        assertCompanyAccess(actor, companyId!);
        return activity.runsForIssue(companyId!, issueId);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Activity for an issue ───────────────────────────────────────
    .get(
      "/issues/:id/activity",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        let issueId = params.id;

        if (!UUID_RE.test(issueId)) {
          const issue = await issues.getByIdentifier(issueId);
          if (!issue) {
            set.status = 404;
            return { error: "Issue not found" };
          }
          assertCompanyAccess(actor, issue.companyId);
          issueId = issue.id;
        } else {
          const issue = await issues.getById(issueId);
          if (issue) assertCompanyAccess(actor, issue.companyId);
        }

        return activity.forIssue(issueId);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Issues for a run ────────────────────────────────────────────
    .get(
      "/runs/:runId/issues",
      async (ctx: any) => {
        const { params } = ctx;
        return activity.issuesForRun(params.runId);
      },
      { params: t.Object({ runId: t.String() }) },
    );
}
