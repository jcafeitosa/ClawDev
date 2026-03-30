/**
 * Access & auth routes — Elysia port.
 *
 * Handles board claims, CLI authentication, invites, join requests,
 * member management, skills access control, and admin operations.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Elysia, t } from "elysia";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import type { PermissionKey } from "@clawdev/shared";
import { agentApiKeys, authUsers, invites, joinRequests } from "@clawdev/db";
import {
  accessService,
  agentService,
  boardAuthService,
  deduplicateAgentName,
  logActivity,
  notifyHireApproved,
} from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import {
  companyInviteExpiresAt,
  agentJoinGrantsFromDefaults,
  resolveJoinRequestAgentManagerId,
  buildJoinDefaultsPayloadForAccept,
  normalizeAgentDefaultsForJoin,
  canReplayOpenClawGatewayInviteAccept,
  mergeJoinDefaultsPayloadForReplay,
  buildInviteOnboardingTextDocument,
} from "./access-utils.js";

// Re-export utility helpers so existing test imports continue to work
export {
  companyInviteExpiresAt,
  agentJoinGrantsFromDefaults,
  resolveJoinRequestAgentManagerId,
  buildJoinDefaultsPayloadForAccept,
  normalizeAgentDefaultsForJoin,
  canReplayOpenClawGatewayInviteAccept,
  mergeJoinDefaultsPayloadForReplay,
  buildInviteOnboardingTextDocument,
} from "./access-utils.js";

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const INVITE_TOKEN_PREFIX = "cld_invite_";
const INVITE_TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const INVITE_TOKEN_SUFFIX_LENGTH = 8;
const INVITE_TOKEN_MAX_RETRIES = 5;

function createInviteToken() {
  const bytes = crypto.randomBytes(INVITE_TOKEN_SUFFIX_LENGTH);
  let suffix = "";
  for (let idx = 0; idx < INVITE_TOKEN_SUFFIX_LENGTH; idx += 1) {
    suffix += INVITE_TOKEN_ALPHABET[bytes[idx]! % INVITE_TOKEN_ALPHABET.length];
  }
  return `${INVITE_TOKEN_PREFIX}${suffix}`;
}

function createClaimSecret() {
  return `cld_claim_${crypto.randomBytes(24).toString("hex")}`;
}

function tokenHashesMatch(left: string, right: string) {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  return (
    leftBytes.length === rightBytes.length &&
    crypto.timingSafeEqual(leftBytes, rightBytes)
  );
}

function isInviteTokenHashCollisionError(error: unknown) {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause ?? null];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const code = "code" in candidate && typeof candidate.code === "string" ? candidate.code : null;
    const message = "message" in candidate && typeof candidate.message === "string" ? candidate.message : "";
    const constraint = "constraint" in candidate && typeof candidate.constraint === "string" ? candidate.constraint : null;
    if (code !== "23505") continue;
    if (constraint === "invites_token_hash_unique_idx") return true;
    if (message.includes("invites_token_hash_unique_idx")) return true;
  }
  return false;
}

function inviteExpired(invite: { expiresAt: Date }) {
  return invite.expiresAt.getTime() <= Date.now();
}

function toJoinRequestResponse(row: typeof joinRequests.$inferSelect) {
  const { claimSecretHash: _claimSecretHash, ...safe } = row;
  return safe;
}

function extractInviteMessage(invite: typeof invites.$inferSelect): string | null {
  const raw = invite.defaultsPayload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const msg = (raw as Record<string, unknown>).agentMessage;
  if (typeof msg !== "string") return null;
  const trimmed = msg.trim();
  return trimmed.length ? trimmed : null;
}

function mergeInviteDefaults(
  defaults: Record<string, unknown> | null | undefined,
  agentMessage: string | null,
): Record<string, unknown> | null {
  const merged = defaults && typeof defaults === "object" ? { ...defaults } : {};
  if (agentMessage) merged.agentMessage = agentMessage;
  return Object.keys(merged).length ? merged : null;
}

// ---------------------------------------------------------------------------
// Skill helpers
// ---------------------------------------------------------------------------

function readSkillMarkdown(skillName: string): string | null {
  const normalized = skillName.trim().toLowerCase();
  if (
    normalized !== "clawdev" &&
    normalized !== "clawdev-create-agent" &&
    normalized !== "clawdev-create-plugin" &&
    normalized !== "para-memory-files"
  )
    return null;
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../skills", normalized, "SKILL.md"),
    path.resolve(process.cwd(), "skills", normalized, "SKILL.md"),
    path.resolve(moduleDir, "../../../skills", normalized, "SKILL.md"),
  ];
  for (const skillPath of candidates) {
    try {
      return fs.readFileSync(skillPath, "utf8");
    } catch {
      // Continue to next candidate
    }
  }
  return null;
}

function resolveSkillsDir(): string | null {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../skills"),
    path.resolve(process.cwd(), "skills"),
    path.resolve(moduleDir, "../../../skills"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      /* skip */
    }
  }
  return null;
}

