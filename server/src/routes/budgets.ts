/**
 * Budget routes — Elysia.
 *
 * Exposes budget overview, policies, and incidents for a company.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { budgetService } from "../services/budgets.js";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";

export function budgetRoutes(db: Db) {
  const svc = budgetService(db);

  return new Elysia()

    // ── GET /companies/:id/budgets/overview ─────────────────────────
    .get(
      "/companies/:companyId/budgets/overview",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const overview = await svc.overview(params.companyId);
        return overview;
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/budgets/policies ─────────────────────────
    .get(
      "/companies/:companyId/budgets/policies",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const policies = await svc.listPolicies(params.companyId);
        return { policies };
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/budgets ───────────────────────────────────
    // Alias: redirect to overview
    .get(
      "/companies/:companyId/budgets",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const overview = await svc.overview(params.companyId);
        return overview;
      },
      { params: companyIdParam },
    );
}
