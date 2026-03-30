import { and, eq, sql, notInArray, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { modelCatalog } from "@clawdev/db";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Model metadata from seed data (loaded once, cached in memory)
// ---------------------------------------------------------------------------

interface ModelMetadataEntry {
  provider: string;
  family?: string;
  label?: string;
  tier?: string;
  capabilities?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPriceMicro?: number;
  outputPriceMicro?: number;
  cachedInputPriceMicro?: number;
  isFree?: boolean;
  isLocal?: boolean;
}

let _modelMetadataCache: Record<string, ModelMetadataEntry> | null = null;

function loadModelMetadata(): Record<string, ModelMetadataEntry> {
  if (_modelMetadataCache) return _modelMetadataCache;

  try {
    const require = createRequire(import.meta.url);
    const sharedPkgPath = require.resolve("@clawdev/shared/package.json");
    const sharedDir = dirname(sharedPkgPath);
    const metadataPath = join(sharedDir, "src", "model-metadata.json");
    const raw = readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(raw) as {
      models: Record<string, ModelMetadataEntry>;
    };
    _modelMetadataCache = parsed.models ?? {};
  } catch (err) {
    console.warn(
      "[model-catalog] Failed to load model-metadata.json, metadata enrichment disabled:",
      err instanceof Error ? err.message : String(err),
    );
    _modelMetadataCache = {};
  }

  return _modelMetadataCache;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A row from the model_catalog table. */
export type ModelCatalogEntry = typeof modelCatalog.$inferSelect;

export interface ModelCatalogFilters {
  adapterType?: string;
  provider?: string;
  tier?: string;
  capability?: string;
  isFree?: boolean;
  isLocal?: boolean;
  search?: string;
}

export interface ModelEnrichment {
  tier?: string;
  capabilities?: string[];
  contextWindow?: number;
  maxOutputTokens?: number;
  inputPriceMicro?: number;
  outputPriceMicro?: number;
  isFree?: boolean;
  freeQuotaDetail?: string;
  family?: string;
}

export interface SyncInput {
  adapterType: string;
  modelId: string;
  label: string;
  provider?: string;
  source?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export function createModelCatalogService(db: Db) {
  return {
    /**
     * Upsert models discovered from adapter probes into the catalog.
     * Uses the (adapterType, modelId) unique index for conflict resolution.
     */
    async syncFromAdapters(
      models: SyncInput[],
    ): Promise<{ added: number; updated: number }> {
      if (models.length === 0) return { added: 0, updated: 0 };

      const metadata = loadModelMetadata();
      let added = 0;

      // Process in batches to avoid oversized statements
      const BATCH_SIZE = 100;
      for (let i = 0; i < models.length; i += BATCH_SIZE) {
        const batch = models.slice(i, i + BATCH_SIZE);

        const rows = batch.map((m) => {
          const provider = m.provider ?? "unknown";
          const lookupKey = `${provider}/${m.modelId}`;
          const meta = metadata[lookupKey];

          const row: Record<string, unknown> = {
            adapterType: m.adapterType,
            modelId: m.modelId,
            label: m.label,
            provider,
            source: m.source ?? "adapter_probe",
            lastProbedAt: new Date(),
            // Clear deprecation if the model reappears in a probe
            deprecatedAt: null,
          };

          // Enrich with seed metadata when available
          if (meta) {
            if (meta.family !== undefined) row.family = meta.family;
            if (meta.tier !== undefined) row.tier = meta.tier;
            if (meta.capabilities !== undefined) row.capabilities = meta.capabilities;
            if (meta.contextWindow !== undefined) row.contextWindow = meta.contextWindow;
            if (meta.maxOutputTokens !== undefined) row.maxOutputTokens = meta.maxOutputTokens;
            if (meta.inputPriceMicro !== undefined) row.inputPriceMicro = meta.inputPriceMicro;
            if (meta.outputPriceMicro !== undefined) row.outputPriceMicro = meta.outputPriceMicro;
            if (meta.cachedInputPriceMicro !== undefined) row.cachedInputPriceMicro = meta.cachedInputPriceMicro;
            if (meta.isFree !== undefined) row.isFree = meta.isFree;
            if (meta.isLocal !== undefined) row.isLocal = meta.isLocal;
          }

          return row;
        });

        // Build the conflict update set. Metadata fields use COALESCE-style
        // logic: only overwrite when the existing row was NOT manually set
        // (source != 'manual'). This preserves manual overrides.
        const result = await db
          .insert(modelCatalog)
          .values(rows as any)
          .onConflictDoUpdate({
            target: [modelCatalog.adapterType, modelCatalog.modelId],
            set: {
              label: sql`excluded.label`,
              provider: sql`excluded.provider`,
              source: sql`excluded.source`,
              lastProbedAt: sql`excluded.last_probed_at`,
              deprecatedAt: sql`null`,
              updatedAt: sql`now()`,
              // Metadata fields: only update if the existing row is not manually overridden
              family: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.family} ELSE COALESCE(excluded.family, ${modelCatalog.family}) END`,
              tier: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.tier} ELSE COALESCE(excluded.tier, ${modelCatalog.tier}) END`,
              capabilities: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.capabilities} ELSE COALESCE(excluded.capabilities, ${modelCatalog.capabilities}) END`,
              contextWindow: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.contextWindow} ELSE COALESCE(excluded.context_window, ${modelCatalog.contextWindow}) END`,
              maxOutputTokens: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.maxOutputTokens} ELSE COALESCE(excluded.max_output_tokens, ${modelCatalog.maxOutputTokens}) END`,
              inputPriceMicro: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.inputPriceMicro} ELSE COALESCE(excluded.input_price_micro, ${modelCatalog.inputPriceMicro}) END`,
              outputPriceMicro: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.outputPriceMicro} ELSE COALESCE(excluded.output_price_micro, ${modelCatalog.outputPriceMicro}) END`,
              cachedInputPriceMicro: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.cachedInputPriceMicro} ELSE COALESCE(excluded.cached_input_price_micro, ${modelCatalog.cachedInputPriceMicro}) END`,
              isFree: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.isFree} ELSE COALESCE(excluded.is_free, ${modelCatalog.isFree}) END`,
              isLocal: sql`CASE WHEN ${modelCatalog.source} = 'manual' THEN ${modelCatalog.isLocal} ELSE COALESCE(excluded.is_local, ${modelCatalog.isLocal}) END`,
            },
          })
          .returning({ id: modelCatalog.id });

        added += result.length;
      }

      // The count is total upserted rows (inserts + updates combined).
      // We cannot perfectly distinguish the two from onConflictDoUpdate,
      // so updated is reported as 0 and added holds the total synced count.
      return { added, updated: 0 };
    },

    /**
     * List models with optional filters. Supports filtering by adapter type,
     * provider, tier, capability (JSON array containment), free/local flags,
     * and free-text search across modelId and label.
     */
    async listModels(filters?: ModelCatalogFilters): Promise<ModelCatalogEntry[]> {
      const conditions: ReturnType<typeof eq>[] = [];

      if (filters?.adapterType) {
        conditions.push(eq(modelCatalog.adapterType, filters.adapterType));
      }
      if (filters?.provider) {
        conditions.push(eq(modelCatalog.provider, filters.provider));
      }
      if (filters?.tier) {
        conditions.push(eq(modelCatalog.tier, filters.tier));
      }
      if (filters?.capability) {
        // capabilities is stored as a jsonb array; use @> containment
        conditions.push(
          sql`${modelCatalog.capabilities}::jsonb @> ${JSON.stringify([filters.capability])}::jsonb` as any,
        );
      }
      if (filters?.isFree !== undefined) {
        conditions.push(eq(modelCatalog.isFree, filters.isFree));
      }
      if (filters?.isLocal !== undefined) {
        conditions.push(eq(modelCatalog.isLocal, filters.isLocal));
      }
      if (filters?.search) {
        const pattern = `%${filters.search}%`;
        conditions.push(
          sql`(${modelCatalog.modelId} ilike ${pattern} or ${modelCatalog.label} ilike ${pattern})` as any,
        );
      }

      const query = db.select().from(modelCatalog);
      if (conditions.length > 0) {
        return (query as any).where(and(...conditions));
      }
      return query;
    },

    /**
     * Get a single model by its composite key (adapterType + modelId).
     */
    async getModel(
      adapterType: string,
      modelId: string,
    ): Promise<ModelCatalogEntry | null> {
      const rows = await db
        .select()
        .from(modelCatalog)
        .where(
          and(
            eq(modelCatalog.adapterType, adapterType),
            eq(modelCatalog.modelId, modelId),
          ),
        );
      return rows[0] ?? null;
    },

    /**
     * Manually enrich a catalog entry with metadata that cannot be
     * auto-discovered (pricing, tier, capabilities, context window, etc.).
     */
    async enrichModel(
      adapterType: string,
      modelId: string,
      metadata: ModelEnrichment,
    ): Promise<ModelCatalogEntry> {
      const setClauses: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (metadata.tier !== undefined) setClauses.tier = metadata.tier;
      if (metadata.capabilities !== undefined) {
        setClauses.capabilities = metadata.capabilities;
      }
      if (metadata.contextWindow !== undefined) setClauses.contextWindow = metadata.contextWindow;
      if (metadata.maxOutputTokens !== undefined) setClauses.maxOutputTokens = metadata.maxOutputTokens;
      if (metadata.inputPriceMicro !== undefined) setClauses.inputPriceMicro = metadata.inputPriceMicro;
      if (metadata.outputPriceMicro !== undefined) setClauses.outputPriceMicro = metadata.outputPriceMicro;
      if (metadata.isFree !== undefined) setClauses.isFree = metadata.isFree;
      if (metadata.freeQuotaDetail !== undefined) setClauses.freeQuotaDetail = metadata.freeQuotaDetail;
      if (metadata.family !== undefined) setClauses.family = metadata.family;

      const rows = await db
        .update(modelCatalog)
        .set(setClauses as any)
        .where(
          and(
            eq(modelCatalog.adapterType, adapterType),
            eq(modelCatalog.modelId, modelId),
          ),
        )
        .returning();

      const row = rows[0];
      if (!row) {
        throw new Error(
          `Model not found in catalog: ${adapterType}/${modelId}`,
        );
      }
      return row;
    },

    /**
     * Mark models that were not seen in the latest probe as potentially
     * deprecated. Sets deprecatedAt on stale rows so the UI can flag them.
     * Returns the number of models marked stale.
     */
    async markStaleModels(
      adapterType: string,
      freshModelIds: string[],
    ): Promise<number> {
      const now = new Date();

      if (freshModelIds.length === 0) {
        // If no fresh models, mark ALL non-deprecated models for this adapter
        const result = await db
          .update(modelCatalog)
          .set({ deprecatedAt: now, updatedAt: now })
          .where(
            and(
              eq(modelCatalog.adapterType, adapterType),
              isNull(modelCatalog.deprecatedAt),
            ),
          )
          .returning({ id: modelCatalog.id });
        return result.length;
      }

      const result = await db
        .update(modelCatalog)
        .set({ deprecatedAt: now, updatedAt: now })
        .where(
          and(
            eq(modelCatalog.adapterType, adapterType),
            notInArray(modelCatalog.modelId, freshModelIds),
            isNull(modelCatalog.deprecatedAt),
          ),
        )
        .returning({ id: modelCatalog.id });

      return result.length;
    },
  };
}
