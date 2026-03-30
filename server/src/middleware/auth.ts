/**
 * Elysia auth middleware — resolves the actor (board user, agent, or none)
 * from the incoming request. Supports:
 *
 * 1. local_trusted mode — implicit board access
 * 2. BetterAuth session cookies — authenticated board users
 * 3. Board API keys (bearer token)
 * 4. Agent API keys (bearer token, hashed)
 * 5. Agent JWT (local adapter tokens)
 */

import { createHash } from "node:crypto";
import { Elysia } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentApiKeys, agents, companyMemberships, instanceUserRoles } from "@clawdev/db";
import { verifyLocalAgentJwt } from "../agent-auth-jwt.js";
import type { DeploymentMode } from "@clawdev/shared";
import type { BetterAuthSessionResult } from "../auth/better-auth.js";
import { logger } from "./logger.js";
import { boardAuthService } from "../services/board-auth.js";
import type { Actor } from "./authz.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface ActorMiddlewareOptions {
  deploymentMode: DeploymentMode;
  resolveSession?: (headers: Headers) => Promise<BetterAuthSessionResult | null>;
}

/**
 * Creates an Elysia plugin that resolves the actor from request headers
 * and attaches it to the context as `actor`.
 */
/**
 * Returns the raw derive function for resolving actor from request.
 * Use with `.derive(createActorResolver(db, opts))` directly on the Elysia chain.
 */
export function createActorResolver(db: Db, opts: ActorMiddlewareOptions) {
  const boardAuth = boardAuthService(db);

  return async ({ request }: { request: Request }): Promise<{ actor: Actor }> => {
      const headers = request.headers;

      // Default actor based on deployment mode
      let actor: Actor =
        opts.deploymentMode === "local_trusted"
          ? { type: "board", userId: "local-board", isInstanceAdmin: true, source: "local_implicit" }
          : { type: "none", source: "none" };

      const runIdHeader = headers.get("x-paperclip-run-id") ?? undefined;

      const authHeader = headers.get("authorization");
      if (!authHeader?.toLowerCase().startsWith("bearer ")) {
        // No bearer token — try session-based auth
        if (opts.deploymentMode === "authenticated" && opts.resolveSession) {
          let session: BetterAuthSessionResult | null = null;
          try {
            session = await opts.resolveSession(headers);
          } catch (err) {
            logger.warn(
              { err, url: request.url },
              "Failed to resolve auth session from request headers",
            );
          }
          if (session?.user?.id) {
            const userId = session.user.id;
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
            return {
              actor: {
                type: "board",
                userId,
                companyIds: memberships.map((row) => row.companyId),
                isInstanceAdmin: Boolean(roleRow),
                runId: runIdHeader,
                source: "session",
              },
            };
          }
        }
        if (runIdHeader) actor.runId = runIdHeader;
        return { actor };
      }

      const token = authHeader.slice("bearer ".length).trim();
      if (!token) {
        return { actor };
      }

      // Try board API key
      const boardKey = await boardAuth.findBoardApiKeyByToken(token);
      if (boardKey) {
        const access = await boardAuth.resolveBoardAccess(boardKey.userId);
        if (access.user) {
          await boardAuth.touchBoardApiKey(boardKey.id);
          return {
            actor: {
              type: "board",
              userId: boardKey.userId,
              companyIds: access.companyIds,
              isInstanceAdmin: access.isInstanceAdmin,
              keyId: boardKey.id,
              runId: runIdHeader,
              source: "board_key",
            },
          };
        }
      }

      // Try agent API key (hashed)
      const tokenHash = hashToken(token);
      const key = await db
        .select()
        .from(agentApiKeys)
        .where(and(eq(agentApiKeys.keyHash, tokenHash), isNull(agentApiKeys.revokedAt)))
        .then((rows) => rows[0] ?? null);

      if (!key) {
        // Try local agent JWT
        const claims = verifyLocalAgentJwt(token);
        if (!claims) {
          return { actor };
        }

        const agentRecord = await db
          .select()
          .from(agents)
          .where(eq(agents.id, claims.sub))
          .then((rows) => rows[0] ?? null);

        if (!agentRecord || agentRecord.companyId !== claims.company_id) {
          return { actor };
        }

        if (agentRecord.status === "terminated" || agentRecord.status === "pending_approval") {
          return { actor };
        }

        return {
          actor: {
            type: "agent",
            agentId: claims.sub,
            companyId: claims.company_id,
            keyId: undefined,
            runId: runIdHeader ?? claims.run_id ?? undefined,
            source: "agent_jwt",
          },
        };
      }

      // Valid agent API key found — update last used
      await db
        .update(agentApiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(agentApiKeys.id, key.id));

      const agentRecord = await db
        .select()
        .from(agents)
        .where(eq(agents.id, key.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agentRecord || agentRecord.status === "terminated" || agentRecord.status === "pending_approval") {
        return { actor };
      }

      return {
        actor: {
          type: "agent",
          agentId: key.agentId,
          companyId: key.companyId,
          keyId: key.id,
          runId: runIdHeader,
          source: "agent_key",
        },
      };
  };
}

/** Elysia plugin wrapper — kept for backward compatibility. */
export function actorMiddleware(db: Db, opts: ActorMiddlewareOptions) {
  return new Elysia({ name: "actor-middleware" }).derive(createActorResolver(db, opts));
}

/**
 * Guard — rejects requests without a board actor.
 */
export function requireBoard() {
  return new Elysia({ name: "require-board" }).onBeforeHandle(({ actor, set }: any) => {
    if (!actor || actor.type !== "board") {
      set.status = 401;
      return { error: "Unauthorized — board access required" };
    }
  });
}
