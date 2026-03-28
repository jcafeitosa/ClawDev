/**
 * Elysia auth plugin — equivalent to Express actorMiddleware.
 * Resolves the actor (board user, agent, or none) from request headers.
 */
import { createHash } from "node:crypto";
import { Elysia } from "elysia";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentApiKeys, agents, companyMemberships, instanceUserRoles } from "@clawdev/db";
import { verifyLocalAgentJwt } from "../agent-auth-jwt.js";
import type { DeploymentMode } from "@clawdev/shared";
import { logger } from "../middleware/logger.js";
import { boardAuthService } from "../services/board-auth.js";

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

export function elysiaAuth(opts: AuthPluginOptions) {
  const boardAuth = boardAuthService(opts.db);

  return new Elysia({ name: "auth" }).derive(
    async ({ request }): Promise<{ actor: Actor }> => {
      const headers = request.headers;
      const runIdHeader = headers.get("x-clawdev-run-id") ?? undefined;

      // Local trusted mode: implicit board access
      if (opts.deploymentMode === "local_trusted") {
        return {
          actor: {
            type: "board",
            userId: "local-board",
            isInstanceAdmin: true,
            runId: runIdHeader,
            source: "local_implicit",
          },
        };
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
                  .where(
                    and(
                      eq(instanceUserRoles.userId, userId),
                      eq(instanceUserRoles.role, "instance_admin"),
                    ),
                  )
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
                actor: {
                  type: "board",
                  userId,
                  companyIds: memberships.map((row: { companyId: string }) => row.companyId),
                  isInstanceAdmin: Boolean(roleRow),
                  runId: runIdHeader,
                  source: "session",
                },
              };
            }
          } catch (err: unknown) {
            logger.warn({ err }, "Failed to resolve auth session");
          }
        }

        return {
          actor: { type: "none", runId: runIdHeader, source: "none" },
        };
      }

      // Bearer token: try agent API key or JWT
      const token = authHeader.slice("bearer ".length).trim();
      if (!token) {
        return { actor: { type: "none", source: "none" } };
      }

      // Try local agent JWT first
      const jwtPayload = verifyLocalAgentJwt(token);
      if (jwtPayload) {
        return {
          actor: {
            type: "agent",
            agentId: jwtPayload.sub,
            companyId: jwtPayload.company_id,
            runId: runIdHeader ?? jwtPayload.run_id,
            source: "jwt",
          },
        };
      }

      // Try hashed API key lookup
      const keyHash = hashToken(token);
      const keyRow = await opts.db
        .select({
          agentId: agentApiKeys.agentId,
          companyId: agents.companyId,
        })
        .from(agentApiKeys)
        .innerJoin(agents, eq(agents.id, agentApiKeys.agentId))
        .where(and(eq(agentApiKeys.keyHash, keyHash), isNull(agentApiKeys.revokedAt)))
        .then((rows: { agentId: string; companyId: string }[]) => rows[0] ?? null);

      if (keyRow) {
        return {
          actor: {
            type: "agent",
            agentId: keyRow.agentId,
            companyId: keyRow.companyId,
            runId: runIdHeader,
            source: "api_key",
          },
        };
      }

      // Try board API key (uses raw token, not hash)
      const boardKeyRow = await boardAuth.findBoardApiKeyByToken(token);
      if (boardKeyRow) {
        const boardAccess = await boardAuth.resolveBoardAccess(boardKeyRow.userId);
        return {
          actor: {
            type: "board",
            userId: boardKeyRow.userId,
            companyIds: boardAccess.companyIds,
            isInstanceAdmin: boardAccess.isInstanceAdmin,
            runId: runIdHeader,
            source: "board_api_key",
          },
        };
      }

      return { actor: { type: "none", source: "bearer_unrecognized" } };
    },
  );
}
