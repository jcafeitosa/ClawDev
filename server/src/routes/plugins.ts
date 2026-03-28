import { Elysia } from "elysia";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { and, desc, eq, gte } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { companies, pluginLogs, pluginWebhookDeliveries } from "@clawdev/db";
import type { PluginStatus, PluginLauncherRenderContextSnapshot } from "@clawdev/shared";
import { PLUGIN_STATUSES } from "@clawdev/shared";
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
import type { ToolRunContext } from "@clawdev/plugin-sdk";
import { JsonRpcCallError, PLUGIN_RPC_ERROR_CODES } from "@clawdev/plugin-sdk";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { validateInstanceConfig } from "../services/plugin-config-validator.js";

type PluginBridgeErrorCode = "WORKER_UNAVAILABLE" | "CAPABILITY_DENIED" | "TIMEOUT" | "WORKER_ERROR" | "UNKNOWN";
interface PluginBridgeErrorResponse { code: PluginBridgeErrorCode; message: string; details?: unknown; }

function mapRpcErrorToBridgeError(err: unknown): PluginBridgeErrorResponse {
  if (err instanceof JsonRpcCallError) {
    switch (err.code) {
      case PLUGIN_RPC_ERROR_CODES.WORKER_UNAVAILABLE: return { code: "WORKER_UNAVAILABLE", message: err.message, details: err.data };
      case PLUGIN_RPC_ERROR_CODES.CAPABILITY_DENIED: return { code: "CAPABILITY_DENIED", message: err.message, details: err.data };
      case PLUGIN_RPC_ERROR_CODES.TIMEOUT: return { code: "TIMEOUT", message: err.message, details: err.data };
      case PLUGIN_RPC_ERROR_CODES.WORKER_ERROR: return { code: "WORKER_ERROR", message: err.message, details: err.data };
      default: return { code: "UNKNOWN", message: err.message, details: err.data };
    }
  }
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("not running") || message.includes("not registered")) return { code: "WORKER_UNAVAILABLE", message };
  return { code: "UNKNOWN", message };
}
import { authPlugin, type Actor } from "../plugins/auth.js";
import { badRequest, notFound } from "../errors.js";

/* ------------------------------------------------------------------ */
/*  Types & helpers previously self-imported                          */
/* ------------------------------------------------------------------ */

interface AvailablePluginExample {
  packageName: string;
  pluginKey: string;
  displayName: string;
  description: string;
  localPath: string;
  tag: "example";
}

/** Optional dependencies for plugin job scheduling routes. */
export interface PluginRouteJobDeps {
  scheduler: PluginJobScheduler;
  jobStore: PluginJobStore;
}

/** Optional dependencies for plugin webhook routes. */
export interface PluginRouteWebhookDeps {
  workerManager: PluginWorkerManager;
}

/** Optional dependencies for plugin tool routes. */
export interface PluginRouteToolDeps {
  toolDispatcher: PluginToolDispatcher;
}

