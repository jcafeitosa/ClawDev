/**
 * Dashboard routes — Elysia port.
 *
 * Provides aggregated dashboard data for companies.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { dashboardService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { logger } from "../middleware/logger.js";

export function dashboardRoutes(db: Db) {
  const svc = dashboardService(db);

  return new Elysia().get(
    "/companies/:companyId/dashboard",
    async (ctx: any) => {
      try {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const data = await svc.summary(params.companyId);
        return data;
      } catch (error) {
        logger.error({ error, companyId: ctx.params?.companyId }, "Error in GET /companies/:companyId/dashboard");
        throw error;
      }
    },
    { params: companyIdParam },
  );
}