function parseSkillFrontmatter(markdown: string): { description: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { description: "" };
  const yaml = match[1];
  const descMatch = yaml?.match(
    /^description:\s*(?:>\s*\n((?:\s{2,}[^\n]*\n?)+)|[|]\s*\n((?:\s{2,}[^\n]*\n?)+)|["']?(.*?)["']?\s*$)/m,
  );
  if (!descMatch) return { description: "" };
  const raw = descMatch[1] ?? descMatch[2] ?? descMatch[3] ?? "";
  return {
    description: raw.split("\n").map((l: string) => l.trim()).filter(Boolean).join(" ").trim(),
  };
}

export interface AvailableSkill {
  name: string;
  description: string;
  isClawdevManaged: boolean;
}

function listAvailableSkills(): AvailableSkill[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const claudeSkillsDir = path.join(homeDir, ".claude", "skills");
  const clawdevSkillsDir = resolveSkillsDir();

  const clawdevSkillNames = new Set<string>();
  if (clawdevSkillsDir) {
    try {
      for (const entry of fs.readdirSync(clawdevSkillsDir, { withFileTypes: true })) {
        if (entry.isDirectory()) clawdevSkillNames.add(entry.name);
      }
    } catch {
      /* skip */
    }
  }

  const skills: AvailableSkill[] = [];
  try {
    const entries = fs.readdirSync(claudeSkillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      if (entry.name.startsWith(".")) continue;
      const skillMdPath = path.join(claudeSkillsDir, entry.name, "SKILL.md");
      let description = "";
      try {
        const md = fs.readFileSync(skillMdPath, "utf8");
        description = parseSkillFrontmatter(md).description;
      } catch {
        /* skip */
      }
      skills.push({
        name: entry.name,
        description,
        isClawdevManaged: clawdevSkillNames.has(entry.name),
      });
    }
  } catch {
    /* ~/.claude/skills/ doesn't exist */
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function accessRoutes(db: Db) {
  const svc = accessService(db);
  const agents = agentService(db);
  const boardAuth = boardAuthService(db);

  return new Elysia()
    // ---------------------------------------------------------------
    // Members
    // ---------------------------------------------------------------

    .get(
      "/companies/:companyId/members",
      async ({ params }) => {
        const members = await svc.listMembers(params.companyId);
        return members;
      },
      { params: companyIdParam },
    )

    .patch(
      "/companies/:companyId/members/:memberId/permissions",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor ?? {};
        const updated = await svc.setMemberPermissions(
          params.companyId,
          params.memberId,
          body.grants ?? [],
          actor.userId ?? null,
        );
        if (!updated) {
          set.status = 404;
          return { error: "Member not found" };
        }
        return updated;
      },
      {
        params: t.Object({ companyId: t.String(), memberId: t.String() }),
        body: t.Object({
          grants: t.Optional(
            t.Array(
              t.Object({
                permissionKey: t.String(),
                scope: t.Optional(t.Any()),
              }),
            ),
          ),
        }),
      },
    )

    // ---------------------------------------------------------------
    // Invites — company-scoped creation
    // ---------------------------------------------------------------

    .get(
      "/companies/:companyId/invites",
      async ({ params }) => {
        const inviteRows = await svc.listInvites(params.companyId);
        return inviteRows;
      },
      { params: companyIdParam },
    )

    .post(
      "/companies/:companyId/invites",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor ?? {};

        const allowedJoinTypes = body.allowedJoinTypes ?? "both";
        const agentMessage = body.agentMessage
          ? (typeof body.agentMessage === "string" ? body.agentMessage.trim() : null)
          : null;
        const defaultsPayload = mergeInviteDefaults(
          body.defaultsPayload ?? null,
          agentMessage,
        );

        let token: string | null = null;
        let created: typeof invites.$inferSelect | null = null;
        for (let attempt = 0; attempt < INVITE_TOKEN_MAX_RETRIES; attempt += 1) {
          const candidateToken = createInviteToken();
          try {
            const row = await db
              .insert(invites)
              .values({
                companyId: params.companyId,
                inviteType: "company_join" as const,
                allowedJoinTypes,
                defaultsPayload,
                expiresAt: companyInviteExpiresAt(Date.now()),
                invitedByUserId: actor.userId ?? null,
                tokenHash: hashToken(candidateToken),
              })
              .returning()
              .then((rows) => rows[0]);
            token = candidateToken;
            created = row;
            break;
          } catch (error) {
            if (!isInviteTokenHashCollisionError(error)) throw error;
          }
        }
        if (!token || !created) {
          set.status = 409;
          return { error: "Failed to generate a unique invite token. Please retry." };
        }

        await logActivity(db, {
          companyId: params.companyId,
          actorType: actor.type === "agent" ? "agent" : "user",
          actorId: actor.type === "agent" ? actor.agentId ?? "unknown-agent" : actor.userId ?? "board",
          action: "invite.created",
          entityType: "invite",
          entityId: created.id,
          details: {
            inviteType: created.inviteType,
            allowedJoinTypes: created.allowedJoinTypes,
            expiresAt: created.expiresAt.toISOString(),
            hasAgentMessage: Boolean(agentMessage),
          },
        });

        set.status = 201;
        return {
          ...created,
          token,
          inviteUrl: `/invite/${token}`,
          onboardingTextPath: `/api/invites/${token}/onboarding.txt`,
          inviteMessage: extractInviteMessage(created),
        };
      },
      {
        params: companyIdParam,
        body: t.Object({
          email: t.Optional(t.String()),
          role: t.Optional(t.String()),
          allowedJoinTypes: t.Optional(t.String()),
          defaultsPayload: t.Optional(t.Any()),
          agentMessage: t.Optional(t.String()),
        }),
      },
    )

    // ---------------------------------------------------------------
    // Invite lookup / onboarding by token
    // ---------------------------------------------------------------

    .get(
      "/invites/:token",
      async ({ params, set }) => {
        const token = params.token.trim();
        if (!token) { set.status = 404; return { error: "Invite not found" }; }
        const invite = await db
          .select()
          .from(invites)
          .where(eq(invites.tokenHash, hashToken(token)))
          .then((rows) => rows[0] ?? null);
        if (!invite || invite.revokedAt || invite.acceptedAt || inviteExpired(invite)) {
          set.status = 404;
          return { error: "Invite not found" };
        }
        return {
          id: invite.id,
          companyId: invite.companyId,
          inviteType: invite.inviteType,
          allowedJoinTypes: invite.allowedJoinTypes,
          expiresAt: invite.expiresAt,
          onboardingTextPath: `/api/invites/${token}/onboarding.txt`,
          inviteMessage: extractInviteMessage(invite),
        };
      },
      { params: t.Object({ token: t.String() }) },
    )

    .get(
      "/invites/:token/onboarding.txt",
      async (ctx: any) => {
        const { params, set } = ctx;
        const token = params.token.trim();
        if (!token) { set.status = 404; return { error: "Invite not found" }; }
        const invite = await db
          .select()
          .from(invites)
          .where(eq(invites.tokenHash, hashToken(token)))
          .then((rows) => rows[0] ?? null);
        if (!invite || invite.revokedAt || inviteExpired(invite)) {
          set.status = 404;
          return { error: "Invite not found" };
        }

        const reqLike = {
          protocol: "http",
          header: (name: string) => {
            if (name === "host") return ctx.request?.headers?.get?.("host") ?? "localhost:3100";
            return undefined;
          },
        };
        const opts = {
          deploymentMode: "authenticated",
          deploymentExposure: "private",
          bindHost: "0.0.0.0",
          allowedHostnames: [],
        };
        const text = buildInviteOnboardingTextDocument(reqLike, token, invite as any, opts);
        set.headers = { "content-type": "text/plain; charset=utf-8" };
        return text;
      },
      { params: t.Object({ token: t.String() }) },
    )

    // ---------------------------------------------------------------
    // Invite accept (full join flow)
    // ---------------------------------------------------------------

    .post(
      "/invites/:token/accept",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor ?? {};
        const token = params.token.trim();
        if (!token) { set.status = 404; return { error: "Invite not found" }; }

        const invite = await db
          .select()
          .from(invites)
          .where(eq(invites.tokenHash, hashToken(token)))
          .then((rows) => rows[0] ?? null);
        if (!invite || invite.revokedAt || inviteExpired(invite)) {
          set.status = 404;
          return { error: "Invite not found" };
        }

        const inviteAlreadyAccepted = Boolean(invite.acceptedAt);
        const existingJoinRequestForInvite = inviteAlreadyAccepted
          ? await db
              .select()
              .from(joinRequests)
              .where(eq(joinRequests.inviteId, invite.id))
              .then((rows) => rows[0] ?? null)
          : null;

        const requestType = body.requestType as "human" | "agent";
        const companyId = invite.companyId;
        if (!companyId) { set.status = 409; return { error: "Invite is missing company scope" }; }

        if (invite.allowedJoinTypes !== "both" && invite.allowedJoinTypes !== requestType) {
          set.status = 400;
          return { error: `Invite does not allow ${requestType} joins` };
        }

        if (requestType === "agent" && !body.agentName) {
          if (!inviteAlreadyAccepted || !existingJoinRequestForInvite?.agentName) {
            set.status = 400;
            return { error: "agentName is required for agent join requests" };
          }
        }

        const adapterType = body.adapterType ?? null;

        if (
          inviteAlreadyAccepted &&
          existingJoinRequestForInvite &&
          !canReplayOpenClawGatewayInviteAccept({
            requestType,
            adapterType: adapterType ?? "",
            existingJoinRequest: {
              requestType: existingJoinRequestForInvite.requestType,
              adapterType: existingJoinRequestForInvite.adapterType ?? "",
              status: existingJoinRequestForInvite.status,
            },
          })
        ) {
          set.status = 404;
          return { error: "Invite not found" };
        }

        const replayJoinRequestId = inviteAlreadyAccepted
          ? existingJoinRequestForInvite?.id ?? null
          : null;

        const replayMergedDefaults = inviteAlreadyAccepted && existingJoinRequestForInvite
          ? mergeJoinDefaultsPayloadForReplay(
              (existingJoinRequestForInvite.agentDefaultsPayload ?? {}) as Record<string, unknown>,
              (body.agentDefaultsPayload ?? {}) as Record<string, unknown>,
            )
          : body.agentDefaultsPayload ?? null;

        const gatewayDefaultsPayload =
          requestType === "agent"
            ? buildJoinDefaultsPayloadForAccept({
                adapterType: adapterType ?? "",
                defaultsPayload: replayMergedDefaults as Record<string, unknown> | null,
              })
            : null;

        const joinDefaults =
          requestType === "agent" && gatewayDefaultsPayload
            ? normalizeAgentDefaultsForJoin({
                adapterType: adapterType ?? "",
                defaultsPayload: gatewayDefaultsPayload as Record<string, unknown>,
                deploymentMode: "authenticated",
                deploymentExposure: "private",
                bindHost: "0.0.0.0",
                allowedHostnames: [],
              })
            : { normalized: null as Record<string, unknown> | null, fatalErrors: [] as string[] };

        if (requestType === "agent" && joinDefaults.fatalErrors.length > 0) {
          set.status = 400;
          return { error: joinDefaults.fatalErrors.join("; ") };
        }

        const claimSecret =
          requestType === "agent" && !inviteAlreadyAccepted ? createClaimSecret() : null;
        const claimSecretHash = claimSecret ? hashToken(claimSecret) : null;
        const claimSecretExpiresAt = claimSecret
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          : null;

        const requestIp = ctx.request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

        const created = !inviteAlreadyAccepted
          ? await db.transaction(async (tx) => {
              await tx
                .update(invites)
                .set({ acceptedAt: new Date(), updatedAt: new Date() })
                .where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)));

              const row = await tx
                .insert(joinRequests)
                .values({
                  inviteId: invite.id,
                  companyId,
                  requestType,
                  status: "pending_approval",
                  requestIp,
                  requestingUserId: requestType === "human" ? actor.userId ?? "local-board" : null,
                  requestEmailSnapshot: null,
                  agentName: requestType === "agent" ? body.agentName : null,
                  adapterType: requestType === "agent" ? adapterType : null,
                  capabilities: requestType === "agent" ? body.capabilities ?? null : null,
                  agentDefaultsPayload: requestType === "agent" ? joinDefaults.normalized : null,
                  claimSecretHash,
                  claimSecretExpiresAt,
                })
                .returning()
                .then((rows) => rows[0]);
              return row;
            })
          : await db
              .update(joinRequests)
              .set({
                requestIp,
                agentName:
                  requestType === "agent"
                    ? body.agentName ?? existingJoinRequestForInvite?.agentName ?? null
                    : null,
                capabilities:
                  requestType === "agent"
                    ? body.capabilities ?? existingJoinRequestForInvite?.capabilities ?? null
                    : null,
                adapterType: requestType === "agent" ? adapterType : null,
                agentDefaultsPayload: requestType === "agent" ? joinDefaults.normalized : null,
                updatedAt: new Date(),
              })
              .where(eq(joinRequests.id, replayJoinRequestId as string))
              .returning()
              .then((rows) => rows[0]);

        if (!created) {
          set.status = 409;
          return { error: "Join request not found" };
        }

        await logActivity(db, {
          companyId,
          actorType: actor.type === "agent" ? "agent" : "user",
          actorId:
            actor.type === "agent"
              ? actor.agentId ?? "invite-agent"
              : actor.userId ?? (requestType === "agent" ? "invite-anon" : "board"),
          action: inviteAlreadyAccepted ? "join.request_replayed" : "join.requested",
          entityType: "join_request",
          entityId: created.id,
          details: { requestType, requestIp: created.requestIp, inviteReplay: inviteAlreadyAccepted },
        });

        const response = toJoinRequestResponse(created);
        if (claimSecret) {
          set.status = 202;
          return {
            ...response,
            claimSecret,
            claimApiKeyPath: `/api/join-requests/${created.id}/claim-api-key`,
          };
        }
        set.status = 202;
        return response;
      },
      {
        params: t.Object({ token: t.String() }),
        body: t.Object({
          requestType: t.String(),
          agentName: t.Optional(t.String()),
          adapterType: t.Optional(t.String()),
          capabilities: t.Optional(t.String()),
          agentDefaultsPayload: t.Optional(t.Any()),
          paperclipApiUrl: t.Optional(t.String()),
        }),
      },
    )

    // ---------------------------------------------------------------
    // Invite revoke / accept (simple ID-based)
    // ---------------------------------------------------------------

    .post(
      "/invites/:token/revoke",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor ?? {};
        // The :token param here is actually the invite ID (for backward compat)
        const inviteId = params.token;
        const invite = await db
          .select()
          .from(invites)
          .where(eq(invites.id, inviteId))
          .then((rows) => rows[0] ?? null);
        if (!invite) { ctx.set.status = 404; return { error: "Invite not found" }; }
        if (invite.acceptedAt) { ctx.set.status = 409; return { error: "Invite already consumed" }; }
        if (invite.revokedAt) return invite;

        const revoked = await db
          .update(invites)
          .set({ revokedAt: new Date(), updatedAt: new Date() })
          .where(eq(invites.id, inviteId))
          .returning()
          .then((rows) => rows[0]);

        if (invite.companyId) {
          await logActivity(db, {
            companyId: invite.companyId,
            actorType: actor.type === "agent" ? "agent" : "user",
            actorId:
              actor.type === "agent"
                ? actor.agentId ?? "unknown-agent"
                : actor.userId ?? "board",
            action: "invite.revoked",
            entityType: "invite",
            entityId: inviteId,
          });
        }

        return revoked;
      },
      { params: t.Object({ token: t.String() }) },
    )

    .post(
      "/invites/:token/accept-by-id",
      async ({ params }) => {
        // Accepts an invite by its database ID (backward compat).
        // The :token param is reused so Elysia's router doesn't conflict.
        const result = await svc.acceptInvite(params.token);
        return result;
      },
      { params: t.Object({ token: t.String() }) },
    )

    // Legacy route alias: the original tests use /invites/:inviteId paths
    // but Elysia requires consistent param names per path segment.
    // The /revoke and /accept-by-id routes above accept either a token or an ID.

    // ---------------------------------------------------------------
    // Join requests
    // ---------------------------------------------------------------

    .get(
      "/companies/:companyId/join-requests",
      async ({ params, query }) => {
        const all = await db
          .select()
          .from(joinRequests)
          .where(eq(joinRequests.companyId, params.companyId))
          .orderBy(desc(joinRequests.createdAt));
        const filtered = all.filter((row) => {
          if (query.status && row.status !== query.status) return false;
          if (query.requestType && row.requestType !== query.requestType) return false;
          return true;
        });
        return filtered.map(toJoinRequestResponse);
      },
      { params: companyIdParam },
    )

    .post(
      "/companies/:companyId/join-requests/:requestId/approve",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor ?? {};
        const companyId = params.companyId;
        const requestId = params.requestId;

        const existing = await db
          .select()
          .from(joinRequests)
          .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.id, requestId)))
          .then((rows) => rows[0] ?? null);
        if (!existing) { set.status = 404; return { error: "Join request not found" }; }
        if (existing.status !== "pending_approval") { set.status = 409; return { error: "Join request is not pending" }; }

        const invite = await db
          .select()
          .from(invites)
          .where(eq(invites.id, existing.inviteId))
          .then((rows) => rows[0] ?? null);
        if (!invite) { set.status = 404; return { error: "Invite not found" }; }

        let createdAgentId: string | null = existing.createdAgentId ?? null;
        if (existing.requestType === "human") {
          if (!existing.requestingUserId) { set.status = 409; return { error: "Join request missing user identity" }; }
          await svc.ensureMembership(companyId, "user", existing.requestingUserId, "member", "active");
        } else {
          const existingAgents = await agents.list(companyId);
          const managerId = resolveJoinRequestAgentManagerId(existingAgents);
          if (!managerId) {
            set.status = 409;
            return { error: "Join request cannot be approved because this company has no active CEO" };
          }

          const agentName = deduplicateAgentName(
            existing.agentName ?? "New Agent",
            existingAgents.map((a) => ({ id: a.id, name: a.name, status: a.status })),
          );

          const created = await agents.create(companyId, {
            name: agentName,
            role: "general",
            title: null,
            status: "idle",
            reportsTo: managerId,
            capabilities: existing.capabilities ?? null,
            adapterType: existing.adapterType ?? "process",
            adapterConfig:
              existing.agentDefaultsPayload && typeof existing.agentDefaultsPayload === "object"
                ? (existing.agentDefaultsPayload as Record<string, unknown>)
                : {},
            runtimeConfig: {},
            budgetMonthlyCents: 0,
            spentMonthlyCents: 0,
            permissions: {},
            lastHeartbeatAt: null,
            metadata: null,
          });
          createdAgentId = created.id;
          await svc.ensureMembership(companyId, "agent", created.id, "member", "active");
          const grants = agentJoinGrantsFromDefaults(
            invite.defaultsPayload as Record<string, unknown> | null,
          ) as Array<{ permissionKey: PermissionKey; scope: Record<string, unknown> | null }>;
          await svc.setPrincipalGrants(companyId, "agent", created.id, grants, actor.userId ?? null);
        }

        const approved = await db
          .update(joinRequests)
          .set({
            status: "approved",
            approvedByUserId: actor.userId ?? "local-board",
            approvedAt: new Date(),
            createdAgentId,
            updatedAt: new Date(),
          })
          .where(eq(joinRequests.id, requestId))
          .returning()
          .then((rows) => rows[0]);

        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: actor.userId ?? "board",
          action: "join.approved",
          entityType: "join_request",
          entityId: requestId,
          details: { requestType: existing.requestType, createdAgentId },
        });

        if (createdAgentId) {
          void notifyHireApproved(db, {
            companyId,
            agentId: createdAgentId,
            source: "join_request",
            sourceId: requestId,
            approvedAt: new Date(),
          }).catch(() => {});
        }

        return toJoinRequestResponse(approved!);
      },
      { params: t.Object({ companyId: t.String(), requestId: t.String() }) },
    )

    .post(
      "/companies/:companyId/join-requests/:requestId/reject",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor ?? {};
        const companyId = params.companyId;
        const requestId = params.requestId;

        const existing = await db
          .select()
          .from(joinRequests)
          .where(and(eq(joinRequests.companyId, companyId), eq(joinRequests.id, requestId)))
          .then((rows) => rows[0] ?? null);
        if (!existing) { set.status = 404; return { error: "Join request not found" }; }
        if (existing.status !== "pending_approval") { set.status = 409; return { error: "Join request is not pending" }; }

        const rejected = await db
          .update(joinRequests)
          .set({
            status: "rejected",
            rejectedByUserId: actor.userId ?? "local-board",
            rejectedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(joinRequests.id, requestId))
          .returning()
          .then((rows) => rows[0]);

        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: actor.userId ?? "board",
          action: "join.rejected",
          entityType: "join_request",
          entityId: requestId,
          details: { requestType: existing.requestType },
        });

        return toJoinRequestResponse(rejected!);
      },
      { params: t.Object({ companyId: t.String(), requestId: t.String() }) },
    )

    // ---------------------------------------------------------------
    // API key claim
    // ---------------------------------------------------------------

    .post(
      "/join-requests/:requestId/claim-api-key",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const requestId = params.requestId;
        const presentedClaimSecretHash = hashToken(body.claimSecret);

        const joinRequest = await db
          .select()
          .from(joinRequests)
          .where(eq(joinRequests.id, requestId))
          .then((rows) => rows[0] ?? null);
        if (!joinRequest) { set.status = 404; return { error: "Join request not found" }; }
        if (joinRequest.requestType !== "agent") { set.status = 400; return { error: "Only agent join requests can claim API keys" }; }
        if (joinRequest.status !== "approved") { set.status = 409; return { error: "Join request must be approved before key claim" }; }
        if (!joinRequest.createdAgentId) { set.status = 409; return { error: "Join request has no created agent" }; }
        if (!joinRequest.claimSecretHash) { set.status = 409; return { error: "Join request is missing claim secret metadata" }; }
        if (!tokenHashesMatch(joinRequest.claimSecretHash, presentedClaimSecretHash)) {
          set.status = 403;
          return { error: "Invalid claim secret" };
        }
        if (joinRequest.claimSecretExpiresAt && joinRequest.claimSecretExpiresAt.getTime() <= Date.now()) {
          set.status = 409;
          return { error: "Claim secret expired" };
        }
        if (joinRequest.claimSecretConsumedAt) {
          set.status = 409;
          return { error: "Claim secret already used" };
        }

        const existingKey = await db
          .select({ id: agentApiKeys.id })
          .from(agentApiKeys)
          .where(eq(agentApiKeys.agentId, joinRequest.createdAgentId))
          .then((rows) => rows[0] ?? null);
        if (existingKey) { set.status = 409; return { error: "API key already claimed" }; }

        const consumed = await db
          .update(joinRequests)
          .set({ claimSecretConsumedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(joinRequests.id, requestId), isNull(joinRequests.claimSecretConsumedAt)))
          .returning({ id: joinRequests.id })
          .then((rows) => rows[0] ?? null);
        if (!consumed) { set.status = 409; return { error: "Claim secret already used" }; }

        const created = await agents.createApiKey(joinRequest.createdAgentId, "initial-join-key");

        await logActivity(db, {
          companyId: joinRequest.companyId,
          actorType: "system",
          actorId: "join-claim",
          action: "agent_api_key.claimed",
          entityType: "agent_api_key",
          entityId: created.id,
          details: { agentId: joinRequest.createdAgentId, joinRequestId: requestId },
        });

        set.status = 201;
        return {
          keyId: created.id,
          token: created.token,
          agentId: joinRequest.createdAgentId,
          createdAt: created.createdAt,
        };
      },
      {
        params: t.Object({ requestId: t.String() }),
        body: t.Object({ claimSecret: t.String() }),
      },
    )

    // ---------------------------------------------------------------
    // CLI auth
    // ---------------------------------------------------------------

    .post("/cli/auth/token", async () => {
      const token = await svc.generateCliToken();
      return token;
    })

    .post(
      "/cli/auth/verify",
      async ({ body }) => {
        const result = await svc.verifyCliToken(body.token);
        return result;
      },
      { body: t.Object({ token: t.String() }) },
    )

    // ---------------------------------------------------------------
    // CLI auth challenges
    // ---------------------------------------------------------------

    .post(
      "/cli-auth/challenges",
      async (ctx: any) => {
        const { challenge, challengeSecret, pendingBoardToken } =
          await boardAuth.createCliAuthChallenge(ctx.body);
        ctx.set.status = 201;
        return {
          id: challenge.id,
          token: challengeSecret,
          boardApiToken: pendingBoardToken,
          approvalPath: `/cli-auth/${challenge.id}?token=${challengeSecret}`,
          approvalUrl: `http://localhost/cli-auth/${challenge.id}?token=${challengeSecret}`,
          pollPath: `/cli-auth/challenges/${challenge.id}`,
          expiresAt: challenge.expiresAt.toISOString(),
        };
      },
    )

    .get(
      "/cli-auth/challenges/:challengeId",
      async (ctx: any) => {
        const challenge = await boardAuth.describeCliAuthChallenge(
          ctx.params.challengeId,
          ctx.query?.token,
        );
        const requiresSignIn = ctx.actor?.type === "none";
        const canApprove = !requiresSignIn;
        return { ...challenge, requiresSignIn, canApprove };
      },
    )

    .post(
      "/cli-auth/challenges/:challengeId/approve",
      async (ctx: any) => {
        const result = await boardAuth.approveCliAuthChallenge(
          ctx.params.challengeId,
          ctx.body?.token,
          ctx.actor?.userId,
        );
        if (result.status !== "approved") {
          return { approved: false, status: result.status };
        }
        const challenge = result.challenge;
        const companyIds = await boardAuth.resolveBoardActivityCompanyIds({
          userId: ctx.actor?.userId,
          requestedCompanyId: challenge.requestedCompanyId ?? null,
          boardApiKeyId: challenge.boardApiKeyId ?? null,
        });
        for (const companyId of companyIds) {
          await logActivity(db, {
            companyId,
            actorType: "user",
            actorId: ctx.actor?.userId ?? "board",
            action: "board_api_key.created",
            entityType: "board_api_key",
            entityId: challenge.boardApiKeyId ?? companyId,
          });
        }
        return {
          approved: true,
          status: "approved",
          userId: ctx.actor?.userId,
          keyId: challenge.boardApiKeyId,
          expiresAt: challenge.expiresAt.toISOString(),
        };
      },
    )

    .post(
      "/cli-auth/challenges/:challengeId/cancel",
      async (ctx: any) => {
        const cancelled = await boardAuth.cancelCliAuthChallenge(
          ctx.params.challengeId,
          ctx.body?.token,
        );
        return {
          status: cancelled.status,
          cancelled: cancelled.status === "cancelled",
        };
      },
    )

    // ---------------------------------------------------------------
    // CLI auth — me / revoke-current
    // ---------------------------------------------------------------

    .get(
      "/cli-auth/me",
      async (ctx: any) => {
        const actor = ctx.actor ?? {};
        if (actor.type !== "board" || !actor.userId) {
          ctx.set.status = 401;
          return { error: "Board authentication required" };
        }
        const accessSnapshot = await boardAuth.resolveBoardAccess(actor.userId);
        return {
          user: accessSnapshot.user,
          userId: actor.userId,
          isInstanceAdmin: accessSnapshot.isInstanceAdmin,
          companyIds: accessSnapshot.companyIds,
          source: actor.source ?? "none",
          keyId: actor.source === "board_key" ? actor.keyId ?? null : null,
        };
      },
    )

    .post(
      "/cli-auth/revoke-current",
      async (ctx: any) => {
        const actor = ctx.actor ?? {};
        const key = await boardAuth.assertCurrentBoardKey(actor.keyId, actor.userId);
        await boardAuth.revokeBoardApiKey(key.id);
        const companyIds = await boardAuth.resolveBoardActivityCompanyIds({
          userId: key.userId,
          boardApiKeyId: key.id,
        });
        for (const companyId of companyIds) {
          await logActivity(db, {
            companyId,
            actorType: "user",
            actorId: key.userId ?? "board",
            action: "board_api_key.revoked",
            entityType: "board_api_key",
            entityId: key.id ?? companyId,
          });
        }
        return { revoked: true };
      },
    )

    // ---------------------------------------------------------------
    // OpenClaw invite prompt
    // ---------------------------------------------------------------

    .post(
      "/companies/:companyId/openclaw/invite-prompt",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const a = ctx.actor;
        if (a?.type === "agent") {
          const agent = await agents.getById(a.agentId);
          if (!agent || agent.role !== "ceo") {
            set.status = 403;
            return { error: "Only CEO agents can create openclaw invite prompts" };
          }
        } else if (a?.type === "board") {
          const allowed = await svc.canUser(params.companyId, a.userId, "users:invite");
          if (!allowed) {
            set.status = 403;
            return { error: "Permission denied" };
          }
        } else {
          set.status = 403;
          return { error: "Permission denied" };
        }

        const tokenStr = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(tokenStr).digest("hex");
        const now = Date.now();
        const expiresAt = companyInviteExpiresAt(now);

        const row = await db
          .insert(invites)
          .values({
            companyId: params.companyId,
            inviteType: "company_join",
            allowedJoinTypes: "agent",
            defaultsPayload: body?.agentMessage ? { agentMessage: body.agentMessage } : null,
            expiresAt,
            invitedByUserId: a?.type === "board" ? a.userId : null,
            tokenHash,
          })
          .returning()
          .then((rows) => rows[0]);

        set.status = 201;
        return {
          ...row,
          token: tokenStr,
          allowedJoinTypes: row.allowedJoinTypes,
          onboardingTextPath: `/api/invites/${tokenStr}/onboarding.txt`,
        };
      },
    )

    // ---------------------------------------------------------------
    // Skills
    // ---------------------------------------------------------------

    .get("/skills/available", () => {
      return { skills: listAvailableSkills() };
    })

    .get("/skills/index", () => {
      return {
        skills: [
          { name: "clawdev", path: "/api/skills/clawdev" },
          { name: "para-memory-files", path: "/api/skills/para-memory-files" },
          { name: "clawdev-create-agent", path: "/api/skills/clawdev-create-agent" },
          { name: "clawdev-create-plugin", path: "/api/skills/clawdev-create-plugin" },
        ],
      };
    })

    .get(
      "/skills/:id",
      async ({ params, set }) => {
        const skillName = params.id.trim().toLowerCase();
        const markdown = readSkillMarkdown(skillName);
        if (!markdown) {
          set.status = 404;
          return { error: "Skill not found" };
        }
        set.headers = { "content-type": "text/markdown" };
        return markdown;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ---------------------------------------------------------------
    // Instance admin routes
    // ---------------------------------------------------------------

    .post(
      "/admin/users/:userId/promote-instance-admin",
      async (ctx: any) => {
        const { params } = ctx;
        const result = await svc.promoteInstanceAdmin(params.userId);
        ctx.set.status = 201;
        return result;
      },
      { params: t.Object({ userId: t.String() }) },
    )

    .post(
      "/admin/users/:userId/demote-instance-admin",
      async (ctx: any) => {
        const { params, set } = ctx;
        const removed = await svc.demoteInstanceAdmin(params.userId);
        if (!removed) {
          set.status = 404;
          return { error: "Instance admin role not found" };
        }
        return removed;
      },
      { params: t.Object({ userId: t.String() }) },
    )

    .get(
      "/admin/users/:userId/company-access",
      async ({ params }) => {
        const memberships = await svc.listUserCompanyAccess(params.userId);
        return memberships;
      },
      { params: t.Object({ userId: t.String() }) },
    )

    .put(
      "/admin/users/:userId/company-access",
      async ({ params, body }: any) => {
        const memberships = await svc.setUserCompanyAccess(
          params.userId,
          body.companyIds ?? [],
        );
        return memberships;
      },
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ companyIds: t.Optional(t.Array(t.String())) }),
      },
    );
}
