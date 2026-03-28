/**
 * Elysia application — incrementally replaces Express routes.
 *
 * Migration strategy:
 * 1. Elysia handles new/migrated routes
 * 2. Unmigrated routes remain in Express (served separately)
 * 3. Once all routes are migrated, Express is removed
 *
 * Eden Treaty types are exported for type-safe client consumption.
 */
import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { and, count, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { heartbeatRuns, instanceUserRoles, invites } from "@clawdev/db";
import type { DeploymentExposure, DeploymentMode } from "@clawdev/shared";
import { readPersistedDevServerStatus, toDevServerHealthStatus } from "./dev-server-status.js";
import { instanceSettingsService } from "./services/instance-settings.js";
import { serverVersion } from "./version.js";
import { elysiaErrorHandler } from "./elysia-plugins/error-handler.js";
import { elysiaAuth } from "./elysia-plugins/auth.js";
import type { StorageService } from "./storage/types.js";

export function createElysiaApp(
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    authReady: boolean;
    companyDeletionEnabled: boolean;
    storageService?: StorageService;
    resolveSession?: (headers: Headers) => Promise<{ user?: { id: string } | null } | null>;
  },
) {
  const app = new Elysia({ prefix: "/api" })
    .use(elysiaErrorHandler)
    .use(
      elysiaAuth({
        db,
        deploymentMode: opts.deploymentMode,
        resolveSession: opts.resolveSession,
      }),
    )
    .get("/health", async () => {
      let bootstrapStatus: "ready" | "bootstrap_pending" = "ready";
      let bootstrapInviteActive = false;

      if (opts.deploymentMode === "authenticated") {
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
        deploymentMode: opts.deploymentMode,
        deploymentExposure: opts.deploymentExposure,
        authReady: opts.authReady,
        bootstrapStatus,
        bootstrapInviteActive,
        features: {
          companyDeletionEnabled: opts.companyDeletionEnabled,
        },
        ...(devServer ? { devServer } : {}),
      };
    });

  return app;
}

/** Export the app type for Eden Treaty client generation */
export type ElysiaApp = ReturnType<typeof createElysiaApp>;
