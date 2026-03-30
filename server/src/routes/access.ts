/**
 * Access & auth routes — Elysia port.
 *
 * Handles board claims, CLI authentication, invites, join requests,
 * member management, and skills access control.
 */

import crypto from "node:crypto";
import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  accessService,
  agentService,
  boardAuthService,
  logActivity,
} from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import { companyInviteExpiresAt } from "./access-utils.js";

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

export function accessRoutes(db: Db) {
  const svc = accessService(db);
  const agents = agentService(db);
  const boardAuth = boardAuthService(db);

  return new Elysia()
    // List members for a company
    .get(
      "/companies/:companyId/members",
      async ({ params }) => {
        const members = await svc.listMembers(params.companyId);
        return members;
      },
      { params: companyIdParam },
    )

    // List invites
    .get(
      "/companies/:companyId/invites",
      async ({ params }) => {
        const invites = await svc.listInvites(params.companyId);
        return invites;
      },
      { params: companyIdParam },
    )

    // Create invite
    .post(
      "/companies/:companyId/invites",
      async ({ params, body }) => {
        const invite = await svc.createInvite({
          companyId: params.companyId,
          email: body.email,
          role: body.role,
        });
        return invite;
      },
      {
        params: companyIdParam,
        body: t.Object({
          email: t.String({ format: "email" }),
          role: t.Optional(t.String()),
        }),
      },
    )

    // Revoke invite
    .post(
      "/invites/:inviteId/revoke",
      async ({ params }) => {
        await svc.revokeInvite(params.inviteId);
        return { success: true };
      },
      { params: t.Object({ inviteId: t.String() }) },
    )

    // Accept invite
    .post(
      "/invites/:inviteId/accept",
      async ({ params }) => {
        const result = await svc.acceptInvite(params.inviteId);
        return result;
      },
      { params: t.Object({ inviteId: t.String() }) },
    )

    // CLI auth — generate token
    .post("/cli/auth/token", async () => {
      const token = await svc.generateCliToken();
      return token;
    })

    // CLI auth — verify token
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

    // Create CLI auth challenge
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

    // Describe CLI auth challenge
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

    // Approve CLI auth challenge
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
          boardApiKeyId: challenge.boardApiKeyId,
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

    // Revoke current board API key
    .post(
      "/cli-auth/revoke-current",
      async (ctx: any) => {
        const key = await boardAuth.assertCurrentBoardKey(ctx.actor?.keyId, ctx.actor?.userId);
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
        if (a.type === "agent") {
          const agent = await agents.getById(a.agentId);
          if (!agent || agent.role !== "ceo") {
            set.status = 403;
            return { error: "Only CEO agents can create openclaw invite prompts" };
          }
        } else if (a.type === "board") {
          const allowed = await svc.canUser(a.userId, "invite", params.companyId);
          if (!allowed) {
            set.status = 403;
            return { error: "Permission denied" };
          }
        } else {
          set.status = 403;
          return { error: "Permission denied" };
        }

        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const now = Date.now();
        const expiresAt = companyInviteExpiresAt(now);

        const inviteInsert = db.insert as any;
        const result = await inviteInsert({
          id: crypto.randomUUID(),
          companyId: params.companyId,
          inviteType: "company_join",
          allowedJoinTypes: "agent",
          defaultsPayload: body?.agentMessage ? { agentMessage: body.agentMessage } : null,
          expiresAt,
          invitedByUserId: a.type === "board" ? a.userId : null,
          tokenHash,
          revokedAt: null,
          acceptedAt: null,
        }).values({}).returning();

        const invite = result[0];
        set.status = 201;
        return {
          ...invite,
          token,
          allowedJoinTypes: invite.allowedJoinTypes,
          onboardingTextPath: `/api/invites/${token}/onboarding.txt`,
        };
      },
    );
}