/** Optional dependencies for plugin UI bridge routes. */
export interface PluginRouteBridgeDeps {
  workerManager: PluginWorkerManager;
  streamBus?: PluginStreamBus;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

const BUNDLED_PLUGIN_EXAMPLES: AvailablePluginExample[] = [
  {
    packageName: "@clawdev/plugin-hello-world-example",
    pluginKey: "paperclip.hello-world-example",
    displayName: "Hello World Widget (Example)",
    description: "Reference UI plugin that adds a simple Hello World widget to the dashboard.",
    localPath: "packages/plugins/examples/plugin-hello-world-example",
    tag: "example",
  },
  {
    packageName: "@clawdev/plugin-file-browser-example",
    pluginKey: "paperclip-file-browser-example",
    displayName: "File Browser (Example)",
    description: "Example plugin that adds a Files link in project navigation plus a project detail file browser.",
    localPath: "packages/plugins/examples/plugin-file-browser-example",
    tag: "example",
  },
  {
    packageName: "@clawdev/plugin-kitchen-sink-example",
    pluginKey: "paperclip-kitchen-sink-example",
    displayName: "Kitchen Sink (Example)",
    description: "Reference plugin that demonstrates the current plugin API surface, bridge flows, UI extension surfaces, jobs, webhooks, tools, streams, and trusted local workspace/process demos.",
    localPath: "packages/plugins/examples/plugin-kitchen-sink-example",
    tag: "example",
  },
];

export function listBundledPluginExamples(): AvailablePluginExample[] {
  return BUNDLED_PLUGIN_EXAMPLES.flatMap((plugin) => {
    const absoluteLocalPath = path.resolve(REPO_ROOT, plugin.localPath);
    if (!existsSync(absoluteLocalPath)) return [];
    return [{ ...plugin, localPath: absoluteLocalPath }];
  });
}

/**
 * Resolve a plugin by either database ID or plugin key.
 */
export async function resolvePlugin(
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

/* ------------------------------------------------------------------ */

export function pluginRoutes(
  db: Db,
  authPlugin: ReturnType<typeof authPlugin>,
  loader: ReturnType<typeof pluginLoader>,
  jobDeps?: PluginRouteJobDeps,
  webhookDeps?: PluginRouteWebhookDeps,
  toolDeps?: PluginRouteToolDeps,
  bridgeDeps?: PluginRouteBridgeDeps,
) {
  const registry = pluginRegistryService(db);
  const lifecycle = pluginLifecycleManager(db, { loader, workerManager: bridgeDeps?.workerManager ?? webhookDeps?.workerManager });

  async function resolvePluginAuditCompanyIds(actor: Actor): Promise<string[]> {
    if (typeof (db as { select?: unknown }).select === "function") {
      const rows = await db.select({ id: companies.id }).from(companies);
      return rows.map((row) => row.id);
    }
    if (actor.type === "agent" && actor.companyId) return [actor.companyId];
    if (actor.type === "board") return actor.companyIds ?? [];
    return [];
  }

  async function logPluginMutationActivity(actor: Actor, action: string, entityId: string, details: Record<string, unknown>): Promise<void> {
    const companyIds = await resolvePluginAuditCompanyIds(actor);
    if (companyIds.length === 0) return;
    const actorInfo = getActorInfo(actor);
    await Promise.all(companyIds.map((companyId) => logActivity(db, { companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action, entityType: "plugin", entityId, details })));
  }

  return new Elysia()
    .use(authPlugin)

    // === List plugins ===
    .get("/plugins", async ({ query, actor }) => {
      assertBoard(actor);
      const rawStatus = (query as Record<string, string>).status;
      if (rawStatus !== undefined) {
        if (!(PLUGIN_STATUSES as readonly string[]).includes(rawStatus)) throw badRequest(`Invalid status '${rawStatus}'. Must be one of: ${PLUGIN_STATUSES.join(", ")}`);
      }
      return rawStatus ? registry.listByStatus(rawStatus as PluginStatus) : registry.listInstalled();
    })

    .get("/plugins/examples", async ({ actor }) => { assertBoard(actor); return listBundledPluginExamples(); })

    .get("/plugins/ui-contributions", async ({ actor }) => {
      assertBoard(actor);
      const plugins = await registry.listByStatus("ready");
      return plugins.map((plugin) => {
        const manifest = plugin.manifestJson;
        if (!manifest) return null;
        const uiMetadata = getPluginUiContributionMetadata(manifest);
        if (!uiMetadata) return null;
        return { pluginId: plugin.id, pluginKey: plugin.pluginKey, displayName: manifest.displayName, version: plugin.version, updatedAt: plugin.updatedAt.toISOString(), uiEntryFile: uiMetadata.uiEntryFile, slots: uiMetadata.slots, launchers: uiMetadata.launchers };
      }).filter(Boolean);
    })

    .get("/plugins/tools", async ({ query, actor, set }) => {
      assertBoard(actor);
      if (!toolDeps) { set.status = 501; return { error: "Plugin tool dispatch is not enabled" }; }
      const pluginId = (query as Record<string, string>).pluginId;
      return toolDeps.toolDispatcher.listToolsForAgent(pluginId ? { pluginId } : undefined);
    })

    .post("/plugins/tools/execute", async ({ body, actor, set }) => {
      assertBoard(actor);
      if (!toolDeps) { set.status = 501; return { error: "Plugin tool dispatch is not enabled" }; }
      const parsed = body as { tool?: string; parameters?: unknown; runContext?: ToolRunContext } | undefined;
      if (!parsed) throw badRequest("Request body is required");
      if (!parsed.tool || typeof parsed.tool !== "string") throw badRequest('"tool" is required and must be a string');
      if (!parsed.runContext || typeof parsed.runContext !== "object") throw badRequest('"runContext" is required and must be an object');
      if (!parsed.runContext.agentId || !parsed.runContext.runId || !parsed.runContext.companyId || !parsed.runContext.projectId) throw badRequest('"runContext" must include agentId, runId, companyId, and projectId');
      assertCompanyAccess(actor, parsed.runContext.companyId);
      const registeredTool = toolDeps.toolDispatcher.getTool(parsed.tool);
      if (!registeredTool) { set.status = 404; return { error: `Tool "${parsed.tool}" not found` }; }
      try { return await toolDeps.toolDispatcher.executeTool(parsed.tool, parsed.parameters ?? {}, parsed.runContext); }
      catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = message.includes("not running") || message.includes("worker") ? 502 : 500; return { error: message }; }
    })

    .post("/plugins/install", async ({ body, actor }) => {
      assertBoard(actor);
      const parsed = body as { packageName?: string; version?: string; isLocalPath?: boolean } | undefined;
      if (!parsed?.packageName || typeof parsed.packageName !== "string") throw badRequest("packageName is required and must be a string");
      if (parsed.version !== undefined && typeof parsed.version !== "string") throw badRequest("version must be a string if provided");
      if (parsed.isLocalPath !== undefined && typeof parsed.isLocalPath !== "boolean") throw badRequest("isLocalPath must be a boolean if provided");
      const trimmedPackage = parsed.packageName.trim();
      if (!trimmedPackage) throw badRequest("packageName cannot be empty");
      if (!parsed.isLocalPath && /[<>:"|?*]/.test(trimmedPackage)) throw badRequest("packageName contains invalid characters");
      try {
        const installOptions = parsed.isLocalPath ? { localPath: trimmedPackage } : { packageName: trimmedPackage, version: parsed.version?.trim() };
        const discovered = await loader.installPlugin(installOptions);
        if (!discovered.manifest) { return new Response(JSON.stringify({ error: "Plugin installed but manifest is missing" }), { status: 500 }); }
        const existingPlugin = await registry.getByKey(discovered.manifest.id);
        if (existingPlugin) {
          await lifecycle.load(existingPlugin.id);
          const updated = await registry.getById(existingPlugin.id);
          await logPluginMutationActivity(actor, "plugin.installed", existingPlugin.id, { pluginId: existingPlugin.id, pluginKey: existingPlugin.pluginKey, packageName: updated?.packageName ?? existingPlugin.packageName, version: updated?.version ?? existingPlugin.version, source: parsed.isLocalPath ? "local_path" : "npm" });
          publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: existingPlugin.id, action: "installed" } });
          return updated;
        }
        return new Response(JSON.stringify({ error: "Plugin installed but not found in registry" }), { status: 500 });
      } catch (err) { throw badRequest(err instanceof Error ? err.message : String(err)); }
    })

