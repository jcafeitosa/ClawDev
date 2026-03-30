import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { companyModelPreferences, modelRoutingLog, modelCatalog } from "@clawdev/db";
import type { createProviderStatusService } from "./provider-status.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ModelResolution {
  adapterType: string;
  modelId: string;
  resolution: "pinned" | "default" | "fallback" | "routed" | "local_preferred";
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

  /**
   * Cost-optimized routing: pick the cheapest available model from the catalog.
   */
  async function cheapestAvailable(
    adapterType?: string,
  ): Promise<ModelResolution | null> {
    const availableModels = await providerStatus.getAvailableModels(adapterType);
    if (availableModels.length === 0) return null;

    // Build a set for quick lookup
    const availableSet = new Set(
      availableModels.map((m) => `${m.adapterType}::${m.modelId}`),
    );

    const conditions = adapterType
      ? [eq(modelCatalog.adapterType, adapterType)]
      : [];

    const catalogRows = await db
      .select({
        adapterType: modelCatalog.adapterType,
        modelId: modelCatalog.modelId,
        inputPriceMicro: modelCatalog.inputPriceMicro,
      })
      .from(modelCatalog)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(modelCatalog.inputPriceMicro);

    for (const row of catalogRows) {
      const key = `${row.adapterType}::${row.modelId}`;
      if (availableSet.has(key)) {
        return {
          adapterType: row.adapterType,
          modelId: row.modelId,
          resolution: "routed",
          fallbackDepth: 0,
          reason: `cost_optimized: cheapest available at ${row.inputPriceMicro} micro/input`,
        };
      }
    }

    return null;
  }

  /**
   * Local-preferred routing: try to find a local model first, then fall back
   * to cost-optimized.
   */
  async function localPreferred(
    adapterType?: string,
  ): Promise<ModelResolution | null> {
    const availableModels = await providerStatus.getAvailableModels(adapterType);
    const availableSet = new Set(
      availableModels.map((m) => `${m.adapterType}::${m.modelId}`),
    );

    const localConditions = [eq(modelCatalog.isLocal, true)];
    if (adapterType) {
      localConditions.push(eq(modelCatalog.adapterType, adapterType));
    }

    const localRows = await db
      .select({
        adapterType: modelCatalog.adapterType,
        modelId: modelCatalog.modelId,
      })
      .from(modelCatalog)
      .where(and(...localConditions))
      .orderBy(modelCatalog.inputPriceMicro);

    for (const row of localRows) {
      const key = `${row.adapterType}::${row.modelId}`;
      if (availableSet.has(key)) {
        return {
          adapterType: row.adapterType,
          modelId: row.modelId,
          resolution: "local_preferred",
          fallbackDepth: 0,
          reason: "local model available",
        };
      }
    }

    // Fall through to cost-optimized
    return cheapestAvailable(adapterType);
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
        // No routing configured — pass through the request as-is
        return {
          adapterType: requestedAdapterType,
          modelId: requestedModelId ?? "auto",
          resolution: "pinned",
          fallbackDepth: 0,
          reason: "no routing configured",
        };
      }

      const strategy = prefs.routingStrategy;
      const primaryAdapterType =
        requestedAdapterType || prefs.defaultAdapterType || requestedAdapterType;
      const primaryModelId =
        requestedModelId && requestedModelId !== "auto"
          ? requestedModelId
          : prefs.defaultModelId ?? undefined;

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
        const result = await cheapestAvailable(primaryAdapterType);
        if (result) return result;

        return {
          adapterType: primaryAdapterType,
          modelId: primaryModelId ?? "auto",
          resolution: "routed",
          fallbackDepth: 0,
          reason: "no available models found in catalog for cost_optimized strategy",
        };
      }

      if (strategy === "local_preferred") {
        const result = await localPreferred(primaryAdapterType);
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
