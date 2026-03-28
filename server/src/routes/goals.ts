import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { createGoalSchema, updateGoalSchema } from "@clawdev/shared";
import { notFound } from "../errors.js";
import { goalService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { elysiaAuth } from "../plugins/auth.js";

export function elysiaGoalRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = goalService(db);

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/goals", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return svc.list(params.companyId);
    })
    .get("/goals/:id", async ({ params, actor }) => {
      const goal = await svc.getById(params.id);
      if (!goal) throw notFound("Goal not found");
      assertCompanyAccess(actor, goal.companyId);
      return goal;
    })
    .post("/companies/:companyId/goals", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = createGoalSchema.parse(body);
      const goal = await svc.create(params.companyId, parsed);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "goal.created",
        entityType: "goal",
        entityId: goal.id,
        details: { title: goal.title },
      });
      set.status = 201;
      return goal;
    })
    .patch("/goals/:id", async ({ params, body, actor }) => {
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Goal not found");
      assertCompanyAccess(actor, existing.companyId);
      const parsed = updateGoalSchema.parse(body);
      const goal = await svc.update(params.id, parsed);
      if (!goal) throw notFound("Goal not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: goal.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "goal.updated",
        entityType: "goal",
        entityId: goal.id,
        details: parsed,
      });
      return goal;
    })
    .delete("/goals/:id", async ({ params, actor }) => {
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Goal not found");
      assertCompanyAccess(actor, existing.companyId);
      const goal = await svc.remove(params.id);
      if (!goal) throw notFound("Goal not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: goal.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "goal.deleted",
        entityType: "goal",
        entityId: goal.id,
      });
      return goal;
    });
}
