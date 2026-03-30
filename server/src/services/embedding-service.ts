/**
 * Embedding service — manages vector embeddings for semantic search.
 *
 * Supports two provider backends:
 *
 * 1. **openai** — OpenAI text-embedding-3-small via api.openai.com
 *    Requires: OPENAI_API_KEY
 *
 * 2. **local** — Any OpenAI-compatible embedding endpoint (llama.cpp,
 *    Ollama, LM Studio, vLLM, etc.) running locally or on a LAN.
 *    Requires: EMBEDDING_BASE_URL (e.g. http://localhost:8080)
 *    Recommended models:
 *      - Qwen/Qwen3-Embedding (GGUF via llama.cpp)  — best quality local
 *      - nomic-embed-text (Ollama)                  — fast, good quality
 *      - mxbai-embed-large (Ollama)                 — high quality
 *      - all-minilm-l6-v2 (Ollama)                  — smallest/fastest
 *
 * All providers share the same pgvector table. The `embedding` column type
 * (vector dimension) must match EMBEDDING_DIMENSIONS (default: 1536).
 * Call `ensureEmbeddingDimensions()` at startup to auto-migrate the column
 * when the dimension changes (also rebuilds the HNSW index).
 */

import { sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "embeddings" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmbeddableEntityType = "issue" | "goal" | "activity";

export interface SearchResult {
  entityType: EmbeddableEntityType;
  entityId: string;
  content: string;
  similarity: number;
}

interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  readonly model: string;
  readonly dimensions: number;
}

import type { EmbeddingProviderConfig } from "@clawdev/shared";
export type { EmbeddingProviderConfig } from "@clawdev/shared";

// ---------------------------------------------------------------------------
// OpenAI provider
// ---------------------------------------------------------------------------

function createOpenAIEmbeddingProvider(
  apiKey: string,
  model = "text-embedding-3-small",
  dimensions = 1536,
): EmbeddingProvider {
  return {
    model,
    dimensions,
    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ input: texts, model, dimensions }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      return data.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    },
  };
}

// ---------------------------------------------------------------------------
// Local (OpenAI-compatible) provider — llama.cpp, Ollama, LM Studio, vLLM
// ---------------------------------------------------------------------------

function createLocalEmbeddingProvider(
  baseUrl: string,
  model: string,
  dimensions = 1536,
): EmbeddingProvider {
  // Normalise base URL — strip trailing slash
  const base = baseUrl.replace(/\/$/, "");
  const endpoint = `${base}/v1/embeddings`;

  return {
    model,
    dimensions,
    async embed(texts: string[]): Promise<number[][]> {
      const body: Record<string, unknown> = { input: texts, model };
      // Pass `dimensions` for Matryoshka-capable models (Qwen3-Embedding,
      // nomic-embed-text, mxbai-embed-large). Servers that don't support
      // it will silently ignore the field.
      body.dimensions = dimensions;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Local embedding API error ${response.status} (${endpoint}): ${text}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
      };

      if (!Array.isArray(data?.data)) {
        throw new Error(
          `Local embedding API returned unexpected shape from ${endpoint}. ` +
            `Expected { data: [{ embedding, index }] }, got: ${JSON.stringify(data).slice(0, 200)}`,
        );
      }

      const results = data.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);

      // Validate dimension of first result
      const firstDim = results[0]?.length;
      if (firstDim && firstDim !== dimensions) {
        log.warn(
          { expected: dimensions, actual: firstDim, model, endpoint },
          "Local embedding returned unexpected dimension. " +
            "Update EMBEDDING_DIMENSIONS and restart to match the model output. " +
            "Embeddings will be rejected by pgvector until the schema is updated.",
        );
      }

      return results;
    },
  };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

