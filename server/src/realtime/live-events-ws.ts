/**
 * Live events WebSocket — Elysia port.
 *
 * Uses Elysia's native WebSocket support (backed by Bun's native WS or uWS)
 * instead of the `ws` npm package + manual HTTP upgrade handling.
 *
 * Clients connect to: /api/companies/:companyId/events/ws
 * Auth: Bearer token (agent API key) or session cookie (board user)
 *
 * The Elysia ws plugin provides:
 * - Built-in ping/pong keepalive
 * - Schema validation for params
 * - Typed context with derive
 * - Automatic connection cleanup
 */

import { createHash, randomUUID } from "node:crypto";
import { Elysia, t } from "elysia";
// Bun-native runtime — no adapter needed
import type { Db } from "@clawdev/db";
import { agentApiKeys, companyMemberships, instanceUserRoles } from "@clawdev/db";
import { and, eq, isNull } from "drizzle-orm";
import type { DeploymentMode } from "@clawdev/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger } from "../middleware/logger.js";
import { subscribeCompanyLiveEvents } from "../services/live-events.js";

const log = logger.child({ service: "live-events-ws" });

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

interface WsUpgradeContext {
  companyId: string;
  actorType: "board" | "agent";
  actorId: string;
}

export function liveEventsElysiaWs(
  db: Db,
  opts: {
    deploymentMode: DeploymentMode;
    resolveSessionFromHeaders?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
  },
) {
  /** Map of WebSocket ID → cleanup function (live event unsubscribe) */
  const cleanupMap = new WeakMap<object, () => void>();

  return new Elysia()
    .ws("/api/companies/:companyId/events/ws", {
      params: t.Object({ companyId: t.String() }),

      // Auth runs before the upgrade completes
      async beforeHandle({ params, request, set }) {
        const { companyId } = params;
        const authHeader = request.headers.get("authorization");
        const url = new URL(request.url);
        const queryToken = url.searchParams.get("token")?.trim() ?? "";

        // Extract bearer token
        let token: string | null = null;
        if (authHeader?.toLowerCase().startsWith("bearer ")) {
          token = authHeader.slice("bearer ".length).trim() || null;
        }
        if (!token && queryToken.length > 0) {
          token = queryToken;
        }

        // No token — check board context
        if (!token) {
          if (opts.deploymentMode === "local_trusted") {
            return; // allow
          }

          if (opts.deploymentMode === "authenticated" && opts.resolveSessionFromHeaders) {
            const session = await opts.resolveSessionFromHeaders(request.headers as unknown as Headers);
            const userId = session?.user?.id;
            if (!userId) {
              set.status = 403;
              return "Forbidden";
            }

            // Verify user has access to this company
            const [roleRow, memberships] = await Promise.all([
              db
                .select({ id: instanceUserRoles.id })
                .from(instanceUserRoles)
                .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
                .then((rows) => rows[0] ?? null),
              db
                .select({ companyId: companyMemberships.companyId })
                .from(companyMemberships)
                .where(
                  and(
                    eq(companyMemberships.principalType, "user"),
                    eq(companyMemberships.principalId, userId),
                    eq(companyMemberships.status, "active"),
                  ),
                ),
            ]);

            const hasAccess = !!roleRow || memberships.some((r) => r.companyId === companyId);
            if (!hasAccess) {
              set.status = 403;
              return "Forbidden";
            }
            return; // allow
          }

          set.status = 403;
          return "Forbidden";
        }

        // Token-based auth (agent API key)
        const tokenHash = hashToken(token);
        const key = await db
          .select()
          .from(agentApiKeys)
          .where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
          .then((rows) => rows[0] ?? null);

        if (!key || key.companyId !== companyId) {
          set.status = 403;
          return "Forbidden";
        }

        // Update last used
        await db
          .update(agentApiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(agentApiKeys.id, key.id));
      },

      open(ws) {
        try {
          const companyId = ws.data?.params?.companyId;
          if (!companyId) {
            log.warn({ wsId: randomUUID() }, "WebSocket opened without company context");
            ws.close();
            return;
          }

          const wsId = randomUUID();
          log.info({ companyId, wsId }, "WebSocket connected");

          // Subscribe to live events for this company
          const unsubscribe = subscribeCompanyLiveEvents(companyId, (event) => {
            try {
              ws.send(JSON.stringify(event));
            } catch {
              // Client may have disconnected
            }
          });

          cleanupMap.set(ws as unknown as object, unsubscribe);
        } catch (error) {
          log.warn({ err: error }, "WebSocket open handler failed");
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
      },

      close(ws) {
        const cleanup = cleanupMap.get(ws as unknown as object);
        if (cleanup) {
          cleanup();
          cleanupMap.delete(ws as unknown as object);
        }

        const companyId = ws.data?.params?.companyId;
        log.info({ companyId }, "WebSocket disconnected");
      },

      error: ((ws: any, error: any) => {
        const companyId = ws.data.params.companyId;
        log.warn({ err: error, companyId }, "WebSocket error");
      }) as any,

      // Send ping every 30s to keep connection alive
      idleTimeout: 60,
    });
}
