/**
 * Auth plugin — resolves actor identity + provides auth macro for route protection.
 *
 * Architecture:
 * - `derive` resolves the actor (board/agent/none) for EVERY request (global context)
 * - `macro.auth` provides opt-in route protection: `{ auth: true }` rejects unauthenticated
 * - `macro.requireBoard` ensures board-level access
 * - `macro.requireAdmin` ensures instance admin access
 *
 * Pattern follows Elysia 1.4 macro best practices:
 * - Macros use `resolve` (runs after validation) with `return status()` for proper
 *   HTTP codes and Eden Treaty type inference.
 *
 * @see https://elysiajs.com/patterns/macro
 * @see https://elysiajs.com/essential/best-practice
 */

import { createHash } from "node:crypto";
import { Elysia, status } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentApiKeys, agents, companyMemberships, instanceUserRoles } from "@clawdev/db";
import { verifyLocalAgentJwt } from "../agent-auth-jwt.js";
import type { DeploymentMode } from "@clawdev/shared";
import { logger } from "../middleware/logger.js";
import { boardAuthService } from "../services/board-auth.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface Actor {
  type: "board" | "agent" | "none";
  userId?: string;
  agentId?: string;
  companyId?: string;
  companyIds?: string[];
  isInstanceAdmin?: boolean;
  runId?: string;
  source: string;
}

interface AuthPluginOptions {
  db: Db;
  deploymentMode: DeploymentMode;
  resolveSession?: (headers: Headers) => Promise<{ user?: { id: string } | null } | null>;
}

// ---------------------------------------------------------------------------
// Actor resolution (internal)
// ---------------------------------------------------------------------------

async function resolveActor(
  opts: AuthPluginOptions,
  boardAuth: ReturnType<typeof boardAuthService>,
  headers: Headers,
): Promise<Actor> {
  const runIdHeader = headers.get("x-clawdev-run-id") ?? undefined;

  // Local trusted mode: try session-based auth first, fall back to implicit board access
  if (opts.deploymentMode === "local_trusted") {
    // Check for agent bearer token first (agents still need explicit auth)
    const authHeader = headers.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      // Fall through to bearer token handling below
    } else if (opts.resolveSession) {
      // Try better-auth session — allows real user login in local_trusted mode
      try {
        const session = await opts.resolveSession(headers);
        if (session?.user?.id) {
          const userId = session.user.id;
          const memberships = await opts.db
              .select({ companyId: companyMemberships.companyId })
              .from(companyMemberships)
              .where(
                and(
                  eq(companyMemberships.principalType, "user"),
                  eq(companyMemberships.principalId, userId),
                  eq(companyMemberships.status, "active"),
                ),
              );
          return {
            type: "board",
            userId,
            companyIds: memberships.map((row: { companyId: string }) => row.companyId),
            // In local_trusted mode, all session users are implicitly instance admins
            isInstanceAdmin: true,
            runId: runIdHeader,
            source: "session",
          };
        }
      } catch {
        // Session resolution failed — fall through to implicit
      }
    }

    // No bearer token and no session — use implicit board access
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return {
        type: "board",
        userId: "local-board",
        isInstanceAdmin: true,
        runId: runIdHeader,
        source: "local_implicit",
      };
    }
  }

  const authHeader = headers.get("authorization");

  // No bearer token: try session-based auth
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    if (opts.resolveSession) {
      try {
        const session = await opts.resolveSession(headers);
        if (session?.user?.id) {
          const userId = session.user.id;
          const [roleRow, memberships] = await Promise.all([
            opts.db
              .select({ id: instanceUserRoles.id })
              .from(instanceUserRoles)
              .where(and(eq(instanceUserRoles.userId, userId), eq(instanceUserRoles.role, "instance_admin")))
              .then((rows: { id: string }[]) => rows[0] ?? null),
            opts.db
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
            type: "board",
            userId,
            companyIds: memberships.map((row: { companyId: string }) => row.companyId),
            isInstanceAdmin: Boolean(roleRow),
            runId: runIdHeader,
            source: "session",
          };
        }
      } catch (err: unknown) {
        logger.warn({ err }, "Failed to resolve auth session");
      }
    }

    return { type: "none", runId: runIdHeader, source: "none" };
  }

  // Bearer token: try agent API key or JWT
  const token = authHeader.slice("bearer ".length).trim();
  if (!token) {
    return { type: "none", source: "none" };
  }

  // Try local agent JWT first
  const jwtPayload = verifyLocalAgentJwt(token);
  if (jwtPayload) {
    return {
      type: "agent",
      agentId: jwtPayload.sub,
      companyId: jwtPayload.company_id,
      runId: runIdHeader ?? jwtPayload.run_id,
      source: "jwt",
    };
  }

  // Try hashed API key lookup
  const keyHash = hashToken(token);
  const keyRow = await opts.db
    .select({ agentId: agentApiKeys.agentId, companyId: agents.companyId })
    .from(agentApiKeys)
    .innerJoin(agents, eq(agents.id, agentApiKeys.agentId))
    .where(and(eq(agentApiKeys.keyHash, keyHash), isNull(agentApiKeys.revokedAt)))
    .then((rows: { agentId: string; companyId: string }[]) => rows[0] ?? null);

  if (keyRow) {
    return {
      type: "agent",
      agentId: keyRow.agentId,
      companyId: keyRow.companyId,
      runId: runIdHeader,
      source: "api_key",
    };
  }

  // Try board API key
  const boardKeyRow = await boardAuth.findBoardApiKeyByToken(token);
  if (boardKeyRow) {
    const boardAccess = await boardAuth.resolveBoardAccess(boardKeyRow.userId);
    return {
      type: "board",
      userId: boardKeyRow.userId,
      companyIds: boardAccess.companyIds,
      isInstanceAdmin: boardAccess.isInstanceAdmin,
      runId: runIdHeader,
      source: "board_api_key",
    };
  }

  return { type: "none", source: "bearer_unrecognized" };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