function buildProvider(config: EmbeddingProviderConfig): EmbeddingProvider | null {
  if (!config) return null;

  if (config.type === "openai") {
    return createOpenAIEmbeddingProvider(
      config.apiKey,
      config.model ?? "text-embedding-3-small",
      config.dimensions ?? 1536,
    );
  }

  if (config.type === "local") {
    return createLocalEmbeddingProvider(
      config.baseUrl,
      config.model,
      config.dimensions ?? 1536,
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Schema dimension management
// ---------------------------------------------------------------------------

/**
 * Ensure the `embeddings.embedding` column has the correct vector dimensions.
 *
 * Reads the current dimension from `pg_attribute` and, if it differs from the
 * configured dimension, automatically:
 *   1. Drops the HNSW index (required before ALTER)
 *   2. Truncates the table (old embeddings are incompatible with new dims)
 *   3. ALTERs the column type to `vector(newDims)`
 *   4. Recreates the HNSW index
 *
 * Safe to call on every startup — no-op when dimensions already match.
 */
export async function ensureEmbeddingDimensions(
  db: Db,
  desiredDimensions: number,
): Promise<{ migrated: boolean; previousDimensions: number | null }> {
  // Read current column definition from pg_attribute + pg_type
  const rows = await db.execute<{ atttypmod: number }>(sql`
    SELECT a.atttypmod
    FROM   pg_attribute a
    JOIN   pg_class     c ON c.oid = a.attrelid
    JOIN   pg_type      t ON t.oid = a.atttypid
    WHERE  c.relname = 'embeddings'
      AND  a.attname = 'embedding'
      AND  a.attnum  > 0
      AND  NOT a.attisdropped
  `);

  // pg_attribute.atttypmod for vector(N) is stored as (N + 4) in some builds,
  // but pgvector actually stores the raw dimension in the typmod.
  const row = (rows as any[])[0];
  if (!row) {
    // Table doesn't exist yet — TimescaleDB migrations haven't run
    log.debug("embeddings table not found — skipping dimension check");
    return { migrated: false, previousDimensions: null };
  }

  const atttypmod: number = Number(row.atttypmod);
  // pgvector encodes dims as typmod directly (no offset)
  const currentDimensions = atttypmod > 0 ? atttypmod : null;

  if (currentDimensions === desiredDimensions) {
    return { migrated: false, previousDimensions: currentDimensions };
  }

  log.warn(
    { currentDimensions, desiredDimensions },
    "Embedding dimension mismatch — migrating schema. All existing embeddings will be cleared.",
  );

  // Rebuild: drop index → truncate → alter column → recreate index
  await db.execute(sql`DROP INDEX IF EXISTS embeddings_vector_idx`);
  await db.execute(sql`TRUNCATE TABLE embeddings`);
  await db.execute(
    sql.raw(`ALTER TABLE embeddings ALTER COLUMN embedding TYPE vector(${desiredDimensions})`),
  );
  await db.execute(sql`
    CREATE INDEX embeddings_vector_idx ON embeddings
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
  `);

  log.info(
    { previousDimensions: currentDimensions, desiredDimensions },
    "Embedding schema migrated successfully",
  );

  return { migrated: true, previousDimensions: currentDimensions };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Create the embedding service.
 *
 * @param db      Drizzle DB instance
 * @param config  Provider config (null = disabled, returns empty results)
 */
export function embeddingService(db: Db, config: EmbeddingProviderConfig) {
  const provider = buildProvider(config);

  const svc = {
    /** Whether embeddings are enabled (provider configured). */
    get enabled() {
      return provider !== null;
    },

    /** Active provider name for logging / health checks. */
    get providerName(): string {
      if (!config) return "none";
      return config.type === "openai"
        ? `openai/${config.model ?? "text-embedding-3-small"}`
        : `local/${config.model}@${(config as any).baseUrl}`;
    },

    /**
     * Generate and store an embedding for an entity.
     */
    async upsert(
      companyId: string,
      entityType: EmbeddableEntityType,
      entityId: string,
      content: string,
    ): Promise<void> {
      if (!provider) {
        log.debug("No embedding provider configured — skipping upsert");
        return;
      }

      const [embedding] = await provider.embed([content]);
      if (!embedding) return;

      const vectorStr = `[${embedding.join(",")}]`;

      await db.execute(sql`
        INSERT INTO embeddings (company_id, entity_type, entity_id, content, embedding, model)
        VALUES (
          ${companyId}, ${entityType}, ${entityId}, ${content},
          ${vectorStr}::vector, ${provider.model}
        )
        ON CONFLICT ON CONSTRAINT embeddings_unique_entity
        DO UPDATE SET
          content    = EXCLUDED.content,
          embedding  = EXCLUDED.embedding,
          model      = EXCLUDED.model,
          updated_at = NOW()
      `);
    },

    /**
     * Batch upsert embeddings for multiple entities.
     * Sends up to 256 texts per API call.
     */
    async batchUpsert(
      companyId: string,
      items: Array<{ entityType: EmbeddableEntityType; entityId: string; content: string }>,
    ): Promise<void> {
      if (!provider || items.length === 0) return;

      const batchSize = 256;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const texts = batch.map((item) => item.content);
        const embeddings = await provider.embed(texts);

        await db.transaction(async (tx) => {
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j]!;
            const embedding = embeddings[j]!;
            const vectorStr = `[${embedding.join(",")}]`;

            await tx.execute(sql`
              INSERT INTO embeddings (company_id, entity_type, entity_id, content, embedding, model)
              VALUES (
                ${companyId}, ${item.entityType}, ${item.entityId}, ${item.content},
                ${vectorStr}::vector, ${provider.model}
              )
              ON CONFLICT ON CONSTRAINT embeddings_unique_entity
              DO UPDATE SET
                content    = EXCLUDED.content,
                embedding  = EXCLUDED.embedding,
                model      = EXCLUDED.model,
                updated_at = NOW()
            `);
          }
        });

        log.info(
          { companyId, batchIndex: i / batchSize + 1, count: batch.length },
          "Batch embedded",
        );
      }
    },

    /**
     * Semantic search — find similar entities using cosine distance.
     */
    async search(
      companyId: string,
      query: string,
      opts?: {
        entityTypes?: EmbeddableEntityType[];
        limit?: number;
        minSimilarity?: number;
      },
    ): Promise<SearchResult[]> {
      if (!provider) return [];

      const limit = opts?.limit ?? 10;
      const minSimilarity = opts?.minSimilarity ?? 0.5;
      const entityTypes = opts?.entityTypes;

      const [queryEmbedding] = await provider.embed([query]);
      if (!queryEmbedding) return [];

      const vectorStr = `[${queryEmbedding.join(",")}]`;

      const typeFilter = entityTypes?.length
        ? sql`AND entity_type = ANY(${entityTypes})`
        : sql``;

      const result = await db.execute<{
        entity_type: string;
        entity_id: string;
        content: string;
        similarity: string;
      }>(sql`
        SELECT
          entity_type,
          entity_id,
          content,
          (1 - (embedding <=> ${vectorStr}::vector))::text AS similarity
        FROM embeddings
        WHERE company_id = ${companyId}
          ${typeFilter}
          AND (1 - (embedding <=> ${vectorStr}::vector)) >= ${minSimilarity}
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `);

      return (result as any[]).map((row: any) => ({
        entityType: row.entity_type as EmbeddableEntityType,
        entityId: row.entity_id,
        content: row.content,
        similarity: Number(row.similarity),
      }));
    },

    /**
     * Find duplicate/similar issues for a company.
     */
    async findSimilarIssues(
      companyId: string,
      issueContent: string,
      opts?: { limit?: number; excludeIssueId?: string },
    ): Promise<SearchResult[]> {
      const results = await svc.search(companyId, issueContent, {
        entityTypes: ["issue"],
        limit: (opts?.limit ?? 5) + 1,
        minSimilarity: 0.7,
      });

      return opts?.excludeIssueId
        ? results.filter((r) => r.entityId !== opts.excludeIssueId)
        : results;
    },

    /**
     * Command palette semantic search across all entity types.
     */
    async commandPaletteSearch(
      companyId: string,
      query: string,
    ): Promise<SearchResult[]> {
      return svc.search(companyId, query, {
        limit: 15,
        minSimilarity: 0.4,
      });
    },

    /**
     * Delete embedding for a specific entity.
     */
    async delete(
      companyId: string,
      entityType: EmbeddableEntityType,
      entityId: string,
    ): Promise<void> {
      await db.execute(sql`
        DELETE FROM embeddings
        WHERE company_id = ${companyId}
          AND entity_type = ${entityType}
          AND entity_id   = ${entityId}
      `);
    },
  };

  return svc;
}

export type EmbeddingService = ReturnType<typeof embeddingService>;
