/**
 * Semantic search routes — Elysia port.
 *
 * Provides pgvector-backed semantic search across issues, goals, and activities.
 * Used by the command palette and duplicate detection.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { embeddingService } from "../services/embedding-service.js";
import { companyIdParam } from "../middleware/index.js";

export function searchRoutes(db: Db, openaiApiKey?: string) {
  const embeddings = embeddingService(db, openaiApiKey);

  return new Elysia({ prefix: "/search" })
    // Command palette semantic search
    .get(
      "/companies/:companyId/semantic",
      async ({ params, query }) => {
        const q = query.q as string;
        if (!q || q.trim().length === 0) {
          return { results: [] };
        }

        const results = await embeddings.commandPaletteSearch(params.companyId, q);
        return { results };
      },
      { params: companyIdParam },
    )

    // Find similar issues (duplicate detection)
    .post(
      "/companies/:companyId/similar-issues",
      async ({ params, body }) => {
        const results = await embeddings.findSimilarIssues(
          params.companyId,
          body.content,
          {
            limit: body.limit,
            excludeIssueId: body.excludeIssueId,
          },
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
