import { Elysia } from "elysia";
import { and, eq, isNull, desc } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentApiKeys, authUsers, invites, joinRequests } from "@clawdev/db";
import {
  acceptInviteSchema,
  createCliAuthChallengeSchema,
  claimJoinRequestApiKeySchema,
  createCompanyInviteSchema,
  createOpenClawInvitePromptSchema,
  listJoinRequestsQuerySchema,
  resolveCliAuthChallengeSchema,
  updateMemberPermissionsSchema,
  updateUserCompanyAccessSchema,
} from "@clawdev/shared";
import type { DeploymentExposure, DeploymentMode } from "@clawdev/shared";
import { badRequest, conflict, forbidden, notFound, unauthorized } from "../errors.js";
import { logger } from "../middleware/logger.js";
import {
  accessService,
  agentService,
  boardAuthService,
  deduplicateAgentName,
  logActivity,
  notifyHireApproved,
} from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";
import { claimBoardOwnership, inspectBoardClaimChallenge } from "../board-claim.js";
import { authPlugin, type Actor } from "../plugins/auth.js";
import {
  hashToken,
  createInviteToken,
  createClaimSecret,
  companyInviteExpiresAt,
  tokenHashesMatch,
  readSkillMarkdown,
  listAvailableSkills,
  toJoinRequestResponse,
  isPlainObject,
  normalizeAgentDefaultsForJoin,
  buildJoinDefaultsPayloadForAccept,
  mergeJoinDefaultsPayloadForReplay,
  canReplayOpenClawGatewayInviteAccept,
  summarizeOpenClawGatewayDefaultsForLog,
  agentJoinGrantsFromDefaults,
  resolveJoinRequestAgentManagerId,
  isInviteTokenHashCollisionError,
  grantsFromDefaults,
  buildInviteOnboardingTextDocument,
} from "../routes/access.js";

// Re-implement Express-Request-dependent helpers for Elysia context

function requestBaseUrlFromHeaders(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto?.split(",")[0]?.trim() || "http";
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host");
  if (!host) return "";
  return `${proto}://${host}`;
}

function requestIpFromHeaders(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) { const first = forwarded.split(",")[0]?.trim(); if (first) return first; }
  return "unknown";
}

function isLocalImplicitActor(actor: Actor) {
  return actor.type === "board" && actor.source === "local_implicit";
}

function inviteExpired(invite: typeof invites.$inferSelect) {
  return invite.expiresAt.getTime() <= Date.now();
}

async function resolveActorEmailFromDb(db: Db, actor: Actor): Promise<string | null> {
  if (isLocalImplicitActor(actor)) return "local@clawdev.local";
  if (!actor.userId) return null;
  const user = await db.select({ email: authUsers.email }).from(authUsers).where(eq(authUsers.id, actor.userId)).then((rows) => rows[0] ?? null);
  return user?.email ?? null;
}

function extractInviteMessage(invite: typeof invites.$inferSelect): string | null {
  const raw = invite.defaultsPayload;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const msg = (raw as Record<string, unknown>).agentMessage;
  if (typeof msg !== "string") return null;
  const trimmed = msg.trim();
  return trimmed.length ? trimmed : null;
}

function mergeInviteDefaults(defaultsPayload: Record<string, unknown> | null | undefined, agentMessage: string | null): Record<string, unknown> | null {
  const merged = defaultsPayload && typeof defaultsPayload === "object" ? { ...defaultsPayload } : {};
  if (agentMessage) merged.agentMessage = agentMessage;
  return Object.keys(merged).length ? merged : null;
}

function buildCliAuthApprovalPath(challengeId: string, token: string) {
  return `/cli-auth/${challengeId}?token=${encodeURIComponent(token)}`;
}

