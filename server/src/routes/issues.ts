/**
 * Issues routes — Elysia port.
 *
 * Handles CRUD for issues, comments, attachments, work products.
 * This is a scaffold matching the Express routes structure.
 * Each handler delegates to the existing service layer.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { issues, issueComments } from "@clawdev/db";
import { eq, and, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";

export function issueRoutes(db: Db) {
  return new Elysia({ prefix: "/issues" })
    .get("/", async ({ query }) => {
      // TODO: Wire up full filtering from Express route
      return { issues: [], total: 0 };
    })

    .get(
      "/:id",
      async ({ params }) => {
        const rows = await db.select().from(issues).where(eq(issues.id, params.id));
        if (rows.length === 0) return new Response("Not found", { status: 404 });
        return rows[0];
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/:id/comments",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(issueComments)
          .where(eq(issueComments.issueId, params.id))
          .orderBy(desc(issueComments.createdAt));
        return rows;
      },
      { params: t.Object({ id: t.String() }) },
    );
}

export function companyIssueRoutes(db: Db) {
  return new Elysia()
    .get(
      "/companies/:companyId/issues",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(issues)
          .where(eq(issues.companyId, params.companyId))
          .orderBy(desc(issues.createdAt));
        return rows;
      },
      { params: companyIdParam },
    );
}
