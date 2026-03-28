import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  addApprovalCommentSchema,
  createApprovalSchema,
  requestApprovalRevisionSchema,
  resolveApprovalSchema,
  resubmitApprovalSchema,
} from "@clawdev/shared";
import { forbidden, notFound } from "../errors.js";
import { logger } from "../middleware/logger.js";
import {
  approvalService,
  heartbeatService,
  issueApprovalService,
  logActivity,
  secretService,
} from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { redactEventPayload } from "../redaction.js";
import { elysiaAuth } from "../elysia-plugins/auth.js";

function redactApprovalPayload<T extends { payload: Record<string, unknown> }>(approval: T): T {
  return { ...approval, payload: redactEventPayload(approval.payload) ?? {} };
}

export function elysiaApprovalRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = approvalService(db);
  const heartbeat = heartbeatService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const secretsSvc = secretService(db);
  const strictSecretsMode = process.env.CLAWDEV_SECRETS_STRICT_MODE === "true";

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/approvals", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const status = (query as Record<string, string>).status;
      const result = await svc.list(params.companyId, status);
      return result.map((a) => redactApprovalPayload(a));
    })
    .get("/approvals/:id", async ({ params, actor }) => {
      const approval = await svc.getById(params.id);
      if (!approval) throw notFound("Approval not found");
      assertCompanyAccess(actor, approval.companyId);
      return redactApprovalPayload(approval);
    })
    .post("/companies/:companyId/approvals", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = createApprovalSchema.parse(body);
      const rawIssueIds = (parsed as Record<string, unknown>).issueIds;
      const issueIds = Array.isArray(rawIssueIds)
        ? rawIssueIds.filter((v: unknown): v is string => typeof v === "string")
        : [];
      const uniqueIssueIds = Array.from(new Set(issueIds));
      const { issueIds: _ids, ...approvalInput } = parsed as Record<string, unknown>;
      const normalizedPayload =
        (approvalInput as Record<string, unknown>).type === "hire_agent"
          ? await secretsSvc.normalizeHireApprovalPayloadForPersistence(
              params.companyId,
              (approvalInput as Record<string, unknown>).payload as Record<string, unknown>,
              { strictMode: strictSecretsMode },
            )
          : (approvalInput as Record<string, unknown>).payload;

      const actorInfo = getActorInfo(actor);
      const approval = await svc.create(params.companyId, {
        ...(approvalInput as Record<string, unknown>),
        payload: normalizedPayload,
        requestedByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
        requestedByAgentId:
          (approvalInput as Record<string, unknown>).requestedByAgentId ??
          (actorInfo.actorType === "agent" ? actorInfo.actorId : null),
        status: "pending",
        decisionNote: null,
        decidedByUserId: null,
        decidedAt: null,
        updatedAt: new Date(),
      } as Parameters<typeof svc.create>[1]);

      if (uniqueIssueIds.length > 0) {
        await issueApprovalsSvc.linkManyForApproval(approval.id, uniqueIssueIds, {
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
    })
    .get("/approvals/:id/issues", async ({ params, actor }) => {
      const approval = await svc.getById(params.id);
      if (!approval) throw notFound("Approval not found");
      assertCompanyAccess(actor, approval.companyId);
      return issueApprovalsSvc.listIssuesForApproval(params.id);
    })
    .post("/approvals/:id/approve", async ({ params, body, actor }) => {
      assertBoard(actor);
      const parsed = resolveApprovalSchema.parse(body);
      const { approval, applied } = await svc.approve(
        params.id,
        parsed.decidedByUserId ?? "board",
        parsed.decisionNote,
      );

      if (applied) {
        const linkedIssues = await issueApprovalsSvc.listIssuesForApproval(approval.id);
        const linkedIssueIds = linkedIssues.map((issue) => issue.id);
        const primaryIssueId = linkedIssueIds[0] ?? null;

        await logActivity(db, {
          companyId: approval.companyId,
          actorType: "user",
          actorId: actor.userId ?? "board",
          action: "approval.approved",
          entityType: "approval",
          entityId: approval.id,
          details: { type: approval.type, requestedByAgentId: approval.requestedByAgentId, linkedIssueIds },
        });

        if (approval.requestedByAgentId) {
          try {
            const wakeRun = await heartbeat.wakeup(approval.requestedByAgentId, {
              source: "automation",
              triggerDetail: "system",
              reason: "approval_approved",
              payload: {
                approvalId: approval.id,
                approvalStatus: approval.status,
                issueId: primaryIssueId,
                issueIds: linkedIssueIds,
              },
              requestedByActorType: "user",
              requestedByActorId: actor.userId ?? "board",
              contextSnapshot: {
                source: "approval.approved",
                approvalId: approval.id,
                approvalStatus: approval.status,
                issueId: primaryIssueId,
                issueIds: linkedIssueIds,
                taskId: primaryIssueId,
                wakeReason: "approval_approved",
              },
            });

            await logActivity(db, {
              companyId: approval.companyId,
              actorType: "user",
              actorId: actor.userId ?? "board",
              action: "approval.requester_wakeup_queued",
              entityType: "approval",
              entityId: approval.id,
              details: { requesterAgentId: approval.requestedByAgentId, wakeRunId: wakeRun?.id ?? null, linkedIssueIds },
            });
          } catch (err) {
            logger.warn({ err, approvalId: approval.id, requestedByAgentId: approval.requestedByAgentId }, "failed to queue requester wakeup after approval");
            await logActivity(db, {
              companyId: approval.companyId,
              actorType: "user",
              actorId: actor.userId ?? "board",
              action: "approval.requester_wakeup_failed",
              entityType: "approval",
              entityId: approval.id,
              details: { requesterAgentId: approval.requestedByAgentId, linkedIssueIds, error: err instanceof Error ? err.message : String(err) },
            });
          }
        }
      }
      return redactApprovalPayload(approval);
    })
    .post("/approvals/:id/reject", async ({ params, body, actor }) => {
      assertBoard(actor);
      const parsed = resolveApprovalSchema.parse(body);
      const { approval, applied } = await svc.reject(params.id, parsed.decidedByUserId ?? "board", parsed.decisionNote);
      if (applied) {
        await logActivity(db, {
          companyId: approval.companyId,
          actorType: "user",
          actorId: actor.userId ?? "board",
          action: "approval.rejected",
          entityType: "approval",
          entityId: approval.id,
          details: { type: approval.type },
        });
      }
      return redactApprovalPayload(approval);
    })
    .post("/approvals/:id/request-revision", async ({ params, body, actor }) => {
      assertBoard(actor);
      const parsed = requestApprovalRevisionSchema.parse(body);
      const approval = await svc.requestRevision(params.id, parsed.decidedByUserId ?? "board", parsed.decisionNote);
      await logActivity(db, {
        companyId: approval.companyId,
        actorType: "user",
        actorId: actor.userId ?? "board",
        action: "approval.revision_requested",
        entityType: "approval",
        entityId: approval.id,
        details: { type: approval.type },
      });
      return redactApprovalPayload(approval);
    })
    .post("/approvals/:id/resubmit", async ({ params, body, actor }) => {
      const parsed = resubmitApprovalSchema.parse(body);
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Approval not found");
      assertCompanyAccess(actor, existing.companyId);
      if (actor.type === "agent" && actor.agentId !== existing.requestedByAgentId) {
        throw forbidden("Only requesting agent can resubmit this approval");
      }
      const normalizedPayload = parsed.payload
        ? existing.type === "hire_agent"
          ? await secretsSvc.normalizeHireApprovalPayloadForPersistence(existing.companyId, parsed.payload as Record<string, unknown>, { strictMode: strictSecretsMode })
          : parsed.payload
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
    })
    .get("/approvals/:id/comments", async ({ params, actor }) => {
      const approval = await svc.getById(params.id);
      if (!approval) throw notFound("Approval not found");
      assertCompanyAccess(actor, approval.companyId);
      return svc.listComments(params.id);
    })
    .post("/approvals/:id/comments", async ({ params, body, actor, set }) => {
      const parsed = addApprovalCommentSchema.parse(body);
      const approval = await svc.getById(params.id);
      if (!approval) throw notFound("Approval not found");
      assertCompanyAccess(actor, approval.companyId);
      const actorInfo = getActorInfo(actor);
      const comment = await svc.addComment(params.id, parsed.body, {
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
    });
}
