/**
 * Plugin management routes — Elysia port.
 *
 * Handles the complete plugin lifecycle: listing, installing, uninstalling,
 * enabling/disabling, health diagnostics, upgrading, configuration,
 * bridge proxy (getData/performAction), tool discovery/execution,
 * job scheduling, webhook ingestion, SSE streaming, and UI slot contributions.
 *
 * Delegates to existing service layer (pluginRegistryService, pluginLifecycleManager, etc.)
 */

import { randomUUID } from "node:crypto";
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
import { validateInstanceConfig } from "../services/plugin-config-validator.js";
import type { PluginJobScheduler } from "../services/plugin-job-scheduler.js";
import type { PluginJobStore } from "../services/plugin-job-store.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";
import type { PluginStreamBus } from "../services/plugin-stream-bus.js";
import type { PluginToolDispatcher } from "../services/plugin-tool-dispatcher.js";
import { companyIdParam } from "../middleware/index.js";
import { assertBoard, type Actor } from "../middleware/authz.js";

/** UUID v4 regex for plugin ID route resolution. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PluginRouteDeps {
  db: Db;
  jobScheduler: PluginJobScheduler;
  jobStore: PluginJobStore;
  workerManager: PluginWorkerManager;
  streamBus: PluginStreamBus;
  toolDispatcher: PluginToolDispatcher;
}

/**
 * Resolve a plugin by either database ID or plugin key.
 *
 * Lookup order:
 * - UUID-like IDs: getById first, then getByKey.
 * - Scoped package keys (e.g. "@scope/name"): getByKey only.
 * - Other non-UUID IDs: try getById first, fallback to getByKey.
 */
async function resolvePlugin(
  registry: ReturnType<typeof pluginRegistryService>,
  pluginId: string,
) {
  const isUuid = UUID_REGEX.test(pluginId);
  const isScopedPackageKey = pluginId.startsWith("@") || pluginId.includes("/");

  if (isScopedPackageKey && !isUuid) {
    return registry.getByKey(pluginId);
  }

  try {
    const byId = await registry.getById(pluginId);
    if (byId) return byId;
  } catch (error) {
    const maybeCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (maybeCode !== "22P02") {
      throw error;
    }
  }

  return registry.getByKey(pluginId);
}

