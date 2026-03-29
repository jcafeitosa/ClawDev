/**
 * Dashboard routes — Elysia port.
 *
 * Provides aggregated dashboard data for companies.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { dashboardService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function dashboardRoutes(db: Db) {
  const svc = dashboardService(db);

  return new Elysia().get(
    "/companies/:companyId/dashboard",
    async ({ params }) => {
      const data = await svc.summary(params.companyId);
      return data;
    },
    { params: companyIdParam },
  );
}
