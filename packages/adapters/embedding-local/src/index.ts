/**
 * @clawdev/embedding-local
 *
 * Programmatic interface to the local llama.cpp embedding server.
 *
 * For CLI usage, see the scripts/ directory:
 *   pnpm setup   — download binary + model
 *   pnpm start   — start the server
 *   pnpm stop    — stop background server
 *
 * @example
 * ```ts
 * import { defaultConfig, buildEmbeddingConfig } from "@clawdev/embedding-local";
 *
 * // Use in ClawDev server/src/index.ts:
 * const embeddingConfig = buildEmbeddingConfig();
 * // → { type: "local", baseUrl: "http://localhost:8085", model: "Qwen3-Embedding-0.6B", dimensions: 1024 }
 * ```
 */

import type { EmbeddingProviderConfig } from "@clawdev/server/services/embedding-service.js";

// Re-export constants for consumers
export const LOCAL_EMBEDDING_DEFAULTS = {
  baseUrl: "http://localhost:8085",
  model: "Qwen3-Embedding-0.6B",
  dimensions: 1024,
  modelFile: "Qwen3-Embedding-0.6B-Q4_K_M.gguf",
} as const;

/**
 * Build an EmbeddingProviderConfig for the local llama.cpp server.
 *
 * Reads from environment variables, falls back to defaults.
 *
 * Env vars:
 *   EMBEDDING_BASE_URL   (default: http://localhost:8085)
 *   EMBEDDING_MODEL      (default: Qwen3-Embedding-0.6B)
 *   EMBEDDING_DIMENSIONS (default: 1024)
 */
export function buildLocalEmbeddingConfig(): {
  type: "local";
  baseUrl: string;
  model: string;
  dimensions: number;
} {
  return {
    type: "local",
    baseUrl: process.env.EMBEDDING_BASE_URL ?? LOCAL_EMBEDDING_DEFAULTS.baseUrl,
    model: process.env.EMBEDDING_MODEL ?? LOCAL_EMBEDDING_DEFAULTS.model,
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? String(LOCAL_EMBEDDING_DEFAULTS.dimensions), 10),
  };
}
