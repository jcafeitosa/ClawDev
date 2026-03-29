/**
 * Routines routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { routines } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";

export function routineRoutes(db: Db) {
  return new Elysia()
    .get(
      "/companies/:companyId/routines",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(routines)
          .where(eq(routines.companyId, params.companyId))
          .orderBy(desc(routines.createdAt));
        return rows;
      },
      { params: companyIdParam },
    )

    .get(
      "/routines/:id",
      async ({ params }) => {
        const rows = await db.select().from(routines).where(eq(routines.id, params.id));
        if (rows.length === 0) return new Response("Not found", { status: 404 });
        return rows[0];
      },
      { params: t.Object({ id: t.String() }) },
    );
}
