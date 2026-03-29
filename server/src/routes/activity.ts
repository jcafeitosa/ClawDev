/**
 * Activity routes — Elysia port.
 *
 * Provides activity feed for companies.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { activityLogs } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam, paginationQuery } from "../middleware/index.js";

export function activityRoutes(db: Db) {
  return new Elysia()
    .get(
      "/companies/:companyId/activity",
      async ({ params, query }) => {
        const limit = Number(query.limit) || 50;
        const offset = ((Number(query.page) || 1) - 1) * limit;

        const rows = await db
          .select()
          .from(activityLogs)
          .where(eq(activityLogs.companyId, params.companyId))
          .orderBy(desc(activityLogs.createdAt))
          .limit(limit)
          .offset(offset);

        return { activities: rows };
      },
      { params: companyIdParam },
    );
}
