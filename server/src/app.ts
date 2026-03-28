/**
 * ClawDev API — Elysia application factory.
 *
 * Creates the complete HTTP server with all route modules, middleware,
 * WebSocket support, and static UI serving. Runs natively on Bun.
 *
 * Eden Treaty types are exported for type-safe frontend consumption:
 *   import type { App } from "@clawdev/server";
 *   import { treaty } from "@elysiajs/eden";
 *   const api = treaty<App>("localhost:3100");
 */

import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { boardMutationGuard } from "./plugins/board-mutation-guard.js";
import { privateHostnameGuard } from "./plugins/private-hostname-guard.js";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import type { Db } from "@clawdev/db";
import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { heartbeatRuns, instanceUserRoles, invites } from "@clawdev/db";
import type { DeploymentExposure, DeploymentMode } from "@clawdev/shared";
import { readPersistedDevServerStatus, toDevServerHealthStatus } from "./dev-server-status.js";
import { instanceSettingsService } from "./services/instance-settings.js";
import { serverVersion } from "./version.js";

// Plugins
import { errorHandler } from "./plugins/error-handler.js";
import { authPlugin } from "./plugins/auth.js";
import type { StorageService } from "./storage/types.js";
import { DEFAULT_LOCAL_PLUGIN_DIR, pluginLoader } from "./services/plugin-loader.js";
import { createPluginWorkerManager } from "./services/plugin-worker-manager.js";
import { createPluginJobScheduler } from "./services/plugin-job-scheduler.js";
import { pluginJobStore } from "./services/plugin-job-store.js";
import { createPluginToolDispatcher } from "./services/plugin-tool-dispatcher.js";
import { pluginLifecycleManager } from "./services/plugin-lifecycle.js";
import { createPluginJobCoordinator } from "./services/plugin-job-coordinator.js";
import { buildHostServices, flushPluginLogBuffer } from "./services/plugin-host-services.js";
import { createPluginEventBus } from "./services/plugin-event-bus.js";
import { setPluginEventBus } from "./services/activity-log.js";
import { createPluginDevWatcher } from "./services/plugin-dev-watcher.js";
import { createPluginHostServiceCleanup } from "./services/plugin-host-service-cleanup.js";
import { pluginRegistryService } from "./services/plugin-registry.js";
import { createHostClientHandlers } from "@clawdev/plugin-sdk";
import { logger } from "./middleware/logger.js";
import { applyUiBranding } from "./ui-branding.js";
import type { PluginRouteJobDeps, PluginRouteWebhookDeps, PluginRouteToolDeps, PluginRouteBridgeDeps } from "./routes/plugins.js";

// Route modules
import { dashboardRoutes } from "./routes/dashboard.js";
import { sidebarBadgeRoutes } from "./routes/sidebar-badges.js";
import { goalRoutes } from "./routes/goals.js";
import { activityRoutes } from "./routes/activity.js";
import { secretRoutes } from "./routes/secrets.js";
import { projectRoutes } from "./routes/projects.js";
import { routineRoutes } from "./routes/routines.js";
import { instanceSettingsRoutes } from "./routes/instance-settings.js";
import { llmRoutes } from "./routes/llms.js";
import { approvalRoutes } from "./routes/approvals.js";
import { executionWorkspaceRoutes } from "./routes/execution-workspaces.js";
import { costRoutes } from "./routes/costs.js";
import { companyRoutes } from "./routes/companies.js";
import { agentRoutes } from "./routes/agents.js";
import { issueRoutes } from "./routes/issues.js";
import { accessRoutes } from "./routes/access.js";
import { pluginRoutes } from "./routes/plugins.js";
import { pluginUiStaticRoutes } from "./routes/plugin-ui-static.js";
import { assetRoutes } from "./routes/assets.js";
import { companySkillRoutes } from "./routes/company-skills.js";

