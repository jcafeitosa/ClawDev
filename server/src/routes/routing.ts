import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { companies, routingDecisions } from "@clawdev/db";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { TaskSignals } from "@clawdev/shared";
import { badRequest } from "../errors.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { authPlugin } from "../plugins/auth.js";
import {
  createModelRegistry,
  createRoutingResolver,
  createCircuitBreaker,
} from "../services/routing/index.js";

// ── Shared singletons ──────────────────────────────────────────────────────
// These mirror the instances used by the scheduler / failover executor
// so diagnostics reflect the actual live state.

const modelRegistry = createModelRegistry();
const circuitBreaker = createCircuitBreaker();
const routingResolver = createRoutingResolver({ modelRegistry, circuitBreaker });

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseIntQuery(raw: string | undefined, fallback: number, max: number): number {
  if (raw == null || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) throw badRequest(`invalid numeric query parameter`);
  return Math.min(n, max);
}

// ── Route module ────────────────────────────────────────────────────────────

export function routingRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>) {
  return new Elysia()
    .use(authPlugin)

    // ── List all available models with capabilities ─────────────────────
    .get("/companies/:companyId/routing/models", ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const models = modelRegistry.listModels();
      return { models };
    })

    // ── List models for a specific adapter ──────────────────────────────
    .get("/companies/:companyId/routing/models/:adapterType", ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const models = modelRegistry.listModels({ adapterType: params.adapterType });
      return { models };
    })

    // ── Dry-run: simulate routing without executing ─────────────────────
    .post("/companies/:companyId/routing/dry-run", async ({ params, body, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);

      const { taskSignals, agentId } = body as {
        taskSignals: TaskSignals;
        agentId?: string;
      };

      if (!taskSignals || typeof taskSignals.estimatedInputTokens !== "number") {
        throw badRequest("taskSignals.estimatedInputTokens is required");
      }
      if (!taskSignals.taskType) {
        throw badRequest("taskSignals.taskType is required");
      }

      // Fetch company routing status
      const [company] = await db
        .select({ routingEnabled: companies.routingEnabled })
        .from(companies)
        .where(eq(companies.id, params.companyId))
        .limit(1);

      if (!company) {
        throw badRequest("Company not found");
      }

      // Build a default routing policy for the dry-run
      const routingPolicy = {
        mode: "full_auto" as const,
        constraints: {},
        fallback: { adapterType: "claude_local", model: "claude-sonnet-4-6" },
      };

      const decision = routingResolver.resolve({
        routingPolicy,
        companyRoutingEnabled: company.routingEnabled,
        taskSignals,
        budgetMonthlyCents: 0, // no budget limit for dry-run
        spentMonthlyCents: 0,
      });

      return { decision, isDryRun: true };
    })

    // ── List recent routing decisions (with pagination) ─────────────────
    .get("/companies/:companyId/routing/decisions", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);

      const q = query as Record<string, string>;
      const limit = parseIntQuery(q.limit, 50, 200);
      const offset = parseIntQuery(q.offset, 0, 100_000);
      const agentId = q.agentId;

      const conditions = [eq(routingDecisions.companyId, params.companyId)];
      if (agentId) {
        conditions.push(eq(routingDecisions.agentId, agentId));
      }

      const whereClause = conditions.length === 1 ? conditions[0]! : and(...conditions)!;

      const [rows, [total]] = await Promise.all([
        db
          .select()
          .from(routingDecisions)
          .where(whereClause)
          .orderBy(desc(routingDecisions.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(routingDecisions)
          .where(whereClause),
      ]);

      return {
        decisions: rows,
        total: total?.count ?? 0,
        limit,
        offset,
      };
    })

    // ── Routing statistics ──────────────────────────────────────────────
    .get("/companies/:companyId/routing/stats", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);

      const whereCompany = eq(routingDecisions.companyId, params.companyId);

      const [summary] = await db
        .select({
          totalDecisions: count(),
          failoverCount: sql<number>`count(*) filter (where ${routingDecisions.isFailover} = true)`,
          avgComplexityScore: sql<number>`coalesce(avg(${routingDecisions.complexityScore}::numeric), 0)`,
        })
        .from(routingDecisions)
        .where(whereCompany);

      const modelDist = await db
        .select({
          model: routingDecisions.selectedModel,
          adapterType: routingDecisions.selectedAdapterType,
          count: count(),
        })
        .from(routingDecisions)
        .where(whereCompany)
        .groupBy(routingDecisions.selectedModel, routingDecisions.selectedAdapterType)
        .orderBy(desc(count()));

      const tierDist = await db
        .select({
          tier: routingDecisions.tier,
          count: count(),
        })
        .from(routingDecisions)
        .where(whereCompany)
        .groupBy(routingDecisions.tier)
        .orderBy(routingDecisions.tier);

      // Estimated savings: difference between using tier-1 for all vs actual cost
      const [costAgg] = await db
        .select({
          totalEstimatedCost: sql<number>`coalesce(sum(${routingDecisions.estimatedCostUsd}::numeric), 0)`,
          decisionCount: count(),
        })
        .from(routingDecisions)
        .where(whereCompany);

      // Rough estimate: if everything ran on tier-1 premium, average ~$0.075/1k output
      const avgTier1CostPerDecision = 0.05; // conservative estimate per decision in USD
      const tier1TotalEstimate = (costAgg?.decisionCount ?? 0) * avgTier1CostPerDecision;
      const actualTotal = Number(costAgg?.totalEstimatedCost ?? 0);
      const estimatedSavings = Math.max(0, Math.round((tier1TotalEstimate - actualTotal) * 100) / 100);

      return {
        totalDecisions: summary?.totalDecisions ?? 0,
        failoverCount: Number(summary?.failoverCount ?? 0),
        avgComplexityScore: Math.round(Number(summary?.avgComplexityScore ?? 0) * 100) / 100,
        modelDistribution: modelDist,
        tierDistribution: tierDist,
        estimatedSavings,
      };
    })

    // ── Circuit breaker state snapshot ───────────────────────────────────
    .get("/companies/:companyId/routing/circuit-breaker", ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);

      const snapshot = circuitBreaker.snapshot();
      const entries: Array<{
        key: string;
        state: string;
        tripCount: number;
        failureCount: number;
      }> = [];

      for (const [key, entry] of snapshot) {
        entries.push({
          key,
          state: entry.state,
          tripCount: entry.tripCount,
          failureCount: entry.failureCount,
        });
      }

      return { breakers: entries };
    })

    // ── Update company routing settings ─────────────────────────────────
    .patch("/companies/:companyId/routing/settings", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);

      const { routingEnabled } = body as { routingEnabled?: boolean };

      if (routingEnabled === undefined || typeof routingEnabled !== "boolean") {
        throw badRequest("routingEnabled (boolean) is required");
      }

      const [updated] = await db
        .update(companies)
        .set({ routingEnabled, updatedAt: new Date() })
        .where(eq(companies.id, params.companyId))
        .returning({
          id: companies.id,
          routingEnabled: companies.routingEnabled,
          updatedAt: companies.updatedAt,
        });

      if (!updated) {
        throw badRequest("Company not found");
      }

      return updated;
    });
}
