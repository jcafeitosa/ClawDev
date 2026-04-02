import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import {
  companyModelPreferences,
  modelRoutingLog,
  modelCatalog,
  providerModelStatus,
} from "@clawdev/db";
import type { createProviderStatusService } from "./provider-status.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ModelResolution {
  adapterType: string;
  modelId: string;
  resolution:
    | "pinned"
    | "default"
    | "fallback"
    | "routed"
    | "local_preferred"
    | "performance_optimized"
    | "availability_optimized";
  fallbackDepth: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Internal cache for company preferences
// ---------------------------------------------------------------------------

interface CachedPreferences {
  data: typeof companyModelPreferences.$inferSelect | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000;

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function createModelRouterService(
  db: Db,
  providerStatus: ReturnType<typeof createProviderStatusService>,
) {
  const preferencesCache = new Map<string, CachedPreferences>();

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  async function loadPreferences(companyId: string) {
    const now = Date.now();
    const cached = preferencesCache.get(companyId);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    const rows = await db
      .select()
      .from(companyModelPreferences)
      .where(eq(companyModelPreferences.companyId, companyId))
      .limit(1);

    const data = rows[0] ?? null;
    preferencesCache.set(companyId, { data, fetchedAt: now });
    return data;
  }

  /**
   * Walk a fallback chain and return the first available model.
   * When `allowCrossProvider` is false, only models whose adapterType matches
   * `primaryAdapterType` are considered.
   */
  async function walkFallbackChain(
    chain: { adapterType: string; modelId: string }[],
    primaryAdapterType: string,
    allowCrossProvider: boolean,
  ): Promise<{ entry: { adapterType: string; modelId: string }; depth: number } | null> {
    for (let i = 0; i < chain.length; i++) {
      const entry = chain[i]!;
      if (!allowCrossProvider && entry.adapterType !== primaryAdapterType) {
        continue;
      }
      const available = await providerStatus.isAvailable(entry.adapterType, entry.modelId);
      if (available) {
        return { entry, depth: i + 1 };
      }
    }
    return null;
  }

  type CandidateModel = {
    adapterType: string;
    modelId: string;
    inputPriceMicro: number | null;
    avgLatencyMs: number | null;
    consecutiveFailures: number;
    isFree: boolean;
    isLocal: boolean;
  };

  async function loadAvailableCandidates(adapterType?: string): Promise<CandidateModel[]> {
    const catalogConditions = adapterType ? [eq(modelCatalog.adapterType, adapterType)] : [];
    const catalogRows = await db
      .select({
        adapterType: modelCatalog.adapterType,
        modelId: modelCatalog.modelId,
        inputPriceMicro: modelCatalog.inputPriceMicro,
        isFree: modelCatalog.isFree,
        isLocal: modelCatalog.isLocal,
      })
      .from(modelCatalog)
      .where(catalogConditions.length > 0 ? and(...catalogConditions) : undefined);

    const statusConditions = adapterType ? [eq(providerModelStatus.adapterType, adapterType)] : [];
    const statusRows = await db
      .select({
        adapterType: providerModelStatus.adapterType,
        modelId: providerModelStatus.modelId,
        avgLatencyMs: providerModelStatus.avgLatencyMs,
        consecutiveFailures: providerModelStatus.consecutiveFailures,
      })
      .from(providerModelStatus)
      .where(statusConditions.length > 0 ? and(...statusConditions) : undefined);

    const statusMap = new Map(
      statusRows.map((row) => [`${row.adapterType}::${row.modelId}`, row] as const),
    );

    const candidates: CandidateModel[] = [];
    for (const row of catalogRows) {
      if (!(await providerStatus.isAvailable(row.adapterType, row.modelId))) {
        continue;
      }
      const status = statusMap.get(`${row.adapterType}::${row.modelId}`);
      candidates.push({
        adapterType: row.adapterType,
        modelId: row.modelId,
        inputPriceMicro: row.inputPriceMicro ?? null,
        avgLatencyMs: status?.avgLatencyMs ?? null,
        consecutiveFailures: status?.consecutiveFailures ?? 0,
        isFree: Boolean(row.isFree),
        isLocal: Boolean(row.isLocal),
      });
    }

    return candidates;
  }

  function chooseCheapest(candidates: CandidateModel[], preferFreeModels: boolean): CandidateModel | null {
    const pool = preferFreeModels ? candidates.filter((candidate) => candidate.isFree) : candidates;
    const effective = pool.length > 0 ? pool : candidates;
    if (effective.length === 0) return null;
    return [...effective].sort((a, b) => {
      const priceA = a.inputPriceMicro ?? Number.MAX_SAFE_INTEGER;
      const priceB = b.inputPriceMicro ?? Number.MAX_SAFE_INTEGER;
      if (priceA !== priceB) return priceA - priceB;
      const failuresA = a.consecutiveFailures ?? 0;
      const failuresB = b.consecutiveFailures ?? 0;
      if (failuresA !== failuresB) return failuresA - failuresB;
      const latencyA = a.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      const latencyB = b.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      if (latencyA !== latencyB) return latencyA - latencyB;
      return a.modelId.localeCompare(b.modelId);
    })[0]!;
  }

  function chooseFastest(candidates: CandidateModel[]): CandidateModel | null {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const latencyA = a.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      const latencyB = b.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      if (latencyA !== latencyB) return latencyA - latencyB;
      const priceA = a.inputPriceMicro ?? Number.MAX_SAFE_INTEGER;
      const priceB = b.inputPriceMicro ?? Number.MAX_SAFE_INTEGER;
      if (priceA !== priceB) return priceA - priceB;
      const failuresA = a.consecutiveFailures ?? 0;
      const failuresB = b.consecutiveFailures ?? 0;
      if (failuresA !== failuresB) return failuresA - failuresB;
      return a.modelId.localeCompare(b.modelId);
    })[0]!;
  }

  function chooseMostAvailable(candidates: CandidateModel[]): CandidateModel | null {
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => {
      const failuresA = a.consecutiveFailures ?? 0;
      const failuresB = b.consecutiveFailures ?? 0;
      if (failuresA !== failuresB) return failuresA - failuresB;
      const latencyA = a.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      const latencyB = b.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      if (latencyA !== latencyB) return latencyA - latencyB;
      const priceA = a.inputPriceMicro ?? Number.MAX_SAFE_INTEGER;
      const priceB = b.inputPriceMicro ?? Number.MAX_SAFE_INTEGER;
      if (priceA !== priceB) return priceA - priceB;
      return a.modelId.localeCompare(b.modelId);
    })[0]!;
  }

  /**
   * Cost-optimized routing: pick the cheapest available model from the catalog.
   */
  async function cheapestAvailable(
    adapterType?: string,
    preferFreeModels = false,
  ): Promise<ModelResolution | null> {
    const candidates = await loadAvailableCandidates(adapterType);
    const selected = chooseCheapest(candidates, preferFreeModels);
    if (!selected) return null;

    return {
      adapterType: selected.adapterType,
      modelId: selected.modelId,
      resolution: "routed",
      fallbackDepth: 0,
      reason: preferFreeModels
        ? "prefer_free_models: cheapest available free model selected"
        : `cost_optimized: cheapest available at ${selected.inputPriceMicro ?? "unknown"} micro/input`,
    };
  }

  /**
   * Local-preferred routing: try to find a local model first, then fall back
   * to cost-optimized.
   */
  async function localPreferred(
    adapterType?: string,
  ): Promise<ModelResolution | null> {
    const candidates = await loadAvailableCandidates(adapterType);
    const localCandidates = candidates.filter((candidate) => candidate.isLocal);
    const selected = chooseCheapest(localCandidates.length > 0 ? localCandidates : candidates, false);
    if (!selected) return null;
    return {
      adapterType: selected.adapterType,
      modelId: selected.modelId,
      resolution: "local_preferred",
      fallbackDepth: 0,
      reason: selected.isLocal ? "local model available" : "no local model available; cost optimized fallback",
    };
  }

  async function fastestAvailable(
    adapterType?: string,
  ): Promise<ModelResolution | null> {
    const candidates = await loadAvailableCandidates(adapterType);
    const selected = chooseFastest(candidates);
    if (!selected) return null;
    return {
      adapterType: selected.adapterType,
      modelId: selected.modelId,
      resolution: "performance_optimized",
      fallbackDepth: 0,
      reason: `performance_optimized: fastest available at ${selected.avgLatencyMs ?? "unknown"} ms`,
    };
  }

  async function mostAvailable(
    adapterType?: string,
  ): Promise<ModelResolution | null> {
    const candidates = await loadAvailableCandidates(adapterType);
    const selected = chooseMostAvailable(candidates);
    if (!selected) return null;
    return {
      adapterType: selected.adapterType,
      modelId: selected.modelId,
      resolution: "availability_optimized",
      fallbackDepth: 0,
      reason: `availability_optimized: lowest failure rate (${selected.consecutiveFailures} failures)`,
    };
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  return {
    /**
     * Main routing entry point.
     *
     * Algorithm:
     * 1. If a specific model is requested (not "auto"), check availability
     *    and return pinned or enter fallback.
     * 2. Load company model preferences; if none, pass through as-is.
     * 3. Apply strategy: pinned (with fallback), cost_optimized, or local_preferred.
     */
    async resolveModel(
      companyId: string,
      agentId: string,
      requestedAdapterType: string,
      requestedModelId?: string,
    ): Promise<ModelResolution> {
      // ---- Step 1: explicit model pin ----
      if (requestedModelId && requestedModelId !== "auto") {
        const available = await providerStatus.isAvailable(
          requestedAdapterType,
          requestedModelId,
        );
        if (available) {
          return {
            adapterType: requestedAdapterType,
            modelId: requestedModelId,
            resolution: "pinned",
            fallbackDepth: 0,
            reason: "requested model is available",
          };
        }
        // Pinned model unavailable — load preferences for fallback
      }

      // ---- Step 2: load company preferences ----
      const prefs = await loadPreferences(companyId);

      if (!prefs) {
        if (requestedModelId && requestedModelId !== "auto") {
          const available = await providerStatus.isAvailable(
            requestedAdapterType,
            requestedModelId,
          );
          if (available) {
            return {
              adapterType: requestedAdapterType,
              modelId: requestedModelId,
              resolution: "pinned",
              fallbackDepth: 0,
              reason: "requested model is available",
            };
          }
        }

        const fallback = await cheapestAvailable(undefined, false);
        if (fallback) {
          return {
            ...fallback,
            reason: "no routing configured; selected best available model across providers",
          };
        }

        // No routing configured and no catalog candidates — pass through the request as-is
        return {
          adapterType: requestedAdapterType,
          modelId: requestedModelId ?? "auto",
          resolution: "pinned",
          fallbackDepth: 0,
          reason: "no routing configured",
        };
      }

      const strategy = prefs.routingStrategy;
      const primaryAdapterType = prefs.defaultAdapterType ?? requestedAdapterType;
      const routingAdapterType = prefs.defaultAdapterType ?? undefined;
      const primaryModelId =
        requestedModelId && requestedModelId !== "auto"
          ? requestedModelId
          : prefs.defaultModelId ?? undefined;
      const preferLocalModels = Boolean(prefs.preferLocalModels);
      const preferFreeModels = Boolean(prefs.preferFreeModels);

      // ---- Step 3: strategy dispatch ----

      if (strategy === "pinned") {
        // Try the primary model first (if we haven't already above)
        if (primaryModelId) {
          const primaryAvailable = await providerStatus.isAvailable(
            primaryAdapterType,
            primaryModelId,
          );
          if (primaryAvailable) {
            return {
              adapterType: primaryAdapterType,
              modelId: primaryModelId,
              resolution: "default",
              fallbackDepth: 0,
              reason: "default model is available",
            };
          }
        }

        // Walk the fallback chain
        const chain = (prefs.fallbackChain ?? []) as {
          adapterType: string;
          modelId: string;
        }[];
        const fallbackResult = await walkFallbackChain(
          chain,
          primaryAdapterType,
          prefs.allowCrossProviderFallback,
        );

        if (fallbackResult) {
          return {
            adapterType: fallbackResult.entry.adapterType,
            modelId: fallbackResult.entry.modelId,
            resolution: "fallback",
            fallbackDepth: fallbackResult.depth,
            reason: `fallback chain entry ${fallbackResult.depth}`,
          };
        }

        // Nothing in chain was available
          return {
            adapterType: primaryAdapterType,
            modelId: primaryModelId ?? "auto",
            resolution: "pinned",
            fallbackDepth: 0,
            reason: "all fallback options exhausted; using primary as last resort",
          };
        }

      if (strategy === "cost_optimized") {
        if (preferLocalModels) {
          const localResult = await localPreferred(routingAdapterType);
          if (localResult) return localResult;
        }
        const result = await cheapestAvailable(routingAdapterType, preferFreeModels);
        if (result) return result;

        return {
          adapterType: primaryAdapterType,
          modelId: primaryModelId ?? "auto",
          resolution: "routed",
          fallbackDepth: 0,
          reason: "no available models found in catalog for cost_optimized strategy",
        };
      }

      if (strategy === "performance_optimized") {
        if (preferLocalModels) {
          const localResult = await localPreferred(routingAdapterType);
          if (localResult) return localResult;
        }
        const result = await fastestAvailable(routingAdapterType);
        if (result) return result;

        return {
          adapterType: primaryAdapterType,
          modelId: primaryModelId ?? "auto",
          resolution: "performance_optimized",
          fallbackDepth: 0,
          reason: "no available models found in catalog for performance_optimized strategy",
        };
      }

      if (strategy === "availability_optimized") {
        if (preferLocalModels) {
          const localResult = await localPreferred(routingAdapterType);
          if (localResult) return localResult;
        }
        const result = await mostAvailable(routingAdapterType);
        if (result) return result;

        return {
          adapterType: primaryAdapterType,
          modelId: primaryModelId ?? "auto",
          resolution: "availability_optimized",
          fallbackDepth: 0,
          reason: "no available models found in catalog for availability_optimized strategy",
        };
      }

      if (strategy === "local_preferred") {
        const result = await localPreferred(routingAdapterType);
        if (result) return result;

        return {
          adapterType: primaryAdapterType,
          modelId: primaryModelId ?? "auto",
          resolution: "local_preferred",
          fallbackDepth: 0,
          reason: "no local or cost-optimized models available",
        };
      }

      // Unknown strategy — pass through
      return {
        adapterType: requestedAdapterType,
        modelId: requestedModelId ?? "auto",
        resolution: "pinned",
        fallbackDepth: 0,
        reason: `unknown routing strategy "${strategy}"; falling through`,
      };
    },

    /**
     * Persist a routing decision to the model_routing_log table.
     */
    async logRoutingDecision(
      companyId: string,
      agentId: string,
      heartbeatRunId: string | null,
      requested: { adapterType: string; modelId?: string },
      resolved: ModelResolution,
    ): Promise<void> {
      await db.insert(modelRoutingLog).values({
        companyId,
        agentId,
        heartbeatRunId,
        requestedAdapterType: requested.adapterType,
        requestedModelId: requested.modelId ?? null,
        resolvedAdapterType: resolved.adapterType,
        resolvedModelId: resolved.modelId,
        resolution: resolved.resolution,
        fallbackDepth: resolved.fallbackDepth,
        reason: resolved.reason,
        occurredAt: new Date(),
      });
    },

    /**
     * Retrieve recent routing log entries for a company, with optional filters.
     */
    async getRoutingLog(
      companyId: string,
      options?: { agentId?: string; from?: Date; to?: Date; limit?: number },
    ) {
      const conditions = [eq(modelRoutingLog.companyId, companyId)];
      if (options?.agentId) {
        conditions.push(eq(modelRoutingLog.agentId, options.agentId));
      }
      if (options?.from) {
        conditions.push(gte(modelRoutingLog.occurredAt, options.from));
      }
      if (options?.to) {
        conditions.push(lte(modelRoutingLog.occurredAt, options.to));
      }

      return db
        .select()
        .from(modelRoutingLog)
        .where(and(...conditions))
        .orderBy(desc(modelRoutingLog.occurredAt))
        .limit(options?.limit ?? 100);
    },
  };
}
