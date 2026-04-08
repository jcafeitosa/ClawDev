/**
 * Access & auth routes — Elysia port.
 *
 * Handles board claims, CLI authentication, invites, join requests,
 * member management, skills access control, and admin operations.
 */

import { Elysia, t } from "elysia";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import type { PermissionKey } from "@clawdev/shared";
import { isLevelCAgentRole } from "@clawdev/shared";
import { agentApiKeys, authUsers, companies, invites, joinRequests } from "@clawdev/db";
import {
  accessService,
  agentService,
  boardAuthService,
  deduplicateAgentName,
  logActivity,
  notifyHireApproved,
} from "../services/index.js";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin, type Actor } from "../middleware/authz.js";
import { companyIdParam } from "../middleware/index.js";
import { logger } from "../middleware/logger.js";
import { claimBoardOwnership, inspectBoardClaimChallenge } from "../board-claim.js";
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

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

const INVITE_TOKEN_PREFIX = "pcp_invite_";
const INVITE_TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const INVITE_TOKEN_SUFFIX_LENGTH = 8;
const INVITE_TOKEN_MAX_RETRIES = 5;

function createInviteToken() {
  const bytes = new Uint8Array(INVITE_TOKEN_SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (let idx = 0; idx < INVITE_TOKEN_SUFFIX_LENGTH; idx += 1) {
    suffix += INVITE_TOKEN_ALPHABET[bytes[idx]! % INVITE_TOKEN_ALPHABET.length];
  }
  return `${INVITE_TOKEN_PREFIX}${suffix}`;
}

function createClaimSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `pcp_claim_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function tokenHashesMatch(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i)! ^ right.charCodeAt(i)!;
  }
  return diff === 0;
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

function requestBaseUrl(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3100";
  }
}

function requestIp(
  request: Request & {
    header?: (name: string) => string | undefined;
    ip?: string | null;
  },
): string {
  const forwarded = request.header?.("x-forwarded-for") ?? request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.header?.("x-real-ip") ?? request.headers.get("x-real-ip");
  if (realIp) {
    const first = realIp.split(",")[0]?.trim();
    if (first) return first;
  }
  if (typeof request.ip === "string" && request.ip.trim()) {
    return request.ip.trim();
  }
  try {
    const hostHeader = request.header?.("host") ?? request.headers.get("host");
    if (hostHeader) {
      const host = hostHeader.split(":")[0]?.trim().toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
        return "127.0.0.1";
      }
    }
    const host = new URL(request.url).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return "127.0.0.1";
    }
    if (host === "::1") {
      return "127.0.0.1";
    }
  } catch {
    // ignore URL parsing failures and fall through to the default fallback
  }
  return "127.0.0.1";
}

function normalizeHostname(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.replace(/^\[(.*)\]$/, "$1");
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  if (!normalized) return false;
  if (normalized === "localhost") return true;
  return normalized === "127.0.0.1" || normalized === "::1";
}

function buildOnboardingConnectionCandidates(opts: {
  baseUrl: string;
  allowedHostnames: string[];
}) {
  const base = new URL(opts.baseUrl);
  const candidates = new Set<string>([opts.baseUrl]);
  const port = base.port ? `:${base.port}` : "";
  for (const rawHost of opts.allowedHostnames) {
    const host = normalizeHostname(rawHost);
    if (!host) continue;
    candidates.add(`${base.protocol}//${host}${port}`);
  }
  if (isLoopbackHost(base.hostname)) {
    candidates.add(`${base.protocol}//host.docker.internal${port}`);
  }
  return Array.from(candidates);
}

function buildOnboardingDiscoveryDiagnostics(opts: {
  apiBaseUrl: string;
  deploymentMode: string;
  deploymentExposure: string;
  bindHost: string;
  allowedHostnames: string[];
}) {
  return [
    `apiBaseUrl=${opts.apiBaseUrl}`,
    `deploymentMode=${opts.deploymentMode}`,
    `deploymentExposure=${opts.deploymentExposure}`,
    `bindHost=${opts.bindHost}`,
    `allowedHostnames=${opts.allowedHostnames.join(",") || "(none)"}`,
  ];
}

