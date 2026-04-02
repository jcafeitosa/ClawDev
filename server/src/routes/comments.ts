/**
 * Comment routes — Elysia port.
 *
 * Currently exposes the root-level comment deletion endpoint used by the UI.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { issueService, logActivity } from "../services/index.js";
import { assertCompanyAccess, type Actor, getActorInfo } from "../middleware/authz.js";

export function commentRoutes(db: Db) {
  const svc = issueService(db);

  return new Elysia()
    .delete(
      "/comments/:commentId",
      async (ctx: any) => {
        const actor: Actor = ctx.actor;
        const comment = await svc.getComment(ctx.params.commentId);
        if (!comment) {
          ctx.set.status = 404;
          return { error: "Comment not found" };
        }
        assertCompanyAccess(actor, comment.companyId);
        if (actor.type !== "board") {
          ctx.set.status = 403;
          return { error: "Board authentication required" };
        }

        const removed = await svc.removeComment(ctx.params.commentId);
        if (!removed) {
          ctx.set.status = 404;
          return { error: "Comment not found" };
        }

        const issue = await svc.getById(removed.issueId);
        if (!issue) {
          ctx.set.status = 404;
          return { error: "Issue not found" };
        }

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

        return removed;
      },
      { params: t.Object({ commentId: t.String() }) },
    );
}
