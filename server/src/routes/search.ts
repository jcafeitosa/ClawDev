/**
 * Semantic search routes — Elysia port.
 *
 * Provides pgvector-backed semantic search across issues, goals, and activities.
 * Used by the command palette and duplicate detection.
 *
 * Provider is configured via EmbeddingProviderConfig (openai | local).
 * When config is null the routes return empty results gracefully.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { embeddingService, type EmbeddingProviderConfig } from "../services/embedding-service.js";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";

export function searchRoutes(db: Db, embeddingConfig: EmbeddingProviderConfig = null) {
  const embeddings = embeddingService(db, embeddingConfig);

  return new Elysia({ prefix: "/search" })
    // Command palette semantic search
    .get(
      "/companies/:companyId/semantic",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const q = query.q as string;
        if (!q || q.trim().length === 0) return { results: [] };
        const results = await embeddings.commandPaletteSearch(params.companyId, q);
        return { results };
      },
      { params: companyIdParam },
    )

    // Find similar issues (duplicate detection)
    .post(
      "/companies/:companyId/similar-issues",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const results = await embeddings.findSimilarIssues(
          params.companyId,
          body.content,
          { limit: body.limit, excludeIssueId: body.excludeIssueId },
        );
        return { results };
      },
      {
        params: companyIdParam,
        body: t.Object({
          content: t.String({ minLength: 1 }),
          limit: t.Optional(t.Number({ minimum: 1, maximum: 20 })),
          excludeIssueId: t.Optional(t.String()),
        }),
      },
    );
}
