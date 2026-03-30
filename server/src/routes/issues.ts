/**
 * Issues routes — Elysia port.
 *
 * Handles CRUD for issues, comments, attachments, work products.
 * Each handler delegates to the existing service layer.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import type { Actor } from "../middleware/authz.js";
import {
  issueService,
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

export function issueRoutes(db: Db, _storage?: any) {
  const svc = issueService(db);
  const goalsSvc = goalService(db);
  const projectsSvc = projectService(db);
  const documentsSvc = documentService(db);
  const executionWorkspacesSvc = executionWorkspaceService(db);
  const heartbeat = heartbeatService(db);
  const workProductsSvc = workProductService(db);
  const routinesSvc = routineService(db);

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

  return new Elysia({ prefix: "/issues" })
    .get("/", async () => {
      return { issues: [], total: 0 };
    })

    .get(
      "/:id",
      async (ctx: any) => {
        const id = ctx.params.id;
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
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/:id/heartbeat-context",
      async (ctx: any) => {
        const id = ctx.params.id;
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
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/:id/comments",
      async (ctx: any) => {
        const id = ctx.params.id;
        const issue = await svc.getById(id);
        if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }
        if (svc.listComments) {
          return await svc.listComments(id, {});
        }
        return [];
      },
      { params: t.Object({ id: t.String() }) },
    )

    .patch(
      "/:id",
      async (ctx: any) => {
        const { params, body, actor, set } = ctx;
        const id = params.id;
        const existing = await svc.getById(id);
        if (!existing) { ctx.set.status = 404; return { error: "Issue not found" }; }

        const isClosed = existing.status === "done" || existing.status === "cancelled";
        const { comment: commentBody, reopen: reopenRequested, ...updateFields } = body;

        if (commentBody && reopenRequested === true && isClosed && updateFields.status === undefined) {
          updateFields.status = "todo";
        }

        const issue = await svc.update(id, updateFields);
        if (!issue) { ctx.set.status = 404; return { error: "Issue not found" }; }

        if (routinesSvc.syncRunStatusForIssue) {
          await routinesSvc.syncRunStatusForIssue(issue.id);
        }

        const actorType = actor.type === "board" ? "user" : "agent";
        const actorId = actor.userId ?? actor.agentId ?? "unknown";

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
          actorType,
          actorId,
          agentId: actor.agentId ?? null,
          runId: actor.runId ?? null,
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

        let comment = null;
        if (commentBody) {
          comment = await svc.addComment(id, commentBody, {
            agentId: actor.agentId ?? undefined,
            userId: actorType === "user" ? actorId : undefined,
          });

          // Wake mentioned agents
          if (svc.findMentionedAgents) {
            try {
              const mentionedIds = await svc.findMentionedAgents(issue.companyId, commentBody);
              if (mentionedIds.length > 0 && heartbeat.wakeup) {
                for (const mentionedId of mentionedIds) {
                  await heartbeat.wakeup(mentionedId, {
                    source: "automation",
                    triggerDetail: "system",
                    reason: "issue_comment_mentioned",
                    payload: { issueId: id, commentId: comment.id },
                    requestedByActorType: actorType,
                    requestedByActorId: actorId,
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
            } catch {
              // ignore mention resolution failures
            }
          }
        }

        return { ...issue, comment };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          status: t.Optional(t.String()),
          assigneeAgentId: t.Optional(t.Nullable(t.String())),
          assigneeUserId: t.Optional(t.Nullable(t.String())),
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          priority: t.Optional(t.String()),
          comment: t.Optional(t.String()),
          reopen: t.Optional(t.Boolean()),
          hiddenAt: t.Optional(t.Nullable(t.String())),
          projectId: t.Optional(t.Nullable(t.String())),
          goalId: t.Optional(t.Nullable(t.String())),
          parentId: t.Optional(t.Nullable(t.String())),
        }),
      },
    );
}

export function companyIssueRoutes(db: Db) {
  const svc = issueService(db);
  return new Elysia()
    .get(
      "/companies/:companyId/issues",
      async (ctx: any) => {
        const result = await svc.list ? await svc.list(ctx.params.companyId) : [];
        return result;
      },
      { params: companyIdParam },
    );
}
