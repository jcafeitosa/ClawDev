/**
 * Type-safe API client using Eden Treaty.
 *
 * Eden Treaty generates a fully typed client from the Elysia app's
 * route definitions. All API calls are type-checked at compile time.
 *
 * Usage:
 *   import { api } from "$lib/api/client";
 *
 *   // Fully typed — autocomplete for all endpoints
 *   const { data } = await api.api.health.get();
 *   const { data: companies } = await api.api.companies.get();
 *   const { data: agent } = await api.api.agents({ id: "..." }).get();
 */

import { treaty } from "@elysiajs/eden";
import type { App } from "@clawdev/server/eden-treaty";

/** Base URL — derived from current window location or env var. */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // In browser: use same origin (SvelteKit SPA served by Elysia)
    return window.location.origin;
  }
  // SSR or build: use env var
  return import.meta.env.VITE_API_URL ?? "http://localhost:3100";
}

/**
 * Type-safe API client.
 *
 * All endpoints from the Elysia app are available with full TypeScript
 * autocompletion and type checking. Request/response types are inferred
 * from the server route definitions.
 *
 * @example
 *   const { data, error } = await api.api.health.get();
 *   if (error) throw error;
 *   console.log(data.version);
 */
export const api = treaty<App>(getBaseUrl(), {
  // Include credentials (cookies) for session-based auth
  fetch: {
    credentials: "include",
  },
});

/**
 * Helper to extract data or throw on error.
 */
export function unwrap<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) {
    const err = result.error as { value?: string; message?: string };
    throw new Error(err.value ?? err.message ?? "API error");
  }
  if (result.data === null) {
    throw new Error("No data returned");
  }
  return result.data;
}
