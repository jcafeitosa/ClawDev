/**
 * Approvals routes — Elysia port.
 *
 * Full approval lifecycle with idempotent approve/reject,
 * revision requests, resubmission, and comments.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  approvalService,
  agentService,
  heartbeatService,
  issueApprovalService,
  logActivity,
  secretService,
} from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { forbidden } from "../errors.js";
import { redactEventPayload } from "../redaction.js";
import { logger } from "../middleware/logger.js";
import { hasLevelCAgentPermissions, isLevelCAgentRole } from "@clawdev/shared";

const log = logger.child({ service: "approvals-routes" });

function redactApprovalPayload<T extends { payload: Record<string, unknown> }>(approval: T): T {
  return {
    ...approval,
    payload: redactEventPayload(approval.payload) ?? {},
  };
}

export function approvalRoutes(db: Db) {
  const svc = approvalService(db);
  const agents = agentService(db);
  const heartbeats = heartbeatService(db);
  const issueApprovals = issueApprovalService(db);
  const secrets = secretService(db);
  const strictSecretsMode = process.env.CLAWDEV_SECRETS_STRICT_MODE === "true";

  async function canResolveHireApproval(actor: Actor, approval: { companyId: string; type: string }) {
    if (actor.type === "board") return true;
    if (approval.type !== "hire_agent") return false;
    if (!actor.agentId) return false;
    const actorAgent = await agents.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== approval.companyId) return false;
    return isLevelCAgentRole(actorAgent.role)
      || hasLevelCAgentPermissions(actorAgent.role)
      || Boolean((actorAgent.permissions as Record<string, unknown> | null | undefined)?.canCreateAgents);
  }

  return new Elysia()
    // List approvals for a company
    .get(
      "/companies/:companyId/approvals",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const status = query.status as string | undefined;
          const result = await svc.list(params.companyId, status);
          return result.map((approval: any) => redactApprovalPayload(approval));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list approvals");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Get approval by ID
    .get(
      "/approvals/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const approval = await svc.getById(params.id);
          if (!approval) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, approval.companyId);
          return redactApprovalPayload(approval);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get approval");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create approval
    .post(
      "/companies/:companyId/approvals",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const rawIssueIds = body.issueIds;
          const issueIds = Array.isArray(rawIssueIds)
            ? rawIssueIds.filter((value: unknown): value is string => typeof value === "string")
            : [];
          const uniqueIssueIds = Array.from(new Set(issueIds));
          const { issueIds: _issueIds, ...approvalInput } = body;
          const normalizedPayload =
            approvalInput.type === "hire_agent"
              ? await secrets.normalizeHireApprovalPayloadForPersistence(
                  params.companyId,
                  approvalInput.payload,
                  { strictMode: strictSecretsMode },
                )
              : approvalInput.payload;

          const actorInfo = getActorInfo(actor);
          const approval = await svc.create(params.companyId, {
            ...approvalInput,
            payload: normalizedPayload,
            requestedByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
            requestedByAgentId:
              approvalInput.requestedByAgentId ?? (actorInfo.actorType === "agent" ? actorInfo.actorId : null),
            status: "pending",
            decisionNote: null,
            decidedByUserId: null,
            decidedAt: null,
            updatedAt: new Date(),
          });

          if (uniqueIssueIds.length > 0) {
            await issueApprovals.linkManyForApproval(approval.id, uniqueIssueIds, {
              agentId: actorInfo.agentId,
              userId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
            });
          }

          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "approval.created",
            entityType: "approval",
            entityId: approval.id,
            details: { type: approval.type, issueIds: uniqueIssueIds },
          });

          set.status = 201;
          return redactApprovalPayload(approval);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create approval");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // List issues linked to an approval
    .get(
      "/approvals/:id/issues",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const approval = await svc.getById(params.id);
          if (!approval) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, approval.companyId);
          return issueApprovals.listIssuesForApproval(params.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list approval issues");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Approve
    .post(
      "/approvals/:id/approve",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          const actorInfo = getActorInfo(actor);
          const approval = await svc.getById(params.id);
          if (!approval) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, approval.companyId);
          if (!(await canResolveHireApproval(actor, approval))) {
            throw forbidden("Only board users or level C agents can approve hire requests");
          }
          const decisionActorId = actorInfo.actorId;
          const note = body?.decidedByUserId ? undefined : (body?.note ?? body?.decisionNote ?? null);

          const { approval: resolved, applied } = await svc.approve(
            params.id,
            body?.decidedByUserId ?? decisionActorId,
            note,
          );

          if (applied) {
            const linkedIssues = await issueApprovals.listIssuesForApproval(resolved.id);
            const linkedIssueIds = linkedIssues.map((issue: any) => issue.id);
            const primaryIssueId = linkedIssueIds[0] ?? null;

            await logActivity(db, {
              companyId: resolved.companyId,
              actorType: actorInfo.actorType,
              actorId: decisionActorId,
              agentId: actorInfo.agentId,
              runId: actorInfo.runId,
              action: "approval.approved",
              entityType: "approval",
              entityId: resolved.id,
              details: {
                type: resolved.type,
                requestedByAgentId: (resolved as any).requestedByAgentId,
                linkedIssueIds,
              },
            });

            if ((resolved as any).requestedByAgentId) {
              try {
                const wakeRun = await heartbeats.wakeup(
                  (resolved as any).requestedByAgentId,
                  {
                    source: "automation",
                    triggerDetail: "system",
                    reason: "approval_approved",
                    payload: {
                      approvalId: resolved.id,
                      approvalStatus: resolved.status,
                      issueId: primaryIssueId,
                      issueIds: linkedIssueIds,
                    },
                    requestedByActorType: "user",
                    requestedByActorId: decisionActorId,
                    contextSnapshot: {
                      source: "approval.approved",
                      approvalId: resolved.id,
                      approvalStatus: resolved.status,
                      issueId: primaryIssueId,
                      issueIds: linkedIssueIds,
                      taskId: primaryIssueId,
                      wakeReason: "approval_approved",
                    },
                  },
                );

                await logActivity(db, {
                  companyId: resolved.companyId,
                  actorType: actorInfo.actorType,
                  actorId: decisionActorId,
                  agentId: actorInfo.agentId,
                  runId: actorInfo.runId,
                  action: "approval.requester_wakeup_queued",
                  entityType: "approval",
                  entityId: resolved.id,
                  details: {
                    requesterAgentId: (resolved as any).requestedByAgentId,
                    wakeRunId: wakeRun?.id ?? null,
                    linkedIssueIds,
                  },
                });
              } catch (err) {
                logger.warn(
                  {
                    err,
                    approvalId: resolved.id,
                    requestedByAgentId: (resolved as any).requestedByAgentId,
                  },
                  "failed to queue requester wakeup after approval",
                );
                await logActivity(db, {
                  companyId: resolved.companyId,
                  actorType: actorInfo.actorType,
                  actorId: decisionActorId,
                  agentId: actorInfo.agentId,
                  runId: actorInfo.runId,
                  action: "approval.requester_wakeup_failed",
                  entityType: "approval",
                  entityId: resolved.id,
                  details: {
                    requesterAgentId: (resolved as any).requestedByAgentId,
                    linkedIssueIds,
                    error: err instanceof Error ? err.message : String(err),
                  },
                });
              }
            }
          }

          return redactApprovalPayload(resolved);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to approve");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(
          t.Object({
            note: t.Optional(t.String()),
            decisionNote: t.Optional(t.String()),
            decidedByUserId: t.Optional(t.String()),
          }),
        ),
      },
    )

    // Reject
    .post(
      "/approvals/:id/reject",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          const actorInfo = getActorInfo(actor);
          const approval = await svc.getById(params.id);
          if (!approval) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, approval.companyId);
          if (!(await canResolveHireApproval(actor, approval))) {
            throw forbidden("Only board users or HR agents can reject hire requests");
          }
          const decisionActorId = actorInfo.actorId;
          const note = body?.reason ?? body?.decisionNote ?? null;

          const { approval: resolved, applied } = await svc.reject(
            params.id,
            body?.decidedByUserId ?? decisionActorId,
            note,
          );

          if (applied) {
            await logActivity(db, {
              companyId: resolved.companyId,
              actorType: actorInfo.actorType,
              actorId: decisionActorId,
              agentId: actorInfo.agentId,
              runId: actorInfo.runId,
              action: "approval.rejected",
              entityType: "approval",
              entityId: resolved.id,
              details: { type: resolved.type },
            });
          }

          return redactApprovalPayload(resolved);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to reject approval");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(
          t.Object({
            reason: t.Optional(t.String()),
            decisionNote: t.Optional(t.String()),
            decidedByUserId: t.Optional(t.String()),
          }),
        ),
      },
    )

    // Request revision
    .post(
      "/approvals/:id/request-revision",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          const userId = actor.userId ?? "board";

          const approval = await svc.requestRevision(
            params.id,
            body?.decidedByUserId ?? userId,
            body?.decisionNote ?? null,
          );

          await logActivity(db, {
            companyId: approval.companyId,
            actorType: "user",
            actorId: userId,
            action: "approval.revision_requested",
            entityType: "approval",
            entityId: approval.id,
            details: { type: approval.type },
          });

          return redactApprovalPayload(approval);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to request revision");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(
          t.Object({
            decisionNote: t.Optional(t.String()),
            decidedByUserId: t.Optional(t.String()),
          }),
        ),
      },
    )

    // Resubmit
    .post(
      "/approvals/:id/resubmit",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          const existing = await svc.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, existing.companyId);

          if (actor.type === "agent" && actor.agentId !== (existing as any).requestedByAgentId) {
            throw forbidden("Only requesting agent can resubmit this approval");
          }

          const normalizedPayload = body?.payload
            ? (existing as any).type === "hire_agent"
              ? await secrets.normalizeHireApprovalPayloadForPersistence(
                  existing.companyId,
                  body.payload,
                  { strictMode: strictSecretsMode },
                )
              : body.payload
            : undefined;
          const approval = await svc.resubmit(params.id, normalizedPayload);
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: approval.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "approval.resubmitted",
            entityType: "approval",
            entityId: approval.id,
            details: { type: approval.type },
          });
          return redactApprovalPayload(approval);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to resubmit approval");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(t.Object({ payload: t.Optional(t.Any()) })),
      },
    )

    // ── Comments ────────────────────────────────────────────────────

    // List comments
    .get(
      "/approvals/:id/comments",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const approval = await svc.getById(params.id);
          if (!approval) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, approval.companyId);
          return svc.listComments(params.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list approval comments");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Add comment
    .post(
      "/approvals/:id/comments",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          const approval = await svc.getById(params.id);
          if (!approval) {
            set.status = 404;
            return { error: "Approval not found" };
          }
          assertCompanyAccess(actor, approval.companyId);
          const actorInfo = getActorInfo(actor);
          const comment = await svc.addComment(params.id, body.body, {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          await logActivity(db, {
            companyId: approval.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "approval.comment_added",
            entityType: "approval",
            entityId: approval.id,
            details: { commentId: comment.id },
          });

          set.status = 201;
          return comment;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to add approval comment");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ body: t.String() }),
      },
    );
}
