/**
 * Eden Treaty type-safe API client export.
 *
 * Eden Treaty generates a fully typed client from the Elysia app's
 * route definitions. Frontend code imports this type and creates a
 * client that has autocompletion for all API endpoints.
 *
 * Usage in svelte-ui:
 *   import type { App } from "@clawdev/server";
 *   import { treaty } from "@elysiajs/eden";
 *
 *   const api = treaty<App>("localhost:3100");
 *   const { data } = await api.api.health.get();
 *
 * This file re-exports the App type from elysia-app.
 */

export type { App } from "./elysia-app.js";
