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
import { node } from "@elysiajs/node";
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
import { serverVersion } from "./version.js";

// Middleware
import { elysiaLogger, elysiaErrorHandler } from "./middleware/index.js";

// Route modules
import {
  issueRoutes,
  companyIssueRoutes,
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
  routineRoutes,
  approvalRoutes,
  runRoutes,
  inboxRoutes,
  budgetRoutes,
} from "./routes/index.js";
import { llmRoutes } from "./routes/llms.js";
import { executionWorkspaceRoutes } from "./routes/execution-workspaces.js";
import { sidebarBadgeRoutes } from "./routes/sidebar-badges.js";
import { pluginUiStaticRoutes } from "./routes/plugin-ui-static.js";

// WebSocket
import { liveEventsElysiaWs } from "./realtime/live-events-ws.js";
import type { BetterAuthSessionResult } from "./auth/better-auth.js";

// Storage
import type { StorageService } from "./storage/types.js";

// Static UI serving
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ElysiaAppOptions {
  db: Db;
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  authHandler?: (request: Request) => Promise<Response> | Response;
  companyDeletionEnabled: boolean;
  storage: StorageService;
  serveUi?: boolean;
  localPluginDir?: string;
  resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
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

  const app = new Elysia({ prefix: "/api" })
    // -- Global middleware --
    .use(cors())
    .use(elysiaLogger)
    .use(elysiaErrorHandler)
    .use(
      swagger({
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

      const persistedDevServerStatus = readPersistedDevServerStatus();
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
        features: { companyDeletionEnabled },
        ...(devServer ? { devServer } : {}),
      };
    })

    // -- Companies (inline, simple CRUD) --
    .get("/companies", async () => {
      const rows = await db.select().from(companies);
      return rows;
    })
    .get(
      "/companies/:companyId",
      async ({ params }) => {
        const rows = await db.select().from(companies).where(eq(companies.id, params.companyId));
        if (rows.length === 0) return new Response("Not found", { status: 404 });
        return rows[0];
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // -- Route modules --
    .use(agentRoutes(db))
    .use(issueRoutes(db))
    .use(companyIssueRoutes(db))
    .use(projectRoutes(db))
    .use(goalRoutes(db))
    .use(secretRoutes(db))
    .use(instanceSettingsRoutes(db))
    .use(companySkillRoutes(db))
    .use(accessRoutes(db))
    .use(activityRoutes(db))
    .use(costRoutes(db))
    .use(dashboardRoutes(db))
    .use(routineRoutes(db))
    .use(approvalRoutes(db))
    .use(executionWorkspaceRoutes(db))
    .use(sidebarBadgeRoutes(db))
    .use(runRoutes(db))
    .use(inboxRoutes(db))
    .use(budgetRoutes(db))
    .use(assetRoutes(db, storage));

  // -- Plugins (conditional — requires plugin deps) --
  if (pluginDeps) {
    app.use(pluginRoutes({ db, ...pluginDeps }));
  }

  // -- Root-level app (non-/api routes + websocket + static UI) --
  const authApp = new Elysia({ prefix: "/api/auth" })
    .get("/get-session", async ({ request }) => {
      if (!authHandler) return new Response("Not found", { status: 404 });
      return authHandler(request);
    })
    .all("/", async ({ request }) => {
      if (!authHandler) return new Response("Not found", { status: 404 });
      return authHandler(request);
    })
    .all("/*", async ({ request }) => {
      if (!authHandler) return new Response("Not found", { status: 404 });
      return authHandler(request);
    });

  const rootApp = new Elysia({ adapter: node() })
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

  // -- Static UI serving (SPA fallback) --
  if (opts.serveUi !== false) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
      path.resolve(__dirname, "../ui-dist"),
      path.resolve(__dirname, "../../svelte-ui/build"),
      path.resolve(__dirname, "../../ui/dist"),
    ];
    const uiDist = candidates.find((p) => fs.existsSync(path.join(p, "index.html")));
    if (uiDist) {
      const indexHtml = applyUiBranding(fs.readFileSync(path.join(uiDist, "index.html"), "utf-8"));

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

        return new Response(indexHtml, {
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
