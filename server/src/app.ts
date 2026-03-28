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
import { cors } from "@elysiajs/cors";
import { openapi } from "@elysiajs/openapi";
import { staticPlugin } from "@elysiajs/static";
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
  resolveSession?: (headers: Headers) => Promise<{ user?: { id: string } | null } | null>;
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
    resolveSession,
  } = opts;

  const auth = authPlugin({ db, deploymentMode, resolveSession });

  const app = new Elysia({ prefix: "/api" })
    // -- Global plugins --
    .use(cors())
    .use(errorHandler)
    .use(auth)
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
    .use(issueRoutes(db, auth))
    .use(accessRoutes(db, auth))
    .use(companySkillRoutes(db, auth))
    .use(assetRoutes(db, auth, storageService))
    .use(pluginRoutes(db, auth))
    .use(pluginUiStaticRoutes(db));

  // -- Root-level app (WebSocket + static UI) --
  const rootApp = new Elysia()
    .use(app)
    .use(liveEventsWs(db, { deploymentMode, resolveSessionFromHeaders: resolveSession }));

  // -- Static UI serving (SPA fallback) --
  if (opts.serveUi !== false) {
    rootApp.use(
      staticPlugin({
        assets: "ui-dist",
        prefix: "/",
        alwaysStatic: true,
        noCache: false,
        indexHTML: true,
      }),
    );
  }

  return rootApp;
}

/** App type for Eden Treaty — import this in the frontend. */
export type App = ReturnType<typeof createApp>;
