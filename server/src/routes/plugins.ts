import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
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
import { resolvePlugin, listBundledPluginExamples } from "../routes/plugins.js";
import type { PluginRouteJobDeps, PluginRouteWebhookDeps, PluginRouteToolDeps, PluginRouteBridgeDeps } from "../routes/plugins.js";

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
import { elysiaAuth, type Actor } from "../plugins/auth.js";
import { badRequest, notFound } from "../errors.js";

export function elysiaPluginRoutes(
  db: Db,
  authPlugin: ReturnType<typeof elysiaAuth>,
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
      if (parsed.companyId) assertCompanyAccess(actor, parsed.companyId);
      if (!bridgeDeps.workerManager.isRunning(plugin.id)) { set.status = 502; return { code: "WORKER_UNAVAILABLE", message: "Plugin worker is not running" }; }
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
      if (parsed.companyId) assertCompanyAccess(actor, parsed.companyId);
      if (!bridgeDeps.workerManager.isRunning(plugin.id)) { set.status = 502; return { code: "WORKER_UNAVAILABLE", message: "Plugin worker is not running" }; }
      try { const result = await bridgeDeps.workerManager.call(plugin.id, "performAction", { key: parsed.key, params: parsed.params ?? {}, companyId: parsed.companyId ?? null, renderEnvironment: parsed.renderEnvironment ?? null } as any); return { data: result }; }
      catch (err) { const bridgeError = mapRpcErrorToBridgeError(err); set.status = 502; return bridgeError; }
    })

    // === REST-friendly bridge variants ===
    .post("/plugins/:pluginId/data/:key", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const parsed = body as { companyId?: string; params?: Record<string, unknown>; renderEnvironment?: PluginLauncherRenderContextSnapshot | null } | undefined;
      if (parsed?.companyId) assertCompanyAccess(actor, parsed.companyId);
      if (!bridgeDeps.workerManager.isRunning(plugin.id)) { set.status = 502; return { code: "WORKER_UNAVAILABLE", message: "Plugin worker is not running" }; }
      try { const result = await bridgeDeps.workerManager.call(plugin.id, "getData", { key: params.key, params: parsed?.params ?? {}, companyId: parsed?.companyId ?? null, renderEnvironment: parsed?.renderEnvironment ?? null } as any); return { data: result }; }
      catch (err) { set.status = 502; return mapRpcErrorToBridgeError(err); }
    })
    .post("/plugins/:pluginId/actions/:key", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      if (!bridgeDeps) { set.status = 501; return { error: "Plugin bridge is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const parsed = body as { companyId?: string; params?: Record<string, unknown>; renderEnvironment?: PluginLauncherRenderContextSnapshot | null } | undefined;
      if (parsed?.companyId) assertCompanyAccess(actor, parsed.companyId);
      if (!bridgeDeps.workerManager.isRunning(plugin.id)) { set.status = 502; return { code: "WORKER_UNAVAILABLE", message: "Plugin worker is not running" }; }
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
      const worker = bridgeDeps?.workerManager ? { supportedMethods: bridgeDeps.workerManager.isRunning(plugin.id) ? (bridgeDeps.workerManager as any).getWorkerInfo?.(plugin.id)?.supportedMethods ?? [] : [] } : null;
      return { ...plugin, supportsConfigTest: worker?.supportedMethods?.includes?.("validateConfig") ?? false };
    })

    .delete("/plugins/:pluginId", async ({ params, query, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const purge = (query as Record<string, string>).purge === "true";
      await lifecycle.unload(plugin.id, purge);
      const updated = await registry.getById(plugin.id);
      await logPluginMutationActivity(actor, "plugin.uninstalled", plugin.id, { pluginKey: plugin.pluginKey, purge });
      publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "uninstalled" } });
      return updated ?? plugin;
    })

    .post("/plugins/:pluginId/enable", async ({ params, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      await lifecycle.enable(plugin.id);
      const updated = await registry.getById(plugin.id);
      await logPluginMutationActivity(actor, "plugin.enabled", plugin.id, { pluginKey: plugin.pluginKey });
      publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "enabled" } });
      return updated ?? plugin;
    })

    .post("/plugins/:pluginId/disable", async ({ params, body, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const reason = (body as Record<string, unknown> | undefined)?.reason as string | undefined;
      await lifecycle.disable(plugin.id, reason);
      const updated = await registry.getById(plugin.id);
      await logPluginMutationActivity(actor, "plugin.disabled", plugin.id, { pluginKey: plugin.pluginKey, reason: reason ?? null });
      publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "disabled" } });
      return updated ?? plugin;
    })

    .get("/plugins/:pluginId/health", async ({ params, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const checks: Array<{ name: string; passed: boolean; message?: string }> = [];
      checks.push({ name: "plugin_registered", passed: true, message: `Plugin '${plugin.pluginKey}' is registered` });
      checks.push({ name: "status_ready", passed: plugin.status === "ready", message: plugin.status === "ready" ? "Plugin status is ready" : `Plugin status is '${plugin.status}' (expected ready)` });
      const hasManifest = Boolean(plugin.manifestJson);
      checks.push({ name: "manifest_present", passed: hasManifest, message: hasManifest ? "Manifest is present" : "Manifest is missing" });
      const isWorkerRunning = bridgeDeps?.workerManager?.isRunning(plugin.id) ?? false;
      checks.push({ name: "worker_running", passed: isWorkerRunning, message: isWorkerRunning ? "Worker process is running" : "Worker process is not running" });
      return { pluginId: plugin.id, status: plugin.status, healthy: checks.every((c) => c.passed), checks, lastError: plugin.lastError ?? undefined };
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

    .post("/plugins/:pluginId/upgrade", async ({ params, body, actor }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const version = (body as Record<string, unknown> | undefined)?.version as string | undefined;
      await lifecycle.upgrade(plugin.id, version);
      const updated = await registry.getById(plugin.id);
      await logPluginMutationActivity(actor, "plugin.upgraded", plugin.id, { pluginKey: plugin.pluginKey, version: updated?.version ?? plugin.version });
      publishGlobalLiveEvent({ type: "plugin.ui.updated", payload: { pluginId: plugin.id, action: "upgraded" } });
      return updated ?? plugin;
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
      // Strip devUiUrl in production
      if (process.env.NODE_ENV === "production") delete configJson.devUiUrl;
      const manifest = plugin.manifestJson;
      if (((manifest as any)?.config?.schema)) {
        const validation = validateInstanceConfig((manifest as any).config.schema, configJson);
        if (!validation.valid) { set.status = 422; return { error: "Config validation failed", details: validation.errors }; }
      }
      const config = await registry.upsertConfig(plugin.id, { configJson });
      if (bridgeDeps?.workerManager?.isRunning(plugin.id)) {
        try { await bridgeDeps.workerManager.call(plugin.id, "configChanged", { configJson } as any); } catch { /* ignore */ }
      }
      await logPluginMutationActivity(actor, "plugin.config.updated", plugin.id, { pluginKey: plugin.pluginKey });
      return config;
    })

    .post("/plugins/:pluginId/config/test", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      if (!bridgeDeps?.workerManager?.isRunning(plugin.id)) { set.status = 501; return { valid: false, message: "Worker is not running — cannot test config", supported: false }; }
      const parsed = body as { configJson?: unknown } | undefined;
      if (!parsed?.configJson) throw badRequest("configJson is required");
      try {
        const result = await bridgeDeps.workerManager.call(plugin.id, "validateConfig", { configJson: parsed.configJson } as any);
        return { valid: (result as unknown as Record<string, unknown>).valid ?? true, message: (result as unknown as Record<string, unknown>).message ?? null, supported: true };
      } catch (err) {
        if (err instanceof JsonRpcCallError && err.code === PLUGIN_RPC_ERROR_CODES.METHOD_NOT_IMPLEMENTED) return { valid: false, message: "Plugin does not implement config validation", supported: false };
        return { valid: false, message: err instanceof Error ? err.message : String(err), supported: true };
      }
    })

    // === Jobs ===
    .get("/plugins/:pluginId/jobs", async ({ params, query, actor, set }) => {
      assertBoard(actor);
      if (!jobDeps) { set.status = 501; return { error: "Plugin job scheduling is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const q = query as Record<string, string>;
      return jobDeps.jobStore.listJobs(plugin.id, q.status as any);
    })

    .get("/plugins/:pluginId/jobs/:jobId/runs", async ({ params, query, actor, set }) => {
      assertBoard(actor);
      if (!jobDeps) { set.status = 501; return { error: "Plugin job scheduling is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const limit = Math.min(Math.max(Number((query as Record<string, string>).limit) || 25, 1), 500);
      return jobDeps.jobStore.listRunsByPlugin(params.jobId, undefined, limit);
    })

    .post("/plugins/:pluginId/jobs/:jobId/trigger", async ({ params, actor, set }) => {
      assertBoard(actor);
      if (!jobDeps) { set.status = 501; return { error: "Plugin job scheduling is not enabled" }; }
      const plugin = await resolvePlugin(registry, params.pluginId);
      if (!plugin) throw notFound("Plugin not found");
      const result = await jobDeps.scheduler.triggerJob(params.jobId, "manual");
      set.status = 202;
      return result;
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
      const isWorkerRunning = bridgeDeps?.workerManager?.isRunning(plugin.id) ?? false;
      const workerDiagnostics = { running: isWorkerRunning, pid: null as number | null, uptimeMs: null as number | null };
      const recentJobs = jobDeps ? await jobDeps.jobStore.listJobs(plugin.id) : [];
      const recentDeliveries = await db.select().from(pluginWebhookDeliveries).where(eq(pluginWebhookDeliveries.pluginId, plugin.id)).orderBy(desc(pluginWebhookDeliveries.startedAt)).limit(10);
      const checks: Array<{ name: string; passed: boolean; message?: string }> = [
        { name: "plugin_registered", passed: true },
        { name: "status_ready", passed: plugin.status === "ready", message: plugin.status !== "ready" ? `Status: ${plugin.status}` : undefined },
        { name: "worker_running", passed: isWorkerRunning },
      ];
      return { plugin: { id: plugin.id, pluginKey: plugin.pluginKey, status: plugin.status, version: plugin.version, lastError: plugin.lastError }, worker: workerDiagnostics, jobs: recentJobs, webhookDeliveries: recentDeliveries, health: { healthy: checks.every((c) => c.passed), checks } };
    });
}
