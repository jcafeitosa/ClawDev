/**
 * Goals routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { goals } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";

export function goalRoutes(db: Db) {
  return new Elysia()
    .get(
      "/companies/:companyId/goals",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(goals)
          .where(eq(goals.companyId, params.companyId))
          .orderBy(desc(goals.createdAt));
        return rows;
      },
      { params: companyIdParam },
    )

    .get(
      "/goals/:id",
      async ({ params }) => {
        const rows = await db.select().from(goals).where(eq(goals.id, params.id));
        if (rows.length === 0) return new Response("Not found", { status: 404 });
        return rows[0];
      },
      { params: t.Object({ id: t.String() }) },
    );
}
