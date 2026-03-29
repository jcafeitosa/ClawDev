/**
 * Approvals routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { approvalService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function approvalRoutes(db: Db) {
  const svc = approvalService(db);

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
      async ({ params }) => {
        const approval = await svc.getById(params.id);
        if (!approval) return new Response("Not found", { status: 404 });
        return approval;
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/approvals/:id/approve",
      async ({ params }) => {
        await svc.approve(params.id, "system", null);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/approvals/:id/reject",
      async ({ params, body }) => {
        await svc.reject(params.id, "system", body?.reason);
        return { success: true };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
      },
    );
}
