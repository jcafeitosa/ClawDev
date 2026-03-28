import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  createRoutineSchema,
  createRoutineTriggerSchema,
  rotateRoutineTriggerSecretSchema,
  runRoutineSchema,
  updateRoutineSchema,
  updateRoutineTriggerSchema,
} from "@clawdev/shared";
import { forbidden, notFound, unauthorized } from "../errors.js";
import { accessService, logActivity, routineService } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { elysiaAuth, type Actor } from "../elysia-plugins/auth.js";

export function elysiaRoutineRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = routineService(db);
  const access = accessService(db);

  async function assertBoardCanAssignTasks(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type !== "board") return;
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
    const allowed = await access.canUser(companyId, actor.userId!, "tasks:assign");
    if (!allowed) throw forbidden("Missing permission: tasks:assign");
  }

  function assertCanManageCompanyRoutine(actor: Actor, companyId: string, assigneeAgentId?: string | null) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") return;
    if (actor.type !== "agent" || !actor.agentId) throw unauthorized();
    if (assigneeAgentId && assigneeAgentId !== actor.agentId) {
      throw forbidden("Agents can only manage routines assigned to themselves");
    }
  }

  async function assertCanManageExistingRoutine(actor: Actor, routineId: string) {
    const routine = await svc.get(routineId);
    if (!routine) return null;
    assertCompanyAccess(actor, routine.companyId);
    if (actor.type === "board") return routine;
    if (actor.type !== "agent" || !actor.agentId) throw unauthorized();
    if (routine.assigneeAgentId !== actor.agentId) {
      throw forbidden("Agents can only manage routines assigned to themselves");
    }
    return routine;
  }

  function getActorMeta(actor: Actor) {
    return {
      agentId: actor.type === "agent" ? actor.agentId ?? null : null,
      userId: actor.type === "board" ? actor.userId ?? "board" : null,
    };
  }

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/routines", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return svc.list(params.companyId);
    })
    .post("/companies/:companyId/routines", async ({ params, body, actor, set }) => {
      const parsed = createRoutineSchema.parse(body);
      await assertBoardCanAssignTasks(actor, params.companyId);
      assertCanManageCompanyRoutine(actor, params.companyId, parsed.assigneeAgentId);
      const created = await svc.create(params.companyId, parsed, getActorMeta(actor));
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.created",
        entityType: "routine",
        entityId: created.id,
        details: { title: created.title, assigneeAgentId: created.assigneeAgentId },
      });
      set.status = 201;
      return created;
    })
    .get("/routines/:id", async ({ params, actor }) => {
      const detail = await svc.getDetail(params.id);
      if (!detail) throw notFound("Routine not found");
      assertCompanyAccess(actor, detail.companyId);
      return detail;
    })
    .patch("/routines/:id", async ({ params, body, actor }) => {
      const parsed = updateRoutineSchema.parse(body);
      const routine = await assertCanManageExistingRoutine(actor, params.id);
      if (!routine) throw notFound("Routine not found");
      const assigneeWillChange = parsed.assigneeAgentId !== undefined && parsed.assigneeAgentId !== routine.assigneeAgentId;
      if (assigneeWillChange) await assertBoardCanAssignTasks(actor, routine.companyId);
      const statusWillActivate = parsed.status !== undefined && parsed.status === "active" && routine.status !== "active";
      if (statusWillActivate) await assertBoardCanAssignTasks(actor, routine.companyId);
      if (actor.type === "agent" && parsed.assigneeAgentId && parsed.assigneeAgentId !== actor.agentId) {
        throw forbidden("Agents can only assign routines to themselves");
      }
      const updated = await svc.update(routine.id, parsed, getActorMeta(actor));
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: routine.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.updated",
        entityType: "routine",
        entityId: routine.id,
        details: { title: updated?.title ?? routine.title },
      });
      return updated;
    })
    .get("/routines/:id/runs", async ({ params, query, actor }) => {
      const routine = await svc.get(params.id);
      if (!routine) throw notFound("Routine not found");
      assertCompanyAccess(actor, routine.companyId);
      const limit = Number((query as Record<string, string>).limit ?? 50);
      return svc.listRuns(routine.id, Number.isFinite(limit) ? limit : 50);
    })
    .post("/routines/:id/triggers", async ({ params, body, actor, set }) => {
      const parsed = createRoutineTriggerSchema.parse(body);
      const routine = await assertCanManageExistingRoutine(actor, params.id);
      if (!routine) throw notFound("Routine not found");
      await assertBoardCanAssignTasks(actor, routine.companyId);
      const created = await svc.createTrigger(routine.id, parsed, getActorMeta(actor));
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: routine.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.trigger_created",
        entityType: "routine_trigger",
        entityId: created.trigger.id,
        details: { routineId: routine.id, kind: created.trigger.kind },
      });
      set.status = 201;
      return created;
    })
    .patch("/routine-triggers/:id", async ({ params, body, actor }) => {
      const parsed = updateRoutineTriggerSchema.parse(body);
      const trigger = await svc.getTrigger(params.id);
      if (!trigger) throw notFound("Routine trigger not found");
      const routine = await assertCanManageExistingRoutine(actor, trigger.routineId);
      if (!routine) throw notFound("Routine not found");
      await assertBoardCanAssignTasks(actor, routine.companyId);
      const updated = await svc.updateTrigger(trigger.id, parsed, getActorMeta(actor));
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: routine.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.trigger_updated",
        entityType: "routine_trigger",
        entityId: trigger.id,
        details: { routineId: routine.id, kind: updated?.kind ?? trigger.kind },
      });
      return updated;
    })
    .delete("/routine-triggers/:id", async ({ params, actor, set }) => {
      const trigger = await svc.getTrigger(params.id);
      if (!trigger) throw notFound("Routine trigger not found");
      const routine = await assertCanManageExistingRoutine(actor, trigger.routineId);
      if (!routine) throw notFound("Routine not found");
      await svc.deleteTrigger(trigger.id);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: routine.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.trigger_deleted",
        entityType: "routine_trigger",
        entityId: trigger.id,
        details: { routineId: routine.id, kind: trigger.kind },
      });
      set.status = 204;
    })
    .post("/routine-triggers/:id/rotate-secret", async ({ params, body, actor }) => {
      rotateRoutineTriggerSecretSchema.parse(body);
      const trigger = await svc.getTrigger(params.id);
      if (!trigger) throw notFound("Routine trigger not found");
      const routine = await assertCanManageExistingRoutine(actor, trigger.routineId);
      if (!routine) throw notFound("Routine not found");
      const rotated = await svc.rotateTriggerSecret(trigger.id, getActorMeta(actor));
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: routine.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.trigger_secret_rotated",
        entityType: "routine_trigger",
        entityId: trigger.id,
        details: { routineId: routine.id },
      });
      return rotated;
    })
    .post("/routines/:id/run", async ({ params, body, actor, set }) => {
      const parsed = runRoutineSchema.parse(body);
      const routine = await assertCanManageExistingRoutine(actor, params.id);
      if (!routine) throw notFound("Routine not found");
      await assertBoardCanAssignTasks(actor, routine.companyId);
      const run = await svc.runRoutine(routine.id, parsed);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: routine.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "routine.run_triggered",
        entityType: "routine_run",
        entityId: run.id,
        details: { routineId: routine.id, source: run.source, status: run.status },
      });
      set.status = 202;
      return run;
    })
    .post("/routine-triggers/public/:publicId/fire", async ({ params, body, request, set }) => {
      const headers = request.headers;
      const result = await svc.firePublicTrigger(params.publicId, {
        authorizationHeader: headers.get("authorization") ?? undefined,
        signatureHeader: headers.get("x-clawdev-signature") ?? undefined,
        timestampHeader: headers.get("x-clawdev-timestamp") ?? undefined,
        idempotencyKey: headers.get("idempotency-key") ?? undefined,
        rawBody: null,
        payload: typeof body === "object" && body !== null ? body as Record<string, unknown> : null,
      });
      set.status = 202;
      return result;
    });
}