    // === Bridge: getData ===
    .post("/plugins/:pluginId/bridge/data", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const parsed = body as { key?: string; companyId?: string; params?: Record<string, unknown>; renderEnvironment?: PluginLauncherRenderContextSnapshot | null } | undefined;
      if (!parsed?.key || typeof parsed.key !== "string") throw badRequest('"key" is required');
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (plugin.status !== "ready") { set.status = 502; return { code: "WORKER_UNAVAILABLE" as const, message: `Plugin is not ready (current status: ${plugin.status})` }; }
      if (parsed.companyId) assertCompanyAccess(actor, parsed.companyId);
      try { const result = await bridgeDeps.workerManager.call(plugin.id, "getData", { key: parsed.key, params: parsed.params ?? {}, companyId: parsed.companyId ?? null, renderEnvironment: parsed.renderEnvironment ?? null } as any); return { data: result }; }
      catch (err) { const bridgeError = mapRpcErrorToBridgeError(err); set.status = 502; return bridgeError; }
    })

    // === Bridge: performAction ===
    .post("/plugins/:pluginId/bridge/action", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const parsed = body as { key?: string; companyId?: string; params?: Record<string, unknown>; renderEnvironment?: PluginLauncherRenderContextSnapshot | null } | undefined;
      if (!parsed?.key || typeof parsed.key !== "string") throw badRequest('"key" is required');
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (plugin.status !== "ready") { set.status = 502; return { code: "WORKER_UNAVAILABLE" as const, message: `Plugin is not ready (current status: ${plugin.status})` }; }
      if (parsed.companyId) assertCompanyAccess(actor, parsed.companyId);
      try { const result = await bridgeDeps.workerManager.call(plugin.id, "performAction", { key: parsed.key, params: parsed.params ?? {}, companyId: parsed.companyId ?? null, renderEnvironment: parsed.renderEnvironment ?? null } as any); return { data: result }; }
      catch (err) { const bridgeError = mapRpcErrorToBridgeError(err); set.status = 502; return bridgeError; }
    })

    // === REST-friendly bridge variants ===
    .post("/plugins/:pluginId/data/:key", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (plugin.status !== "ready") { set.status = 502; return { code: "WORKER_UNAVAILABLE" as const, message: `Plugin is not ready (current status: ${plugin.status})` }; }
      const parsed = body as { companyId?: string; params?: Record<string, unknown>; renderEnvironment?: PluginLauncherRenderContextSnapshot | null } | undefined;
      if (parsed?.companyId) assertCompanyAccess(actor, parsed.companyId);
      try { const result = await bridgeDeps.workerManager.call(plugin.id, "getData", { key: params.key, params: parsed?.params ?? {}, companyId: parsed?.companyId ?? null, renderEnvironment: parsed?.renderEnvironment ?? null } as any); return { data: result }; }
      catch (err) { set.status = 502; return mapRpcErrorToBridgeError(err); }
    })
    .post("/plugins/:pluginId/actions/:key", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (plugin.status !== "ready") { set.status = 502; return { code: "WORKER_UNAVAILABLE" as const, message: `Plugin is not ready (current status: ${plugin.status})` }; }
      const parsed = body as { companyId?: string; params?: Record<string, unknown>; renderEnvironment?: PluginLauncherRenderContextSnapshot | null } | undefined;
      if (parsed?.companyId) assertCompanyAccess(actor, parsed.companyId);
      try { const result = await bridgeDeps.workerManager.call(plugin.id, "performAction", { key: params.key, params: parsed?.params ?? {}, companyId: parsed?.companyId ?? null, renderEnvironment: parsed?.renderEnvironment ?? null } as any); return { data: result }; }
      catch (err) { set.status = 502; return mapRpcErrorToBridgeError(err); }
    })

    // === SSE stream ===
    .get("/plugins/:pluginId/bridge/stream/:channel", async ({ params, query, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps?.streamBus) { set.status = 501; return { error: "Plugin stream bridge is not enabled" }; }
      const companyId = (query as Record<string, string>).companyId;
      if (!companyId) throw badRequest('"companyId" query parameter is required');
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      assertCompanyAccess(actor, companyId);

      const streamBus = bridgeDeps.streamBus;
      const pluginId = plugin.id;
      const channel = params.channel;

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(":ok\n\n"));
          let unsubscribed = false;
          const unsubscribe = streamBus.subscribe(pluginId, channel, companyId, (event: unknown, eventType: string) => {
            if (unsubscribed) return;
            try {
              let frame = "";
              if (eventType !== "message") frame += `event: ${eventType}\n`;
              frame += `data: ${JSON.stringify(event)}\n\n`;
              controller.enqueue(encoder.encode(frame));
            } catch { unsubscribed = true; unsubscribe(); controller.close(); }
          });
          // Cleanup when client disconnects
          const checkClosed = setInterval(() => {
            try { controller.enqueue(encoder.encode(":\n\n")); } // heartbeat comment
            catch { clearInterval(checkClosed); if (!unsubscribed) { unsubscribed = true; unsubscribe(); } }
          }, 30000);
        },
      });

      return new Response(stream, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive", "x-accel-buffering": "no" },
      });
    })

    // === Plugin CRUD ===
    .get("/plugins/:pluginId", async ({ params, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const worker = bridgeDeps?.workerManager ? (bridgeDeps.workerManager as any).getWorker?.(plugin.id) : null;
      const supportsConfigTest = worker ? (worker.supportedMethods ?? []).includes("validateConfig") : false;
      return { ...plugin, supportsConfigTest };
    })

    .delete("/plugins/:pluginId", async ({ params, query, actor, set }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const purge = (query as Record<string, string>).purge === "true";
      try {
        const result = await lifecycle.unload(plugin.id, purge);
        await logPluginMutationActivity(actor, "plugin.uninstalled", plugin.id, { pluginId: plugin.id, pluginKey: plugin.pluginKey, purge });
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "uninstalled" } });
        return result;
      } catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 400; return { error: message }; }
    })

    .post("/plugins/:pluginId/enable", async ({ params, actor, set }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      try {
        const result = await lifecycle.enable(plugin.id);
        await logPluginMutationActivity(actor, "plugin.enabled", plugin.id, { pluginId: plugin.id, pluginKey: plugin.pluginKey, version: result?.version ?? plugin.version });
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "enabled" } });
        return result;
      } catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 400; return { error: message }; }
    })

    .post("/plugins/:pluginId/disable", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const reason = (body as Record<string, unknown> | undefined)?.reason as string | undefined;
      try {
        const result = await lifecycle.disable(plugin.id, reason);
        await logPluginMutationActivity(actor, "plugin.disabled", plugin.id, { pluginId: plugin.id, pluginKey: plugin.pluginKey, reason: reason ?? null });
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "disabled" } });
        return result;
      } catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 400; return { error: message }; }
    })

    .get("/plugins/:pluginId/health", async ({ params, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
      checks.push({ name: "registry", passed: true, message: "Plugin found in registry" });
      const hasValidManifest = Boolean(plugin.manifestJson?.id);
      checks.push({ name: "manifest", passed: hasValidManifest, message: hasValidManifest ? "Manifest is valid" : "Manifest is invalid or missing" });
      const isHealthy = plugin.status === "ready";
      checks.push({ name: "status", passed: isHealthy, message: `Current status: ${plugin.status}` });
      const hasNoError = !plugin.lastError;
      if (!hasNoError) checks.push({ name: "error_state", passed: false, message: plugin.lastError ?? undefined });
      return { pluginId: plugin.id, status: plugin.status, healthy: isHealthy && hasValidManifest && hasNoError, checks, lastError: plugin.lastError ?? undefined };
    })

    .get("/plugins/:pluginId/logs", async ({ params, query, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const q = query as Record<string, string>;
      const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 500);
      const conditions = [eq(pluginLogs.pluginId, plugin.id)];
      if (q.level) conditions.push(eq(pluginLogs.level, q.level));
      if (q.since) conditions.push(gte(pluginLogs.createdAt, new Date(q.since)));
      return db.select().from(pluginLogs).where(and(...conditions)).orderBy(desc(pluginLogs.createdAt)).limit(limit);
    })

    .post("/plugins/:pluginId/upgrade", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const version = (body as Record<string, unknown> | undefined)?.version as string | undefined;
      try {
        const result = await lifecycle.upgrade(plugin.id, version);
        await logPluginMutationActivity(actor, "plugin.upgraded", plugin.id, { pluginId: plugin.id, pluginKey: plugin.pluginKey, previousVersion: plugin.version, version: result?.version ?? plugin.version, targetVersion: version ?? null });
        publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "upgraded" } });
        return result;
      } catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 400; return { error: message }; }
    })

    .get("/plugins/:pluginId/config", async ({ params, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      return registry.getConfig(plugin.id);
    })

    .post("/plugins/:pluginId/config", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const parsed = body as { configJson?: unknown } | undefined;
      if (!parsed?.configJson || typeof parsed.configJson !== "object") throw badRequest("configJson is required and must be an object");
      const configJson = parsed.configJson as Record<string, unknown>;
      // Strip devUiUrl unless the caller is an instance admin (SSRF prevention)
      if ("devUiUrl" in configJson && !(actor.type === "board" && actor.isInstanceAdmin)) {
        delete configJson.devUiUrl;
      }
      // Validate configJson against the plugin's instanceConfigSchema (if declared)
      const schema = plugin.manifestJson?.instanceConfigSchema;
      if (schema && Object.keys(schema as Record<string, unknown>).length > 0) {
        const validation = validateInstanceConfig(configJson, schema);
        if (!validation.valid) { set.status = 400; return { error: "Configuration does not match the plugin's instanceConfigSchema", fieldErrors: validation.errors }; }
      }
      try {
        const config = await registry.upsertConfig(plugin.id, { configJson });
        await logPluginMutationActivity(actor, "plugin.config.updated", plugin.id, { pluginId: plugin.id, pluginKey: plugin.pluginKey, configKeyCount: Object.keys(configJson).length });
        // Notify the running worker about the config change
        if (bridgeDeps?.workerManager?.isRunning(plugin.id)) {
          try {
            await bridgeDeps.workerManager.call(plugin.id, "configChanged", { config: configJson } as any);
          } catch (rpcErr) {
            if (rpcErr instanceof JsonRpcCallError && rpcErr.code === PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED) {
              try { await lifecycle.restartWorker(plugin.id); } catch { /* restart failure is non-fatal */ }
            }
          }
        }
        return config;
      } catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 400; return { error: message }; }
    })

    .post("/plugins/:pluginId/config/test", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (plugin.status !== "ready") { set.status = 400; return { error: `Plugin is not ready (current status: ${plugin.status})` }; }
      const parsed = body as { configJson?: Record<string, unknown> } | undefined;
      if (!parsed?.configJson || typeof parsed.configJson !== "object") throw badRequest("configJson is required and must be an object");
      // Fast schema-level rejection before hitting the worker RPC
      const schema = plugin.manifestJson?.instanceConfigSchema;
      if (schema && Object.keys(schema as Record<string, unknown>).length > 0) {
        const validation = validateInstanceConfig(parsed.configJson, schema);
        if (!validation.valid) { set.status = 400; return { error: "Configuration does not match the plugin's instanceConfigSchema", fieldErrors: validation.errors }; }
      }
      try {
        const result = await bridgeDeps.workerManager.call(plugin.id, "validateConfig", { config: parsed.configJson } as any) as { ok?: boolean; warnings?: string[]; errors?: string[] };
        if (result.ok) {
          const warningText = result.warnings?.length ? `Warnings: ${result.warnings.join("; ")}` : undefined;
          return { valid: true, message: warningText };
        } else {
          const errorText = result.errors?.length ? result.errors.join("; ") : "Configuration validation failed.";
          return { valid: false, message: errorText };
        }
      } catch (err) {
        if (err instanceof JsonRpcCallError && err.code === PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED) return { valid: false, supported: false, message: "This plugin does not support configuration testing." };
        const bridgeError = mapRpcErrorToBridgeError(err); set.status = 502; return bridgeError;
      }
    })

    // === Jobs ===
    .get("/plugins/:pluginId/jobs", async ({ params, query, actor, set }) => {
      assertBoard(actor);
      if (!jobDeps) { set.status = 501; return { error: "Job scheduling is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const q = query as Record<string, string>;
      const validStatuses = ["active", "paused", "failed"];
      if (q.status !== undefined && !validStatuses.includes(q.status)) { set.status = 400; return { error: `Invalid status '${q.status}'. Must be one of: ${validStatuses.join(", ")}` }; }
      try { return await jobDeps.jobStore.listJobs(plugin.id, q.status as "active" | "paused" | "failed" | undefined); }
      catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 500; return { error: message }; }
    })

    .get("/plugins/:pluginId/jobs/:jobId/runs", async ({ params, query, actor, set }) => {
      assertBoard(actor);
      if (!jobDeps) { set.status = 501; return { error: "Job scheduling is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const job = await jobDeps.jobStore.getJobByIdForPlugin(plugin.id, params.jobId);
      if (!job) { set.status = 404; return { error: "Job not found" }; }
      const limit = Math.min(Math.max(Number((query as Record<string, string>).limit) || 25, 1), 500);
      try { return await jobDeps.jobStore.listRunsByJob(params.jobId, limit); }
      catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 500; return { error: message }; }
    })

    .post("/plugins/:pluginId/jobs/:jobId/trigger", async ({ params, actor, set }) => {
      assertBoard(actor);
      if (!jobDeps) { set.status = 501; return { error: "Job scheduling is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const job = await jobDeps.jobStore.getJobByIdForPlugin(plugin.id, params.jobId);
      if (!job) { set.status = 404; return { error: "Job not found" }; }
      try { const result = await jobDeps.scheduler.triggerJob(params.jobId, "manual"); return result; }
      catch (err) { const message = err instanceof Error ? err.message : String(err); set.status = 400; return { error: message }; }
    })

    // === Webhooks (PUBLIC — no auth) ===
    .post("/plugins/:pluginId/webhooks/:endpointKey", async ({ params, request, set }) => {
      if (!webhookDeps) { set.status = 501; return { error: "Webhook ingestion is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (plugin.status !== "ready") throw badRequest(`Plugin is not ready (current status: ${plugin.status})`);
      const manifest = plugin.manifestJson;
      if (!manifest) throw badRequest("Plugin manifest is missing");
      if (!(manifest.capabilities ?? []).includes("webhooks.receive")) throw badRequest("Plugin does not have the webhooks.receive capability");
      const declaredWebhooks = manifest.webhooks ?? [];
      if (!declaredWebhooks.find((w: { endpointKey: string }) => w.endpointKey === params.endpointKey)) { set.status = 404; return { error: `Webhook endpoint '${params.endpointKey}' is not declared by this plugin` }; }

      const requestId = randomUUID();
      const rawHeaders: Record<string, string> = {};
      for (const [key, value] of request.headers.entries()) rawHeaders[key] = value;
      const rawBody = await request.clone().text();
      let parsedBody: unknown;
      try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = rawBody; }
      const payload = typeof parsedBody === "object" && parsedBody !== null ? parsedBody as Record<string, unknown> : {};

      const startedAt = new Date();
      const [delivery] = await db.insert(pluginWebhookDeliveries).values({ pluginId: plugin.id, webhookKey: params.endpointKey, status: "pending", payload, headers: rawHeaders, startedAt }).returning({ id: pluginWebhookDeliveries.id });

      try {
        await webhookDeps.workerManager.call(plugin.id, "handleWebhook", { endpointKey: params.endpointKey, headers: rawHeaders, rawBody, parsedBody, requestId });
        const finishedAt = new Date();
        await db.update(pluginWebhookDeliveries).set({ status: "success", durationMs: finishedAt.getTime() - startedAt.getTime(), finishedAt }).where(eq(pluginWebhookDeliveries.id, delivery.id));
        return { deliveryId: delivery.id, status: "success" };
      } catch (err) {
        const finishedAt = new Date();
        const errorMessage = err instanceof Error ? err.message : String(err);
        await db.update(pluginWebhookDeliveries).set({ status: "failed", durationMs: finishedAt.getTime() - startedAt.getTime(), error: errorMessage, finishedAt }).where(eq(pluginWebhookDeliveries.id, delivery.id));
        set.status = 502;
        return { deliveryId: delivery.id, status: "failed", error: errorMessage };
      }
    })

    // === Dashboard ===
    .get("/plugins/:pluginId/dashboard", async ({ params, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");

      // --- Worker diagnostics ---
      let worker: {
        status: string;
        pid: number | null;
        uptime: number | null;
        consecutiveCrashes: number;
        totalCrashes: number;
        pendingRequests: number;
        lastCrashAt: number | null;
        nextRestartAt: number | null;
      } | null = null;
      const wm = bridgeDeps?.workerManager ?? webhookDeps?.workerManager ?? null;
      if (wm) {
        const handle = (wm as any).getWorker?.(plugin.id);
        if (handle) {
          const diag = handle.diagnostics();
          worker = { status: diag.status, pid: diag.pid, uptime: diag.uptime, consecutiveCrashes: diag.consecutiveCrashes, totalCrashes: diag.totalCrashes, pendingRequests: diag.pendingRequests, lastCrashAt: diag.lastCrashAt, nextRestartAt: diag.nextRestartAt };
        }
      }

      // --- Recent job runs (last 10, newest first) ---
      let recentJobRuns: Array<{ id: string; jobId: string; jobKey?: string; trigger: string; status: string; durationMs: number | null; error: string | null; startedAt: string | null; finishedAt: string | null; createdAt: string }> = [];
      if (jobDeps) {
        try {
          const runs = await jobDeps.jobStore.listRunsByPlugin(plugin.id, undefined, 10);
          const jobs = await jobDeps.jobStore.listJobs(plugin.id);
          const jobKeyMap = new Map(jobs.map((j: any) => [j.id, j.jobKey]));
          recentJobRuns = runs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r: any) => ({
            id: r.id, jobId: r.jobId, jobKey: jobKeyMap.get(r.jobId) ?? undefined, trigger: r.trigger, status: r.status, durationMs: r.durationMs, error: r.error,
            startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : null, finishedAt: r.finishedAt ? new Date(r.finishedAt).toISOString() : null, createdAt: new Date(r.createdAt).toISOString(),
          }));
        } catch { /* job data unavailable */ }
      }

      // --- Recent webhook deliveries (last 10, newest first) ---
      let recentWebhookDeliveries: Array<{ id: string; webhookKey: string; status: string; durationMs: number | null; error: string | null; startedAt: string | null; finishedAt: string | null; createdAt: string }> = [];
      try {
        const deliveries = await db.select({
          id: pluginWebhookDeliveries.id, webhookKey: pluginWebhookDeliveries.webhookKey, status: pluginWebhookDeliveries.status,
          durationMs: pluginWebhookDeliveries.durationMs, error: pluginWebhookDeliveries.error,
          startedAt: pluginWebhookDeliveries.startedAt, finishedAt: pluginWebhookDeliveries.finishedAt, createdAt: pluginWebhookDeliveries.createdAt,
        }).from(pluginWebhookDeliveries).where(eq(pluginWebhookDeliveries.pluginId, plugin.id)).orderBy(desc(pluginWebhookDeliveries.createdAt)).limit(10);
        recentWebhookDeliveries = deliveries.map((d) => ({
          id: d.id, webhookKey: d.webhookKey, status: d.status, durationMs: d.durationMs, error: d.error,
          startedAt: d.startedAt ? d.startedAt.toISOString() : null, finishedAt: d.finishedAt ? d.finishedAt.toISOString() : null, createdAt: d.createdAt.toISOString(),
        }));
      } catch { /* webhook data unavailable */ }

      // --- Health check ---
      const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
      checks.push({ name: "registry", passed: true, message: "Plugin found in registry" });
      const hasValidManifest = Boolean(plugin.manifestJson?.id);
      checks.push({ name: "manifest", passed: hasValidManifest, message: hasValidManifest ? "Manifest is valid" : "Manifest is invalid or missing" });
      const isHealthy = plugin.status === "ready";
      checks.push({ name: "status", passed: isHealthy, message: `Current status: ${plugin.status}` });
      const hasNoError = !plugin.lastError;
      if (!hasNoError) checks.push({ name: "error_state", passed: false, message: plugin.lastError ?? undefined });

      return {
        pluginId: plugin.id, worker, recentJobRuns, recentWebhookDeliveries,
        health: { pluginId: plugin.id, status: plugin.status, healthy: isHealthy && hasValidManifest && hasNoError, checks, lastError: plugin.lastError ?? undefined },
        checkedAt: new Date().toISOString(),
      };
    });
}
