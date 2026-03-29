/**
 * Cost tracking routes — Elysia port.
 *
 * Provides LLM cost tracking per agent, company, and time period.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { costService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function costRoutes(db: Db) {
  const svc = costService(db);

  return new Elysia()
    // Company cost summary
    .get(
      "/companies/:companyId/costs",
      async ({ params, query }) => {
        const from = query.from ? new Date(query.from as string) : undefined;
        const to = query.to ? new Date(query.to as string) : undefined;
        const costs = await svc.getCompanyCosts(params.companyId, { from, to });
        return costs;
      },
      { params: companyIdParam },
    )

    // Agent cost breakdown
    .get(
      "/companies/:companyId/costs/by-agent",
      async ({ params, query }) => {
        const from = query.from ? new Date(query.from as string) : undefined;
        const to = query.to ? new Date(query.to as string) : undefined;
        const breakdown = await svc.getCostsByAgent(params.companyId, { from, to });
        return breakdown;
      },
      { params: companyIdParam },
    )

    // Daily cost trend
    .get(
      "/companies/:companyId/costs/daily",
      async ({ params, query }) => {
        const days = Number(query.days) || 30;
        const trend = await svc.getDailyTrend(params.companyId, days);
        return trend;
      },
      { params: companyIdParam },
    );
}
