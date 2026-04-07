/**
 * Issues routes — Elysia port.
 *
 * Handles CRUD for issues, comments, attachments, work products,
 * documents, labels, approvals, checkout/release, read/inbox state.
 * Each handler delegates to the existing service layer.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { checkoutIssueSchema, composeStructuredSddDescription, isLevelCAgentRole, parseStructuredSddDescription, validateStructuredSddInput } from "@clawdev/shared";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, assertBoard, getActorInfo, type Actor } from "../middleware/authz.js";
import { logger } from "../middleware/logger.js";
import { forbidden, unauthorized, HttpError } from "../errors.js";
import {
  issueService,
  issueApprovalService,
  accessService,
  goalService,
  projectService,
  documentService,
  executionWorkspaceService,
  heartbeatService,
  workProductService,
  logActivity,
  routineService,
  agentService,
} from "../services/index.js";
import { queueIssueAssignmentWakeup } from "../services/issue-assignment-wakeup.js";
import { agentHookService } from "../services/agent-hooks.js";
import { shouldWakeAssigneeOnCheckout } from "./issues-checkout-wakeup.js";
import { isAllowedContentType, MAX_ATTACHMENT_BYTES } from "../attachment-types.js";

const MAX_ISSUE_COMMENT_LIMIT = 500;
const log = logger.child({ service: "issues-routes" });

export function issueRoutes(db: Db, _storage?: any) {
  const svc = issueService(db);
  const access = accessService(db);
  const goalsSvc = goalService(db);
  const projectsSvc = projectService(db);
  const documentsSvc = documentService(db);
  const executionWorkspacesSvc = executionWorkspaceService(db);
  const heartbeat = heartbeatService(db);
  const workProductsSvc = workProductService(db);
  const routinesSvc = routineService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const agentsSvc = agentService(db);
  const hookSvc = agentHookService(db);

  async function resolveIssueProjectAndGoal(issue: {
    companyId: string;
    projectId: string | null;
    goalId: string | null;
  }) {
    const projectPromise = issue.projectId ? projectsSvc.getById(issue.projectId) : Promise.resolve(null);
    const directGoalPromise = issue.goalId ? goalsSvc.getById(issue.goalId) : Promise.resolve(null);
    const [project, directGoal] = await Promise.all([projectPromise, directGoalPromise]);

    if (directGoal) {
      return { project, goal: directGoal };
    }

    const projectGoalId = project?.goalId ?? project?.goalIds?.[0] ?? null;
    if (projectGoalId) {
      const projectGoal = await goalsSvc.getById(projectGoalId);
      return { project, goal: projectGoal };
    }

    if (!issue.projectId) {
      const defaultGoal = await goalsSvc.getDefaultCompanyGoal(issue.companyId);
      return { project, goal: defaultGoal };
    }

    return { project, goal: null };
  }

  /** Resolve issue identifier (e.g. "CLA-1") to UUID. */
  async function normalizeIssueIdentifier(rawId: string): Promise<string> {
    if (/^[A-Z]+-\d+$/i.test(rawId)) {
      const issue = await svc.getByIdentifier(rawId);
      if (issue) return issue.id;
    }
    return rawId;
  }

  function canCreateAgentsLegacy(agent: { permissions: Record<string, unknown> | null | undefined; role: string }) {
    if (isLevelCAgentRole(agent.role)) return true;
    if (!agent.permissions || typeof agent.permissions !== "object") return false;
    return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
  }

  async function deleteCommentForBoardActor(
    actor: Actor,
    commentId: string,
    opts?: { issueId?: string | null },
  ) {
    const comment = await svc.getComment(commentId);
    if (!comment) return { status: 404 as const, body: { error: "Comment not found" } };
    if (opts?.issueId && comment.issueId !== opts.issueId) {
      return { status: 404 as const, body: { error: "Comment not found" } };
    }
    if (actor.type !== "board") {
      return { status: 403 as const, body: { error: "Board authentication required" } };
    }

    const removed = await svc.removeComment(commentId);
    if (!removed) return { status: 404 as const, body: { error: "Comment not found" } };

    const issue = await svc.getById(removed.issueId);
    if (!issue) return { status: 404 as const, body: { error: "Issue not found" } };

    const actorInfo = getActorInfo(actor);
    await logActivity(db, {
      companyId: issue.companyId,
      actorType: actorInfo.actorType,
      actorId: actorInfo.actorId,
      agentId: actorInfo.agentId,
      runId: actorInfo.runId,
      action: "issue.comment_deleted",
      entityType: "issue",
      entityId: issue.id,
      details: {
        commentId: removed.id,
        bodySnippet: removed.body.slice(0, 120),
        identifier: issue.identifier,
        issueTitle: issue.title,
      },
    });

    return { status: 200 as const, body: removed };
  }

  async function assertCanAssignTasks(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
      const allowed = await access.canUser(companyId, actor.userId!, "tasks:assign");
      if (!allowed) throw forbidden("Missing permission: tasks:assign");
      return;
    }
    if (actor.type === "agent") {
      if (!actor.agentId) throw forbidden("Agent authentication required");
      const allowedByGrant = await access.hasPermission(companyId, "agent", actor.agentId, "tasks:assign");
      if (allowedByGrant) return;
      const actorAgent = await agentsSvc.getById(actor.agentId);
      if (actorAgent && actorAgent.companyId === companyId && canCreateAgentsLegacy(actorAgent)) return;
      throw forbidden("Missing permission: tasks:assign");
    }
    throw unauthorized();
  }

  async function assertCanManageIssueApprovalLinks(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agentsSvc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Forbidden");
    if (isLevelCAgentRole(actorAgent.role) || Boolean(actorAgent.permissions?.canCreateAgents)) return;
    throw forbidden("Missing permission to link approvals");
  }

  function requireAgentRunId(actor: Actor): string | null {
    if (actor.type !== "agent") return null;
    const runId = actor.runId?.trim();
    if (runId) return runId;
    return null;
  }

  async function assertAgentRunCheckoutOwnership(
    actor: Actor,
    issue: { id: string; companyId: string; status: string; assigneeAgentId: string | null },
  ): Promise<boolean> {
    if (actor.type !== "agent") return true;
    const actorAgentId = actor.agentId;
    if (!actorAgentId) throw forbidden("Agent authentication required");
    if (issue.status !== "in_progress" || issue.assigneeAgentId !== actorAgentId) {
      return true;
    }
    const runId = requireAgentRunId(actor);
    if (!runId) throw unauthorized("Agent run id required");
    const ownership = await svc.assertCheckoutOwner(issue.id, actorAgentId, runId);
    if (ownership.adoptedFromRunId) {
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: issue.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "issue.checkout_lock_adopted",
        entityType: "issue",
        entityId: issue.id,
        details: {
          previousCheckoutRunId: ownership.adoptedFromRunId,
          checkoutRunId: runId,
          reason: "stale_checkout_run",
        },
      });
    }
    return true;
  }

  return new Elysia({ prefix: "/issues" })
    /* ------------------------------------------------------------------ */
    /* GET /issues/                                                       */
    /* ------------------------------------------------------------------ */
    .get("/", ({ set }: any) => {
      set.status = 400;
      return { error: "Missing companyId in path. Use /api/companies/{companyId}/issues." };
    })

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id                                                    */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id",
      async (ctx: any) => {
        try {
          const rawId = ctx.params.id;
          const id = await normalizeIssueIdentifier(rawId);
          // Support both UUID and identifier (e.g. "CLA-1") lookups
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
          const issue = isUuid
            ? (await svc.getById(id) ?? (svc.getByIdentifier ? await svc.getByIdentifier(id) : null))
            : (svc.getByIdentifier ? await svc.getByIdentifier(id) : null);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }

          const [{ project, goal }, ancestors, mentionedProjectIds, documentPayload] = await Promise.all([
            resolveIssueProjectAndGoal(issue),
            svc.getAncestors(issue.id),
            svc.findMentionedProjectIds ? svc.findMentionedProjectIds(issue.id) : Promise.resolve([]),
            documentsSvc.getIssueDocumentPayload ? documentsSvc.getIssueDocumentPayload(issue) : Promise.resolve({}),
          ]);
          const mentionedProjects = mentionedProjectIds.length > 0
            ? await projectsSvc.listByIds(issue.companyId, mentionedProjectIds)
            : [];
          const currentExecutionWorkspace = issue.executionWorkspaceId
            ? await executionWorkspacesSvc.getById(issue.executionWorkspaceId)
            : null;
          const workProducts = workProductsSvc.listForIssue
            ? await workProductsSvc.listForIssue(issue.id)
            : [];
          return {
            ...issue,
            goalId: goal?.id ?? issue.goalId,
            ancestors,
            ...documentPayload,
            project: project ?? null,
            goal: goal ?? null,
            mentionedProjects,
            currentExecutionWorkspace,
            workProducts,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get issue");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/heartbeat-context                                  */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/heartbeat-context",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }

          const wakeCommentId =
            typeof ctx.query?.wakeCommentId === "string" && ctx.query.wakeCommentId.trim().length > 0
              ? ctx.query.wakeCommentId.trim()
              : null;

          const [{ project, goal }, ancestors, commentCursor, wakeComment] = await Promise.all([
            resolveIssueProjectAndGoal(issue),
            svc.getAncestors(issue.id),
            svc.getCommentCursor(issue.id),
            wakeCommentId ? svc.getComment(wakeCommentId) : null,
          ]);

          return {
            issue: {
              id: issue.id,
              identifier: issue.identifier,
              title: issue.title,
              description: issue.description,
              status: issue.status,
              priority: issue.priority,
              projectId: issue.projectId,
              goalId: goal?.id ?? issue.goalId,
              parentId: issue.parentId,
              assigneeAgentId: issue.assigneeAgentId,
              assigneeUserId: issue.assigneeUserId,
              updatedAt: issue.updatedAt,
            },
            ancestors: (ancestors ?? []).map((ancestor: any) => ({
              id: ancestor.id,
              identifier: ancestor.identifier,
              title: ancestor.title,
              status: ancestor.status,
              priority: ancestor.priority,
            })),
            project: project
              ? {
                  id: project.id,
                  name: project.name,
                  status: project.status,
                  targetDate: project.targetDate,
                }
              : null,
            goal: goal
              ? {
                  id: goal.id,
                  title: goal.title,
                  status: goal.status,
                  level: goal.level,
                  parentId: goal.parentId,
                }
              : null,
            commentCursor,
            wakeComment:
              wakeComment && wakeComment.issueId === issue.id
                ? wakeComment
                : null,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get heartbeat context");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/comments                                           */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/comments",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }

          const afterCommentId =
            typeof ctx.query?.after === "string" && ctx.query.after.trim().length > 0
              ? ctx.query.after.trim()
              : typeof ctx.query?.afterCommentId === "string" && ctx.query.afterCommentId.trim().length > 0
                ? ctx.query.afterCommentId.trim()
                : null;
          const order =
            typeof ctx.query?.order === "string" && ctx.query.order.trim().toLowerCase() === "asc"
              ? ("asc" as const)
              : ("desc" as const);
          const limitRaw =
            typeof ctx.query?.limit === "string" && ctx.query.limit.trim().length > 0
              ? Number(ctx.query.limit)
              : null;
          const limit =
            limitRaw && Number.isFinite(limitRaw) && limitRaw > 0
              ? Math.min(Math.floor(limitRaw), MAX_ISSUE_COMMENT_LIMIT)
              : null;

          if (svc.listComments) {
            return await svc.listComments(id, { afterCommentId, order, limit });
          }
          return [];
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list comments");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/comments/:commentId                                */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/comments/:commentId",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const commentId = ctx.params.commentId;
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const comment = await svc.getComment(commentId);
          if (!comment || comment.issueId !== id) {
            ctx.set.status = 404;
            return { error: "Comment not found" };
          }
          return comment;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get comment");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), commentId: t.String() }) },
    )

    /* DELETE /issues/:id/comments/:commentId                             */
    /* ------------------------------------------------------------------ */
    .delete(
      "/:id/comments/:commentId",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);
          const result = await deleteCommentForBoardActor(actor, ctx.params.commentId, { issueId: issue.id });
          ctx.set.status = result.status;
          return result.body;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete comment");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), commentId: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/comments                                          */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/comments",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);
          await assertAgentRunCheckoutOwnership(actor, issue);

          const actorInfo = getActorInfo(actor);
          const reopenRequested = ctx.body.reopen === true;
          const interruptRequested = ctx.body.interrupt === true;
          const isClosed = issue.status === "done" || issue.status === "cancelled";
          let reopened = false;
          let reopenFromStatus: string | null = null;
          let interruptedRunId: string | null = null;
          let currentIssue = issue;

        if (reopenRequested && isClosed) {
          const reopenedIssue = await svc.update(id, { status: "todo" });
          if (!reopenedIssue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          reopened = true;
          reopenFromStatus = issue.status;
          currentIssue = reopenedIssue;

          await logActivity(db, {
            companyId: currentIssue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.updated",
            entityType: "issue",
            entityId: currentIssue.id,
            details: {
              status: "todo",
              reopened: true,
              reopenedFrom: reopenFromStatus,
              source: "comment",
              identifier: currentIssue.identifier,
            },
          });
        }

        if (interruptRequested) {
          if (actor.type !== "board") {
            ctx.set.status = 403;
            return { error: "Only board users can interrupt active runs from issue comments" };
          }

          let runToInterrupt = currentIssue.executionRunId
            ? await heartbeat.getRun(currentIssue.executionRunId)
            : null;

          if (
            (!runToInterrupt || runToInterrupt.status !== "running") &&
            currentIssue.assigneeAgentId
          ) {
            const activeRun = await heartbeat.getActiveRunForAgent(currentIssue.assigneeAgentId);
            const activeIssueId =
              activeRun &&
                activeRun.contextSnapshot &&
                typeof activeRun.contextSnapshot === "object" &&
                typeof (activeRun.contextSnapshot as Record<string, unknown>).issueId === "string"
                ? ((activeRun.contextSnapshot as Record<string, unknown>).issueId as string)
                : null;
            if (activeRun && activeRun.status === "running" && activeIssueId === currentIssue.id) {
              runToInterrupt = activeRun;
            }
          }

          if (runToInterrupt && runToInterrupt.status === "running") {
            const cancelled = await heartbeat.cancelRun(runToInterrupt.id);
            if (cancelled) {
              interruptedRunId = cancelled.id;
              await logActivity(db, {
                companyId: cancelled.companyId,
                actorType: actorInfo.actorType,
                actorId: actorInfo.actorId,
                agentId: actorInfo.agentId,
                runId: actorInfo.runId,
                action: "heartbeat.cancelled",
                entityType: "heartbeat_run",
                entityId: cancelled.id,
                details: { agentId: cancelled.agentId, source: "issue_comment_interrupt", issueId: currentIssue.id },
              });
            }
          }
        }

        const comment = await svc.addComment(id, ctx.body.body, {
          agentId: actorInfo.agentId ?? undefined,
          userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          runId: actorInfo.runId ?? undefined,
        });

        if (actorInfo.runId) {
          await heartbeat.reportRunActivity(actorInfo.runId).catch((err: unknown) =>
            logger.warn({ err, runId: actorInfo.runId }, "failed to clear detached run warning after issue comment"));
        }

        await logActivity(db, {
          companyId: currentIssue.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "issue.comment_added",
          entityType: "issue",
          entityId: currentIssue.id,
          details: {
            commentId: comment.id,
            bodySnippet: comment.body.slice(0, 120),
            identifier: currentIssue.identifier,
            issueTitle: currentIssue.title,
            ...(reopened ? { reopened: true, reopenedFrom: reopenFromStatus, source: "comment" } : {}),
            ...(interruptedRunId ? { interruptedRunId } : {}),
          },
        });

        // Merge all wakeups from this comment into one enqueue per agent to avoid duplicate runs.
        void (async () => {
          const wakeups = new Map<string, Parameters<typeof heartbeat.wakeup>[1]>();
          const assigneeId = currentIssue.assigneeAgentId;
          const actorIsAgent = actorInfo.actorType === "agent";
          const selfComment = actorIsAgent && actorInfo.actorId === assigneeId;
          const skipWake = selfComment || isClosed;
          if (assigneeId && (reopened || !skipWake)) {
            if (reopened) {
              wakeups.set(assigneeId, {
                source: "automation",
                triggerDetail: "system",
                reason: "issue_reopened_via_comment",
                payload: {
                  issueId: currentIssue.id,
                  commentId: comment.id,
                  reopenedFrom: reopenFromStatus,
                  mutation: "comment",
                  ...(interruptedRunId ? { interruptedRunId } : {}),
                },
                requestedByActorType: actorInfo.actorType,
                requestedByActorId: actorInfo.actorId,
                contextSnapshot: {
                  issueId: currentIssue.id,
                  taskId: currentIssue.id,
                  commentId: comment.id,
                  source: "issue.comment.reopen",
                  wakeReason: "issue_reopened_via_comment",
                  reopenedFrom: reopenFromStatus,
                  ...(interruptedRunId ? { interruptedRunId } : {}),
                },
              });
            } else {
              wakeups.set(assigneeId, {
                source: "automation",
                triggerDetail: "system",
                reason: "issue_commented",
                payload: {
                  issueId: currentIssue.id,
                  commentId: comment.id,
                  mutation: "comment",
                  ...(interruptedRunId ? { interruptedRunId } : {}),
                },
                requestedByActorType: actorInfo.actorType,
                requestedByActorId: actorInfo.actorId,
                contextSnapshot: {
                  issueId: currentIssue.id,
                  taskId: currentIssue.id,
                  commentId: comment.id,
                  source: "issue.comment",
                  wakeReason: "issue_commented",
                  ...(interruptedRunId ? { interruptedRunId } : {}),
                },
              });
            }
          }

          let mentionedIds: string[] = [];
          try {
            mentionedIds = await svc.findMentionedAgents(issue.companyId, ctx.body.body);
          } catch (err) {
            logger.warn({ err, issueId: id }, "failed to resolve @-mentions");
          }

          for (const mentionedId of mentionedIds) {
            if (wakeups.has(mentionedId)) continue;
            if (actorIsAgent && actorInfo.actorId === mentionedId) continue;
            wakeups.set(mentionedId, {
              source: "automation",
              triggerDetail: "system",
              reason: "issue_comment_mentioned",
              payload: { issueId: id, commentId: comment.id },
              requestedByActorType: actorInfo.actorType,
              requestedByActorId: actorInfo.actorId,
              contextSnapshot: {
                issueId: id,
                taskId: id,
                commentId: comment.id,
                wakeCommentId: comment.id,
                wakeReason: "issue_comment_mentioned",
                source: "comment.mention",
              },
            });
          }

          for (const [agentId, wakeup] of wakeups.entries()) {
            heartbeat
              .wakeup(agentId, wakeup)
              .catch((err: unknown) => logger.warn({ err, issueId: currentIssue.id, agentId }, "failed to wake agent on issue comment"));
          }
        })();

          ctx.set.status = 201;
          return comment;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to add comment");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          body: t.String(),
          reopen: t.Optional(t.Boolean()),
          interrupt: t.Optional(t.Boolean()),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* PATCH /issues/:id                                                  */
    /* ------------------------------------------------------------------ */
    .patch(
      "/:id",
      async (ctx: any) => {
        try {
          const { params, body, actor, set } = ctx;
          const id = await normalizeIssueIdentifier(params.id);
          const existing = await svc.getById(id);
          if (!existing) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(actor, existing.companyId);

        const assigneeWillChange =
          (body.assigneeAgentId !== undefined && body.assigneeAgentId !== existing.assigneeAgentId) ||
          (body.assigneeUserId !== undefined && body.assigneeUserId !== existing.assigneeUserId);

        const isAgentReturningIssueToCreator =
          actor.type === "agent" &&
          !!actor.agentId &&
          existing.assigneeAgentId === actor.agentId &&
          body.assigneeAgentId === null &&
          typeof body.assigneeUserId === "string" &&
          !!existing.createdByUserId &&
          body.assigneeUserId === existing.createdByUserId;

        if (assigneeWillChange) {
          if (!isAgentReturningIssueToCreator) {
            await assertCanAssignTasks(actor, existing.companyId);
          }
        }
        await assertAgentRunCheckoutOwnership(actor, existing);

        const actorInfo = getActorInfo(actor);
        const isClosed = existing.status === "done" || existing.status === "cancelled";
        const {
          comment: commentBody,
          reopen: reopenRequested,
          hiddenAt: hiddenAtRaw,
          sddSpec,
          sddDesign,
          sddRisk,
          sddRollout,
          sddRollback,
          sddValidation,
          description,
          ...updateFields
        } = body;

        if (hiddenAtRaw !== undefined) {
          updateFields.hiddenAt = hiddenAtRaw ? new Date(hiddenAtRaw) : null;
        }
        if (description !== undefined) {
          updateFields.description = description;
        }

        if (commentBody && reopenRequested === true && isClosed && updateFields.status === undefined) {
          updateFields.status = "todo";
        }

        const structuredSddPatchKeys = [sddSpec, sddDesign, sddRisk, sddRollout, sddRollback, sddValidation];
        const hasStructuredSddPatch = structuredSddPatchKeys.some((value) => value !== undefined);
        if (hasStructuredSddPatch) {
          const normalizedSpec = typeof sddSpec === "string" ? sddSpec.trim() : "";
          const normalizedDesign = typeof sddDesign === "string" ? sddDesign.trim() : "";
          const normalizedRisk = typeof sddRisk === "string" ? sddRisk.trim() : "";
          const normalizedRollout = typeof sddRollout === "string" ? sddRollout.trim() : "";
          const normalizedRollback = typeof sddRollback === "string" ? sddRollback.trim() : "";
          const normalizedValidation = typeof sddValidation === "string" ? sddValidation.trim() : "";
          const sddIssues = validateStructuredSddInput({
            spec: normalizedSpec,
            design: normalizedDesign,
            risk: normalizedRisk,
            rollout: normalizedRollout,
            rollback: normalizedRollback,
            validation: normalizedValidation,
          });
          if (sddIssues.length > 0) {
            set.status = 422;
            return {
              error: "SDD payload is too weak for issue update",
              details: sddIssues,
            };
          }
          const summary = typeof description === "string"
            ? description
            : parseStructuredSddDescription(existing.description).summary || null;
          updateFields.description = composeStructuredSddDescription({
            subjectLabel: `Issue: ${existing.identifier ?? existing.title}`,
            summary,
            spec: normalizedSpec,
            design: normalizedDesign,
            risk: normalizedRisk,
            rollout: normalizedRollout,
            rollback: normalizedRollback,
            validation: normalizedValidation,
          });
        }

        let issue;
        try {
          issue = await svc.update(id, updateFields);
        } catch (err) {
          if (err instanceof HttpError && err.status === 422) {
            logger.warn(
              {
                issueId: id,
                companyId: existing.companyId,
                assigneePatch: {
                  assigneeAgentId: body.assigneeAgentId === undefined ? "__omitted__" : body.assigneeAgentId,
                  assigneeUserId: body.assigneeUserId === undefined ? "__omitted__" : body.assigneeUserId,
                },
                currentAssignee: {
                  assigneeAgentId: existing.assigneeAgentId,
                  assigneeUserId: existing.assigneeUserId,
                },
                error: (err as HttpError).message,
                details: (err as HttpError).details,
              },
              "issue update rejected with 422",
            );
          }
          throw err;
        }
        if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }

        if (routinesSvc.syncRunStatusForIssue) {
          await routinesSvc.syncRunStatusForIssue(issue.id);
        }

        if (actorInfo.runId) {
          await heartbeat.reportRunActivity(actorInfo.runId).catch((err: unknown) =>
            logger.warn({ err, runId: actorInfo.runId }, "failed to clear detached run warning after issue activity"));
        }

        // Build activity details with previous values for changed fields
        const previous: Record<string, unknown> = {};
        for (const key of Object.keys(updateFields)) {
          if (key in existing && (existing as Record<string, unknown>)[key] !== (updateFields as Record<string, unknown>)[key]) {
            previous[key] = (existing as Record<string, unknown>)[key];
          }
        }

        const hasFieldChanges = Object.keys(previous).length > 0;
        const reopened =
          commentBody &&
          reopenRequested === true &&
          isClosed &&
          previous.status !== undefined &&
          issue.status === "todo";
        const reopenFromStatus = reopened ? existing.status : null;

        await logActivity(db, {
          companyId: issue.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "issue.updated",
          entityType: "issue",
          entityId: issue.id,
          details: {
            ...updateFields,
            identifier: issue.identifier,
            ...(commentBody ? { source: "comment" } : {}),
            ...(reopened ? { reopened: true, reopenedFrom: reopenFromStatus } : {}),
            _previous: hasFieldChanges ? previous : undefined,
          },
        });

        if (body.status && issue.assigneeAgentId) {
          const hookEvent = body.status === "done" ? "task.completed" : body.status === "blocked" ? "task.blocked" : null;
          if (hookEvent) {
            hookSvc.fireEvent(issue.companyId, issue.assigneeAgentId, hookEvent as any, {
              issueId: issue.id, title: issue.title, status: body.status, previousStatus: existing.status,
            }).catch(() => {});
          }
        }

        let comment = null;
        if (commentBody) {
          comment = await svc.addComment(id, commentBody, {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
            runId: actorInfo.runId ?? undefined,
          });

          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.comment_added",
            entityType: "issue",
            entityId: issue.id,
            details: {
              commentId: comment.id,
              bodySnippet: comment.body.slice(0, 120),
              identifier: issue.identifier,
              issueTitle: issue.title,
              ...(reopened ? { reopened: true, reopenedFrom: reopenFromStatus, source: "comment" } : {}),
              ...(hasFieldChanges ? { updated: true } : {}),
            },
          });
        }

        const statusChangedFromBacklog =
          existing.status === "backlog" &&
          issue.status !== "backlog" &&
          body.status !== undefined;

        // Merge all wakeups from this update into one enqueue per agent to avoid duplicate runs.
        void (async () => {
          const wakeups = new Map<string, Parameters<typeof heartbeat.wakeup>[1]>();

          if (assigneeWillChange && issue.assigneeAgentId && issue.status !== "backlog") {
            wakeups.set(issue.assigneeAgentId, {
              source: "assignment",
              triggerDetail: "system",
              reason: "issue_assigned",
              payload: { issueId: issue.id, mutation: "update" },
              requestedByActorType: actorInfo.actorType,
              requestedByActorId: actorInfo.actorId,
              contextSnapshot: { issueId: issue.id, source: "issue.update" },
            });
          }

          if (!assigneeWillChange && statusChangedFromBacklog && issue.assigneeAgentId) {
            wakeups.set(issue.assigneeAgentId, {
              source: "automation",
              triggerDetail: "system",
              reason: "issue_status_changed",
              payload: { issueId: issue.id, mutation: "update" },
              requestedByActorType: actorInfo.actorType,
              requestedByActorId: actorInfo.actorId,
              contextSnapshot: { issueId: issue.id, source: "issue.status_change" },
            });
          }

          if (commentBody && comment) {
            let mentionedIds: string[] = [];
            try {
              mentionedIds = await svc.findMentionedAgents(issue.companyId, commentBody);
            } catch (err) {
              logger.warn({ err, issueId: id }, "failed to resolve @-mentions");
            }

            for (const mentionedId of mentionedIds) {
              if (wakeups.has(mentionedId)) continue;
              if (actorInfo.actorType === "agent" && actorInfo.actorId === mentionedId) continue;
              wakeups.set(mentionedId, {
                source: "automation",
                triggerDetail: "system",
                reason: "issue_comment_mentioned",
                payload: { issueId: id, commentId: comment.id },
                requestedByActorType: actorInfo.actorType,
                requestedByActorId: actorInfo.actorId,
                contextSnapshot: {
                  issueId: id,
                  taskId: id,
                  commentId: comment.id,
                  wakeCommentId: comment.id,
                  wakeReason: "issue_comment_mentioned",
                  source: "comment.mention",
                },
              });
            }
          }

          for (const [agentId, wakeup] of wakeups.entries()) {
            heartbeat
              .wakeup(agentId, wakeup)
              .catch((err: unknown) => logger.warn({ err, issueId: issue.id, agentId }, "failed to wake agent on issue update"));
          }
        })();

          return { ...issue, comment };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update issue");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          status: t.Optional(t.String()),
          assigneeAgentId: t.Optional(t.Nullable(t.String())),
          assigneeUserId: t.Optional(t.Nullable(t.String())),
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          sddSpec: t.Optional(t.Nullable(t.String())),
          sddDesign: t.Optional(t.Nullable(t.String())),
          sddRisk: t.Optional(t.Nullable(t.String())),
          sddRollout: t.Optional(t.Nullable(t.String())),
          sddRollback: t.Optional(t.Nullable(t.String())),
          sddValidation: t.Optional(t.Nullable(t.String())),
          priority: t.Optional(t.String()),
          comment: t.Optional(t.String()),
          reopen: t.Optional(t.Boolean()),
          hiddenAt: t.Optional(t.Nullable(t.String())),
          projectId: t.Optional(t.Nullable(t.String())),
          goalId: t.Optional(t.Nullable(t.String())),
          parentId: t.Optional(t.Nullable(t.String())),
          labelIds: t.Optional(t.Array(t.String())),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /issues/:id                                                  */
    /* ------------------------------------------------------------------ */
    .delete(
      "/:id",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const existing = await svc.getById(id);
          if (!existing) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, existing.companyId);
          const attachments = await svc.listAttachments(id);

          const issue = await svc.remove(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }

          if (_storage) {
            for (const attachment of attachments) {
              try {
                await _storage.deleteObject(attachment.companyId, attachment.objectKey);
              } catch (err) {
                logger.warn({ err, issueId: id, attachmentId: attachment.id }, "failed to delete attachment object during issue delete");
              }
            }
          }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.deleted",
            entityType: "issue",
            entityId: issue.id,
          });

          return issue;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete issue");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/checkout                                          */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/checkout",
      async (ctx: any) => {
        try {
          const parsedBody = checkoutIssueSchema.safeParse(ctx.body);
          if (!parsedBody.success) {
            ctx.set.status = 400;
            return { error: "Validation error", details: parsedBody.error.issues };
          }
          const { agentId, expectedStatuses } = parsedBody.data;

          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);

          if (issue.projectId) {
            const project = await projectsSvc.getById(issue.projectId);
            if (project?.pausedAt) {
              ctx.set.status = 409;
              return {
                error:
                  project.pauseReason === "budget"
                    ? "Project is paused because its budget hard-stop was reached"
                    : "Project is paused",
              };
            }
          }

          if (actor.type === "agent" && actor.agentId !== agentId) {
            ctx.set.status = 403;
            return { error: "Agent can only checkout as itself" };
          }

          const checkoutRunId = requireAgentRunId(actor);
          if (actor.type === "agent" && !checkoutRunId) {
            ctx.set.status = 401;
            return { error: "Agent run id required" };
          }

          const updated = await svc.checkout(id, agentId, expectedStatuses, checkoutRunId);
          const actorInfo = getActorInfo(actor);

          void logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.checked_out",
            entityType: "issue",
            entityId: issue.id,
            details: { agentId },
          }).catch((err: unknown) => {
            logger.warn({ err, issueId: issue.id }, "failed to log issue checkout");
          });

          if (updated.assigneeAgentId) {
            hookSvc.fireEvent(issue.companyId, updated.assigneeAgentId, "task.checkout" as any, {
              issueId: issue.id, title: issue.title,
            }).catch(() => {});
          }

          if (
            shouldWakeAssigneeOnCheckout({
              actorType: actor.type,
              actorAgentId: actor.type === "agent" ? actor.agentId ?? null : null,
              checkoutAgentId: agentId,
              checkoutRunId,
            })
          ) {
            void heartbeat
              .wakeup(agentId, {
                source: "assignment",
                triggerDetail: "system",
                reason: "issue_checked_out",
                payload: { issueId: issue.id, mutation: "checkout" },
                requestedByActorType: actorInfo.actorType,
                requestedByActorId: actorInfo.actorId,
                contextSnapshot: { issueId: issue.id, source: "issue.checkout" },
              })
              .catch((err: unknown) => logger.warn({ err, issueId: issue.id }, "failed to wake assignee on issue checkout"));
          }

          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to checkout issue");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/release                                           */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/release",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const existing = await svc.getById(id);
          if (!existing) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, existing.companyId);
          await assertAgentRunCheckoutOwnership(actor, existing);

          const actorRunId = requireAgentRunId(actor);
          if (actor.type === "agent" && !actorRunId) {
            ctx.set.status = 401;
            return { error: "Agent run id required" };
          }

          const released = await svc.release(
            id,
            actor.type === "agent" ? actor.agentId : undefined,
            actorRunId,
          );
          if (!released) { ctx.set.status = 404; return { error: "Issue not found" }; }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: released.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.released",
            entityType: "issue",
            entityId: released.id,
          });

          return released;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to release issue");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/read                                              */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/read",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);
          if (actor.type !== "board") { ctx.set.status = 403; return { error: "Board authentication required" }; }
          if (!actor.userId) { ctx.set.status = 403; return { error: "Board user context required" }; }

          const readState = await svc.markRead(issue.companyId, issue.id, actor.userId, new Date());
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.read_marked",
            entityType: "issue",
            entityId: issue.id,
            details: { userId: actor.userId, lastReadAt: readState.lastReadAt },
          });
          return readState;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to mark issue as read");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/inbox-archive                                     */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/inbox-archive",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);
          if (actor.type !== "board") { ctx.set.status = 403; return { error: "Board authentication required" }; }
          if (!actor.userId) { ctx.set.status = 403; return { error: "Board user context required" }; }

          const archiveState = await svc.archiveInbox(issue.companyId, issue.id, actor.userId, new Date());
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.inbox_archived",
            entityType: "issue",
            entityId: issue.id,
            details: { userId: actor.userId, archivedAt: archiveState.archivedAt },
          });
          return archiveState;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to archive issue from inbox");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /issues/:id/inbox-archive                                   */
    /* ------------------------------------------------------------------ */
    .delete(
      "/:id/inbox-archive",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);
          if (actor.type !== "board") { ctx.set.status = 403; return { error: "Board authentication required" }; }
          if (!actor.userId) { ctx.set.status = 403; return { error: "Board user context required" }; }

          const removed = await svc.unarchiveInbox(issue.companyId, issue.id, actor.userId);
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.inbox_unarchived",
            entityType: "issue",
            entityId: issue.id,
            details: { userId: actor.userId },
          });
          return removed ?? { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to unarchive issue from inbox");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/approvals                                          */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/approvals",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(ctx.actor, issue.companyId);
          return await issueApprovalsSvc.listApprovalsForIssue(id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list issue approvals");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/approvals                                         */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/approvals",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          await assertCanManageIssueApprovalLinks(actor, issue.companyId);

          const actorInfo = getActorInfo(actor);
          await issueApprovalsSvc.link(id, ctx.body.approvalId, {
            agentId: actorInfo.agentId,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
          });

          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.approval_linked",
            entityType: "issue",
            entityId: issue.id,
            details: { approvalId: ctx.body.approvalId },
          });

          const approvals = await issueApprovalsSvc.listApprovalsForIssue(id);
          ctx.set.status = 201;
          return approvals;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to link approval to issue");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({ approvalId: t.String() }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /issues/:id/approvals/:approvalId                           */
    /* ------------------------------------------------------------------ */
    .delete(
      "/:id/approvals/:approvalId",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const approvalId = ctx.params.approvalId;
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          await assertCanManageIssueApprovalLinks(actor, issue.companyId);

          await issueApprovalsSvc.unlink(id, approvalId);

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.approval_unlinked",
            entityType: "issue",
            entityId: issue.id,
            details: { approvalId },
          });

          return { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to unlink approval from issue");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), approvalId: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/work-products                                      */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/work-products",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(ctx.actor, issue.companyId);
          return await workProductsSvc.listForIssue(issue.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list issue work products");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /issues/:id/work-products                                     */
    /* ------------------------------------------------------------------ */
    .post(
      "/:id/work-products",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);

          const product = await workProductsSvc.createForIssue(issue.id, issue.companyId, {
            ...ctx.body,
            projectId: ctx.body.projectId ?? issue.projectId ?? null,
          });
          if (!product) { ctx.set.status = 422; return { error: "Invalid work product payload" }; }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.work_product_created",
            entityType: "issue",
            entityId: issue.id,
            details: { workProductId: product.id, type: product.type, provider: product.provider },
          });

          ctx.set.status = 201;
          return product;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create issue work product");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          type: t.String(),
          provider: t.Optional(t.String()),
          externalId: t.Optional(t.Nullable(t.String())),
          externalUrl: t.Optional(t.Nullable(t.String())),
          title: t.Optional(t.Nullable(t.String())),
          description: t.Optional(t.Nullable(t.String())),
          projectId: t.Optional(t.Nullable(t.String())),
          isPrimary: t.Optional(t.Boolean()),
          metadata: t.Optional(t.Any()),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/documents                                          */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/documents",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(ctx.actor, issue.companyId);
          return await documentsSvc.listIssueDocuments(issue.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list issue documents");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/documents/:key                                     */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/documents/:key",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(ctx.actor, issue.companyId);

          const rawKey = String(ctx.params.key ?? "").trim().toLowerCase();
          const doc = await documentsSvc.getIssueDocumentByKey(issue.id, rawKey);
          if (!doc) { ctx.set.status = 404; return { error: "Document not found" }; }
          return doc;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get issue document");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), key: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* PUT /issues/:id/documents/:key                                     */
    /* ------------------------------------------------------------------ */
    .put(
      "/:id/documents/:key",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);

          const rawKey = String(ctx.params.key ?? "").trim().toLowerCase();
          const actorInfo = getActorInfo(actor);
          const result = await documentsSvc.upsertIssueDocument({
            issueId: issue.id,
            key: rawKey,
            title: ctx.body.title ?? null,
            format: ctx.body.format,
            body: ctx.body.body,
            changeSummary: ctx.body.changeSummary ?? null,
            baseRevisionId: ctx.body.baseRevisionId ?? null,
            createdByAgentId: actorInfo.agentId ?? null,
            createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
          });
          const doc = result.document;

          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: result.created ? "issue.document_created" : "issue.document_updated",
            entityType: "issue",
            entityId: issue.id,
            details: {
              key: doc.key,
              documentId: doc.id,
              title: doc.title,
              format: doc.format,
              revisionNumber: doc.latestRevisionNumber,
            },
          });

          ctx.set.status = result.created ? 201 : 200;
          return doc;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to upsert issue document");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String(), key: t.String() }),
        body: t.Object({
          title: t.Optional(t.Nullable(t.String())),
          format: t.String(),
          body: t.String(),
          changeSummary: t.Optional(t.Nullable(t.String())),
          baseRevisionId: t.Optional(t.Nullable(t.String())),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/documents/:key/revisions                           */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/documents/:key/revisions",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(ctx.actor, issue.companyId);

          const rawKey = String(ctx.params.key ?? "").trim().toLowerCase();
          return await documentsSvc.listIssueDocumentRevisions(issue.id, rawKey);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list issue document revisions");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), key: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /issues/:id/documents/:key                                  */
    /* ------------------------------------------------------------------ */
    .delete(
      "/:id/documents/:key",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, issue.companyId);
          if (actor.type !== "board") { ctx.set.status = 403; return { error: "Board authentication required" }; }

          const rawKey = String(ctx.params.key ?? "").trim().toLowerCase();
          const removed = await documentsSvc.deleteIssueDocument(issue.id, rawKey);
          if (!removed) { ctx.set.status = 404; return { error: "Document not found" }; }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: issue.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.document_deleted",
            entityType: "issue",
            entityId: issue.id,
            details: {
              key: removed.key,
              documentId: removed.id,
              title: removed.title,
            },
          });

          return { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete issue document");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), key: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* GET /issues/:id/attachments                                        */
    /* ------------------------------------------------------------------ */
    .get(
      "/:id/attachments",
      async (ctx: any) => {
        try {
          const id = await normalizeIssueIdentifier(ctx.params.id);
          const issue = await svc.getById(id);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          assertCompanyAccess(ctx.actor, issue.companyId);
          const attachments = await svc.listAttachments(id);
          return attachments.map((a: any) => ({
            ...a,
            contentPath: `/api/attachments/${a.id}/content`,
          }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list issue attachments");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}

/* ====================================================================== */
/* Company-scoped issue routes (mounted at /companies/:companyId level)   */
/* ====================================================================== */

export function companyIssueRoutes(db: Db) {
  const svc = issueService(db);
  const goalsSvc = goalService(db);
  const projectsSvc = projectService(db);
  const heartbeat = heartbeatService(db);

  return new Elysia()
    /* ------------------------------------------------------------------ */
    /* GET /companies/:companyId/issues                                   */
    /* ------------------------------------------------------------------ */
    .get(
      "/companies/:companyId/issues",
      async (ctx: any) => {
        try {
          const companyId = ctx.params.companyId;
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, companyId);

          const assigneeUserFilterRaw = ctx.query?.assigneeUserId as string | undefined;
          const touchedByUserFilterRaw = ctx.query?.touchedByUserId as string | undefined;
          const inboxArchivedByUserFilterRaw = ctx.query?.inboxArchivedByUserId as string | undefined;
          const unreadForUserFilterRaw = ctx.query?.unreadForUserId as string | undefined;

          const assigneeUserId =
            assigneeUserFilterRaw === "me" && actor.type === "board"
              ? actor.userId
              : assigneeUserFilterRaw;
          const touchedByUserId =
            touchedByUserFilterRaw === "me" && actor.type === "board"
              ? actor.userId
              : touchedByUserFilterRaw;
          const inboxArchivedByUserId =
            inboxArchivedByUserFilterRaw === "me" && actor.type === "board"
              ? actor.userId
              : inboxArchivedByUserFilterRaw;
          const unreadForUserId =
            unreadForUserFilterRaw === "me" && actor.type === "board"
              ? actor.userId
              : unreadForUserFilterRaw;

          if (assigneeUserFilterRaw === "me" && (!assigneeUserId || actor.type !== "board")) {
            ctx.set.status = 403;
            return { error: "assigneeUserId=me requires board authentication" };
          }
          if (touchedByUserFilterRaw === "me" && (!touchedByUserId || actor.type !== "board")) {
            ctx.set.status = 403;
            return { error: "touchedByUserId=me requires board authentication" };
          }
          if (inboxArchivedByUserFilterRaw === "me" && (!inboxArchivedByUserId || actor.type !== "board")) {
            ctx.set.status = 403;
            return { error: "inboxArchivedByUserId=me requires board authentication" };
          }
          if (unreadForUserFilterRaw === "me" && (!unreadForUserId || actor.type !== "board")) {
            ctx.set.status = 403;
            return { error: "unreadForUserId=me requires board authentication" };
          }

          const result = await svc.list(companyId, {
            status: ctx.query?.status as string | undefined,
            assigneeAgentId: ctx.query?.assigneeAgentId as string | undefined,
            participantAgentId: ctx.query?.participantAgentId as string | undefined,
            assigneeUserId,
            touchedByUserId,
            inboxArchivedByUserId,
            unreadForUserId,
            projectId: ctx.query?.projectId as string | undefined,
            parentId: ctx.query?.parentId as string | undefined,
            labelId: ctx.query?.labelId as string | undefined,
            originKind: ctx.query?.originKind as string | undefined,
            originId: ctx.query?.originId as string | undefined,
            includeRoutineExecutions:
              ctx.query?.includeRoutineExecutions === "true" || ctx.query?.includeRoutineExecutions === "1",
            q: ctx.query?.q as string | undefined,
          });
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list company issues");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    /* ------------------------------------------------------------------ */
    /* POST /companies/:companyId/issues                                  */
    /* ------------------------------------------------------------------ */
    .post(
      "/companies/:companyId/issues",
      async (ctx: any) => {
        try {
          const companyId = ctx.params.companyId;
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, companyId);

          const accessSvc = accessService(db);
          const agentsSvc = agentService(db);

          if (ctx.body.assigneeAgentId || ctx.body.assigneeUserId) {
            // Inline assertCanAssignTasks logic
            if (actor.type === "board") {
              if (actor.source !== "local_implicit" && !actor.isInstanceAdmin) {
                const allowed = await accessSvc.canUser(companyId, actor.userId!, "tasks:assign");
                if (!allowed) throw forbidden("Missing permission: tasks:assign");
              }
            } else if (actor.type === "agent") {
              if (!actor.agentId) throw forbidden("Agent authentication required");
              const allowedByGrant = await accessSvc.hasPermission(companyId, "agent", actor.agentId, "tasks:assign");
              if (!allowedByGrant) {
                const actorAgent = await agentsSvc.getById(actor.agentId);
                const canCreate = actorAgent && actorAgent.companyId === companyId &&
                  (isLevelCAgentRole(actorAgent.role) || Boolean(actorAgent.permissions?.canCreateAgents));
                if (!canCreate) throw forbidden("Missing permission: tasks:assign");
              }
            } else {
              throw unauthorized();
            }
          }

          const actorInfo = getActorInfo(actor);
          const {
            sddSpec,
            sddDesign,
            sddRisk,
            sddRollout,
            sddRollback,
            sddValidation,
            description,
            ...issueData
          } = ctx.body;
          const normalizedSpec = typeof sddSpec === "string" ? sddSpec.trim() : "";
          const normalizedDesign = typeof sddDesign === "string" ? sddDesign.trim() : "";
          const normalizedRisk = typeof sddRisk === "string" ? sddRisk.trim() : "";
          const normalizedRollout = typeof sddRollout === "string" ? sddRollout.trim() : "";
          const normalizedRollback = typeof sddRollback === "string" ? sddRollback.trim() : "";
          const normalizedValidation = typeof sddValidation === "string" ? sddValidation.trim() : "";
          // Only validate SDD when at least one section is provided
          const hasSddContent = [normalizedSpec, normalizedDesign, normalizedRisk, normalizedRollout, normalizedRollback, normalizedValidation].some(Boolean);
          if (hasSddContent) {
            const sddIssues = validateStructuredSddInput({
              spec: normalizedSpec,
              design: normalizedDesign,
              risk: normalizedRisk,
              rollout: normalizedRollout,
              rollback: normalizedRollback,
              validation: normalizedValidation,
            });
            if (sddIssues.length > 0) {
              log.warn({ category: "http", sddIssues }, "SDD validation warning for issue creation");
            }
          }

          const issue = await svc.create(companyId, {
            ...issueData,
            description: composeStructuredSddDescription({
              subjectLabel: `Issue: ${typeof issueData.title === "string" ? issueData.title : "Untitled issue"}`,
              summary: typeof description === "string" ? description : description == null ? null : String(description),
              spec: normalizedSpec,
              design: normalizedDesign,
              risk: normalizedRisk,
              rollout: normalizedRollout,
              rollback: normalizedRollback,
              validation: normalizedValidation,
            }),
            createdByAgentId: actorInfo.agentId,
            createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
          });

          await logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.created",
            entityType: "issue",
            entityId: issue.id,
            details: { title: issue.title, identifier: issue.identifier },
          });

          void queueIssueAssignmentWakeup({
            heartbeat,
            issue,
            reason: "issue_assigned",
            mutation: "create",
            contextSource: "issue.create",
            requestedByActorType: actorInfo.actorType,
            requestedByActorId: actorInfo.actorId,
          });

          ctx.set.status = 201;
          return issue;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create issue in company");
          throw err;
        }
      },
      {
        params: companyIdParam,
        body: t.Object({
          title: t.String(),
          description: t.Optional(t.Nullable(t.String())),
          sddSpec: t.Optional(t.Nullable(t.String())),
          sddDesign: t.Optional(t.Nullable(t.String())),
          sddRisk: t.Optional(t.Nullable(t.String())),
          sddRollout: t.Optional(t.Nullable(t.String())),
          sddRollback: t.Optional(t.Nullable(t.String())),
          sddValidation: t.Optional(t.Nullable(t.String())),
          status: t.Optional(t.String()),
          priority: t.Optional(t.String()),
          assigneeAgentId: t.Optional(t.Nullable(t.String())),
          assigneeUserId: t.Optional(t.Nullable(t.String())),
          projectId: t.Optional(t.Nullable(t.String())),
          goalId: t.Optional(t.Nullable(t.String())),
          parentId: t.Optional(t.Nullable(t.String())),
          labelIds: t.Optional(t.Array(t.String())),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* GET /companies/:companyId/labels                                   */
    /* ------------------------------------------------------------------ */
    .get(
      "/companies/:companyId/labels",
      async (ctx: any) => {
        try {
          const companyId = ctx.params.companyId;
          assertCompanyAccess(ctx.actor, companyId);
          return await svc.listLabels(companyId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list company labels");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    /* ------------------------------------------------------------------ */
    /* POST /companies/:companyId/labels                                  */
    /* ------------------------------------------------------------------ */
    .post(
      "/companies/:companyId/labels",
      async (ctx: any) => {
        try {
          const companyId = ctx.params.companyId;
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, companyId);
          const label = await svc.createLabel(companyId, ctx.body);
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "label.created",
            entityType: "label",
            entityId: label.id,
            details: { name: label.name, color: label.color },
          });
          ctx.set.status = 201;
          return label;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create label");
          throw err;
        }
      },
      {
        params: companyIdParam,
        body: t.Object({
          name: t.String(),
          color: t.Optional(t.Nullable(t.String())),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /labels/:labelId                                            */
    /* ------------------------------------------------------------------ */
    .delete(
      "/labels/:labelId",
      async (ctx: any) => {
        try {
          const labelId = ctx.params.labelId;
          const existing = await svc.getLabelById(labelId);
          if (!existing) { ctx.set.status = 404; return { error: "Label not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, existing.companyId);
          const removed = await svc.deleteLabel(labelId);
          if (!removed) { ctx.set.status = 404; return { error: "Label not found" }; }
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: removed.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "label.deleted",
            entityType: "label",
            entityId: removed.id,
            details: { name: removed.name, color: removed.color },
          });
          return removed;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete label");
          throw err;
        }
      },
      { params: t.Object({ labelId: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* PATCH /work-products/:id                                           */
    /* ------------------------------------------------------------------ */
    .patch(
      "/work-products/:id",
      async (ctx: any) => {
        try {
          const wpId = ctx.params.id;
          const wpSvc = workProductService(db);
          const existing = await wpSvc.getById(wpId);
          if (!existing) { ctx.set.status = 404; return { error: "Work product not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, existing.companyId);
          const product = await wpSvc.update(wpId, ctx.body);
          if (!product) { ctx.set.status = 404; return { error: "Work product not found" }; }
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: existing.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.work_product_updated",
            entityType: "issue",
            entityId: existing.issueId,
            details: { workProductId: product.id, changedKeys: Object.keys(ctx.body).sort() },
          });
          return product;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update work product");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          type: t.Optional(t.String()),
          provider: t.Optional(t.String()),
          externalId: t.Optional(t.Nullable(t.String())),
          externalUrl: t.Optional(t.Nullable(t.String())),
          title: t.Optional(t.Nullable(t.String())),
          description: t.Optional(t.Nullable(t.String())),
          projectId: t.Optional(t.Nullable(t.String())),
          isPrimary: t.Optional(t.Boolean()),
          metadata: t.Optional(t.Any()),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /work-products/:id                                          */
    /* ------------------------------------------------------------------ */
    .delete(
      "/work-products/:id",
      async (ctx: any) => {
        try {
          const wpId = ctx.params.id;
          const wpSvc = workProductService(db);
          const existing = await wpSvc.getById(wpId);
          if (!existing) { ctx.set.status = 404; return { error: "Work product not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, existing.companyId);
          const removed = await wpSvc.remove(wpId);
          if (!removed) { ctx.set.status = 404; return { error: "Work product not found" }; }
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: existing.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.work_product_deleted",
            entityType: "issue",
            entityId: existing.issueId,
            details: { workProductId: removed.id, type: removed.type },
          });
          return removed;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete work product");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* POST /companies/:companyId/issues/:issueId/attachments             */
    /* ------------------------------------------------------------------ */
    .post(
      "/companies/:companyId/issues/:issueId/attachments",
      async (ctx: any) => {
        try {
          const companyId = ctx.params.companyId;
          const issueId = ctx.params.issueId;
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, companyId);
          const issueSvc = issueService(db);
          const issue = await issueSvc.getById(issueId);
          if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
          if (issue.companyId !== companyId) { ctx.set.status = 422; return { error: "Issue does not belong to company" }; }

          // Elysia file upload handling - body contains the parsed multipart form
          const file = ctx.body?.file;
          if (!file) { ctx.set.status = 400; return { error: "Missing file field 'file'" }; }

          const contentType = (file.type || "").toLowerCase();
          if (!isAllowedContentType(contentType)) {
            ctx.set.status = 422;
            return { error: `Unsupported attachment type: ${contentType || "unknown"}` };
          }

          const buffer = Buffer.from(await file.arrayBuffer());
          if (buffer.length <= 0) { ctx.set.status = 422; return { error: "Attachment is empty" }; }
          if (buffer.length > MAX_ATTACHMENT_BYTES) {
            ctx.set.status = 422;
            return { error: `Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes` };
          }

          const { getStorageService } = await import("../storage/index.js");
          const storage = getStorageService();

          const actorInfo = getActorInfo(actor);
          const stored = await storage.putFile({
            companyId,
            namespace: `issues/${issueId}`,
            originalFilename: file.name || null,
            contentType,
            body: buffer,
          });

          const issueCommentId = ctx.body?.issueCommentId ?? null;
          const attachment = await issueSvc.createAttachment({
            issueId,
            issueCommentId,
            provider: stored.provider,
            objectKey: stored.objectKey,
            contentType: stored.contentType,
            byteSize: stored.byteSize,
            sha256: stored.sha256,
            originalFilename: stored.originalFilename,
            createdByAgentId: actorInfo.agentId,
            createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null,
          });

          await logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.attachment_added",
            entityType: "issue",
            entityId: issueId,
            details: {
              attachmentId: attachment.id,
              originalFilename: attachment.originalFilename,
              contentType: attachment.contentType,
              byteSize: attachment.byteSize,
            },
          });

          ctx.set.status = 201;
          return {
            ...attachment,
            contentPath: `/api/attachments/${attachment.id}/content`,
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create attachment");
          throw err;
        }
      },
      {
        params: t.Object({ companyId: t.String(), issueId: t.String() }),
        body: t.Object({
          file: t.File(),
          issueCommentId: t.Optional(t.Nullable(t.String())),
        }),
      },
    )

    /* ------------------------------------------------------------------ */
    /* GET /attachments/:attachmentId/content                             */
    /* ------------------------------------------------------------------ */
    .get(
      "/attachments/:attachmentId/content",
      async (ctx: any) => {
        try {
          const attachmentId = ctx.params.attachmentId;
          const issueSvc = issueService(db);
          const attachment = await issueSvc.getAttachmentById(attachmentId);
          if (!attachment) { ctx.set.status = 404; return { error: "Attachment not found" }; }
          assertCompanyAccess(ctx.actor, attachment.companyId);

          const { getStorageService } = await import("../storage/index.js");
          const storage = getStorageService();
          const object = await storage.getObject(attachment.companyId, attachment.objectKey);

          ctx.set.headers["content-type"] = attachment.contentType || object.contentType || "application/octet-stream";
          ctx.set.headers["content-length"] = String(attachment.byteSize || object.contentLength || 0);
          ctx.set.headers["cache-control"] = "private, max-age=60";
          const filename = attachment.originalFilename ?? "attachment";
          ctx.set.headers["content-disposition"] = `inline; filename="${filename.replaceAll("\"", "")}"`;

          return object.stream;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get attachment content");
          throw err;
        }
      },
      { params: t.Object({ attachmentId: t.String() }) },
    )

    /* ------------------------------------------------------------------ */
    /* DELETE /attachments/:attachmentId                                  */
    /* ------------------------------------------------------------------ */
    .delete(
      "/attachments/:attachmentId",
      async (ctx: any) => {
        try {
          const attachmentId = ctx.params.attachmentId;
          const issueSvc = issueService(db);
          const attachment = await issueSvc.getAttachmentById(attachmentId);
          if (!attachment) { ctx.set.status = 404; return { error: "Attachment not found" }; }
          const actor: Actor = ctx.actor;
          assertCompanyAccess(actor, attachment.companyId);

          try {
            const { getStorageService } = await import("../storage/index.js");
            const storage = getStorageService();
            await storage.deleteObject(attachment.companyId, attachment.objectKey);
          } catch (err) {
            logger.warn({ err, attachmentId }, "storage delete failed while removing attachment");
          }

          const removed = await issueSvc.removeAttachment(attachmentId);
          if (!removed) { ctx.set.status = 404; return { error: "Attachment not found" }; }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: removed.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "issue.attachment_removed",
            entityType: "issue",
            entityId: removed.issueId,
            details: {
              attachmentId: removed.id,
            },
          });

          return { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete attachment");
          throw err;
        }
      },
      { params: t.Object({ attachmentId: t.String() }) },
    );
}