function createInviteOnboardingProbe(baseUrl: string, token: string) {
  const textInstructionsPath = `/api/invites/${token}/onboarding.txt`;
  const testResolutionPath = `/api/invites/${token}/test-resolution`;
  return {
    baseUrl,
    textInstructionsPath,
    textInstructionsUrl: `${baseUrl}${textInstructionsPath}`,
    testResolutionPath,
    testResolutionUrl: `${baseUrl}${testResolutionPath}`,
  };
}

async function getInviteCompanyName(db: Db, companyId: string | null) {
  if (!companyId) return null;
  const company = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows) => rows[0] ?? null);
  return company?.name ?? null;
}

function toInviteSummaryResponse(
  req: Request,
  token: string,
  invite: typeof invites.$inferSelect,
  companyName: string | null = null,
) {
  const baseUrl = requestBaseUrl(req);
  const onboardingPath = `/api/invites/${token}/onboarding`;
  const onboardingTextPath = `/api/invites/${token}/onboarding.txt`;
  const inviteMessage = extractInviteMessage(invite);
  return {
    id: invite.id,
    companyId: invite.companyId,
    companyName,
    inviteType: invite.inviteType,
    allowedJoinTypes: invite.allowedJoinTypes,
    expiresAt: invite.expiresAt,
    onboardingPath,
    onboardingUrl: `${baseUrl}${onboardingPath}`,
    onboardingTextPath,
    onboardingTextUrl: `${baseUrl}${onboardingTextPath}`,
    skillIndexPath: "/api/skills/index",
    skillIndexUrl: `${baseUrl}/api/skills/index`,
    inviteMessage,
  };
}