export function pluginRoutes(deps: PluginRouteDeps) {
  const { db, jobScheduler, jobStore, workerManager, streamBus, toolDispatcher } = deps;
  const registry = pluginRegistryService(db);
  const lifecycle = pluginLifecycleManager(db);

  const pluginIdParam = t.Object({ pluginId: t.String() });

  return new Elysia({ prefix: "/plugins" })
    // ------------------------------------------------------------------
    // Static routes MUST come before parameterized /:pluginId routes
    // ------------------------------------------------------------------

    // List all plugins
    .get("/", async ({ query, set, ...ctx }: any) => {
      assertBoard(ctx.actor);
      const rawStatus = query.status as string | undefined;
      if (rawStatus !== undefined) {
        if (typeof rawStatus !== "string" || !(PLUGIN_STATUSES as readonly string[]).includes(rawStatus)) {
          set.status = 400;
          return { error: `Invalid status '${String(rawStatus)}'. Must be one of: ${PLUGIN_STATUSES.join(", ")}` };
        }
      }
      const status = rawStatus as PluginStatus | undefined;
      const plugins = status ? await registry.listByStatus(status) : await registry.listInstalled();
      return plugins;
    })

    // UI slot contributions for all ready plugins
    .get("/ui/slots", async ({ ...ctx }: any) => {
      assertBoard(ctx.actor);
      const plugins = await registry.listByStatus("ready");

      const contributions = plugins
        .map((plugin) => {
          const manifest = (plugin as any).manifestJson;
          if (!manifest) return null;

          const uiMetadata = getPluginUiContributionMetadata(manifest);
          if (!uiMetadata) return null;

          return {
            pluginId: plugin.id,
            pluginKey: (plugin as any).pluginKey,
            displayName: manifest.displayName,
            version: (plugin as any).version,
            updatedAt: plugin.updatedAt?.toISOString?.() ?? plugin.updatedAt,
            uiEntryFile: uiMetadata.uiEntryFile,
            slots: uiMetadata.slots,
            launchers: uiMetadata.launchers,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      return contributions;
    })

    // List all available plugin-contributed tools
    .get("/tools", async ({ query, set, ...ctx }: any) => {
      assertBoard(ctx.actor);
      if (!toolDispatcher) {
        set.status = 501;
        return { error: "Plugin tool dispatch is not enabled" };
      }
      const pluginId = query.pluginId as string | undefined;
      const filter = pluginId ? { pluginId } : undefined;
      const tools = toolDispatcher.listToolsForAgent(filter);
      return tools;
    })

    // Execute a plugin-contributed tool
    .post(
      "/tools/execute",
      async ({ body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!toolDispatcher) {
          set.status = 501;
          return { error: "Plugin tool dispatch is not enabled" };
        }

        const { tool, parameters, runContext } = body;

        if (!tool || typeof tool !== "string") {
          set.status = 400;
          return { error: '"tool" is required and must be a string' };
        }

        if (!runContext || typeof runContext !== "object") {
          set.status = 400;
          return { error: '"runContext" is required and must be an object' };
        }

        if (!runContext.agentId || !runContext.runId || !runContext.companyId || !runContext.projectId) {
          set.status = 400;
          return { error: '"runContext" must include agentId, runId, companyId, and projectId' };
        }

        const registeredTool = toolDispatcher.getTool(tool);
        if (!registeredTool) {
          set.status = 404;
          return { error: `Tool "${tool}" not found` };
        }

        try {
          const result = await toolDispatcher.executeTool(tool, parameters ?? {}, runContext);
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("not running") || message.includes("worker")) {
            set.status = 502;
            return { error: message };
          }
          set.status = 500;
          return { error: message };
        }
      },
    )

    // Install plugin
    .post(
      "/install",
      async ({ body, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const loader = pluginLoader(db);
        const discovered = await loader.installPlugin({
          packageName: body.source === "npm" ? body.specifier : undefined,
          localPath: body.source === "local" ? body.specifier : undefined,
        });
        const pluginRecord = await registry.getByKey(discovered.manifest!.id);
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: pluginRecord!.id } });
        return pluginRecord;
      },
      {
        body: t.Object({
          source: t.Union([t.Literal("npm"), t.Literal("local")]),
          specifier: t.String(),
          companyId: t.Optional(t.String()),
        }),
      },
    )

    // ------------------------------------------------------------------
    // Parameterized plugin routes
    // ------------------------------------------------------------------

    // Get plugin details
    .get(
      "/:pluginId",
      async ({ params, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        const worker = workerManager?.getWorker?.(plugin.id);
        const supportsConfigTest = worker
          ? worker.supportedMethods?.includes("validateConfig")
          : false;

        return { ...plugin, supportsConfigTest };
      },
      { params: pluginIdParam },
    )

    // Uninstall plugin
    .post(
      "/:pluginId/uninstall",
      async ({ params, query, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const purge = query.purge === "true";
        await lifecycle.unload(params.pluginId, purge);
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
        return { success: true };
      },
      { params: pluginIdParam },
    )

    // Enable plugin
    .post(
      "/:pluginId/enable",
      async ({ params, ...ctx }: any) => {
        assertBoard(ctx.actor);
        await lifecycle.enable(params.pluginId);
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
        return { success: true };
      },
      { params: pluginIdParam },
    )

    // Disable plugin
    .post(
      "/:pluginId/disable",
      async ({ params, ...ctx }: any) => {
        assertBoard(ctx.actor);
        await lifecycle.disable(params.pluginId);
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
        return { success: true };
      },
      { params: pluginIdParam },
    )

    // Upgrade plugin
    .post(
      "/:pluginId/upgrade",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        try {
          const version = body?.version as string | undefined;
          const result = await lifecycle.upgrade(plugin.id, version);
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "upgraded" } });
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 400;
          return { error: message };
        }
      },
      { params: pluginIdParam },
    )

    // Health check
    .get(
      "/:pluginId/health",
      async ({ params, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        const checks: Array<{ name: string; passed: boolean; message?: string }> = [];

        checks.push({ name: "registry", passed: true, message: "Plugin found in registry" });

        const hasValidManifest = Boolean((plugin as any).manifestJson?.id);
        checks.push({
          name: "manifest",
          passed: hasValidManifest,
          message: hasValidManifest ? "Manifest is valid" : "Manifest is invalid or missing",
        });

        const isHealthy = plugin.status === "ready";
        checks.push({ name: "status", passed: isHealthy, message: `Current status: ${plugin.status}` });

        const hasNoError = !(plugin as any).lastError;
        if (!hasNoError) {
          checks.push({ name: "error_state", passed: false, message: (plugin as any).lastError ?? undefined });
        }

        return {
          pluginId: plugin.id,
          status: plugin.status,
          healthy: isHealthy && hasValidManifest && hasNoError,
          checks,
          lastError: (plugin as any).lastError ?? undefined,
        };
      },
      { params: pluginIdParam },
    )

    // Plugin logs
    .get(
      "/:pluginId/logs",
      async ({ params, query, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 25, 1), 500);
        const level = query.level as string | undefined;
        const since = query.since ? new Date(query.since as string) : undefined;

        const conditions = [eq(pluginLogs.pluginId, plugin.id)];
        if (level) {
          conditions.push(eq(pluginLogs.level, level));
        }
        if (since && !isNaN(since.getTime())) {
          conditions.push(gte(pluginLogs.createdAt, since));
        }

        const rows = await db
          .select()
          .from(pluginLogs)
          .where(and(...conditions))
          .orderBy(desc(pluginLogs.createdAt))
          .limit(limit);
        return rows;
      },
      { params: pluginIdParam },
    )

    // Plugin config — get
    .get(
      "/:pluginId/config",
      async ({ params, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        const config = await registry.getConfig(plugin.id);
        return config;
      },
      { params: pluginIdParam },
    )

    // Plugin config — save (upsert)
    .post(
      "/:pluginId/config",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (!body?.configJson || typeof body.configJson !== "object") {
          set.status = 400;
          return { error: '"configJson" is required and must be an object' };
        }

        // Validate against instanceConfigSchema if declared
        const schema = (plugin as any).manifestJson?.instanceConfigSchema;
        if (schema && Object.keys(schema).length > 0) {
          const validation = validateInstanceConfig(body.configJson, schema);
          if (!validation.valid) {
            set.status = 400;
            return {
              error: "Configuration does not match the plugin's instanceConfigSchema",
              fieldErrors: validation.errors,
            };
          }
        }

        try {
          const result = await registry.upsertConfig(plugin.id, {
            configJson: body.configJson,
          });

          // Notify the running worker about the config change.
          if (workerManager?.isRunning?.(plugin.id)) {
            try {
              await workerManager.call(plugin.id, "configChanged", { config: body.configJson });
            } catch {
              // If worker doesn't handle live config, restart it.
              try {
                await lifecycle.restartWorker(plugin.id);
              } catch {
                // Non-fatal for the config save response.
              }
            }
          }

          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 400;
          return { error: message };
        }
      },
      { params: pluginIdParam },
    )

    // Plugin config — test (validate without persisting)
    .post(
      "/:pluginId/config/test",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!workerManager) {
          set.status = 501;
          return { error: "Plugin bridge is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (plugin.status !== "ready") {
          set.status = 400;
          return { error: `Plugin is not ready (current status: ${plugin.status})` };
        }

        if (!body?.configJson || typeof body.configJson !== "object") {
          set.status = 400;
          return { error: '"configJson" is required and must be an object' };
        }

        const schema = (plugin as any).manifestJson?.instanceConfigSchema;
        if (schema && Object.keys(schema).length > 0) {
          const validation = validateInstanceConfig(body.configJson, schema);
          if (!validation.valid) {
            set.status = 400;
            return {
              error: "Configuration does not match the plugin's instanceConfigSchema",
              fieldErrors: validation.errors,
            };
          }
        }

        try {
          const result = await workerManager.call(
            plugin.id,
            "validateConfig",
            { config: body.configJson },
          );

          if (result.ok) {
            const warningText = result.warnings?.length
              ? `Warnings: ${result.warnings.join("; ")}`
              : undefined;
            return { valid: true, message: warningText };
          }
          const errorText = result.errors?.length
            ? result.errors.join("; ")
            : "Configuration validation failed.";
          return { valid: false, message: errorText };
        } catch (err: any) {
          // Worker doesn't implement validateConfig
          if (err?.code === -32601) {
            return {
              valid: false,
              supported: false,
              message: "This plugin does not support configuration testing.",
            };
          }
          const message = err instanceof Error ? err.message : String(err);
          set.status = 502;
          return { code: "UNKNOWN", message };
        }
      },
      { params: pluginIdParam },
    )

    // Bridge proxy — getData
    .post(
      "/:pluginId/bridge/data",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!workerManager) {
          set.status = 501;
          return { error: "Plugin bridge is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (plugin.status !== "ready") {
          set.status = 502;
          return { code: "WORKER_UNAVAILABLE", message: `Plugin is not ready (current status: ${plugin.status})` };
        }

        if (!body || !body.key || typeof body.key !== "string") {
          set.status = 400;
          return { error: '"key" is required and must be a string' };
        }

        try {
          const result = await workerManager.call(plugin.id, "getData", {
            key: body.key,
            params: body.params ?? {},
            renderEnvironment: body.renderEnvironment ?? null,
          });
          return { data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 502;
          return { code: "UNKNOWN", message };
        }
      },
      { params: pluginIdParam },
    )

    // Bridge proxy — performAction
    .post(
      "/:pluginId/bridge/action",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!workerManager) {
          set.status = 501;
          return { error: "Plugin bridge is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (plugin.status !== "ready") {
          set.status = 502;
          return { code: "WORKER_UNAVAILABLE", message: `Plugin is not ready (current status: ${plugin.status})` };
        }

        if (!body || !body.key || typeof body.key !== "string") {
          set.status = 400;
          return { error: '"key" is required and must be a string' };
        }

        try {
          const result = await workerManager.call(plugin.id, "performAction", {
            key: body.key,
            params: body.params ?? {},
            renderEnvironment: body.renderEnvironment ?? null,
          });
          return { data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 502;
          return { code: "UNKNOWN", message };
        }
      },
      { params: pluginIdParam },
    )

    // URL-keyed bridge — getData via path param
    .post(
      "/:pluginId/data/:key",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!workerManager) {
          set.status = 501;
          return { error: "Plugin bridge is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (plugin.status !== "ready") {
          set.status = 502;
          return { code: "WORKER_UNAVAILABLE", message: `Plugin is not ready (current status: ${plugin.status})` };
        }

        try {
          const result = await workerManager.call(plugin.id, "getData", {
            key: params.key,
            params: body?.params ?? {},
            renderEnvironment: body?.renderEnvironment ?? null,
          });
          return { data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 502;
          return { code: "UNKNOWN", message };
        }
      },
      { params: t.Object({ pluginId: t.String(), key: t.String() }) },
    )

    // URL-keyed bridge — performAction via path param
    .post(
      "/:pluginId/actions/:key",
      async ({ params, body, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!workerManager) {
          set.status = 501;
          return { error: "Plugin bridge is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (plugin.status !== "ready") {
          set.status = 502;
          return { code: "WORKER_UNAVAILABLE", message: `Plugin is not ready (current status: ${plugin.status})` };
        }

        try {
          const result = await workerManager.call(plugin.id, "performAction", {
            key: params.key,
            params: body?.params ?? {},
            renderEnvironment: body?.renderEnvironment ?? null,
          });
          return { data: result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 502;
          return { code: "UNKNOWN", message };
        }
      },
      { params: t.Object({ pluginId: t.String(), key: t.String() }) },
    )

    // Plugin jobs
    .get(
      "/:pluginId/jobs",
      async ({ params, query, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!jobStore) {
          set.status = 501;
          return { error: "Job scheduling is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        const rawStatus = query.status as string | undefined;
        const validStatuses = ["active", "paused", "failed"];
        if (rawStatus !== undefined && !validStatuses.includes(rawStatus)) {
          set.status = 400;
          return { error: `Invalid status '${rawStatus}'. Must be one of: ${validStatuses.join(", ")}` };
        }

        const jobs = await jobStore.listJobs(
          plugin.id,
          rawStatus as "active" | "paused" | "failed" | undefined,
        );
        return jobs;
      },
      { params: pluginIdParam },
    )

    // Job runs
    .get(
      "/:pluginId/jobs/:jobId/runs",
      async ({ params, query, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!jobStore) {
          set.status = 501;
          return { error: "Job scheduling is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        const job = await jobStore.getJobByIdForPlugin(plugin.id, params.jobId);
        if (!job) { set.status = 404; return { error: "Job not found" }; }

        const limit = query.limit ? parseInt(query.limit as string, 10) : 25;
        if (isNaN(limit) || limit < 1 || limit > 500) {
          set.status = 400;
          return { error: "limit must be a number between 1 and 500" };
        }

        const runs = await jobStore.listRunsByJob(params.jobId, limit);
        return runs;
      },
      { params: t.Object({ pluginId: t.String(), jobId: t.String() }) },
    )

    // Trigger job manually
    .post(
      "/:pluginId/jobs/:jobName/trigger",
      async ({ params, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        if (!jobScheduler) {
          set.status = 501;
          return { error: "Job scheduling is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        try {
          const result = await jobScheduler.triggerJob(params.jobName, "manual");
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          set.status = 400;
          return { error: message };
        }
      },
      { params: t.Object({ pluginId: t.String(), jobName: t.String() }) },
    )

    // Webhook deliveries (list)
    .get(
      "/:pluginId/webhooks/deliveries",
      async ({ params, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const rows = await db
          .select()
          .from(pluginWebhookDeliveries)
          .where(eq(pluginWebhookDeliveries.pluginId, params.pluginId))
          .orderBy(desc(pluginWebhookDeliveries.createdAt))
          .limit(50);
        return rows;
      },
      { params: pluginIdParam },
    )

    // Webhook ingestion (receive inbound webhook)
    .post(
      "/:pluginId/webhooks/:endpointKey",
      async ({ params, body, request, set }: any) => {
        if (!workerManager) {
          set.status = 501;
          return { error: "Webhook ingestion is not enabled" };
        }

        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        if (plugin.status !== "ready") {
          set.status = 400;
          return { error: `Plugin is not ready (current status: ${plugin.status})` };
        }

        const manifest = (plugin as any).manifestJson;
        if (!manifest) {
          set.status = 400;
          return { error: "Plugin manifest is missing" };
        }

        const capabilities = manifest.capabilities ?? [];
        if (!capabilities.includes("webhooks.receive")) {
          set.status = 400;
          return { error: "Plugin does not have the webhooks.receive capability" };
        }

        const declaredWebhooks = manifest.webhooks ?? [];
        const webhookDecl = declaredWebhooks.find(
          (w: any) => w.endpointKey === params.endpointKey,
        );
        if (!webhookDecl) {
          set.status = 404;
          return { error: `Webhook endpoint '${params.endpointKey}' is not declared by this plugin` };
        }

        const requestId = randomUUID();
        const rawHeaders: Record<string, string> = {};
        if (request?.headers) {
          for (const [key, value] of request.headers.entries()) {
            rawHeaders[key] = value;
          }
        }

        const payload = body ?? {};
        const rawBody = typeof body === "string" ? body : JSON.stringify(body ?? {});

        const startedAt = new Date();
        const [delivery] = await db
          .insert(pluginWebhookDeliveries)
          .values({
            pluginId: plugin.id,
            webhookKey: params.endpointKey,
            status: "pending",
            payload,
            headers: rawHeaders,
            startedAt,
          })
          .returning({ id: pluginWebhookDeliveries.id });

        try {
          await workerManager.call(plugin.id, "handleWebhook", {
            endpointKey: params.endpointKey,
            headers: rawHeaders,
            rawBody,
            parsedBody: body,
            requestId,
          });

          const finishedAt = new Date();
          const durationMs = finishedAt.getTime() - startedAt.getTime();
          await db
            .update(pluginWebhookDeliveries)
            .set({ status: "success", durationMs, finishedAt })
            .where(eq(pluginWebhookDeliveries.id, delivery.id));

          return { deliveryId: delivery.id, status: "success" };
        } catch (err) {
          const finishedAt = new Date();
          const durationMs = finishedAt.getTime() - startedAt.getTime();
          const errorMessage = err instanceof Error ? err.message : String(err);

          await db
            .update(pluginWebhookDeliveries)
            .set({ status: "failed", durationMs, error: errorMessage, finishedAt })
            .where(eq(pluginWebhookDeliveries.id, delivery.id));

          set.status = 502;
          return { deliveryId: delivery.id, status: "failed", error: errorMessage };
        }
      },
      { params: t.Object({ pluginId: t.String(), endpointKey: t.String() }) },
    )

    // Aggregated health dashboard
    .get(
      "/:pluginId/dashboard",
      async ({ params, set, ...ctx }: any) => {
        assertBoard(ctx.actor);
        const plugin = await resolvePlugin(registry, params.pluginId);
        if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

        // Worker diagnostics
        let worker: Record<string, unknown> | null = null;
        if (workerManager) {
          const handle = workerManager.getWorker?.(plugin.id);
          if (handle) {
            const diag = handle.diagnostics();
            worker = {
              status: diag.status,
              pid: diag.pid,
              uptime: diag.uptime,
              consecutiveCrashes: diag.consecutiveCrashes,
              totalCrashes: diag.totalCrashes,
              pendingRequests: diag.pendingRequests,
              lastCrashAt: diag.lastCrashAt,
              nextRestartAt: diag.nextRestartAt,
            };
          }
        }

        // Recent job runs
        let recentJobRuns: unknown[] = [];
        if (jobStore) {
          try {
            const runs = await jobStore.listRunsByPlugin(plugin.id, undefined, 10);
            const jobs = await jobStore.listJobs(plugin.id);
            const jobKeyMap = new Map(jobs.map((j: any) => [j.id, j.jobKey]));

            recentJobRuns = runs
              .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((r: any) => ({
                id: r.id,
                jobId: r.jobId,
                jobKey: jobKeyMap.get(r.jobId) ?? undefined,
                trigger: r.trigger,
                status: r.status,
                durationMs: r.durationMs,
                error: r.error,
                startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null,
                finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null,
                createdAt: new Date(r.createdAt).toISOString(),
              }));
          } catch {
            // Job data unavailable
          }
        }

        // Recent webhook deliveries
        let recentWebhookDeliveries: unknown[] = [];
        try {
          const deliveries = await db
            .select()
            .from(pluginWebhookDeliveries)
            .where(eq(pluginWebhookDeliveries.pluginId, plugin.id))
            .orderBy(desc(pluginWebhookDeliveries.createdAt))
            .limit(10);

          recentWebhookDeliveries = deliveries.map((d: any) => ({
            id: d.id,
            webhookKey: d.webhookKey,
            status: d.status,
            durationMs: d.durationMs,
            error: d.error,
            startedAt: d.startedAt ? d.startedAt.toISOString() : null,
            finishedAt: d.finishedAt ? d.finishedAt.toISOString() : null,
            createdAt: d.createdAt.toISOString(),
          }));
        } catch {
          // Webhook data unavailable
        }

        // Health checks
        const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
        checks.push({ name: "registry", passed: true, message: "Plugin found in registry" });

        const hasValidManifest = Boolean((plugin as any).manifestJson?.id);
        checks.push({
          name: "manifest",
          passed: hasValidManifest,
          message: hasValidManifest ? "Manifest is valid" : "Manifest is invalid or missing",
        });

        const isHealthy = plugin.status === "ready";
        checks.push({ name: "status", passed: isHealthy, message: `Current status: ${plugin.status}` });

        const hasNoError = !(plugin as any).lastError;
        if (!hasNoError) {
          checks.push({ name: "error_state", passed: false, message: (plugin as any).lastError ?? undefined });
        }

        return {
          pluginId: plugin.id,
          worker,
          recentJobRuns,
          recentWebhookDeliveries,
          health: {
            pluginId: plugin.id,
            status: plugin.status,
            healthy: isHealthy && hasValidManifest && hasNoError,
            checks,
            lastError: (plugin as any).lastError ?? undefined,
          },
          checkedAt: new Date().toISOString(),
        };
      },
      { params: pluginIdParam },
    );
}
