/**
 * Elysia application — complete replacement for Express.
 *
 * Mounts ALL route modules (health, companies, agents, issues, projects,
 * goals, plugins, assets, settings, skills, access, activity, costs,
 * dashboard, routines, approvals) plus middleware (logger, error handler).
 *
 * Exports the App type for Eden Treaty type-safe client generation.
 *
 * Usage:
 *   import { createElysiaApp, type App } from "./elysia-app.js";
 *   const app = createElysiaApp({ db, ... });
 *   app.listen(3100);
 */

import { Elysia, t } from "elysia";
// Bun-native runtime — no adapter needed
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import type { Db } from "@clawdev/db";
import {
  count,
  eq,
  and,
  gt,
  isNull,
  inArray,
  sql,
} from "drizzle-orm";
import {
  companies,
  heartbeatRuns,
  instanceUserRoles,
  invites,
} from "@clawdev/db";
import type { DeploymentExposure, DeploymentMode } from "@clawdev/shared";
import { readPersistedDevServerStatus, toDevServerHealthStatus } from "./dev-server-status.js";
import { instanceSettingsService } from "./services/instance-settings.js";
import { buildSystemReport } from "./services/system-report.js";
import { serverVersion } from "./version.js";
import { HttpError } from "./errors.js";

// Middleware
import { elysiaLogger, elysiaErrorHandler } from "./middleware/index.js";
import { createActorResolver } from "./middleware/auth.js";
import { checkBoardMutation } from "./middleware/board-mutation-guard.js";

// Route modules
import {
  companyIssueRoutes,
  issueRoutes,
  commentRoutes,
  companyRoutes,
  projectRoutes,
  goalRoutes,
  secretRoutes,
  instanceSettingsRoutes,
  companySkillRoutes,
  agentRoutes,
  accessRoutes,
  activityRoutes,
  costRoutes,
  dashboardRoutes,
  documentRoutes,
  routineRoutes,
  approvalRoutes,
  runRoutes,
  inboxRoutes,
  budgetRoutes,
  searchRoutes,
  modelRoutes,
  agentTeamRoutes,
  agentDelegationRoutes,
  agentPipelineRoutes,
  agentDeliberationRoutes,
  agentTemplateRoutes,
  teamKnowledgeRoutes,
  channelRoutes,
  logsRoutes,
  agentHookRoutes,
} from "./routes/index.js";
import { llmRoutes } from "./routes/llms.js";
import { executionWorkspaceRoutes } from "./routes/execution-workspaces.js";
import { sidebarBadgeRoutes } from "./routes/sidebar-badges.js";
import { pluginUiStaticRoutes } from "./routes/plugin-ui-static.js";

// WebSocket
import { liveEventsElysiaWs } from "./realtime/live-events-ws.js";
import type { BetterAuthSessionResult } from "./auth/better-auth.js";
import { assertBoard, type Actor } from "./middleware/authz.js";

// Storage
import type { StorageService } from "./storage/types.js";

// Static UI serving & vite-dev proxy
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { applyUiBranding } from "./ui-branding.js";

// Plugin deps
import type { PluginJobScheduler } from "./services/plugin-job-scheduler.js";
import type { PluginJobStore } from "./services/plugin-job-store.js";
import type { PluginWorkerManager } from "./services/plugin-worker-manager.js";
import type { PluginStreamBus } from "./services/plugin-stream-bus.js";
import type { PluginToolDispatcher } from "./services/plugin-tool-dispatcher.js";
import { pluginRoutes } from "./routes/plugins.js";
import { assetRoutes } from "./routes/assets.js";
import { DEFAULT_LOCAL_PLUGIN_DIR } from "./services/plugin-loader.js";
import { pluginRegistryService } from "./services/plugin-registry.js";
import type { EmbeddingProviderConfig } from "./services/embedding-service.js";
import { logger as sharedLogger } from "./middleware/logger.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UiMode = "static" | "vite-dev" | "none";

