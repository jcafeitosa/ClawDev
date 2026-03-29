import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { badRequest, notFound } from "../errors.js";
import { providerService } from "../services/providers.js";
import { fetchAllQuotaWindows } from "../services/quota-windows.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { authPlugin } from "../plugins/auth.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseLimit(query: Record<string, string>): number {
  const raw = query.limit;
  if (raw == null || raw === "") return 50;
  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit <= 0 || limit > 500) {
    throw badRequest("invalid 'limit' value");
  }
  return limit;
}

// ---------------------------------------------------------------------------
// Route module
// ---------------------------------------------------------------------------

export function providerRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>) {
  const providers = providerService(db);

  return new Elysia()
    .use(authPlugin)

    // ── List all providers with consolidated status ──────────────────────
    .get("/companies/:companyId/providers", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const statuses = await providers.getConsolidatedStatus(params.companyId);
      return { providers: statuses };
    })

    // ── Get single provider detail ──────────────────────────────────────
    .get("/companies/:companyId/providers/:adapterType", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const statuses = await providers.getConsolidatedStatus(params.companyId);
      const found = statuses.find((s) => s.adapterType === params.adapterType);
      if (!found) {
        throw notFound(`Provider '${params.adapterType}' not found`);
      }
      return { provider: found };
    })

    // ── Create / update provider config ─────────────────────────────────
    .put("/companies/:companyId/providers/:adapterType", async ({ params, body, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);

      const {
        displayName,
        enabled,
        priority,
        authMethod,
        credentialSecretId,
        subscriptionPlan,
        subscriptionLimitMonthly,
        subscriptionResetsAt,
      } = body as {
        displayName?: string;
        enabled?: boolean;
        priority?: number;
        authMethod?: string;
        credentialSecretId?: string | null;
        subscriptionPlan?: string | null;
        subscriptionLimitMonthly?: number | null;
        subscriptionResetsAt?: string | null;
      };

      // Validate types when present
      if (displayName !== undefined && typeof displayName !== "string") {
        throw badRequest("displayName must be a string");
      }
      if (enabled !== undefined && typeof enabled !== "boolean") {
        throw badRequest("enabled must be a boolean");
      }
      if (priority !== undefined && (typeof priority !== "number" || !Number.isFinite(priority))) {
        throw badRequest("priority must be a finite number");
      }

      const config = await providers.upsertConfig(params.companyId, params.adapterType, {
        displayName,
        enabled,
        priority,
        authMethod,
        credentialSecretId,
        subscriptionPlan,
        subscriptionLimitMonthly,
        subscriptionResetsAt: subscriptionResetsAt ? new Date(subscriptionResetsAt) : subscriptionResetsAt === null ? null : undefined,
      });

      return { config };
    })

    // ── Delete provider config ──────────────────────────────────────────
    .delete("/companies/:companyId/providers/:adapterType", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);
      await providers.deleteConfig(params.companyId, params.adapterType);
      return { ok: true };
    })

    // ── Test connection ─────────────────────────────────────────────────
    .post("/companies/:companyId/providers/:adapterType/test", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);
      const result = await providers.testConnection(params.companyId, params.adapterType);
      return result;
    })

    // ── Refresh quota ───────────────────────────────────────────────────
    .post("/companies/:companyId/providers/:adapterType/refresh-quota", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);

      // Force-fetch quota windows (bypasses any cache by fetching from adapters)
      const allWindows = await fetchAllQuotaWindows();
      const adapterSlugMap: Record<string, string> = {
        claude_local: "anthropic",
        codex_local: "openai",
        copilot_local: "github",
        cursor: "cursor",
        gemini_local: "google",
        opencode_local: "opencode",
        openclaw_gateway: "openclaw",
        pi_local: "pi",
        hermes_local: "hermes",
      };
      const providerSlug = adapterSlugMap[params.adapterType] ?? params.adapterType;
      const matched = allWindows.find((w) => w.provider === providerSlug);

      if (!matched) {
        return { ok: false, error: "No quota data available for this provider", windows: [] };
      }

      return {
        ok: matched.ok,
        error: matched.error ?? null,
        windows: matched.windows,
        source: matched.source ?? null,
      };
    })

    // ── Reset circuit breaker ───────────────────────────────────────────
    .post("/companies/:companyId/providers/:adapterType/reset-breaker", async ({ params, body, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      assertBoard(actor);

      const { modelId } = (body ?? {}) as { modelId?: string };

      if (modelId) {
        // Reset a specific adapter:model breaker
        providers.circuitBreaker.reset(params.adapterType, modelId);
        return { ok: true, reset: `${params.adapterType}:${modelId}` };
      }

      // Reset all breakers for this adapter type
      const snapshot = providers.circuitBreaker.snapshot();
      let resetCount = 0;
      for (const key of snapshot.keys()) {
        if (key.startsWith(`${params.adapterType}:`)) {
          const [, model] = key.split(":");
          if (model) {
            providers.circuitBreaker.reset(params.adapterType, model);
            resetCount++;
          }
        }
      }

      return { ok: true, resetCount };
    })

    // ── Health history ──────────────────────────────────────────────────
    .get("/companies/:companyId/providers/:adapterType/health-history", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const q = query as Record<string, string>;
      const limit = parseLimit(q);
      const history = await providers.getHealthHistory(params.companyId, params.adapterType, limit);
      return { events: history };
    })

    // ── Agent usage map ─────────────────────────────────────────────────
    .get("/companies/:companyId/providers/agents-usage", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const usageMap = await providers.getAgentUsageMap(params.companyId);
      return { usage: usageMap };
    });
}
