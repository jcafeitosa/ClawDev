/**
 * Plugin management routes — Elysia port.
 *
 * Handles the complete plugin lifecycle: listing, installing, uninstalling,
 * enabling/disabling, health diagnostics, upgrading, and UI slot contributions.
 *
 * Delegates to existing service layer (pluginRegistryService, pluginLifecycleManager, etc.)
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { pluginLogs, pluginWebhookDeliveries } from "@clawdev/db";
import { desc, eq, and, gte } from "drizzle-orm";
import { PLUGIN_STATUSES } from "@clawdev/shared";
import type { PluginStatus } from "@clawdev/shared";
import { pluginRegistryService } from "../services/plugin-registry.js";
import { pluginLifecycleManager } from "../services/plugin-lifecycle.js";
import { getPluginUiContributionMetadata, pluginLoader } from "../services/plugin-loader.js";
import { logActivity } from "../services/activity-log.js";
import { publishGlobalLiveEvent } from "../services/live-events.js";
import type { PluginJobScheduler } from "../services/plugin-job-scheduler.js";
import type { PluginJobStore } from "../services/plugin-job-store.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";
import type { PluginStreamBus } from "../services/plugin-stream-bus.js";
import type { PluginToolDispatcher } from "../services/plugin-tool-dispatcher.js";
import { companyIdParam } from "../middleware/index.js";

export interface PluginRouteDeps {
  db: Db;
  jobScheduler: PluginJobScheduler;
  jobStore: PluginJobStore;
  workerManager: PluginWorkerManager;
  streamBus: PluginStreamBus;
  toolDispatcher: PluginToolDispatcher;
}

export function pluginRoutes(deps: PluginRouteDeps) {
  const { db, jobScheduler, jobStore, workerManager, streamBus, toolDispatcher } = deps;
  const registry = pluginRegistryService(db);
  const lifecycle = pluginLifecycleManager(db);

  return new Elysia({ prefix: "/plugins" })
    // List all plugins
    .get("/", async ({ query }) => {
      const status = query.status as PluginStatus | undefined;
      const plugins = await registry.list(status ? { status } : undefined);
      return plugins;
    })

    // Get plugin details
    .get(
      "/:pluginId",
      async ({ params }) => {
        const plugin = await registry.get(params.pluginId);
        if (!plugin) return new Response("Plugin not found", { status: 404 });
        return plugin;
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // Install plugin
    .post(
      "/install",
      async ({ body }) => {
        const result = await lifecycle.install({
          source: body.source,
          specifier: body.specifier,
          companyId: body.companyId,
        });
        publishGlobalLiveEvent({ type: "plugin:installed", payload: { pluginId: result.id } });
        return result;
      },
      {
        body: t.Object({
          source: t.Union([t.Literal("npm"), t.Literal("local")]),
          specifier: t.String(),
          companyId: t.Optional(t.String()),
        }),
      },
    )

    // Uninstall plugin
    .post(
      "/:pluginId/uninstall",
      async ({ params, query }) => {
        const purge = query.purge === "true";
        await lifecycle.uninstall(params.pluginId, { purge });
        publishGlobalLiveEvent({ type: "plugin:uninstalled", payload: { pluginId: params.pluginId } });
        return { success: true };
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // Enable plugin
    .post(
      "/:pluginId/enable",
      async ({ params }) => {
        await lifecycle.enable(params.pluginId);
        publishGlobalLiveEvent({ type: "plugin:enabled", payload: { pluginId: params.pluginId } });
        return { success: true };
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // Disable plugin
    .post(
      "/:pluginId/disable",
      async ({ params }) => {
        await lifecycle.disable(params.pluginId);
        publishGlobalLiveEvent({ type: "plugin:disabled", payload: { pluginId: params.pluginId } });
        return { success: true };
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // Health check
    .get(
      "/:pluginId/health",
      async ({ params }) => {
        const health = await lifecycle.healthCheck(params.pluginId);
        return health;
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // Plugin logs
    .get(
      "/:pluginId/logs",
      async ({ params, query }) => {
        const since = query.since ? new Date(query.since as string) : undefined;
        const rows = await db
          .select()
          .from(pluginLogs)
          .where(
            since
              ? and(eq(pluginLogs.pluginId, params.pluginId), gte(pluginLogs.createdAt, since))
              : eq(pluginLogs.pluginId, params.pluginId),
          )
          .orderBy(desc(pluginLogs.createdAt))
          .limit(100);
        return rows;
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // UI slot contributions for all ready plugins
    .get("/ui/slots", async () => {
      const contributions = await getPluginUiContributionMetadata(db);
      return contributions;
    })

    // Plugin jobs
    .get(
      "/:pluginId/jobs",
      async ({ params }) => {
        const jobs = await jobStore.listByPlugin(params.pluginId);
        return jobs;
      },
      { params: t.Object({ pluginId: t.String() }) },
    )

    // Trigger job manually
    .post(
      "/:pluginId/jobs/:jobName/trigger",
      async ({ params }) => {
        await jobScheduler.triggerNow(params.pluginId, params.jobName);
        return { success: true };
      },
      { params: t.Object({ pluginId: t.String(), jobName: t.String() }) },
    )

    // Webhook deliveries
    .get(
      "/:pluginId/webhooks/deliveries",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(pluginWebhookDeliveries)
          .where(eq(pluginWebhookDeliveries.pluginId, params.pluginId))
          .orderBy(desc(pluginWebhookDeliveries.createdAt))
          .limit(50);
        return rows;
      },
      { params: t.Object({ pluginId: t.String() }) },
    );
}
