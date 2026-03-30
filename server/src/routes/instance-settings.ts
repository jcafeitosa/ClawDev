/**
 * Instance settings routes — Elysia port.
 *
 * Provides GET and PATCH endpoints for general and experimental instance settings.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { instanceSettingsService, logActivity } from "../services/index.js";
import { assertInstanceAdmin, type Actor } from "../middleware/authz.js";

/** Throws 403 if the actor is not a board user with instance admin access. */
function assertCanManageInstanceSettings(actor: Actor) {
  assertInstanceAdmin(actor);
}

export function instanceSettingsRoutes(db: Db) {
  const svc = instanceSettingsService(db);

  return new Elysia({ prefix: "/instance/settings" })
    // General settings
    .get("/general", async (ctx: any) => {
      assertCanManageInstanceSettings(ctx.actor);
      return await svc.getGeneral();
    })

    .patch(
      "/general",
      async (ctx: any) => {
        assertCanManageInstanceSettings(ctx.actor);
        const updated = await svc.updateGeneral(ctx.body);
        const companyIds = await svc.listCompanyIds();
        await Promise.all(
          companyIds.map((companyId: string) =>
            logActivity(db, {
              companyId,
              actorType: ctx.actor.type === "board" ? "user" : "agent",
              actorId: ctx.actor.userId ?? ctx.actor.agentId ?? "unknown",
              agentId: ctx.actor.agentId ?? null,
              runId: ctx.actor.runId ?? null,
              action: "instance.settings.general_updated",
              entityType: "instance_settings",
              entityId: updated.id,
              details: {
                general: updated.general,
                changedKeys: Object.keys(ctx.body).sort(),
              },
            }),
          ),
        );
        return updated.general;
      },
      {
        body: t.Object({
          censorUsernameInLogs: t.Optional(t.Boolean()),
        }),
      },
    )

    // Experimental settings
    .get("/experimental", async (ctx: any) => {
      assertCanManageInstanceSettings(ctx.actor);
      return await svc.getExperimental();
    })

    .patch(
      "/experimental",
      async (ctx: any) => {
        assertCanManageInstanceSettings(ctx.actor);
        const updated = await svc.updateExperimental(ctx.body);
        const companyIds = await svc.listCompanyIds();
        await Promise.all(
          companyIds.map((companyId: string) =>
            logActivity(db, {
              companyId,
              actorType: ctx.actor.type === "board" ? "user" : "agent",
              actorId: ctx.actor.userId ?? ctx.actor.agentId ?? "unknown",
              agentId: ctx.actor.agentId ?? null,
              runId: ctx.actor.runId ?? null,
              action: "instance.settings.experimental_updated",
              entityType: "instance_settings",
              entityId: updated.id,
              details: {
                experimental: updated.experimental,
                changedKeys: Object.keys(ctx.body).sort(),
              },
            }),
          ),
        );
        return updated.experimental;
      },
      {
        body: t.Object({
          enableIsolatedWorkspaces: t.Optional(t.Boolean()),
          autoRestartDevServerWhenIdle: t.Optional(t.Boolean()),
        }),
      },
    );
}
