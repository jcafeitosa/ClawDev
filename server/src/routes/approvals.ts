/**
 * Approvals routes — Elysia port.
 *
 * Full approval lifecycle with idempotent approve/reject.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  approvalService,
  heartbeatService,
  issueApprovalService,
  logActivity,
  secretService,
} from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import type { Actor } from "../middleware/authz.js";

export function approvalRoutes(db: Db) {
  const svc = approvalService(db);
  const heartbeats = heartbeatService(db);
  const issueApprovals = issueApprovalService(db);
  const secrets = secretService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/approvals",
      async ({ params, query }) => {
        const status = query.status as string | undefined;
        const approvals = await svc.list(params.companyId, status);
        return approvals;
      },
      { params: companyIdParam },
    )

    .get(
      "/approvals/:id",
      async ({ params, set }) => {
        const approval = await svc.getById(params.id);
        if (!approval) {
          set.status = 404;
          return { error: "Not found" };
        }
        return approval;
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/approvals/:id/approve",
      async ({ params, body, set, ...ctx }) => {
        const actor = (ctx as any).actor as Actor | undefined;
        const userId = actor?.userId ?? "system";
        const note = body?.note ?? body?.decisionNote ?? null;

        const result = await svc.approve(params.id, userId, note);

        if (result.applied) {
          const approval = result.approval;

          // Link issues if present
          const linkedIssues = await issueApprovals.listIssuesForApproval(approval.id);

          // Wake up requesting agent
          if ((approval as any).requestedByAgentId) {
            await heartbeats.wakeup(
              (approval as any).requestedByAgentId,
              { source: "on_demand" as const },
            );
          }

          // Log activity
          await logActivity(db, {
            companyId: approval.companyId,
            entityType: "approval",
            entityId: approval.id,
            action: "approved",
            actorType: actor?.type === "agent" ? "agent" : "user",
            actorId: userId,
          });
        }

        return result.approval;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(
          t.Object({
            note: t.Optional(t.String()),
            decisionNote: t.Optional(t.String()),
          }),
        ),
      },
    )

    .post(
      "/approvals/:id/reject",
      async ({ params, body, set, ...ctx }) => {
        const actor = (ctx as any).actor as Actor | undefined;
        const userId = actor?.userId ?? "system";
        const reason = body?.reason ?? body?.decisionNote ?? null;

        const result = await svc.reject(params.id, userId, reason);

        if (result.applied) {
          const approval = result.approval;

          await logActivity(db, {
            companyId: approval.companyId,
            entityType: "approval",
            entityId: approval.id,
            action: "rejected",
            actorType: actor?.type === "agent" ? "agent" : "user",
            actorId: userId,
          });
        }

        return result.approval;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(t.Object({ reason: t.Optional(t.String()), decisionNote: t.Optional(t.String()) })),
      },
    );
}
