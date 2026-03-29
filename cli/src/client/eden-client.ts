/**
 * Eden Treaty client for CLI — type-safe API access.
 *
 * This wraps the Eden Treaty client with CLI-specific configuration:
 * - API key authentication (Bearer token)
 * - Base URL from config
 * - Error handling aligned with CLI error display
 *
 * Usage:
 *   import { createCliApiClient } from "./eden-client.js";
 *   const api = createCliApiClient({ apiBase: "http://localhost:3100", apiKey: "..." });
 *   const { data } = await api.api.health.get();
 */

import { treaty } from "@elysiajs/eden";
import type { App } from "@clawdev/server/eden-treaty";

export interface CliApiClientOptions {
  apiBase: string;
  apiKey?: string;
}

/**
 * Create a type-safe API client for CLI commands.
 *
 * Returns an Eden Treaty client with all routes typed from the server.
 */
export function createCliApiClient(opts: CliApiClientOptions) {
  const headers: Record<string, string> = {};
  if (opts.apiKey) {
    headers["authorization"] = `Bearer ${opts.apiKey}`;
  }

  return treaty<App>(opts.apiBase, {
    headers,
    fetch: {
      credentials: "omit", // CLI doesn't use cookies
    },
  });
}

/**
 * Helper — extract data or throw a CLI-friendly error.
 */
export function unwrapCli<T>(
  result: { data: T | null; error: unknown },
  context?: string,
): T {
  if (result.error) {
    const err = result.error as { value?: string; message?: string; status?: number };
    const status = err.status ?? "unknown";
    const message = err.value ?? err.message ?? "API error";
    const prefix = context ? `${context}: ` : "";
    throw new Error(`${prefix}HTTP ${status} — ${message}`);
  }
  if (result.data === null) {
    throw new Error(context ? `${context}: No data returned` : "No data returned");
  }
  return result.data;
}
