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
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { assertBoard, assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { logger } from "../middleware/logger.js";

/** UUID v4 regex for plugin ID route resolution. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AvailablePluginExample {
  packageName: string;
  pluginKey: string;
  displayName: string;
  description: string;
  localPath: string;
  tag: "example";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const BUNDLED_PLUGIN_EXAMPLES: AvailablePluginExample[] = [
  {
    packageName: "@clawdev/plugin-hello-world-example",
    pluginKey: "clawdev.hello-world-example",
    displayName: "Hello World Widget (Example)",
    description: "Reference UI plugin that adds a simple Hello World widget to the ClawDev dashboard.",
    localPath: "packages/plugins/examples/plugin-hello-world-example",
    tag: "example",
  },
  {
    packageName: "@clawdev/plugin-file-browser-example",
    pluginKey: "clawdev-file-browser-example",
    displayName: "File Browser (Example)",
    description: "Example plugin that adds a Files link in project navigation plus a project detail file browser.",
    localPath: "packages/plugins/examples/plugin-file-browser-example",
    tag: "example",
  },
  {
    packageName: "@clawdev/plugin-kitchen-sink-example",
    pluginKey: "clawdev-kitchen-sink-example",
    displayName: "Kitchen Sink (Example)",
    description: "Reference plugin that demonstrates the current ClawDev plugin API surface, bridge flows, UI extension surfaces, jobs, webhooks, tools, streams, and trusted local workspace/process demos.",
    localPath: "packages/plugins/examples/plugin-kitchen-sink-example",
    tag: "example",
  },
];

function listBundledPluginExamples(): AvailablePluginExample[] {
  return BUNDLED_PLUGIN_EXAMPLES.flatMap((plugin) => {
    const absoluteLocalPath = path.resolve(REPO_ROOT, plugin.localPath);
    if (!existsSync(absoluteLocalPath)) return [];
    return [{ ...plugin, localPath: absoluteLocalPath }];
  });
}

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
  } catch {
    // Fall through to key lookup. Some database drivers surface invalid-id
    // lookups as generic errors instead of the Postgres 22P02 code.
  }

  return registry.getByKey(pluginId);
}

export function pluginRoutes(deps: PluginRouteDeps) {
  const { db, jobScheduler, jobStore, workerManager, streamBus, toolDispatcher } = deps;
  const registry = pluginRegistryService(db);
  const lifecycle = pluginLifecycleManager(db);
  const log = logger.child({ service: "plugins-routes" });

  const pluginIdParam = t.Object({ pluginId: t.String() });

  return new Elysia({ prefix: "/plugins" })
    // ------------------------------------------------------------------
    // Static routes MUST come before parameterized /:pluginId routes
    // ------------------------------------------------------------------

    // List all plugins
    .get("/", async ({ query, set, ...ctx }: any) => {
      try {
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to list plugins");
        throw err;
      }
    })

    // First-party examples
    .get("/examples", async ({ ...ctx }: any) => {
      try {
        assertBoard(ctx.actor);
        return listBundledPluginExamples();
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to list plugin examples");
        throw err;
      }
    })

    // UI slot contributions for all ready plugins
    .get("/ui-contributions", async ({ ...ctx }: any) => {
      try {
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to get UI contributions");
        throw err;
      }
    })

    .get("/ui/slots", async ({ ...ctx }: any) => {
      try {
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
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to get UI slots");
        throw err;
      }
    })

    // List all available plugin-contributed tools
    .get("/tools", async ({ query, set, ...ctx }: any) => {
      try {
        assertBoard(ctx.actor);
        if (!toolDispatcher) {
          set.status = 501;
          return { error: "Plugin tool dispatch is not enabled" };
        }
        const pluginId = query.pluginId as string | undefined;
        const filter = pluginId ? { pluginId } : undefined;
        const tools = toolDispatcher.listToolsForAgent(filter);
        return tools;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to list plugin tools");
        throw err;
      }
    })

    // Execute a plugin-contributed tool
    .post(
      "/tools/execute",
      async ({ body, set, ...ctx }: any) => {
        try {
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

          assertCompanyAccess(ctx.actor, runContext.companyId);

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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to execute plugin tool");
          throw err;
        }
      },
    )

    // Install plugin
    .post(
      "/install",
      async (ctx: any) => {
        try {
          assertBoard(ctx.actor);
          const loader = pluginLoader(db);
          const installBody = (ctx.body ?? {}) as Record<string, unknown>;
          const jsonError = (status: number, error: string) => new Response(
            JSON.stringify({ error }),
            { status, headers: { "content-type": "application/json; charset=utf-8" } },
          );

          if (!installBody.packageName || typeof installBody.packageName !== "string") {
            return jsonError(400, "packageName is required and must be a string");
          }

          if (installBody.version !== undefined && typeof installBody.version !== "string") {
            return jsonError(400, "version must be a string if provided");
          }

          if (installBody.isLocalPath !== undefined && typeof installBody.isLocalPath !== "boolean") {
            return jsonError(400, "isLocalPath must be a boolean if provided");
          }

          const trimmedPackage = installBody.packageName.trim();
          if (trimmedPackage.length === 0) {
            return jsonError(400, "packageName cannot be empty");
          }

          if (!installBody.isLocalPath && /[<>:"|?*]/.test(trimmedPackage)) {
            return jsonError(400, "packageName contains invalid characters");
          }

          let discovered;
          try {
            discovered = await loader.installPlugin(
              installBody.isLocalPath
                ? { localPath: trimmedPackage }
                : { packageName: trimmedPackage, version: (installBody.version as string | undefined)?.trim() },
            );
          } catch (error) {
            return jsonError(500, error instanceof Error ? error.message : String(error));
          }

          if (!discovered.manifest) {
            return jsonError(500, "Plugin installed but manifest is missing");
          }

          const pluginRecord = await registry.getByKey(discovered.manifest!.id);
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: pluginRecord!.id } });
          return pluginRecord;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to install plugin");
          throw err;
        }
      },
      {
        body: t.Any(),
      },
    )

    // ------------------------------------------------------------------
    // Parameterized plugin routes
    // ------------------------------------------------------------------

    // Get plugin details
    .get(
      "/:pluginId",
      async ({ params, set, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          const plugin = await resolvePlugin(registry, params.pluginId);
          if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

          const worker = workerManager?.getWorker?.(plugin.id);
          const supportsConfigTest = worker
            ? worker.supportedMethods?.includes("validateConfig")
            : false;

          return { ...plugin, supportsConfigTest };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin details");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Uninstall plugin
    .post(
      "/:pluginId/uninstall",
      async ({ params, query, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          const purge = query.purge === "true";
          await lifecycle.unload(params.pluginId, purge);
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
          return { success: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to uninstall plugin");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    .delete(
      "/:pluginId",
      async ({ params, query, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          const purge = query.purge === "true";
          await lifecycle.unload(params.pluginId, purge);
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
          return { success: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete plugin");
          throw err;
        }
      },
      {
        params: pluginIdParam,
        query: t.Object({
          purge: t.Optional(t.String()),
        }),
      },
    )

    // Enable plugin
    .post(
      "/:pluginId/enable",
      async ({ params, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          await lifecycle.enable(params.pluginId);
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
          return { success: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to enable plugin");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Disable plugin
    .post(
      "/:pluginId/disable",
      async ({ params, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          await lifecycle.disable(params.pluginId);
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: params.pluginId } });
          return { success: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to disable plugin");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Upgrade plugin
    .post(
      "/:pluginId/upgrade",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to upgrade plugin");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Health check
    .get(
      "/:pluginId/health",
      async ({ params, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin health");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Plugin logs
    .get(
      "/:pluginId/logs",
      async ({ params, query, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin logs");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Plugin config — get
    .get(
      "/:pluginId/config",
      async ({ params, set, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          const plugin = await resolvePlugin(registry, params.pluginId);
          if (!plugin) { set.status = 404; return { error: "Plugin not found" }; }

          const config = await registry.getConfig(plugin.id);
          return config;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin config");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Plugin config — save (upsert)
    .post(
      "/:pluginId/config",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to save plugin config");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Plugin config — test (validate without persisting)
    .post(
      "/:pluginId/config/test",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to test plugin config");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Bridge proxy — getData
    .post(
      "/:pluginId/bridge/data",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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

          if (body.companyId) {
            assertCompanyAccess(ctx.actor, body.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin data");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Bridge proxy — performAction
    .post(
      "/:pluginId/bridge/action",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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

          if (body.companyId) {
            assertCompanyAccess(ctx.actor, body.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to perform plugin action");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // URL-keyed bridge — getData via path param
    .post(
      "/:pluginId/data/:key",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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

          if (body?.companyId) {
            assertCompanyAccess(ctx.actor, body.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin data by key");
          throw err;
        }
      },
      { params: t.Object({ pluginId: t.String(), key: t.String() }) },
    )

    // URL-keyed bridge — performAction via path param
    .post(
      "/:pluginId/actions/:key",
      async ({ params, body, set, ...ctx }: any) => {
        try {
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

          if (body?.companyId) {
            assertCompanyAccess(ctx.actor, body.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to perform plugin action by key");
          throw err;
        }
      },
      { params: t.Object({ pluginId: t.String(), key: t.String() }) },
    )

    // SSE stream bridge route
    .get(
      "/:pluginId/bridge/stream/:channel",
      async ({ params, query, set, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          if (!streamBus) {
            set.status = 501;
            return { error: "Plugin stream bridge is not enabled" };
          }

          const companyId = query?.companyId as string | undefined;
          if (!companyId) {
            set.status = 400;
            return { error: '"companyId" query parameter is required' };
          }

          const plugin = await resolvePlugin(registry, params.pluginId);
          if (!plugin) {
            set.status = 404;
            return { error: "Plugin not found" };
          }

          assertCompanyAccess(ctx.actor, companyId);

          const encoder = new TextEncoder();
          let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
          let unsubscribed = false;
          let unsubscribe = () => {};
          const safeUnsubscribe = () => {
            if (unsubscribed) return;
            unsubscribed = true;
            try {
              unsubscribe();
            } finally {
              try {
                controllerRef?.close();
              } catch {
                // ignore
              }
            }
          };

          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              controllerRef = controller;
              controller.enqueue(encoder.encode(":ok\n\n"));
              unsubscribe = streamBus.subscribe(
                plugin.id,
                params.channel,
                companyId,
                (event, eventType) => {
                  if (unsubscribed) return;
                  try {
                    if (eventType !== "message") {
                      controller.enqueue(encoder.encode(`event: ${eventType}\n`));
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                    if (eventType === "close") {
                      safeUnsubscribe();
                    }
                  } catch {
                    safeUnsubscribe();
                  }
                },
              );
            },
            cancel() {
              safeUnsubscribe();
            },
          });

          return new Response(stream, {
            headers: {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
              connection: "keep-alive",
              "x-accel-buffering": "no",
            },
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to open plugin stream");
          throw err;
        }
      },
      { params: t.Object({ pluginId: t.String(), channel: t.String() }), query: t.Object({ companyId: t.String() }) },
    )

    // Plugin jobs
    .get(
      "/:pluginId/jobs",
      async ({ params, query, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list plugin jobs");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Job runs
    .get(
      "/:pluginId/jobs/:jobId/runs",
      async ({ params, query, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list job runs");
          throw err;
        }
      },
      { params: t.Object({ pluginId: t.String(), jobId: t.String() }) },
    )

    // Trigger job manually
    .post(
      "/:pluginId/jobs/:jobId/trigger",
      async ({ params, set, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          if (!jobScheduler) {
            set.status = 501;
            return { error: "Job scheduling is not enabled" };
          }

          const plugin = await resolvePlugin(registry, params.pluginId);
          if (!plugin) {
            set.status = 404;
            return { error: "Plugin not found" };
          }

          try {
            const result = await jobScheduler.triggerJob(params.jobId, "manual");
            return result;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            set.status = 400;
            return { error: message };
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to trigger job");
          throw err;
        }
      },
      { params: t.Object({ pluginId: t.String(), jobId: t.String() }) },
    )

    // Webhook deliveries (list)
    .get(
      "/:pluginId/webhooks/deliveries",
      async ({ params, ...ctx }: any) => {
        try {
          assertBoard(ctx.actor);
          const rows = await db
            .select()
            .from(pluginWebhookDeliveries)
            .where(eq(pluginWebhookDeliveries.pluginId, params.pluginId))
            .orderBy(desc(pluginWebhookDeliveries.createdAt))
            .limit(50);
          return rows;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list webhook deliveries");
          throw err;
        }
      },
      { params: pluginIdParam },
    )

    // Webhook ingestion (receive inbound webhook)
    .post(
      "/:pluginId/webhooks/:endpointKey",
      async ({ params, body, request, set }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to handle webhook");
          throw err;
        }
      },
      { params: t.Object({ pluginId: t.String(), endpointKey: t.String() }) },
    )

    // Aggregated health dashboard
    .get(
      "/:pluginId/dashboard",
      async ({ params, set, ...ctx }: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get plugin dashboard");
          throw err;
        }
      },
      { params: pluginIdParam },
    );
}