export async function rewriteApiNotFoundResponse(
  request: Request,
  status: number,
  response: unknown,
): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/api/")) return null;
  if (status !== 404) return null;

  if (response instanceof Response) {
    const bodyText = await response.clone().text().catch(() => "");
    if (bodyText !== "{\"error\":\"Not found\"}" && bodyText !== "Not found") {
      return null;
    }
  }

  const body =
    pathname.startsWith("/api/plugins/") ? { error: "Plugin not found" } : { error: "API route not found" };

  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function buildAuthGetSessionResponse(actor: Actor): Response | null {
  if (actor.type !== "board" || !actor.userId) return null;

  return new Response(
    JSON.stringify({
      session: {
        id: `paperclip:${actor.source}:${actor.userId}`,
        userId: actor.userId,
      },
      user: {
        id: actor.userId,
        email: null,
        name: actor.source === "local_implicit" ? "Local Board" : null,
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    },
  );
}

async function buildPluginDetailResponse(
  registry: ReturnType<typeof pluginRegistryService>,
  workerManager: PluginWorkerManager | undefined,
  pluginId: string,
  actor: Actor,
  set: { status?: number },
) {
  assertBoard(actor);
  let plugin = await registry.getById(pluginId).catch(() => null);
  if (!plugin) {
    plugin = await registry.getByKey(pluginId).catch(() => null);
  }
  if (!plugin) {
    set.status = 404;
    return { error: "Plugin not found" };
  }

  const worker = workerManager?.getWorker?.(plugin.id);
  const supportsConfigTest = worker
    ? worker.supportedMethods?.includes("validateConfig")
    : false;

  return { ...plugin, supportsConfigTest };
}

export interface ElysiaAppOptions {
  db: Db;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  authHandler?: (request: Request) => Promise<Response> | Response;
  companyDeletionEnabled: boolean;
  storage: StorageService;
  serveUi?: boolean;
  /** UI serving mode: "static" serves from ui-dist, "vite-dev" proxies to SvelteKit dev server, "none" disables UI. */
  uiMode?: UiMode;
  localPluginDir?: string;
  resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
  /** Embedding provider config (openai | local | null). When null, search returns empty results. */
  embeddingConfig?: EmbeddingProviderConfig;
  pluginDeps?: {
    jobScheduler: PluginJobScheduler;
    jobStore: PluginJobStore;
    workerManager: PluginWorkerManager;
    streamBus: PluginStreamBus;
    toolDispatcher: PluginToolDispatcher;
  };
}

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

export function createElysiaApp(opts: ElysiaAppOptions) {
  const {
    db,
    deploymentMode,
    deploymentExposure,
    authReady,
    authHandler,
    companyDeletionEnabled,
    storage,
    resolveSessionFromHeaders,
    pluginDeps,
  } = opts;

  let app: any = new Elysia({ prefix: "/api" })
    // -- Global middleware --
    .use(cors())
    .use(elysiaLogger)
    .use(elysiaErrorHandler)
    .derive(
      createActorResolver(db, {
        deploymentMode,
        resolveSession: resolveSessionFromHeaders,
      }),
    )
    .onBeforeHandle((ctx: any) => {
      const blocked = checkBoardMutation(ctx.request, ctx.actor);
      if (blocked) {
        ctx.set.status = blocked.status;
        return blocked.body;
      }
    })
    .onAfterHandle({ as: "global" }, async (...args: any[]) => {
      const [ctx, response] = args as [any, any];
      const rewritten = await rewriteApiNotFoundResponse(ctx.request, ctx.set.status ?? 200, response);
      if (rewritten) return rewritten;
    })
    .use(
      swagger({
        documentation: {
          info: { title: "ClawDev API", version: serverVersion },
        },
      }),
    )

    // -- Health --
    .get("/health", async () => {
      try {
        await db.execute(sql`SELECT 1`);
      } catch {
        return new Response(
          JSON.stringify({
            status: "unhealthy",
            version: serverVersion,
            error: "database_unreachable",
          }),
          {
            status: 503,
            headers: { "content-type": "application/json" },
          },
        );
      }

      let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
      let bootstrapInviteActive = false;

      if (deploymentMode === "authenticated") {
        const roleCount = await db
          .select({ count: count() })
          .from(instanceUserRoles)
          .where(sql`${instanceUserRoles.role} = 'instance_admin'`)
          .then((rows) => Number(rows[0]?.count ?? 0));
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
            .then((rows) => Number(rows[0]?.count ?? 0));
          bootstrapInviteActive = inviteCount > 0;
        }
      }

      const companyCount = await db
        .select({ count: count() })
        .from(companies)
        .then((rows) => Number(rows[0]?.count ?? 0));
      const hasCompanies = companyCount > 0;
      const systemReport = await buildSystemReport(db);

      const persistedDevServerStatus = await readPersistedDevServerStatus();
      let devServer: ReturnType<typeof toDevServerHealthStatus> | undefined;
      if (persistedDevServerStatus) {
        const settings = instanceSettingsService(db);
        const experimentalSettings = await settings.getExperimental();
        const activeRunCount = await db
          .select({ count: count() })
          .from(heartbeatRuns)
          .where(inArray(heartbeatRuns.status, ["queued", "running"]))
          .then((rows) => Number(rows[0]?.count ?? 0));
        devServer = toDevServerHealthStatus(persistedDevServerStatus, {
          autoRestartEnabled: experimentalSettings.autoRestartDevServerWhenIdle ?? false,
          activeRunCount,
        });
      }

      return {
        status: "ok",
        version: serverVersion,
        deploymentMode,
        deploymentExposure,
        authReady,
        bootstrapStatus,
        bootstrapInviteActive,
        hasCompanies,
        features: { companyDeletionEnabled },
        diagnostics: systemReport,
        ...(devServer ? { devServer } : {}),
      };
    })

    // -- Route modules --
    .use(companyIssueRoutes(db))
    .use(companyRoutes(db, storage))
    .use(runRoutes(db))
    .use(agentRoutes(db))
    .use(issueRoutes(db))
    .use(commentRoutes(db))
    .use(projectRoutes(db))
    .use(goalRoutes(db))
    .use(secretRoutes(db))
    .use(instanceSettingsRoutes(db))
    .use(companySkillRoutes(db))
    .use(accessRoutes(db))
    .use(activityRoutes(db))
    .use(costRoutes(db))
    .use(dashboardRoutes(db))
    .use(documentRoutes(db))
    .use(routineRoutes(db))
    .use(approvalRoutes(db))
    .use(executionWorkspaceRoutes(db))
    .use(sidebarBadgeRoutes(db))
    .use(inboxRoutes(db))
    .use(budgetRoutes(db))
    .use(assetRoutes(db, storage))
    .use(searchRoutes(db, opts.embeddingConfig ?? null))
    .use(modelRoutes(db))
    .use(agentTeamRoutes(db))
    .use(agentDelegationRoutes(db))
    .use(agentPipelineRoutes(db))
    .use(agentDeliberationRoutes(db))
    .use(agentTemplateRoutes(db))
    .use(teamKnowledgeRoutes(db))
    .use(channelRoutes(db))
    .use(agentHookRoutes(db));

  // -- Logs (real-time streaming) --
  app = app.use(logsRoutes());

  // -- Plugins (conditional — requires plugin deps) --
  if (pluginDeps) {
    app = app.use(pluginRoutes({ db, ...pluginDeps }));
    app = app.get(
      "/plugins/:pluginId",
      async ({ params, set, ...ctx }: any) => {
        return buildPluginDetailResponse(
          pluginRegistryService(db),
          pluginDeps.workerManager,
          params.pluginId,
          ctx.actor,
          set,
        );
      },
      { params: t.Object({ pluginId: t.String() }) },
    );
  }

  // -- Root-level app (non-/api routes + websocket + static UI) --
  const resolveAuthActor = createActorResolver(db, {
    deploymentMode,
    resolveSession: resolveSessionFromHeaders,
  });

  const authApp = new Elysia({ prefix: "/api/auth" })
    .get("/get-session", async ({ request }) => {
      const { actor } = await resolveAuthActor({ request });
      const response = buildAuthGetSessionResponse(actor);
      if (response) return response;
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    })
    .all("/", async ({ request }) => {
      if (!authHandler) return new Response("Not found", { status: 404 });
      return authHandler(request);
    })
    .all("/*", async ({ request }) => {
      if (!authHandler) return new Response("Not found", { status: 404 });
      return authHandler(request);
    });

  const rootErrorLog = sharedLogger.child({ service: "root-error-handler" });

  let rootApp: any = new Elysia()
    // Global error handler — ensures DB/runtime errors never leak to clients
    .onError(({ code, error, set, request }) => {
      const url = new URL(request.url);

      switch (code) {
        case "NOT_FOUND":
          set.status = 404;
          if (url.pathname.startsWith("/api/plugins/")) {
            return { error: "Plugin not found" };
          }
          return url.pathname.startsWith("/api/")
            ? { error: "API route not found" }
            : { error: "Not found" };
        case "VALIDATION":
          set.status = 400;
          return { error: "Validation error", details: (error as Error).message };
        case "PARSE":
          set.status = 400;
          return { error: "Invalid request body" };
        default:
          if (error instanceof HttpError) {
            set.status = error.status;
            return error.details
              ? { error: error.message, details: error.details }
              : { error: error.message };
          }
          const msg = (error as any)?.message ?? String(error);
          rootErrorLog.error(
            { category: "error", code, err: msg, stack: (error as any)?.stack, path: url.pathname },
            `Unhandled error in ${url.pathname}`
          );
          set.status = 500;
          return { error: "Internal server error" };
      }
    })
    // LLM reflection routes (mounted at /llms, outside /api)
    .use(llmRoutes(db))
    // Plugin UI static files (mounted at /_plugins)
    .use(pluginUiStaticRoutes(db, { localPluginDir: opts.localPluginDir ?? DEFAULT_LOCAL_PLUGIN_DIR }))
    // API routes
    .use(app)
    // WebSocket
    .use(
      liveEventsElysiaWs(db, {
        deploymentMode,
        resolveSessionFromHeaders,
      }),
    );

  // -- UI serving --
  // Resolve effective UI mode: explicit uiMode takes precedence, then fall back to serveUi flag
  const effectiveUiMode: UiMode = opts.uiMode ?? (opts.serveUi !== false ? "static" : "none");

  if (effectiveUiMode === "vite-dev") {
    const uiDevPort = Number(process.env.CLAWDEV_UI_PORT) || 5174;
    // Reverse-proxy non-API requests to the SvelteKit dev server.
    // The SvelteKit vite.config.ts already proxies /api back to this server,
    // so the dev loop is: browser -> Elysia -> Vite for UI requests.
    const VITE_DEV_ORIGIN = `http://localhost:${uiDevPort}`;

    const isUiRequest = (pathname: string) =>
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/api") &&
      !pathname.startsWith("/llms/") &&
      !pathname.startsWith("/_plugins/");

    const proxyToVite = async ({ request, set }: any) => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/plugins/") && pluginDeps) {
        const pluginId = url.pathname.slice("/api/plugins/".length);
        if (pluginId) {
          const { actor } = await resolveAuthActor({ request });
          return buildPluginDetailResponse(
            pluginRegistryService(db),
            pluginDeps.workerManager,
            pluginId,
            actor,
            set,
          );
        }
      }
      if (!isUiRequest(url.pathname)) {
        set.status = 404;
        return { error: "Not found" };
      }

      const target = `${VITE_DEV_ORIGIN}${url.pathname}${url.search}`;
      try {
        // Forward the request to the Vite dev server
        const proxyHeaders = new Headers(request.headers);
        // Remove host so Vite sees its own origin
        proxyHeaders.delete("host");

        const proxyResp = await fetch(target, {
          method: request.method,
          headers: proxyHeaders,
          body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
          // @ts-expect-error -- duplex needed for streaming bodies in Node 20+
          duplex: request.method !== "GET" && request.method !== "HEAD" ? "half" : undefined,
          redirect: "manual",
        });

        // Return the proxied response directly
        return new Response(proxyResp.body, {
          status: proxyResp.status,
          statusText: proxyResp.statusText,
          headers: proxyResp.headers,
        });
      } catch {
        // Vite dev server not running yet — return a helpful message
        set.status = 502;
        set.headers["content-type"] = "text/html; charset=utf-8";
        return `<html><body style="font-family:system-ui;padding:2rem">
          <h1>Vite dev server not reachable</h1>
          <p>The SvelteKit dev server at <code>${VITE_DEV_ORIGIN}</code> is not running.</p>
          <p>Start it with: <code>pnpm --filter @clawdev/svelte-ui dev</code></p>
          <p>The API is still available at <code>/api/*</code>.</p>
        </body></html>`;
      }
    };

    rootApp
      .get("/", proxyToVite)
      .get("/*", proxyToVite)
      .get(
        "/api/plugins/:pluginId",
        async ({ request, params, set }: any) => {
          if (!pluginDeps) {
            set.status = 404;
            return { error: "API route not found" };
          }

          const { actor } = await resolveAuthActor({ request });
          return buildPluginDetailResponse(
            pluginRegistryService(db),
            pluginDeps.workerManager,
            params.pluginId,
            actor,
            set,
          );
        },
        { params: t.Object({ pluginId: t.String() }) },
      );

  } else if (effectiveUiMode === "static") {
    // Static UI serving (SPA fallback) — production mode
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(__dirname, "../ui-dist"),
      path.resolve(__dirname, "../../svelte-ui/build"),
    ];
    const uiDist = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
    if (uiDist) {
      // Use 200.html (SPA fallback with absolute paths) for non-root routes.
      // index.html has relative paths that break on nested URLs like /{companyPrefix}/dashboard.
      const fallbackPath = fs.existsSync(path.join(uiDist, "200.html"))
        ? path.join(uiDist, "200.html")
        : path.join(uiDist, "index.html");

      // Cache the fallback HTML but invalidate when the file changes on disk.
      // This prevents stale HTML (with old JS/CSS hashes) after a UI rebuild
      // without requiring a full server restart.
      let cachedFallbackHtml = applyUiBranding(fs.readFileSync(fallbackPath, "utf-8"));
      let cachedFallbackMtime = fs.statSync(fallbackPath).mtimeMs;

      function getFallbackHtml(): string {
        try {
          const currentMtime = fs.statSync(fallbackPath).mtimeMs;
          if (currentMtime !== cachedFallbackMtime) {
            cachedFallbackHtml = applyUiBranding(fs.readFileSync(fallbackPath, "utf-8"));
            cachedFallbackMtime = currentMtime;
          }
        } catch {
          // If stat fails, serve the cached version
        }
        return cachedFallbackHtml;
      }

      const mimeTypes: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".mjs": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".map": "application/json",
      };

      const serveStaticUi = async ({ request, set }: any) => {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/plugins/") && pluginDeps) {
          const pluginId = url.pathname.slice("/api/plugins/".length);
          if (pluginId) {
            const { actor } = await resolveAuthActor({ request });
            return buildPluginDetailResponse(
              pluginRegistryService(db),
              pluginDeps.workerManager,
              pluginId,
              actor,
              set,
            );
          }
        }
        if (
          url.pathname.startsWith("/api/") ||
          url.pathname.startsWith("/llms/") ||
          url.pathname.startsWith("/_plugins/")
        ) {
          set.status = 404;
          return { error: "Not found" };
        }

        const filePath = path.join(uiDist, url.pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mime = mimeTypes[ext] ?? "application/octet-stream";
          const headers: Record<string, string> = { "content-type": mime };
          if (url.pathname.includes("/immutable/")) {
            headers["cache-control"] = "public, max-age=31536000, immutable";
          }
          return new Response(fs.readFileSync(filePath), { headers });
        }

        return new Response(getFallbackHtml(), {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      };

      rootApp
        .get("/", serveStaticUi)
        .get("/*", serveStaticUi);
    }
  }

  rootApp.use(authApp);
  return rootApp;
}

/** App type for Eden Treaty — import this in the frontend. */
export type App = ReturnType<typeof createElysiaApp>;
