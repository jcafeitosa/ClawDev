import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { patchInstanceExperimentalSettingsSchema, patchInstanceGeneralSettingsSchema } from "@clawdev/shared";
import { forbidden } from "../errors.js";
import { instanceSettingsService, logActivity } from "../services/index.js";
import { getActorInfo } from "./authz.js";
import { elysiaAuth, type Actor } from "../elysia-plugins/auth.js";

function assertCanManageInstanceSettings(actor: Actor) {
  if (actor.type !== "board") throw forbidden("Board access required");
  if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
  throw forbidden("Instance admin access required");
}

export function elysiaInstanceSettingsRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = instanceSettingsService(db);

  return new Elysia()
    .use(authPlugin)
    .get("/instance/settings/general", async ({ actor }) => {
      assertCanManageInstanceSettings(actor);
      return svc.getGeneral();
    })
    .patch("/instance/settings/general", async ({ body, actor }) => {
      assertCanManageInstanceSettings(actor);
      const parsed = patchInstanceGeneralSettingsSchema.parse(body);
      const updated = await svc.updateGeneral(parsed);
      const actorInfo = getActorInfo(actor);
      const companyIds = await svc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "instance.settings.general_updated",
            entityType: "instance_settings",
            entityId: updated.id,
            details: { general: updated.general, changedKeys: Object.keys(parsed).sort() },
          }),
        ),
      );
      return updated.general;
    })
    .get("/instance/settings/experimental", async ({ actor }) => {
      assertCanManageInstanceSettings(actor);
      return svc.getExperimental();
    })
    .patch("/instance/settings/experimental", async ({ body, actor }) => {
      assertCanManageInstanceSettings(actor);
      const parsed = patchInstanceExperimentalSettingsSchema.parse(body);
      const updated = await svc.updateExperimental(parsed);
      const actorInfo = getActorInfo(actor);
      const companyIds = await svc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            runId: actorInfo.runId,
            action: "instance.settings.experimental_updated",
            entityType: "instance_settings",
            entityId: updated.id,
            details: { experimental: updated.experimental, changedKeys: Object.keys(parsed).sort() },
          }),
        ),
      );
      return updated.experimental;
    });
}
