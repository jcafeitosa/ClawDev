/**
 * Inbox routes — Elysia.
 *
 * Provides a company-scoped inbox: unread issues assigned to the current
 * user or requiring attention (pending approvals, failed runs, join requests).
 *
 * The frontend uses these for sidebar badges and the Inbox page.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { agents, approvals, heartbeatRuns, issues, joinRequests } from "@clawdev/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";

export function inboxRoutes(db: Db) {
  return new Elysia()

    // ── GET /companies/:id/inbox ────────────────────────────────────
    // Returns issues that need attention (not done/cancelled) plus
    // pending approvals and failed runs, aggregated into one list.
    .get(
      "/companies/:companyId/inbox",
      async ({ params, query }) => {
        const limit = Math.min(Number(query.limit) || 50, 200);
        const status = query.status as string | undefined; // e.g. "unread"

        // If limit=0 the frontend just wants a count
        if (Number(query.limit) === 0) {
          const openIssues = await db
            .select({ id: issues.id })
            .from(issues)
            .where(
              and(
                eq(issues.companyId, params.companyId),
                ne(issues.status, "done"),
                ne(issues.status, "cancelled"),
              ),
            );

          const pendingApprovals = await db
            .select({ id: approvals.id })
            .from(approvals)
            .where(
              and(
                eq(approvals.companyId, params.companyId),
                eq(approvals.status, "pending"),
              ),
            );

          return {
            count: openIssues.length + pendingApprovals.length,
          };
        }

        const issueRows = await db
          .select({
            id: issues.id,
            identifier: issues.identifier,
            title: issues.title,
            status: issues.status,
            priority: issues.priority,
            createdAt: issues.createdAt,
            updatedAt: issues.updatedAt,
          })
          .from(issues)
          .where(
            and(
              eq(issues.companyId, params.companyId),
              ne(issues.status, "done"),
              ne(issues.status, "cancelled"),
            ),
          )
          .orderBy(desc(issues.updatedAt))
          .limit(limit);

        return {
          items: issueRows.map((r) => ({ ...r, itemType: "issue" as const })),
          total: issueRows.length,
        };
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/join-requests ────────────────────────────
    .get(
      "/companies/:companyId/join-requests",
      async ({ params, query }) => {
        const status = (query.status as string) ?? "pending_approval";
        const limit = Math.min(Number(query.limit) || 50, 200);

        const rows = await db
          .select()
          .from(joinRequests)
          .where(
            and(
              eq(joinRequests.companyId, params.companyId),
              eq(joinRequests.status, status),
            ),
          )
          .orderBy(desc(joinRequests.createdAt))
          .limit(limit);

        return { joinRequests: rows, total: rows.length };
      },
      { params: companyIdParam },
    );
}
