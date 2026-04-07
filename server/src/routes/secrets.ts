/**
 * Secrets routes — Elysia port.
 *
 * Handles secret provider listing, CRUD for company secrets,
 * rotation, metadata updates, and deletion with activity logging.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { SECRET_PROVIDERS, type SecretProvider } from "@clawdev/shared";
import { companyIdParam } from "../middleware/index.js";
import { assertBoard, assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { secretService } from "../services/secrets.js";
import { logActivity } from "../services/activity-log.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "secrets-routes" });

export function secretRoutes(db: Db) {
  const svc = secretService(db);

  const configuredDefaultProvider = process.env.CLAWDEV_SECRETS_PROVIDER;
  const defaultProvider = (
    configuredDefaultProvider && SECRET_PROVIDERS.includes(configuredDefaultProvider as SecretProvider)
      ? configuredDefaultProvider
      : "local_encrypted"
  ) as SecretProvider;

  return new Elysia()
    // List available secret providers
    .get(
      "/companies/:companyId/secret-providers",
      async ({ params, ...ctx }: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          assertCompanyAccess(actor, params.companyId);
          return svc.listProviders();
        } catch (error) {
          log.error({ error, params }, "Failed to list secret providers");
          throw error;
        }
      },
      { params: companyIdParam },
    )

    // List secrets for a company
    .get(
      "/companies/:companyId/secrets",
      async ({ params, ...ctx }: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          assertCompanyAccess(actor, params.companyId);
          const secrets = await svc.list(params.companyId);
          return secrets;
        } catch (error) {
          log.error({ error, companyId: params.companyId }, "Failed to list secrets");
          throw error;
        }
      },
      { params: companyIdParam },
    )

    // Create a secret
    .post(
      "/companies/:companyId/secrets",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          assertCompanyAccess(actor, params.companyId);

          const created = await svc.create(
            params.companyId,
            {
              name: body.name,
              provider: body.provider ?? defaultProvider,
              value: body.value,
              description: body.description,
              externalRef: body.externalRef,
            },
            { userId: actor.userId ?? "board", agentId: null },
          );

          await logActivity(db, {
            companyId: params.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "secret.created",
            entityType: "secret",
            entityId: created.id,
            details: { name: created.name, provider: created.provider },
          });

          set.status = 201;
          return created;
        } catch (error) {
          log.error({ error, companyId: ctx.params.companyId, secretName: ctx.body?.name }, "Failed to create secret");
          throw error;
        }
      },
      {
        params: companyIdParam,
        body: t.Object({
          name: t.String(),
          provider: t.Optional(t.String()),
          value: t.String(),
          description: t.Optional(t.String()),
          externalRef: t.Optional(t.String()),
        }),
      },
    )

    // Rotate a secret
    .post(
      "/secrets/:id/rotate",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertBoard(actor);

          const existing = await svc.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Secret not found" };
          }

          assertCompanyAccess(actor, existing.companyId);

          const rotated = await svc.rotate(
            params.id,
            {
              value: body.value,
              externalRef: body.externalRef,
            },
            { userId: actor.userId ?? "board", agentId: null },
          );

          await logActivity(db, {
            companyId: rotated.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "secret.rotated",
            entityType: "secret",
            entityId: rotated.id,
            details: { version: rotated.latestVersion },
          });

          return rotated;
        } catch (error) {
          log.error({ error, secretId: ctx.params.id }, "Failed to rotate secret");
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          value: t.String(),
          externalRef: t.Optional(t.String()),
        }),
      },
    )

    // Update secret metadata
    .patch(
      "/secrets/:id",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertBoard(actor);

          const existing = await svc.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Secret not found" };
          }

          assertCompanyAccess(actor, existing.companyId);

          const updated = await svc.update(params.id, {
            name: body.name,
            description: body.description,
            externalRef: body.externalRef,
          });

          if (!updated) {
            set.status = 404;
            return { error: "Secret not found" };
          }

          await logActivity(db, {
            companyId: updated.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "secret.updated",
            entityType: "secret",
            entityId: updated.id,
            details: { name: updated.name },
          });

          return updated;
        } catch (error) {
          log.error({ error, secretId: ctx.params.id }, "Failed to update secret");
          throw error;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          externalRef: t.Optional(t.String()),
        }),
      },
    )

    // Delete a secret
    .delete(
      "/secrets/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          assertBoard(actor);

          const existing = await svc.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Secret not found" };
          }

          assertCompanyAccess(actor, existing.companyId);

          const removed = await svc.remove(params.id);
          if (!removed) {
            set.status = 404;
            return { error: "Secret not found" };
          }

          await logActivity(db, {
            companyId: removed.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "secret.deleted",
            entityType: "secret",
            entityId: removed.id,
            details: { name: removed.name },
          });

          return { ok: true };
        } catch (error) {
          log.error({ error, secretId: ctx.params.id }, "Failed to delete secret");
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}
