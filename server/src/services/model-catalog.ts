import { and, eq, sql, notInArray, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { modelCatalog } from "@clawdev/db";

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

      let added = 0;

      // Process in batches to avoid oversized statements
      const BATCH_SIZE = 100;
      for (let i = 0; i < models.length; i += BATCH_SIZE) {
        const batch = models.slice(i, i + BATCH_SIZE);

        const rows = batch.map((m) => ({
          adapterType: m.adapterType,
          modelId: m.modelId,
          label: m.label,
          provider: m.provider ?? "unknown",
          source: m.source ?? "adapter_probe",
          lastProbedAt: new Date(),
          // Clear deprecation if the model reappears in a probe
          deprecatedAt: null,
        }));

        const result = await db
          .insert(modelCatalog)
          .values(rows)
          .onConflictDoUpdate({
            target: [modelCatalog.adapterType, modelCatalog.modelId],
            set: {
              label: sql`excluded.label`,
              provider: sql`excluded.provider`,
              source: sql`excluded.source`,
              lastProbedAt: sql`excluded.last_probed_at`,
              deprecatedAt: sql`null`,
              updatedAt: sql`now()`,
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
