/**
 * Embedding service — manages vector embeddings for semantic search.
 *
 * Uses OpenAI text-embedding-3-small (1536 dimensions) to generate
 * embeddings, stored in PostgreSQL via pgvector extension.
 *
 * Supports:
 * - Embedding generation for issues, goals, activity logs
 * - Semantic similarity search (cosine distance)
 * - Batch embedding updates
 * - Command palette semantic search across all entity types
 */

import { sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "embeddings" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EmbeddableEntityType = "issue" | "goal" | "activity";

interface EmbeddingRecord {
  id: string;
  entityType: EmbeddableEntityType;
  entityId: string;
  content: string;
  model: string;
  createdAt: Date;
}

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

// ---------------------------------------------------------------------------
// OpenAI embedding provider
// ---------------------------------------------------------------------------

function createOpenAIEmbeddingProvider(apiKey: string): EmbeddingProvider {
  const model = "text-embedding-3-small";
  const dimensions = 1536;

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

      // Sort by index to match input order
      return data.data
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    },
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export function embeddingService(db: Db, openaiApiKey?: string) {
  const provider = openaiApiKey
    ? createOpenAIEmbeddingProvider(openaiApiKey)
    : null;

  return {
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
        log.warn("No embedding provider configured — skipping embedding");
        return;
      }

      const [embedding] = await provider.embed([content]);
      if (!embedding) return;

      const vectorStr = `[${embedding.join(",")}]`;

      await db.execute(sql`
        INSERT INTO embeddings (company_id, entity_type, entity_id, content, embedding, model)
        VALUES (${companyId}, ${entityType}, ${entityId}, ${content}, ${vectorStr}::vector, ${provider.model})
        ON CONFLICT (company_id, entity_type, entity_id)
          WHERE TRUE
        DO UPDATE SET
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          model = EXCLUDED.model,
          updated_at = NOW()
      `);
    },

    /**
     * Batch upsert embeddings for multiple entities.
     */
    async batchUpsert(
      companyId: string,
      items: Array<{ entityType: EmbeddableEntityType; entityId: string; content: string }>,
    ): Promise<void> {
      if (!provider || items.length === 0) return;

      // Batch embed (max 2048 inputs per API call)
      const batchSize = 256;
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const texts = batch.map((item) => item.content);
        const embeddings = await provider.embed(texts);

        // Insert all in a single transaction
        await db.transaction(async (tx) => {
          for (let j = 0; j < batch.length; j++) {
            const item = batch[j]!;
            const embedding = embeddings[j]!;
            const vectorStr = `[${embedding.join(",")}]`;

            await tx.execute(sql`
              INSERT INTO embeddings (company_id, entity_type, entity_id, content, embedding, model)
              VALUES (${companyId}, ${item.entityType}, ${item.entityId}, ${item.content}, ${vectorStr}::vector, ${provider.model})
              ON CONFLICT (company_id, entity_type, entity_id)
                WHERE TRUE
              DO UPDATE SET
                content = EXCLUDED.content,
                embedding = EXCLUDED.embedding,
                model = EXCLUDED.model,
                updated_at = NOW()
            `);
          }
        });

        log.info({ companyId, batch: i / batchSize + 1, count: batch.length }, "Batch embedded");
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

      // Build entity type filter
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
      const results = await this.search(companyId, issueContent, {
        entityTypes: ["issue"],
        limit: (opts?.limit ?? 5) + 1,
        minSimilarity: 0.7,
      });

      // Exclude the issue itself if provided
      return opts?.excludeIssueId
        ? results.filter((r) => r.entityId !== opts.excludeIssueId)
        : results;
    },

    /**
     * Command palette search — search across all entity types.
     */
    async commandPaletteSearch(
      companyId: string,
      query: string,
    ): Promise<SearchResult[]> {
      return this.search(companyId, query, {
        limit: 15,
        minSimilarity: 0.4,
      });
    },

    /**
     * Delete embedding for an entity.
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
          AND entity_id = ${entityId}
      `);
    },
  };
}
