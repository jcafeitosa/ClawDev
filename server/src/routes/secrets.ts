import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  SECRET_PROVIDERS,
  type SecretProvider,
  createSecretSchema,
  rotateSecretSchema,
  updateSecretSchema,
} from "@clawdev/shared";
import { notFound } from "../errors.js";
import { assertBoard, assertCompanyAccess } from "./authz.js";
import { logActivity, secretService } from "../services/index.js";
import { authPlugin } from "../plugins/auth.js";

export function secretRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>) {
  const svc = secretService(db);
  const configuredDefaultProvider = process.env.CLAWDEV_SECRETS_PROVIDER;
  const defaultProvider = (
    configuredDefaultProvider && SECRET_PROVIDERS.includes(configuredDefaultProvider as SecretProvider)
      ? configuredDefaultProvider
      : "local_encrypted"
  ) as SecretProvider;

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/secret-providers", ({ params, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      return svc.listProviders();
    })
    .get("/companies/:companyId/secrets", async ({ params, actor }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      return svc.list(params.companyId);
    })
    .post("/companies/:companyId/secrets", async ({ params, body, actor, set }) => {
      assertBoard(actor);
      assertCompanyAccess(actor, params.companyId);
      const parsed = createSecretSchema.parse(body);
      const created = await svc.create(
        params.companyId,
        {
          name: parsed.name,
          provider: parsed.provider ?? defaultProvider,
          value: parsed.value,
          description: parsed.description,
          externalRef: parsed.externalRef,
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
    })
    .post("/secrets/:id/rotate", async ({ params, body, actor }) => {
      assertBoard(actor);
      const parsed = rotateSecretSchema.parse(body);
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Secret not found");
      assertCompanyAccess(actor, existing.companyId);
      const rotated = await svc.rotate(
        params.id,
        { value: parsed.value, externalRef: parsed.externalRef },
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
    })
    .patch("/secrets/:id", async ({ params, body, actor }) => {
      assertBoard(actor);
      const parsed = updateSecretSchema.parse(body);
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Secret not found");
      assertCompanyAccess(actor, existing.companyId);
      const updated = await svc.update(params.id, {
        name: parsed.name,
        description: parsed.description,
        externalRef: parsed.externalRef,
      });
      if (!updated) throw notFound("Secret not found");
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
    })
    .delete("/secrets/:id", async ({ params, actor }) => {
      assertBoard(actor);
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Secret not found");
      assertCompanyAccess(actor, existing.companyId);
      const removed = await svc.remove(params.id);
      if (!removed) throw notFound("Secret not found");
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
    });
}
