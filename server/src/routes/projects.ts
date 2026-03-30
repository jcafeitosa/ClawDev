/**
 * Projects routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { projects } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { projectService } from "../services/projects.js";
import { deriveProjectUrlKey } from "@clawdev/shared";

export function projectRoutes(db: Db) {
  const svc = projectService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/projects",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(projects)
          .where(eq(projects.companyId, params.companyId))
          .orderBy(desc(projects.createdAt));
        // Attach derived urlKey so the frontend can build correct links
        return rows.map((r) => ({ ...r, urlKey: deriveProjectUrlKey(r.name, r.id) }));
      },
      { params: companyIdParam },
    )

    .get(
      "/projects/:id",
      async (ctx: any) => {
        const id = ctx.params.id;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        let project = null;
        if (isUuid) {
          // Fast path: lookup by UUID directly
          project = await svc.getById(id);
        }
        if (!project) {
          // urlKey lookup: find project whose derived urlKey matches
          const allRows = await db.select().from(projects);
          const match = allRows.find((r) => deriveProjectUrlKey(r.name, r.id) === id);
          if (match) project = await svc.getById(match.id);
        }
        if (!project) {
          ctx.set.status = 404;
          return { error: "Not found" };
        }
        return project;
      },
      { params: t.Object({ id: t.String() }) },
    );
}
