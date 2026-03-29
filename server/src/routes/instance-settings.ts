/**
 * Instance settings routes — Elysia port.
 *
 * Provides GET and PATCH endpoints for general and experimental instance settings.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { instanceSettingsService, logActivity } from "../services/index.js";

export function instanceSettingsRoutes(db: Db) {
  const svc = instanceSettingsService(db);

  return new Elysia({ prefix: "/instance/settings" })
    // General settings
    .get("/general", async () => {
      return await svc.getGeneral();
    })

    .patch(
      "/general",
      async ({ body }) => {
        const updated = await svc.updateGeneral(body);
        return updated;
      },
      {
        body: t.Object({
          instanceName: t.Optional(t.String()),
          defaultLlmModel: t.Optional(t.String()),
          maxConcurrentAgents: t.Optional(t.Number()),
        }),
      },
    )

    // Experimental settings
    .get("/experimental", async () => {
      return await svc.getExperimental();
    })

    .patch(
      "/experimental",
      async ({ body }) => {
        const updated = await svc.updateExperimental(body);
        return updated;
      },
      {
        body: t.Object({
          autoRestartDevServerWhenIdle: t.Optional(t.Boolean()),
          enablePluginSandbox: t.Optional(t.Boolean()),
          enableCostTracking: t.Optional(t.Boolean()),
        }),
      },
    );
}
