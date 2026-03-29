/**
 * Budget routes — Elysia.
 *
 * Exposes budget overview, policies, and incidents for a company.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { budgetService } from "../services/budgets.js";
import { companyIdParam } from "../middleware/index.js";

export function budgetRoutes(db: Db) {
  const svc = budgetService(db);

  return new Elysia()

    // ── GET /companies/:id/budgets/overview ─────────────────────────
    .get(
      "/companies/:companyId/budgets/overview",
      async ({ params }) => {
        const overview = await svc.overview(params.companyId);
        return overview;
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/budgets/policies ─────────────────────────
    .get(
      "/companies/:companyId/budgets/policies",
      async ({ params }) => {
        const policies = await svc.listPolicies(params.companyId);
        return { policies };
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/budgets ───────────────────────────────────
    // Alias: redirect to overview
    .get(
      "/companies/:companyId/budgets",
      async ({ params }) => {
        const overview = await svc.overview(params.companyId);
        return overview;
      },
      { params: companyIdParam },
    );
}