/**
 * Auth plugin with macro-based route protection.
 *
 * Usage:
 *   const auth = authPlugin({ db, deploymentMode });
 *
 *   app.use(auth)
 *     .get("/public", () => "hello")                           // no auth
 *     .get("/protected", ({ actor }) => actor, { auth: true }) // requires auth
 *     .get("/admin", ({ actor }) => actor, { requireAdmin: true }) // requires instance admin
 */
export function authPlugin(opts: AuthPluginOptions) {
  const boardAuth = boardAuthService(opts.db);

  return new Elysia({ name: "auth" })
    // Global actor resolution — runs for every request
    .derive(async ({ request }): Promise<{ actor: Actor }> => {
      const actor = await resolveActor(opts, boardAuth, request.headers);
      return { actor };
    })
    // Macros for opt-in route protection
    .macro({
      /**
       * Require any authenticated actor (board or agent).
       * Usage: `{ auth: true }`
       */
      auth: {
        resolve({ actor }) {
          if (!actor || actor.type === "none") {
            return status(401, { error: "Authentication required" });
          }
          return { actor };
        },
      },
      /**
       * Require board-level access.
       * Usage: `{ requireBoard: true }`
       */
      requireBoard: {
        resolve({ actor }) {
          if (!actor || actor.type !== "board") {
            return status(403, { error: "Board access required" });
          }
          return { actor };
        },
      },
      /**
       * Require instance admin access.
       * Usage: `{ requireAdmin: true }`
       */
      requireAdmin: {
        resolve({ actor }) {
          if (!actor || actor.type !== "board") {
            return status(403, { error: "Instance admin access required" });
          }
          if (actor.source !== "local_implicit" && !actor.isInstanceAdmin) {
            return status(403, { error: "Instance admin access required" });
          }
          return { actor };
        },
      },
    })
    .as("global");
}
