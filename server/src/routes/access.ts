/**
 * Access & auth routes — Elysia port.
 *
 * Handles board claims, CLI authentication, invites, join requests,
 * member management, and skills access control.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { accessService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function accessRoutes(db: Db) {
  const svc = accessService(db);

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
    );
}
