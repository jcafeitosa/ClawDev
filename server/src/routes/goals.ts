/**
 * Goals routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { goals } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";

export function goalRoutes(db: Db) {
  return new Elysia()
    .get(
      "/companies/:companyId/goals",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

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
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const rows = await db.select().from(goals).where(eq(goals.id, ctx.params.id));
        if (rows.length === 0) {
          ctx.set.status = 404;
          return { error: "Not found" };
        }
        assertCompanyAccess(actor, rows[0].companyId);
        return rows[0];
      },
      { params: t.Object({ id: t.String() }) },
    );
}