export function accessRoutes(
  db: Db,
  authPlugin: ReturnType<typeof authPlugin>,
  opts: {
    deploymentMode: DeploymentMode;
    deploymentExposure: DeploymentExposure;
    bindHost: string;
    allowedHostnames: string[];
  },
) {
  const access = accessService(db);
  const boardAuth = boardAuthService(db);
  const agents = agentService(db);

  async function assertInstanceAdmin(actor: Actor) {
    if (actor.type !== "board") throw unauthorized();
    if (isLocalImplicitActor(actor)) return;
    const allowed = await access.isInstanceAdmin(actor.userId!);
    if (!allowed) throw forbidden("Instance admin required");
  }

  async function assertCompanyPermission(actor: Actor, companyId: string, permissionKey: any) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "agent") {
      if (!actor.agentId) throw forbidden();
      const allowed = await access.hasPermission(companyId, "agent", actor.agentId, permissionKey);
      if (!allowed) throw forbidden("Permission denied");
      return;
    }
    if (actor.type !== "board") throw unauthorized();
    if (isLocalImplicitActor(actor)) return;
    const allowed = await access.canUser(companyId, actor.userId!, permissionKey);
    if (!allowed) throw forbidden("Permission denied");
  }

  async function assertCanGenerateOpenClawInvitePrompt(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "agent") {
      if (!actor.agentId) throw forbidden("Agent authentication required");
      const actorAgent = await agents.getById(actor.agentId);
      if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
      if (actorAgent.role !== "ceo") throw forbidden("Only CEO agents can generate OpenClaw invite prompts");
      return;
    }
    if (actor.type !== "board") throw unauthorized();
    if (isLocalImplicitActor(actor)) return;
    const allowed = await access.canUser(companyId, actor.userId!, "users:invite");
    if (!allowed) throw forbidden("Permission denied");
  }

  async function createCompanyInviteForCompany(actor: Actor, request: Request, companyId: string, allowedJoinTypes: "human" | "agent" | "both", defaultsPayload?: Record<string, unknown> | null, agentMessage?: string | null) {
    const normalizedAgentMessage = typeof agentMessage === "string" ? agentMessage.trim() || null : null;
    const insertValues = { companyId, inviteType: "company_join" as const, allowedJoinTypes, defaultsPayload: mergeInviteDefaults(defaultsPayload ?? null, normalizedAgentMessage), expiresAt: companyInviteExpiresAt(), invitedByUserId: actor.userId ?? null };
    let token: string | null = null;
    let created: typeof invites.$inferSelect | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidateToken = createInviteToken();
      try {
        const row = await db.insert(invites).values({ ...insertValues, tokenHash: hashToken(candidateToken) }).returning().then((rows) => rows[0]);
        token = candidateToken; created = row; break;
      } catch (error) { if (!isInviteTokenHashCollisionError(error)) throw error; }
    }
    if (!token || !created) throw conflict("Failed to generate a unique invite token. Please retry.");
    return { token, created, normalizedAgentMessage };
  }

  function toInviteSummary(request: Request, token: string, invite: typeof invites.$inferSelect) {
    const baseUrl = requestBaseUrlFromHeaders(request);
    const onboardingPath = `/api/invites/${token}/onboarding`;
    const onboardingTextPath = `/api/invites/${token}/onboarding.txt`;
    return { id: invite.id, companyId: invite.companyId, inviteType: invite.inviteType, allowedJoinTypes: invite.allowedJoinTypes, expiresAt: invite.expiresAt, onboardingPath, onboardingUrl: baseUrl ? `${baseUrl}${onboardingPath}` : onboardingPath, onboardingTextPath, onboardingTextUrl: baseUrl ? `${baseUrl}${onboardingTextPath}` : onboardingTextPath, skillIndexPath: "/api/skills/index", skillIndexUrl: baseUrl ? `${baseUrl}/api/skills/index` : "/api/skills/index", inviteMessage: extractInviteMessage(invite) };
  }

  return new Elysia()
    .use(authPlugin)

    // === Board claim ===
    .get("/board-claim/:token", async ({ params, query }) => {
      const token = params.token.trim();
      const code = typeof (query as Record<string, string>).code === "string" ? (query as Record<string, string>).code.trim() : undefined;
      if (!token) throw notFound("Board claim challenge not found");
      const challenge = inspectBoardClaimChallenge(token, code);
      if (challenge.status === "invalid") throw notFound("Board claim challenge not found");
      return challenge;
    })
    .post("/board-claim/:token/claim", async ({ params, body, actor }) => {
      const token = params.token.trim();
      const code = typeof (body as Record<string, unknown>)?.code === "string" ? ((body as Record<string, unknown>).code as string).trim() : undefined;
      if (!token) throw notFound("Board claim challenge not found");
      if (!code) throw badRequest("Claim code is required");
      if (actor.type !== "board" || actor.source !== "session" || !actor.userId) throw unauthorized("Sign in before claiming board ownership");
      const claimed = await claimBoardOwnership(db, { token, code, userId: actor.userId });
      if (claimed.status === "invalid") throw notFound("Board claim challenge not found");
      if (claimed.status === "expired") throw conflict("Board claim challenge expired. Restart server to generate a new one.");
      if (claimed.status === "claimed") return { claimed: true, userId: claimed.claimedByUserId ?? actor.userId };
      throw conflict("Board claim challenge is no longer available");
    })

    // === CLI auth ===
    .post("/cli-auth/challenges", async ({ body, request, set }) => {
      const parsed = createCliAuthChallengeSchema.parse(body);
      const created = await boardAuth.createCliAuthChallenge(parsed);
      const approvalPath = buildCliAuthApprovalPath(created.challenge.id, created.challengeSecret);
      const baseUrl = requestBaseUrlFromHeaders(request);
      set.status = 201;
      return { id: created.challenge.id, token: created.challengeSecret, boardApiToken: created.pendingBoardToken, approvalPath, approvalUrl: baseUrl ? `${baseUrl}${approvalPath}` : null, pollPath: `/cli-auth/challenges/${created.challenge.id}`, expiresAt: created.challenge.expiresAt.toISOString(), suggestedPollIntervalMs: 1000 };
    })
    .get("/cli-auth/challenges/:id", async ({ params, query, actor }) => {
      const q = query as Record<string, string>;
      const token = q.token?.trim() ?? "";
      if (!params.id || !token) throw notFound("CLI auth challenge not found");
      const challenge = await boardAuth.describeCliAuthChallenge(params.id, token);
      if (!challenge) throw notFound("CLI auth challenge not found");
      const isSignedIn = actor.type === "board" && (actor.source === "session" || isLocalImplicitActor(actor)) && Boolean(actor.userId);
      const canApprove = isSignedIn && (challenge.requestedAccess !== "instance_admin_required" || isLocalImplicitActor(actor) || Boolean(actor.isInstanceAdmin));
      return { ...challenge, requiresSignIn: !isSignedIn, canApprove, currentUserId: actor.type === "board" ? actor.userId ?? null : null };
    })
    .post("/cli-auth/challenges/:id/approve", async ({ params, body, actor }) => {
      const parsed = resolveCliAuthChallengeSchema.parse(body);
      if (actor.type !== "board" || (!actor.userId && !isLocalImplicitActor(actor))) throw unauthorized("Sign in before approving CLI access");
      const userId = actor.userId ?? "local-board";
      const approved = await boardAuth.approveCliAuthChallenge(params.id, parsed.token, userId);
      if (approved.status === "approved") {
        const companyIds = await boardAuth.resolveBoardActivityCompanyIds({ userId, requestedCompanyId: approved.challenge.requestedCompanyId, boardApiKeyId: approved.challenge.boardApiKeyId });
        for (const companyId of companyIds) await logActivity(db, { companyId, actorType: "user", actorId: userId, action: "board_api_key.created", entityType: "user", entityId: userId, details: { boardApiKeyId: approved.challenge.boardApiKeyId, requestedAccess: approved.challenge.requestedAccess, requestedCompanyId: approved.challenge.requestedCompanyId, challengeId: approved.challenge.id } });
      }
      return { approved: approved.status === "approved", status: approved.status, userId, keyId: approved.challenge.boardApiKeyId ?? null, expiresAt: approved.challenge.expiresAt.toISOString() };
    })
    .post("/cli-auth/challenges/:id/cancel", async ({ params, body }) => {
      const parsed = resolveCliAuthChallengeSchema.parse(body);
      const cancelled = await boardAuth.cancelCliAuthChallenge(params.id, parsed.token);
      return { status: cancelled.status, cancelled: cancelled.status === "cancelled" };
    })
    .get("/cli-auth/me", async ({ actor }) => {
      if (actor.type !== "board" || !actor.userId) throw unauthorized("Board authentication required");
      const accessSnapshot = await boardAuth.resolveBoardAccess(actor.userId);
      return { user: accessSnapshot.user, userId: actor.userId, isInstanceAdmin: accessSnapshot.isInstanceAdmin, companyIds: accessSnapshot.companyIds, source: actor.source ?? "none", keyId: actor.source === "board_api_key" ? (actor as unknown as Record<string, unknown>).keyId ?? null : null };
    })
    .post("/cli-auth/revoke-current", async ({ actor }) => {
      if (actor.type !== "board" || actor.source !== "board_api_key") throw badRequest("Current board API key context is required");
      const key = await boardAuth.assertCurrentBoardKey((actor as unknown as Record<string, unknown>).keyId as string, actor.userId);
      await boardAuth.revokeBoardApiKey(key.id);
      const companyIds = await boardAuth.resolveBoardActivityCompanyIds({ userId: key.userId, boardApiKeyId: key.id });
      for (const companyId of companyIds) await logActivity(db, { companyId, actorType: "user", actorId: key.userId, action: "board_api_key.revoked", entityType: "user", entityId: key.userId, details: { boardApiKeyId: key.id, revokedVia: "cli_auth_logout" } });
      return { revoked: true, keyId: key.id };
    })

    // === Skills ===
    .get("/skills/available", () => ({ skills: listAvailableSkills() }))
    .get("/skills/index", () => ({ skills: [{ name: "clawdev", path: "/api/skills/clawdev" }, { name: "para-memory-files", path: "/api/skills/para-memory-files" }, { name: "clawdev-create-agent", path: "/api/skills/clawdev-create-agent" }] }))
    .get("/skills/:skillName", ({ params, set }) => {
      const markdown = readSkillMarkdown(params.skillName.trim().toLowerCase());
      if (!markdown) throw notFound("Skill not found");
      set.headers["content-type"] = "text/markdown";
      return markdown;
    })

    // === Invites ===
    .post("/companies/:companyId/invites", async ({ params, body, actor, request, set }) => {
      const parsed = createCompanyInviteSchema.parse(body);
      await assertCompanyPermission(actor, params.companyId, "users:invite");
      const { token, created, normalizedAgentMessage } = await createCompanyInviteForCompany(actor, request, params.companyId, (parsed as Record<string, unknown>).allowedJoinTypes as "human" | "agent" | "both", (parsed as Record<string, unknown>).defaultsPayload as Record<string, unknown> | null, (parsed as Record<string, unknown>).agentMessage as string | null);
      await logActivity(db, { companyId: params.companyId, actorType: actor.type === "agent" ? "agent" : "user", actorId: actor.type === "agent" ? actor.agentId ?? "unknown-agent" : actor.userId ?? "board", action: "invite.created", entityType: "invite", entityId: created.id, details: { inviteType: created.inviteType, allowedJoinTypes: created.allowedJoinTypes, expiresAt: created.expiresAt.toISOString(), hasAgentMessage: Boolean(normalizedAgentMessage) } });
      const summary = toInviteSummary(request, token, created);
      set.status = 201;
      return { ...created, token, inviteUrl: `/invite/${token}`, onboardingTextPath: summary.onboardingTextPath, onboardingTextUrl: summary.onboardingTextUrl, inviteMessage: summary.inviteMessage };
    })
    .post("/companies/:companyId/openclaw/invite-prompt", async ({ params, body, actor, request, set }) => {
      const parsed = createOpenClawInvitePromptSchema.parse(body);
      await assertCanGenerateOpenClawInvitePrompt(actor, params.companyId);
      const { token, created, normalizedAgentMessage } = await createCompanyInviteForCompany(actor, request, params.companyId, "agent", null, (parsed as Record<string, unknown>).agentMessage as string | null);
      await logActivity(db, { companyId: params.companyId, actorType: actor.type === "agent" ? "agent" : "user", actorId: actor.type === "agent" ? actor.agentId ?? "unknown-agent" : actor.userId ?? "board", action: "invite.openclaw_prompt_created", entityType: "invite", entityId: created.id, details: { inviteType: created.inviteType, allowedJoinTypes: created.allowedJoinTypes, expiresAt: created.expiresAt.toISOString(), hasAgentMessage: Boolean(normalizedAgentMessage) } });
      const summary = toInviteSummary(request, token, created);
      set.status = 201;
      return { ...created, token, inviteUrl: `/invite/${token}`, onboardingTextPath: summary.onboardingTextPath, onboardingTextUrl: summary.onboardingTextUrl, inviteMessage: summary.inviteMessage };
    })
    .get("/invites/:token", async ({ params, request }) => {
      const token = params.token.trim();
      if (!token) throw notFound("Invite not found");
      const invite = await db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).then((rows) => rows[0] ?? null);
      if (!invite || invite.revokedAt || invite.acceptedAt || inviteExpired(invite)) throw notFound("Invite not found");
      return toInviteSummary(request, token, invite);
    })
    .get("/invites/:token/onboarding", async ({ params, request }) => {
      const token = params.token.trim();
      if (!token) throw notFound("Invite not found");
      const invite = await db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).then((rows) => rows[0] ?? null);
      if (!invite || invite.revokedAt || inviteExpired(invite)) throw notFound("Invite not found");
      // Build onboarding manifest using the original Express-compatible function via a shim request
      const fakeReq = { header: (name: string) => request.headers.get(name) ?? undefined, protocol: new URL(request.url).protocol.replace(":", ""), actor: { type: "none", source: "none" } };
      const { buildInviteOnboardingManifest } = await import("../routes/access.js");
      return buildInviteOnboardingManifest(fakeReq as any, token, invite, opts);
    })
    .get("/invites/:token/onboarding.txt", async ({ params, request, set }) => {
      const token = params.token.trim();
      if (!token) throw notFound("Invite not found");
      const invite = await db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).then((rows) => rows[0] ?? null);
      if (!invite || invite.revokedAt || inviteExpired(invite)) throw notFound("Invite not found");
      const fakeReq = { header: (name: string) => request.headers.get(name) ?? undefined, protocol: new URL(request.url).protocol.replace(":", ""), actor: { type: "none", source: "none" } };
      set.headers["content-type"] = "text/plain; charset=utf-8";
      return buildInviteOnboardingTextDocument(fakeReq as any, token, invite, opts);
    })
    .get("/invites/:token/test-resolution", async ({ params, query }) => {
      const token = params.token.trim();
      if (!token) throw notFound("Invite not found");
      const invite = await db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).then((rows) => rows[0] ?? null);
      if (!invite || invite.revokedAt || inviteExpired(invite)) throw notFound("Invite not found");
      const q = query as Record<string, string>;
      const rawUrl = q.url?.trim() ?? "";
      if (!rawUrl) throw badRequest("url query parameter is required");
      let target: URL;
      try { target = new URL(rawUrl); } catch { throw badRequest("Invalid url parameter"); }
      const { probeInviteResolutionTarget } = await import("../routes/access.js");
      const result = await probeInviteResolutionTarget(target, 10000);
      return result;
    })

    // === Accept invite (the most complex endpoint) ===
    .post("/invites/:token/accept", async ({ params, body, actor, request, set }) => {
      const parsed = acceptInviteSchema.parse(body) as Record<string, unknown>;
      const token = params.token.trim();
      if (!token) throw notFound("Invite not found");
      const invite = await db.select().from(invites).where(eq(invites.tokenHash, hashToken(token))).then((rows) => rows[0] ?? null);
      if (!invite || invite.revokedAt || inviteExpired(invite)) throw notFound("Invite not found");
      const inviteAlreadyAccepted = Boolean(invite.acceptedAt);
      const existingJoinRequestForInvite = inviteAlreadyAccepted ? await db.select().from(joinRequests).where(eq(joinRequests.inviteId, invite.id)).then((rows) => rows[0] ?? null) : null;

      if (invite.inviteType === "bootstrap_ceo") {
        if (inviteAlreadyAccepted) throw notFound("Invite not found");
        if (parsed.requestType !== "human") throw badRequest("Bootstrap invite requires human request type");
        if (actor.type !== "board" || (!actor.userId && !isLocalImplicitActor(actor))) throw unauthorized("Authenticated user required for bootstrap acceptance");
        const userId = actor.userId ?? "local-board";
        if (!(await access.isInstanceAdmin(userId))) await access.promoteInstanceAdmin(userId);
        const updated = await db.update(invites).set({ acceptedAt: new Date(), updatedAt: new Date() }).where(eq(invites.id, invite.id)).returning().then((rows) => rows[0] ?? invite);
        set.status = 202;
        return { inviteId: updated.id, inviteType: updated.inviteType, bootstrapAccepted: true, userId };
      }

      const requestType = parsed.requestType as "human" | "agent";
      const companyId = invite.companyId;
      if (!companyId) throw conflict("Invite is missing company scope");
      if (invite.allowedJoinTypes !== "both" && invite.allowedJoinTypes !== requestType) throw badRequest(`Invite does not allow ${requestType} joins`);
      if (requestType === "human" && actor.type !== "board") throw unauthorized("Human invite acceptance requires authenticated user");
      if (requestType === "human" && !actor.userId && !isLocalImplicitActor(actor)) throw unauthorized("Authenticated user is required");
      if (requestType === "agent" && !parsed.agentName) { if (!inviteAlreadyAccepted || !existingJoinRequestForInvite?.agentName) throw badRequest("agentName is required for agent join requests"); }
      const adapterType = (parsed.adapterType as string) ?? null;
      if (inviteAlreadyAccepted && !canReplayOpenClawGatewayInviteAccept({ requestType, adapterType, existingJoinRequest: existingJoinRequestForInvite })) throw notFound("Invite not found");
      const replayJoinRequestId = inviteAlreadyAccepted ? existingJoinRequestForInvite?.id ?? null : null;
      if (inviteAlreadyAccepted && !replayJoinRequestId) throw conflict("Join request not found");

      const replayMergedDefaults = inviteAlreadyAccepted ? mergeJoinDefaultsPayloadForReplay(existingJoinRequestForInvite?.agentDefaultsPayload ?? null, parsed.agentDefaultsPayload ?? null) : parsed.agentDefaultsPayload ?? null;
      const gatewayDefaultsPayload = requestType === "agent" ? buildJoinDefaultsPayloadForAccept({ adapterType, defaultsPayload: replayMergedDefaults, clawdevApiUrl: parsed.clawdevApiUrl ?? null, inboundOpenClawAuthHeader: request.headers.get("x-openclaw-auth") ?? null, inboundOpenClawTokenHeader: request.headers.get("x-openclaw-token") ?? null }) : null;
      const joinDefaults = requestType === "agent" ? normalizeAgentDefaultsForJoin({ adapterType, defaultsPayload: gatewayDefaultsPayload, deploymentMode: opts.deploymentMode, deploymentExposure: opts.deploymentExposure, bindHost: opts.bindHost, allowedHostnames: opts.allowedHostnames }) : { normalized: null as Record<string, unknown> | null, diagnostics: [] as Array<{ code: string; level: string; message: string; hint?: string }>, fatalErrors: [] as string[] };
      if (requestType === "agent" && joinDefaults.fatalErrors.length > 0) throw badRequest(joinDefaults.fatalErrors.join("; "));
      if (requestType === "agent" && adapterType === "openclaw_gateway") logger.info({ inviteId: invite.id, normalizedAgentDefaults: summarizeOpenClawGatewayDefaultsForLog(joinDefaults.normalized) }, "invite accept normalized OpenClaw gateway defaults");

      const claimSecret = requestType === "agent" && !inviteAlreadyAccepted ? createClaimSecret() : null;
      const claimSecretHash = claimSecret ? hashToken(claimSecret) : null;
      const claimSecretExpiresAt = claimSecret ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
      const actorEmail = requestType === "human" ? await resolveActorEmailFromDb(db, actor) : null;

      const created = !inviteAlreadyAccepted
        ? await db.transaction(async (tx) => {
            await tx.update(invites).set({ acceptedAt: new Date(), updatedAt: new Date() }).where(and(eq(invites.id, invite.id), isNull(invites.acceptedAt), isNull(invites.revokedAt)));
            return tx.insert(joinRequests).values({ inviteId: invite.id, companyId, requestType, status: "pending_approval", requestIp: requestIpFromHeaders(request), requestingUserId: requestType === "human" ? actor.userId ?? "local-board" : null, requestEmailSnapshot: requestType === "human" ? actorEmail : null, agentName: requestType === "agent" ? (parsed.agentName as string) : null, adapterType: requestType === "agent" ? adapterType : null, capabilities: requestType === "agent" ? (parsed.capabilities as string) ?? null : null, agentDefaultsPayload: requestType === "agent" ? joinDefaults.normalized : null, claimSecretHash, claimSecretExpiresAt }).returning().then((rows) => rows[0]);
          })
        : await db.update(joinRequests).set({ requestIp: requestIpFromHeaders(request), agentName: requestType === "agent" ? (parsed.agentName as string) ?? existingJoinRequestForInvite?.agentName ?? null : null, capabilities: requestType === "agent" ? (parsed.capabilities as string) ?? existingJoinRequestForInvite?.capabilities ?? null : null, adapterType: requestType === "agent" ? adapterType : null, agentDefaultsPayload: requestType === "agent" ? joinDefaults.normalized : null, updatedAt: new Date() }).where(eq(joinRequests.id, replayJoinRequestId as string)).returning().then((rows) => rows[0]);

      if (!created) throw conflict("Join request not found");

      if (inviteAlreadyAccepted && requestType === "agent" && adapterType === "openclaw_gateway" && created.status === "approved" && created.createdAgentId) {
        const existingAgent = await agents.getById(created.createdAgentId);
        if (!existingAgent) throw conflict("Approved join request agent not found");
        const existingConfig = isPlainObject(existingAgent.adapterConfig) ? (existingAgent.adapterConfig as Record<string, unknown>) : {};
        await agents.update(created.createdAgentId, { adapterType, adapterConfig: { ...existingConfig, ...(joinDefaults.normalized ?? {}) } });
        await logActivity(db, { companyId, actorType: actor.type === "agent" ? "agent" : "user", actorId: actor.type === "agent" ? actor.agentId ?? "invite-agent" : actor.userId ?? "board", action: "agent.updated_from_join_replay", entityType: "agent", entityId: created.createdAgentId, details: { inviteId: invite.id, joinRequestId: created.id } });
      }

      await logActivity(db, { companyId, actorType: actor.type === "agent" ? "agent" : "user", actorId: actor.type === "agent" ? actor.agentId ?? "invite-agent" : actor.userId ?? (requestType === "agent" ? "invite-anon" : "board"), action: inviteAlreadyAccepted ? "join.request_replayed" : "join.requested", entityType: "join_request", entityId: created.id, details: { requestType, requestIp: created.requestIp, inviteReplay: inviteAlreadyAccepted } });

      const response = toJoinRequestResponse(created);
      set.status = 202;
      if (claimSecret) {
        const fakeReq = { header: (name: string) => request.headers.get(name) ?? undefined, protocol: new URL(request.url).protocol.replace(":", ""), actor: { type: "none", source: "none" } };
        const { buildInviteOnboardingManifest } = await import("../routes/access.js");
        const onboardingManifest = buildInviteOnboardingManifest(fakeReq as any, token, invite, opts);
        return { ...response, claimSecret, claimApiKeyPath: `/api/join-requests/${created.id}/claim-api-key`, onboarding: onboardingManifest.onboarding, diagnostics: joinDefaults.diagnostics };
      }
      return { ...response, ...(joinDefaults.diagnostics.length > 0 ? { diagnostics: joinDefaults.diagnostics } : {}) };
    })

    .post("/invites/:inviteId/revoke", async ({ params, actor }) => {
      const invite = await db.select().from(invites).where(eq(invites.id, params.inviteId)).then((rows) => rows[0] ?? null);
      if (!invite) throw notFound("Invite not found");
      if (invite.inviteType === "bootstrap_ceo") { await assertInstanceAdmin(actor); } else { if (!invite.companyId) throw conflict("Invite is missing company scope"); await assertCompanyPermission(actor, invite.companyId, "users:invite"); }
      if (invite.acceptedAt) throw conflict("Invite already consumed");
      if (invite.revokedAt) return invite;
      const revoked = await db.update(invites).set({ revokedAt: new Date(), updatedAt: new Date() }).where(eq(invites.id, params.inviteId)).returning().then((rows) => rows[0]);
      if (invite.companyId) await logActivity(db, { companyId: invite.companyId, actorType: actor.type === "agent" ? "agent" : "user", actorId: actor.type === "agent" ? actor.agentId ?? "unknown-agent" : actor.userId ?? "board", action: "invite.revoked", entityType: "invite", entityId: params.inviteId });
      return revoked;
    })

    // === Join requests ===
    .get("/companies/:companyId/join-requests", async ({ params, query, actor }) => {
      await assertCompanyPermission(actor, params.companyId, "joins:approve");
      const q = listJoinRequestsQuerySchema.parse(query);
      const all = await db.select().from(joinRequests).where(eq(joinRequests.companyId, params.companyId)).orderBy(desc(joinRequests.createdAt));
      return all.filter((row) => { if (q.status && row.status !== q.status) return false; if (q.requestType && row.requestType !== q.requestType) return false; return true; }).map(toJoinRequestResponse);
    })
    .post("/companies/:companyId/join-requests/:requestId/approve", async ({ params, actor }) => {
      await assertCompanyPermission(actor, params.companyId, "joins:approve");
      const existing = await db.select().from(joinRequests).where(and(eq(joinRequests.companyId, params.companyId), eq(joinRequests.id, params.requestId))).then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Join request not found");
      if (existing.status !== "pending_approval") throw conflict("Join request is not pending");
      const invite = await db.select().from(invites).where(eq(invites.id, existing.inviteId)).then((rows) => rows[0] ?? null);
      if (!invite) throw notFound("Invite not found");
      let createdAgentId: string | null = existing.createdAgentId ?? null;
      if (existing.requestType === "human") {
        if (!existing.requestingUserId) throw conflict("Join request missing user identity");
        await access.ensureMembership(params.companyId, "user", existing.requestingUserId, "member", "active");
        const grants = grantsFromDefaults(invite.defaultsPayload as Record<string, unknown> | null, "human");
        await access.setPrincipalGrants(params.companyId, "user", existing.requestingUserId, grants, actor.userId ?? null);
      } else {
        const existingAgents = await agents.list(params.companyId);
        const managerId = resolveJoinRequestAgentManagerId(existingAgents);
        if (!managerId) throw conflict("Join request cannot be approved because this company has no active CEO");
        const agentName = deduplicateAgentName(existing.agentName ?? "New Agent", existingAgents.map((a) => ({ id: a.id, name: a.name, status: a.status })));
        const created = await agents.create(params.companyId, { name: agentName, role: "general", title: null, status: "idle", reportsTo: managerId, capabilities: existing.capabilities ?? null, adapterType: existing.adapterType ?? "process", adapterConfig: existing.agentDefaultsPayload && typeof existing.agentDefaultsPayload === "object" ? (existing.agentDefaultsPayload as Record<string, unknown>) : {}, runtimeConfig: {}, budgetMonthlyCents: 0, spentMonthlyCents: 0, permissions: {}, lastHeartbeatAt: null, metadata: null } as Parameters<typeof agents.create>[1]);
        createdAgentId = created.id;
        await access.ensureMembership(params.companyId, "agent", created.id, "member", "active");
        const grants = agentJoinGrantsFromDefaults(invite.defaultsPayload as Record<string, unknown> | null);
        await access.setPrincipalGrants(params.companyId, "agent", created.id, grants, actor.userId ?? null);
      }
      const approved = await db.update(joinRequests).set({ status: "approved", approvedByUserId: actor.userId ?? (isLocalImplicitActor(actor) ? "local-board" : null), approvedAt: new Date(), createdAgentId, updatedAt: new Date() }).where(eq(joinRequests.id, params.requestId)).returning().then((rows) => rows[0]);
      await logActivity(db, { companyId: params.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "join.approved", entityType: "join_request", entityId: params.requestId, details: { requestType: existing.requestType, createdAgentId } });
      if (createdAgentId) void notifyHireApproved(db, { companyId: params.companyId, agentId: createdAgentId, source: "join_request", sourceId: params.requestId, approvedAt: new Date() }).catch(() => {});
      return toJoinRequestResponse(approved);
    })
    .post("/companies/:companyId/join-requests/:requestId/reject", async ({ params, actor }) => {
      await assertCompanyPermission(actor, params.companyId, "joins:approve");
      const existing = await db.select().from(joinRequests).where(and(eq(joinRequests.companyId, params.companyId), eq(joinRequests.id, params.requestId))).then((rows) => rows[0] ?? null);
      if (!existing) throw notFound("Join request not found");
      if (existing.status !== "pending_approval") throw conflict("Join request is not pending");
      const rejected = await db.update(joinRequests).set({ status: "rejected", rejectedByUserId: actor.userId ?? (isLocalImplicitActor(actor) ? "local-board" : null), rejectedAt: new Date(), updatedAt: new Date() }).where(eq(joinRequests.id, params.requestId)).returning().then((rows) => rows[0]);
      await logActivity(db, { companyId: params.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "join.rejected", entityType: "join_request", entityId: params.requestId, details: { requestType: existing.requestType } });
      return toJoinRequestResponse(rejected);
    })
    .post("/join-requests/:requestId/claim-api-key", async ({ params, body, set }) => {
      const parsed = claimJoinRequestApiKeySchema.parse(body);
      const presentedHash = hashToken((parsed as Record<string, unknown>).claimSecret as string);
      const jr = await db.select().from(joinRequests).where(eq(joinRequests.id, params.requestId)).then((rows) => rows[0] ?? null);
      if (!jr) throw notFound("Join request not found");
      if (jr.requestType !== "agent") throw badRequest("Only agent join requests can claim API keys");
      if (jr.status !== "approved") throw conflict("Join request must be approved before key claim");
      if (!jr.createdAgentId) throw conflict("Join request has no created agent");
      if (!jr.claimSecretHash) throw conflict("Join request is missing claim secret metadata");
      if (!tokenHashesMatch(jr.claimSecretHash, presentedHash)) throw forbidden("Invalid claim secret");
      if (jr.claimSecretExpiresAt && jr.claimSecretExpiresAt.getTime() <= Date.now()) throw conflict("Claim secret expired");
      if (jr.claimSecretConsumedAt) throw conflict("Claim secret already used");
      const existingKey = await db.select({ id: agentApiKeys.id }).from(agentApiKeys).where(eq(agentApiKeys.agentId, jr.createdAgentId)).then((rows) => rows[0] ?? null);
      if (existingKey) throw conflict("API key already claimed");
      const consumed = await db.update(joinRequests).set({ claimSecretConsumedAt: new Date(), updatedAt: new Date() }).where(and(eq(joinRequests.id, params.requestId), isNull(joinRequests.claimSecretConsumedAt))).returning({ id: joinRequests.id }).then((rows) => rows[0] ?? null);
      if (!consumed) throw conflict("Claim secret already used");
      const created = await agents.createApiKey(jr.createdAgentId, "initial-join-key");
      await logActivity(db, { companyId: jr.companyId, actorType: "system", actorId: "join-claim", action: "agent_api_key.claimed", entityType: "agent_api_key", entityId: created.id, details: { agentId: jr.createdAgentId, joinRequestId: params.requestId } });
      set.status = 201;
      return { keyId: created.id, token: created.token, agentId: jr.createdAgentId, createdAt: created.createdAt };
    })

    // === Members ===
    .get("/companies/:companyId/members", async ({ params, actor }) => {
      await assertCompanyPermission(actor, params.companyId, "users:manage_permissions");
      return access.listMembers(params.companyId);
    })
    .patch("/companies/:companyId/members/:memberId/permissions", async ({ params, body, actor }) => {
      await assertCompanyPermission(actor, params.companyId, "users:manage_permissions");
      const parsed = updateMemberPermissionsSchema.parse(body);
      const updated = await access.setMemberPermissions(params.companyId, params.memberId, (parsed as Record<string, unknown>).grants as any ?? [], actor.userId ?? null);
      if (!updated) throw notFound("Member not found");
      return updated;
    })

    // === Admin ===
    .post("/admin/users/:userId/promote-instance-admin", async ({ params, actor, set }) => {
      await assertInstanceAdmin(actor);
      set.status = 201;
      return access.promoteInstanceAdmin(params.userId);
    })
    .post("/admin/users/:userId/demote-instance-admin", async ({ params, actor }) => {
      await assertInstanceAdmin(actor);
      const removed = await access.demoteInstanceAdmin(params.userId);
      if (!removed) throw notFound("Instance admin role not found");
      return removed;
    })
    .get("/admin/users/:userId/company-access", async ({ params, actor }) => {
      await assertInstanceAdmin(actor);
      return access.listUserCompanyAccess(params.userId);
    })
    .put("/admin/users/:userId/company-access", async ({ params, body, actor }) => {
      await assertInstanceAdmin(actor);
      const parsed = updateUserCompanyAccessSchema.parse(body);
      return access.setUserCompanyAccess(params.userId, (parsed as Record<string, unknown>).companyIds as string[] ?? []);
    });
}