function buildInviteOnboardingManifest(
  req: Request,
  token: string,
  invite: typeof invites.$inferSelect,
) {
  const baseUrl = requestBaseUrl(req);
  const deploymentMode = process.env.CLAWDEV_DEPLOYMENT_MODE ?? "local_trusted";
  const deploymentExposure =
    process.env.CLAWDEV_DEPLOYMENT_EXPOSURE ?? "private";
  const bindHost = process.env.CLAWDEV_BIND_HOST ?? "127.0.0.1";
  const allowedHostnames = (process.env.CLAWDEV_ALLOWED_HOSTNAMES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  const claimPath = "/api/join-requests/{requestId}/claim-api-key";
  const registrationEndpointPath = `/api/invites/${token}/accept`;
  const onboarding = createInviteOnboardingProbe(baseUrl, token);
  const connectionCandidates = buildOnboardingConnectionCandidates({
    baseUrl,
    allowedHostnames,
  });

  return {
    invite: {
      id: invite.id,
      companyId: invite.companyId,
      inviteType: invite.inviteType,
      allowedJoinTypes: invite.allowedJoinTypes,
      expiresAt: invite.expiresAt,
      onboardingTextPath: onboarding.textInstructionsPath,
      inviteMessage: extractInviteMessage(invite),
    },
    onboarding: {
      instructions:
        "Join as an OpenClaw Gateway agent, save your one-time claim secret, wait for board approval, then claim your API key. Save the claim response token to ~/.openclaw/workspace/paperclip-claimed-api-key.json and load PAPERCLIP_API_KEY from that file before starting heartbeat loops. You MUST submit adapterType='openclaw_gateway', set agentDefaultsPayload.url to your ws:// or wss:// OpenClaw gateway endpoint, and include agentDefaultsPayload.headers.x-openclaw-token (or legacy x-openclaw-auth).",
      inviteMessage: extractInviteMessage(invite),
      recommendedAdapterType: "openclaw_gateway",
      requiredFields: {
        requestType: "agent",
        agentName: "Display name for this agent",
        adapterType: "Use 'openclaw_gateway' for OpenClaw Gateway agents",
        capabilities: "Optional capability summary",
        agentDefaultsPayload:
          "Adapter config for OpenClaw gateway. MUST include url (ws:// or wss://) and headers.x-openclaw-token (or legacy x-openclaw-auth). Optional fields: paperclipApiUrl, waitTimeoutMs, sessionKeyStrategy, sessionKey, role, scopes, disableDeviceAuth, devicePrivateKeyPem.",
      },
      registrationEndpoint: {
        method: "POST",
        path: registrationEndpointPath,
        url: `${baseUrl}${registrationEndpointPath}`,
      },
      claimEndpointTemplate: {
        method: "POST",
        path: claimPath,
        body: {
          claimSecret: "one-time claim secret returned when the join request is created",
        },
      },
      connectivity: {
        deploymentMode,
        deploymentExposure,
        bindHost,
        allowedHostnames,
        connectionCandidates,
        diagnostics: buildOnboardingDiscoveryDiagnostics({
          apiBaseUrl: baseUrl,
          deploymentMode,
          deploymentExposure,
          bindHost,
          allowedHostnames,
        }),
        guidance:
          deploymentMode === "authenticated" && deploymentExposure === "private"
            ? "If OpenClaw runs on another machine, ensure the Paperclip hostname is reachable and allowed via `pnpm paperclipai allowed-hostname <host>`."
            : "Ensure OpenClaw can reach this Paperclip API base URL for invite, claim, and skill bootstrap calls.",
        testResolutionEndpoint: {
          method: "GET",
          path: onboarding.testResolutionPath,
          url: onboarding.testResolutionUrl,
        },
      },
      textInstructions: {
        path: onboarding.textInstructionsPath,
        url: onboarding.textInstructionsUrl,
        contentType: "text/plain",
      },
      skill: {
        name: "paperclip",
        path: "/api/skills/paperclip",
        url: `${baseUrl}/api/skills/paperclip`,
        installPath: "~/.openclaw/skills/paperclip/SKILL.md",
      },
    },
  };
}

type InviteResolutionProbe = {
  status: "reachable" | "timeout" | "unreachable";
  method: "HEAD";
  durationMs: number;
  httpStatus: number | null;
  message: string;
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function probeInviteResolutionTarget(
  url: URL,
  timeoutMs: number,
): Promise<InviteResolutionProbe> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    if (
      response.ok ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status === 405 ||
      response.status === 422 ||
      response.status === 500 ||
      response.status === 501
    ) {
      return {
        status: "reachable",
        method: "HEAD",
        durationMs,
        httpStatus: response.status,
        message: `Webhook endpoint responded to HEAD with HTTP ${response.status}.`,
      };
    }
    return {
      status: "unreachable",
      method: "HEAD",
      durationMs,
      httpStatus: response.status,
      message: `Webhook endpoint probe returned HTTP ${response.status}.`,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (isAbortError(error)) {
      return {
        status: "timeout",
        method: "HEAD",
        durationMs,
        httpStatus: null,
        message: `Webhook endpoint probe timed out after ${timeoutMs}ms.`,
      };
    }
    return {
      status: "unreachable",
      method: "HEAD",
      durationMs,
      httpStatus: null,
      message:
        error instanceof Error
          ? error.message
          : "Webhook endpoint probe failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
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

function assertBoardCompanyAccess(actor: Actor, companyId: string) {
  assertBoard(actor);
  assertCompanyAccess(actor, companyId);
}

// ---------------------------------------------------------------------------
// Skill helpers
// ---------------------------------------------------------------------------

async function readSkillMarkdown(skillName: string): Promise<string | null> {
  const normalized = skillName.trim().toLowerCase();
  const aliasMap: Record<string, string> = {
    paperclip: "clawdev",
    "paperclip-create-agent": "clawdev-create-agent",
    "paperclip-create-plugin": "clawdev-create-plugin",
  };
  const resolved = aliasMap[normalized] ?? normalized;
  if (
    resolved !== "clawdev" &&
    resolved !== "clawdev-create-agent" &&
    resolved !== "clawdev-create-plugin" &&
    resolved !== "para-memory-files"
  )
    return null;
  const moduleDir = new URL(".", import.meta.url).pathname;
  const candidates = [
    `${moduleDir}../../skills/${resolved}/SKILL.md`,
    `${process.cwd()}/skills/${resolved}/SKILL.md`,
    `${moduleDir}../../../skills/${resolved}/SKILL.md`,
  ];
  for (const skillPath of candidates) {
    if (await Bun.file(skillPath).exists()) return await Bun.file(skillPath).text();
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
  isPaperclipManaged: boolean;
}

const PAPERCLIP_MANAGED_SKILL_NAMES = new Set([
  "paperclip",
  "paperclip-create-agent",
  "paperclip-create-plugin",
  "para-memory-files",
]);

async function listAvailableSkills(): Promise<AvailableSkill[]> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  const claudeSkillsDir = `${homeDir}/.claude/skills`;

  const skills: AvailableSkill[] = [];
  if (!(await Bun.file(claudeSkillsDir).exists())) return skills;

  const glob = new Bun.Glob(`${claudeSkillsDir}/*/SKILL.md`);
  for await (const skillMdPath of glob.scan({ cwd: "/" })) {
    const pathString = String(skillMdPath);
    const name = pathString.split("/").slice(-2, -1)[0] ?? "";
    if (!name || name.startsWith(".")) continue;
    let description = "";
    try {
      description = parseSkillFrontmatter(await Bun.file(pathString).text()).description;
    } catch {
      /* skip */
    }
    skills.push({
      name,
      description,
      isPaperclipManaged: PAPERCLIP_MANAGED_SKILL_NAMES.has(name),
    });
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
  const log = logger.child({ service: "access-routes" });

  return new Elysia()
    // ---------------------------------------------------------------
    // Members
    // ---------------------------------------------------------------

    .get(
      "/companies/:companyId/members",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertBoardCompanyAccess(actor, params.companyId);
          const members = await svc.listMembers(params.companyId);
          return members;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get members");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    .patch(
      "/companies/:companyId/members/:memberId/permissions",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertBoardCompanyAccess(actor, params.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to set member permissions");
          throw err;
        }
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

    .post(
      "/companies/:companyId/invites",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertBoardCompanyAccess(actor, params.companyId);

          const allowedJoinTypes = body?.allowedJoinTypes ?? "both";
          const agentMessage = body?.agentMessage
            ? (typeof body.agentMessage === "string" ? body.agentMessage.trim() : null)
            : null;
          const defaultsPayload = mergeInviteDefaults(
            body?.defaultsPayload ?? null,
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
                  tokenHash: await hashToken(candidateToken),
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

        const companyName = await getInviteCompanyName(db, params.companyId);
        const inviteSummary = toInviteSummaryResponse(ctx.request, token, created, companyName);

        set.status = 201;
        return {
          ...created,
          token,
          inviteUrl: `/invite/${token}`,
          companyName,
          onboardingPath: inviteSummary.onboardingPath,
          onboardingUrl: inviteSummary.onboardingUrl,
          onboardingTextPath: inviteSummary.onboardingTextPath,
          onboardingTextUrl: inviteSummary.onboardingTextUrl,
          skillIndexPath: inviteSummary.skillIndexPath,
          skillIndexUrl: inviteSummary.skillIndexUrl,
          inviteMessage: extractInviteMessage(created),
        };
        } catch (error) {
          ctx.set.status = 500;
          return { error: "Internal server error" };
        }
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
      "/invites/:token/onboarding",
      async (ctx: any) => {
        try {
          const { params, set, request } = ctx;
          const token = params.token.trim();
          if (!token) { set.status = 404; return { error: "Invite not found" }; }
          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.tokenHash, await hashToken(token)))
            .then((rows) => rows[0] ?? null);
          if (!invite || invite.revokedAt || inviteExpired(invite)) {
            set.status = 404;
            return { error: "Invite not found" };
          }
          return buildInviteOnboardingManifest(request as Request, token, invite);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get invite onboarding manifest");
          throw err;
        }
      },
      { params: t.Object({ token: t.String() }) },
    )

    .get(
      "/invites/:token/test-resolution",
      async (ctx: any) => {
        try {
          const { params, query, set } = ctx;
          const token = params.token.trim();
          if (!token) { set.status = 404; return { error: "Invite not found" }; }
          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.tokenHash, await hashToken(token)))
            .then((rows) => rows[0] ?? null);
          if (!invite || invite.revokedAt || inviteExpired(invite)) {
            set.status = 404;
            return { error: "Invite not found" };
          }

          const rawUrl = typeof query.url === "string" ? query.url.trim() : "";
          if (!rawUrl) {
            set.status = 400;
            return { error: "url query parameter is required" };
          }
          let target: URL;
          try {
            target = new URL(rawUrl);
          } catch {
            set.status = 400;
            return { error: "url must be an absolute http(s) URL" };
          }
          if (target.protocol !== "http:" && target.protocol !== "https:") {
            set.status = 400;
            return { error: "url must use http or https" };
          }

          const parsedTimeoutMs =
            typeof query.timeoutMs === "string"
              ? Number(query.timeoutMs)
              : NaN;
          const timeoutMs = Number.isFinite(parsedTimeoutMs)
            ? Math.max(1000, Math.min(15000, Math.floor(parsedTimeoutMs)))
            : 5000;
          const probe = await probeInviteResolutionTarget(target, timeoutMs);
          return {
            inviteId: invite.id,
            testResolutionPath: `/api/invites/${token}/test-resolution`,
            requestedUrl: target.toString(),
            timeoutMs,
            ...probe,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to test invite resolution");
          throw err;
        }
      },
      { params: t.Object({ token: t.String() }) },
    )

    .get(
      "/invites/:token",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const token = params.token.trim();
          if (!token) { set.status = 404; return { error: "Invite not found" }; }
          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.tokenHash, await hashToken(token)))
            .then((rows) => rows[0] ?? null);
          if (!invite || invite.revokedAt || invite.acceptedAt || inviteExpired(invite)) {
            set.status = 404;
            return { error: "Invite not found" };
          }
          const companyName = await getInviteCompanyName(db, invite.companyId);
          return toInviteSummaryResponse(ctx.request as Request, token, invite, companyName);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get invite");
          throw err;
        }
      },
      { params: t.Object({ token: t.String() }) },
    )

    .get(
      "/invites/:token/onboarding.txt",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const token = params.token.trim();
          if (!token) { set.status = 404; return { error: "Invite not found" }; }
          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.tokenHash, await hashToken(token)))
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get onboarding text");
          throw err;
        }
      },
      { params: t.Object({ token: t.String() }) },
    )

    // ---------------------------------------------------------------
    // Invite accept (full join flow)
    // ---------------------------------------------------------------

    .post(
      "/invites/:token/accept",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor ?? {};
          const token = params.token.trim();
          if (!token) { set.status = 404; return { error: "Invite not found" }; }

          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.tokenHash, await hashToken(token)))
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
                  paperclipApiUrl: body.paperclipApiUrl ?? null,
                  inboundOpenClawAuthHeader: ctx.request?.headers?.get?.("x-openclaw-auth") ?? null,
                  inboundOpenClawTokenHeader: ctx.request?.headers?.get?.("x-openclaw-token") ?? null,
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
          const claimSecretHash = claimSecret ? await hashToken(claimSecret) : null;
          const claimSecretExpiresAt = claimSecret
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : null;

          const requestIpValue = requestIp(ctx.request);
          const actorEmail =
            requestType === "human" && actor.type === "board" && actor.source === "local_implicit"
              ? "local@paperclip.local"
              : null;

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
                    requestIp: requestIpValue,
                    requestingUserId: requestType === "human" ? actor.userId ?? "local-board" : null,
                    requestEmailSnapshot: requestType === "human" ? actorEmail : null,
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
                  requestIp: requestIpValue,
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to accept invite");
          throw err;
        }
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
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          // The :token param here is actually the invite ID (for backward compat)
          const inviteId = params.token;
          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.id, inviteId))
            .then((rows) => rows[0] ?? null);
          if (!invite) { ctx.set.status = 404; return { error: "Invite not found" }; }
          if (invite.inviteType === "bootstrap_ceo") {
            assertInstanceAdmin(actor);
          } else if (invite.companyId) {
            assertBoardCompanyAccess(actor, invite.companyId);
          } else {
            ctx.set.status = 409;
            return { error: "Invite is missing company scope" };
          }
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to revoke invite");
          throw err;
        }
      },
      { params: t.Object({ token: t.String() }) },
    )

    .post(
      "/invites/:token/accept-by-id",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          // Accepts an invite by its database ID (backward compat).
          // The :token param is reused so Elysia's router doesn't conflict.
          const invite = await db
            .select()
            .from(invites)
            .where(eq(invites.id, params.token))
            .then((rows) => rows[0] ?? null);
          if (!invite) {
            ctx.set.status = 404;
            return { error: "Invite not found" };
          }
          if (invite.inviteType === "bootstrap_ceo") {
            assertInstanceAdmin(actor);
          } else if (invite.companyId) {
            assertBoardCompanyAccess(actor, invite.companyId);
          } else {
            ctx.set.status = 409;
            return { error: "Invite is missing company scope" };
          }
          const result = await svc.acceptInvite(params.token);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to accept invite by ID");
          throw err;
        }
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
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get join requests");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    .post(
      "/companies/:companyId/join-requests/:requestId/approve",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const companyId = params.companyId;
          const requestId = params.requestId;
          assertBoardCompanyAccess(actor, companyId);

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
              return { error: "Join request cannot be approved because this company has no active level C agent" };
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to approve join request");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), requestId: t.String() }) },
    )

    .post(
      "/companies/:companyId/join-requests/:requestId/reject",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const companyId = params.companyId;
          const requestId = params.requestId;
          assertBoardCompanyAccess(actor, companyId);

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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to reject join request");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), requestId: t.String() }) },
    )

    // ---------------------------------------------------------------
    // API key claim
    // ---------------------------------------------------------------

    .post(
      "/join-requests/:requestId/claim-api-key",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const requestId = params.requestId;
          const presentedClaimSecretHash = await hashToken(body.claimSecret);

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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to claim API key");
          throw err;
        }
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
      try {
        const token = await svc.generateCliToken();
        return token;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to generate CLI token");
        throw err;
      }
    })

    .post(
      "/cli/auth/verify",
      async ({ body }) => {
        try {
          const result = await svc.verifyCliToken(body.token);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to verify CLI token");
          throw err;
        }
      },
      { body: t.Object({ token: t.String() }) },
    )

    // ---------------------------------------------------------------
    // CLI auth challenges
    // ---------------------------------------------------------------

    .post(
      "/cli-auth/challenges",
      async (ctx: any) => {
        try {
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
            suggestedPollIntervalMs: 1000,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create CLI auth challenge");
          throw err;
        }
      },
    )

    .get(
      "/cli-auth/challenges/:challengeId",
      async (ctx: any) => {
        try {
          const challenge = await boardAuth.describeCliAuthChallenge(
            ctx.params.challengeId,
            ctx.query?.token,
          );
          const requiresSignIn = ctx.actor?.type === "none";
          const canApprove = !requiresSignIn;
          return {
            ...challenge,
            requiresSignIn,
            canApprove,
            currentUserId: ctx.actor?.type === "board" ? ctx.actor?.userId ?? null : null,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get CLI auth challenge");
          throw err;
        }
      },
    )

    .post(
      "/cli-auth/challenges/:challengeId/approve",
      async (ctx: any) => {
        try {
          const userId = ctx.actor?.userId ?? "local-board";
          const result = await boardAuth.approveCliAuthChallenge(
            ctx.params.challengeId,
            ctx.body?.token,
            userId,
          );
          if (result.status !== "approved") {
            return { approved: false, status: result.status };
          }
          const challenge = result.challenge;
          const companyIds = await boardAuth.resolveBoardActivityCompanyIds({
            userId,
            requestedCompanyId: challenge.requestedCompanyId ?? null,
            boardApiKeyId: challenge.boardApiKeyId ?? null,
          });
          for (const companyId of companyIds) {
            await logActivity(db, {
              companyId,
              actorType: "user",
              actorId: userId,
              action: "board_api_key.created",
              entityType: "user",
              entityId: userId,
              details: {
                boardApiKeyId: challenge.boardApiKeyId,
                requestedAccess: challenge.requestedAccess,
                requestedCompanyId: challenge.requestedCompanyId,
                challengeId: challenge.id,
              },
            });
          }
          return {
            approved: true,
            status: "approved",
            userId,
            keyId: challenge.boardApiKeyId,
            expiresAt: challenge.expiresAt.toISOString(),
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to approve CLI auth challenge");
          throw err;
        }
      },
    )

    .post(
      "/cli-auth/challenges/:challengeId/cancel",
      async (ctx: any) => {
        try {
          const cancelled = await boardAuth.cancelCliAuthChallenge(
            ctx.params.challengeId,
            ctx.body?.token,
          );
          return {
            status: cancelled.status,
            cancelled: cancelled.status === "cancelled",
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to cancel CLI auth challenge");
          throw err;
        }
      },
    )

    // ---------------------------------------------------------------
    // CLI auth — me / revoke-current
    // ---------------------------------------------------------------

    .get(
      "/cli-auth/me",
      async (ctx: any) => {
        try {
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get CLI auth user info");
          throw err;
        }
      },
    )

    .post(
      "/cli-auth/revoke-current",
      async (ctx: any) => {
        try {
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
              entityType: "user",
              entityId: key.userId ?? "board",
              details: {
                boardApiKeyId: key.id,
                revokedVia: "cli_auth_logout",
              },
            });
          }
          return { revoked: true, keyId: key.id };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to revoke CLI auth token");
          throw err;
        }
      },
    )

    // ---------------------------------------------------------------
    // OpenClaw invite prompt
    // ---------------------------------------------------------------

    .post(
      "/companies/:companyId/openclaw/invite-prompt",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const a = ctx.actor as Actor;
          assertCompanyAccess(a, params.companyId);
          if (a.type === "agent") {
            if (!a.agentId) {
              set.status = 403;
              return { error: "Only level C agents can create openclaw invite prompts" };
            }
            const agent = await agents.getById(a.agentId);
            if (!agent || !isLevelCAgentRole(agent.role)) {
              set.status = 403;
              return { error: "Only level C agents can create openclaw invite prompts" };
            }
          } else if (a.type === "board") {
            const allowed =
              a.source === "local_implicit" || a.isInstanceAdmin
                ? true
                : await svc.canUser(params.companyId, a.userId ?? "board", "users:invite");
            if (!allowed) {
              set.status = 403;
              return { error: "Permission denied" };
            }
          } else {
            set.status = 403;
            return { error: "Permission denied" };
          }

          const tokenStr = createInviteToken();
          const tokenHash = await hashToken(tokenStr);
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

          const companyName = await getInviteCompanyName(db, params.companyId);
          const inviteSummary = toInviteSummaryResponse(ctx.request, tokenStr, row, companyName);

          set.status = 201;
          return {
            ...row,
            inviteUrl: `/invite/${tokenStr}`,
            companyName,
            token: tokenStr,
            allowedJoinTypes: row.allowedJoinTypes,
            onboardingPath: inviteSummary.onboardingPath,
            onboardingUrl: inviteSummary.onboardingUrl,
            onboardingTextPath: inviteSummary.onboardingTextPath,
            onboardingTextUrl: inviteSummary.onboardingTextUrl,
            skillIndexPath: inviteSummary.skillIndexPath,
            skillIndexUrl: inviteSummary.skillIndexUrl,
            inviteMessage: body?.agentMessage ?? null,
          };
        } catch (error) {
          ctx.set.status = 500;
          return { error: "Internal server error" };
        }
      },
    )

    // ---------------------------------------------------------------
    // Board claim
    // ---------------------------------------------------------------

    .get(
      "/board-claim/:token",
      async ({ params, query, set }: any) => {
        try {
          const token = String(params.token ?? "").trim();
          const code = typeof query?.code === "string" ? query.code.trim() : undefined;
          if (!token) {
            set.status = 404;
            return { error: "Board claim challenge not found" };
          }
          const challenge = inspectBoardClaimChallenge(token, code);
          if (challenge.status === "invalid") {
            set.status = 404;
            return { error: "Board claim challenge not found" };
          }
          return challenge;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to inspect board claim challenge");
          throw err;
        }
      },
      {
        params: t.Object({ token: t.String() }),
        query: t.Object({ code: t.Optional(t.String()) }),
      },
    )

    .post(
      "/board-claim/:token/claim",
      async ({ params, body, set, actor }: any) => {
        try {
          if (actor.type !== "board" || actor.source !== "session" || !actor.userId) {
            set.status = 401;
            return { error: "Sign in before claiming board ownership" };
          }

          const token = String(params.token ?? "").trim();
          const code = typeof body?.code === "string" ? body.code.trim() : undefined;
          if (!token) {
            set.status = 404;
            return { error: "Board claim challenge not found" };
          }
          if (!code) {
            set.status = 400;
            return { error: "Claim code is required" };
          }

          const claimed = await claimBoardOwnership(db, {
            token,
            code,
            userId: actor.userId,
          });

          if (claimed.status === "invalid") {
            set.status = 404;
            return { error: "Board claim challenge not found" };
          }
          if (claimed.status === "expired") {
            set.status = 409;
            return { error: "Board claim challenge expired. Restart server to generate a new one." };
          }
          if (claimed.status === "claimed") {
            return {
              claimed: true,
              userId: claimed.claimedByUserId ?? actor.userId,
            };
          }

          set.status = 409;
          return { error: "Board claim challenge is no longer available" };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to claim board ownership");
          throw err;
        }
      },
      {
        params: t.Object({ token: t.String() }),
        body: t.Object({ code: t.String() }),
      },
    )

    // ---------------------------------------------------------------
    // Skills
    // ---------------------------------------------------------------

    .get("/skills/available", async () => {
      try {
        return { skills: await listAvailableSkills() };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to list available skills");
        throw err;
      }
    })

    .get("/skills/index", () => {
      try {
        return {
          skills: [
            { name: "paperclip", path: "/api/skills/paperclip" },
            { name: "para-memory-files", path: "/api/skills/para-memory-files" },
            { name: "paperclip-create-agent", path: "/api/skills/paperclip-create-agent" },
          ],
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        log.error({ category: "http.error", err: errMsg }, "Failed to get skills index");
        throw err;
      }
    })

    .get(
      "/skills/:id",
      async ({ params, set }) => {
        try {
          const skillName = params.id.trim().toLowerCase();
          const markdown = await readSkillMarkdown(skillName);
          if (!markdown) {
            set.status = 404;
            return { error: "Skill not found" };
          }
          set.headers = { "content-type": "text/markdown" };
          return markdown;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get skill");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ---------------------------------------------------------------
    // Instance admin routes
    // ---------------------------------------------------------------

    .get(
      "/admin/users",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const admins = await svc.listInstanceAdmins();
          const adminSet = new Set(admins.map((row: { userId: string }) => row.userId));

          return db
            .select({
              id: authUsers.id,
              name: authUsers.name,
              email: authUsers.email,
              createdAt: authUsers.createdAt,
            })
            .from(authUsers)
            .orderBy(desc(authUsers.createdAt))
            .then((rows: Array<{ id: string; name: string; email: string; createdAt: Date }>) =>
              rows.map((row) => ({
                ...row,
                isInstanceAdmin: adminSet.has(row.id),
              })),
            );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list admin users");
          throw err;
        }
      },
    )

    .post(
      "/admin/users/:userId/promote-instance-admin",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const result = await svc.promoteInstanceAdmin(params.userId);
          ctx.set.status = 201;
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to promote instance admin");
          throw err;
        }
      },
      { params: t.Object({ userId: t.String() }) },
    )

    .post(
      "/admin/users/:userId/demote-instance-admin",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const removed = await svc.demoteInstanceAdmin(params.userId);
          if (!removed) {
            set.status = 404;
            return { error: "Instance admin role not found" };
          }
          return removed;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to demote instance admin");
          throw err;
        }
      },
      { params: t.Object({ userId: t.String() }) },
    )

    .get(
      "/admin/users/:userId/company-access",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const memberships = await svc.listUserCompanyAccess(params.userId);
          return memberships;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get user company access");
          throw err;
        }
      },
      { params: t.Object({ userId: t.String() }) },
    )

    .put(
      "/admin/users/:userId/company-access",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertInstanceAdmin(actor);
          const memberships = await svc.setUserCompanyAccess(
            params.userId,
            body.companyIds ?? [],
          );
          return memberships;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to set user company access");
          throw err;
        }
      },
      {
        params: t.Object({ userId: t.String() }),
        body: t.Object({ companyIds: t.Optional(t.Array(t.String())) }),
      },
    );
}