// WebSocket
import { liveEventsWs } from "./realtime/live-events-ws.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppOptions {
  db: Db;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  companyDeletionEnabled: boolean;
  storageService?: StorageService;
  serveUi?: boolean;
  bindHost?: string;
  allowedHostnames?: string[];
  localPluginDir?: string;
  instanceId?: string;
  hostVersion?: string;
  resolveSession?: (headers: Headers) => Promise<{ user?: { id: string } | null } | null>;
  /** better-auth instance — mounted via .mount(auth.handler) for native Web API auth */
  betterAuth?: { handler: (request: Request) => Promise<Response> | Response };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export function createApp(opts: AppOptions) {
  const {
    db,
    deploymentMode,
    deploymentExposure,
    authReady,
    companyDeletionEnabled,
    storageService,
    bindHost = "127.0.0.1",
    allowedHostnames = [],
    localPluginDir = DEFAULT_LOCAL_PLUGIN_DIR,
    resolveSession,
  } = opts;

  const auth = authPlugin({ db, deploymentMode, resolveSession });

  const serverPort = Number(process.env.PORT) || 3101;

  const app = new Elysia({ prefix: "/api" })
    // -- Global plugins --
    .use(cors({ credentials: true }))
    .use(errorHandler)
    .use(privateHostnameGuard({
      enabled: deploymentExposure === "private",
      allowedHostnames,
      bindHost,
    }))
    .use(auth)
    .use(boardMutationGuard({ serverPort }))
    .use(
      openapi({
        documentation: {
          info: { title: "ClawDev API", version: serverVersion },
        },
      }),
    )

    // -- Health --
    .get("/health", async () => {
      let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
      let bootstrapInviteActive = false;

      if (deploymentMode === "authenticated") {
        const roleCount = await db
          .select({ count: count() })
          .from(instanceUserRoles)
          .where(sql`${instanceUserRoles.role} = 'instance_admin'`)
          .then((rows: { count: number }[]) => Number(rows[0]?.count ?? 0));
        bootstrapStatus = roleCount > 0 ? "ready" : "bootstrap_pending";

        if (bootstrapStatus === "bootstrap_pending") {
          const now = new Date();
          const inviteCount = await db
            .select({ count: count() })
            .from(invites)
            .where(
              and(
                eq(invites.inviteType, "bootstrap_ceo"),
                isNull(invites.revokedAt),
                isNull(invites.acceptedAt),
                gt(invites.expiresAt, now),
              ),
            )
            .then((rows: { count: number }[]) => Number(rows[0]?.count ?? 0));
          bootstrapInviteActive = inviteCount > 0;
        }
      }

      const persistedDevServerStatus = readPersistedDevServerStatus();
      let devServer: ReturnType<typeof toDevServerHealthStatus> | undefined;
      if (persistedDevServerStatus) {
        const settings = instanceSettingsService(db);
        const experimentalSettings = await settings.getExperimental();
        const activeRunCount = await db
          .select({ count: count() })
          .from(heartbeatRuns)
          .where(inArray(heartbeatRuns.status, ["queued", "running"]))
          .then((rows: { count: number }[]) => Number(rows[0]?.count ?? 0));
        devServer = toDevServerHealthStatus(persistedDevServerStatus, {
          autoRestartEnabled: experimentalSettings.autoRestartDevServerWhenIdle ?? false,
          activeRunCount,
        });
      }

      return {
        status: "ok" as const,
        version: serverVersion,
        deploymentMode,
        deploymentExposure,
        authReady,
        bootstrapStatus,
        bootstrapInviteActive,
        features: { companyDeletionEnabled },
        ...(devServer ? { devServer } : {}),
      };
    })

    // -- Route modules --
    .use(dashboardRoutes(db, auth))
    .use(sidebarBadgeRoutes(db, auth))
    .use(goalRoutes(db, auth))
    .use(activityRoutes(db, auth))
    .use(secretRoutes(db, auth))
    .use(projectRoutes(db, auth))
    .use(routineRoutes(db, auth))
    .use(instanceSettingsRoutes(db, auth))
    .use(llmRoutes(db, auth))
    .use(approvalRoutes(db, auth))
    .use(executionWorkspaceRoutes(db, auth))
    .use(costRoutes(db, auth))
    .use(companyRoutes(db, auth, storageService))
    .use(agentRoutes(db, auth))
    .use(issueRoutes(db, auth, storageService!))
    .use(accessRoutes(db, auth, {
      deploymentMode,
      deploymentExposure,
      bindHost,
      allowedHostnames,
    }))
    .use(companySkillRoutes(db, auth))
    .use(assetRoutes(db, auth, storageService));

  // -- Plugin lifecycle initialization --
  const hostServicesDisposers = new Map<string, () => void>();
  const workerManager = createPluginWorkerManager();
  const pluginRegistry = pluginRegistryService(db);
  const eventBus = createPluginEventBus();
  setPluginEventBus(eventBus);
  const jobStoreInstance = pluginJobStore(db);
  const lifecycle = pluginLifecycleManager(db, { workerManager });
  const scheduler = createPluginJobScheduler({ db, jobStore: jobStoreInstance, workerManager });
  const toolDispatcher = createPluginToolDispatcher({ workerManager, lifecycleManager: lifecycle, db });
  const jobCoordinator = createPluginJobCoordinator({ db, lifecycle, scheduler, jobStore: jobStoreInstance });
  const hostServiceCleanup = createPluginHostServiceCleanup(lifecycle, hostServicesDisposers);
  const loader = pluginLoader(
    db,
    { localPluginDir },
    {
      workerManager,
      eventBus,
      jobScheduler: scheduler,
      jobStore: jobStoreInstance,
      toolDispatcher,
      lifecycleManager: lifecycle,
      instanceInfo: {
        instanceId: opts.instanceId ?? "default",
        hostVersion: opts.hostVersion ?? serverVersion,
      },
      buildHostHandlers: (pluginId: string, manifest: { id: string; capabilities: string[] }) => {
        const notifyWorker = (method: string, params: unknown) => {
          const handle = workerManager.getWorker(pluginId);
          if (handle) handle.notify(method, params);
        };
        const services = buildHostServices(db, pluginId, manifest.id, eventBus, notifyWorker);
        hostServicesDisposers.set(pluginId, () => services.dispose());
        return createHostClientHandlers({ pluginId, capabilities: manifest.capabilities, services });
      },
    },
  );

  const pluginJobDeps: PluginRouteJobDeps = { scheduler, jobStore: jobStoreInstance };
  const pluginWebhookDeps: PluginRouteWebhookDeps = { workerManager };
  const pluginToolDeps: PluginRouteToolDeps = { toolDispatcher };
  const pluginBridgeDeps: PluginRouteBridgeDeps = { workerManager };

  app
    .use(pluginRoutes(db, auth, loader, pluginJobDeps, pluginWebhookDeps, pluginToolDeps, pluginBridgeDeps))
    .use(pluginUiStaticRoutes(db, { localPluginDir }));

  // Start plugin services
  jobCoordinator.start();
  scheduler.start();
  void toolDispatcher.initialize().catch((err: unknown) => {
    logger.error({ err }, "Failed to initialize plugin tool dispatcher");
  });
  const devWatcher = createPluginDevWatcher(
    lifecycle,
    async (pluginId: string) => (await pluginRegistry.getById(pluginId))?.packagePath ?? null,
  );
  void loader.loadAll().then((result: { results: Array<{ success: boolean; plugin: { id: string; packagePath?: string | null } }> } | null) => {
    if (!result) return;
    for (const loaded of result.results) {
      if (loaded.success && loaded.plugin.packagePath) {
        devWatcher.watch(loaded.plugin.id, loaded.plugin.packagePath);
      }
    }
  }).catch((err: unknown) => {
    logger.error({ err }, "Failed to load ready plugins on startup");
  });
  process.once("exit", () => {
    devWatcher?.close();
    hostServiceCleanup.disposeAll();
    hostServiceCleanup.teardown();
  });
  process.once("beforeExit", () => {
    void flushPluginLogBuffer();
  });

  // -- Root-level app (auth handler + WebSocket + static UI) --
  // Use node() adapter only when running under Node.js; Bun runs natively.
  const isBun = typeof globalThis.Bun !== "undefined";
  const rootApp = new Elysia(isBun ? {} : { adapter: node() })
    .use(cors({ credentials: true }));

  // Mount better-auth handler at /api/auth/* (native Web API — passes full request)
  if (opts.betterAuth) {
    const authHandler = opts.betterAuth.handler;
    rootApp.all("/api/auth/*", async ({ request }) => {
      const response = await authHandler(request);
      return response;
    });
  }

  rootApp
    .use(app)
    .use(liveEventsWs(db, { deploymentMode, resolveSessionFromHeaders: resolveSession }));

  // -- Static UI serving (SPA fallback) --
  if (opts.serveUi !== false) {
    const uiDistDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ui-dist");
    const MIME_TYPES: Record<string, string> = {
      ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
      ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
      ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2",
      ".ttf": "font/ttf", ".webp": "image/webp", ".avif": "image/avif",
    };
    // Pre-compute branded index.html at startup
    const indexHtmlPath = path.join(uiDistDir, "index.html");
    const brandedIndexHtml = fs.existsSync(indexHtmlPath)
      ? applyUiBranding(fs.readFileSync(indexHtmlPath, "utf-8"))
      : null;

    rootApp.get("/*", ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return;
      let filePath = path.join(uiDistDir, url.pathname);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const withIndex = path.join(filePath, "index.html");
        if (fs.existsSync(withIndex)) { filePath = withIndex; }
        else {
          // SPA fallback — serve branded index.html
          if (brandedIndexHtml) return new Response(brandedIndexHtml, { headers: { "content-type": "text/html" } });
          filePath = path.join(uiDistDir, "index.html");
        }
      }
      if (!fs.existsSync(filePath)) return new Response("Not Found", { status: 404 });
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      // Apply branding to HTML files
      if (ext === ".html") {
        const html = applyUiBranding(fs.readFileSync(filePath, "utf-8"));
        return new Response(html, { headers: { "content-type": "text/html" } });
      }
      const body = fs.readFileSync(filePath);
      return new Response(body, { headers: { "content-type": contentType } });
    });
  }

  return rootApp;
}

/** App type for Eden Treaty — import this in the frontend. */
export type App = ReturnType<typeof createApp>;
