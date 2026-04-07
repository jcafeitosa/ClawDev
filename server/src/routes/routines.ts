/**
 * Routines routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { forbidden, unauthorized } from "../errors.js";
import { accessService, logActivity, routineService } from "../services/index.js";
import { logger } from "../middleware/logger.js";

export function routineRoutes(db: Db) {
  const svc = routineService(db);
  const access = accessService(db);
  const log = logger.child({ service: "routines-routes" });

  async function checkBoardCanAssignTasks(actor: Actor, companyId: string, ctx: any): Promise<boolean> {
    if (actor.type !== "board") return false;
    if (actor.source === "local_implicit" || actor.isInstanceAdmin) return false;
    const allowed = await access.canUser(companyId, actor.userId!, "tasks:assign");
    if (!allowed) {
      ctx.set.status = 403;
      return true;
    }
    return false;
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

  return new Elysia()
    // List routines for a company
    .get(
      "/companies/:companyId/routines",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, ctx.params.companyId);
          const result = await svc.list(ctx.params.companyId);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list routines");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Create routine
    .post(
      "/companies/:companyId/routines",
      async (ctx: any) => {
        try {
          const { params, body, actor, set } = ctx;
          assertCompanyAccess(actor, params.companyId);
          const denied = await checkBoardCanAssignTasks(actor, params.companyId, ctx);
          if (denied) return { error: "Missing permission: tasks:assign" };
          assertCanManageCompanyRoutine(actor, params.companyId, body.assigneeAgentId);
          const created = await svc.create(params.companyId, body, {
            agentId: actor.type === "agent" ? actor.agentId : null,
            userId: actor.type === "board" ? actor.userId ?? "board" : null,
          });
          const actorInfoCreate = getActorInfo(actor);
          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfoCreate.actorType,
            actorId: actorInfoCreate.actorId,
            agentId: actorInfoCreate.agentId,
            runId: actorInfoCreate.runId,
            action: "routine.created",
            entityType: "routine",
            entityId: created.id,
            details: { title: created.title, assigneeAgentId: created.assigneeAgentId },
          }).catch(() => {});
          set.status = 201;
          return created;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create routine");
          throw err;
        }
      },
      {
        params: companyIdParam,
        body: t.Object({
          projectId: t.Optional(t.Nullable(t.String())),
          goalId: t.Optional(t.Nullable(t.String())),
          parentIssueId: t.Optional(t.Nullable(t.String())),
          title: t.String(),
          description: t.Optional(t.Nullable(t.String())),
          assigneeAgentId: t.String(),
          priority: t.Optional(t.String()),
          concurrencyPolicy: t.Optional(t.String()),
          catchUpPolicy: t.Optional(t.String()),
        }),
      },
    )

    // Get routine detail
    .get(
      "/routines/:id",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const detail = await svc.getDetail(ctx.params.id);
          if (!detail) { ctx.set.status = 404; return { error: "Routine not found" }; }
          assertCompanyAccess(actor, detail.companyId);
          return detail;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get routine detail");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update routine
    .patch(
      "/routines/:id",
      async (ctx: any) => {
        try {
          const { params, body, actor } = ctx;
          const routine = await assertCanManageExistingRoutine(actor, params.id);
          if (!routine) { ctx.set.status = 404; return { error: "Routine not found" }; }

          const assigneeWillChange =
            body.assigneeAgentId !== undefined &&
            body.assigneeAgentId !== routine.assigneeAgentId;
          if (assigneeWillChange) {
            const denied = await checkBoardCanAssignTasks(actor, routine.companyId, ctx);
            if (denied) return { error: "Missing permission: tasks:assign" };
          }

          const statusWillActivate =
            body.status !== undefined &&
            body.status === "active" &&
            routine.status !== "active";
          if (statusWillActivate) {
            const denied = await checkBoardCanAssignTasks(actor, routine.companyId, ctx);
            if (denied) return { error: "Missing permission: tasks:assign" };
          }

          const updated = await svc.update(routine.id, body, {
            agentId: actor.type === "agent" ? actor.agentId : null,
            userId: actor.type === "board" ? actor.userId ?? "board" : null,
          });
          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update routine");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          assigneeAgentId: t.Optional(t.String()),
          priority: t.Optional(t.String()),
          status: t.Optional(t.String()),
          concurrencyPolicy: t.Optional(t.String()),
          catchUpPolicy: t.Optional(t.String()),
        }),
      },
    )

    // List routine runs
    .get(
      "/routines/:id/runs",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const routine = await svc.get(ctx.params.id);
          if (!routine) { ctx.set.status = 404; return { error: "Routine not found" }; }
          assertCompanyAccess(actor, routine.companyId);
          const limit = Number(ctx.query?.limit ?? 50);
          const result = await svc.listRuns(routine.id, Number.isFinite(limit) ? limit : 50);
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list routine runs");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create trigger
    .post(
      "/routines/:id/triggers",
      async (ctx: any) => {
        try {
          const { params, body, actor, set } = ctx;
          const routine = await svc.get(params.id);
          if (!routine) { ctx.set.status = 404; return { error: "Routine not found" }; }
          assertCompanyAccess(actor, routine.companyId);
          const denied = await checkBoardCanAssignTasks(actor, routine.companyId, ctx);
          if (denied) return { error: "Missing permission: tasks:assign" };
          const created = await svc.createTrigger(routine.id, body, {
            agentId: actor.type === "agent" ? actor.agentId : null,
            userId: actor.type === "board" ? actor.userId ?? "board" : null,
          });
          const actorInfoTrigger = getActorInfo(actor);
          await logActivity(db, {
            companyId: routine.companyId,
            actorType: actorInfoTrigger.actorType,
            actorId: actorInfoTrigger.actorId,
            agentId: actorInfoTrigger.agentId,
            runId: actorInfoTrigger.runId,
            action: "routine.trigger_created",
            entityType: "routine_trigger",
            entityId: created.trigger.id,
            details: { routineId: routine.id, kind: created.trigger.kind },
          }).catch(() => {});
          set.status = 201;
          return created;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create trigger");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          kind: t.String(),
          label: t.Optional(t.String()),
          cronExpression: t.Optional(t.String()),
          timezone: t.Optional(t.String()),
          enabled: t.Optional(t.Boolean()),
        }),
      },
    )

    // Manually run a routine
    .post(
      "/routines/:id/run",
      async (ctx: any) => {
        try {
          const { params, body, actor, set } = ctx;
          const routine = await assertCanManageExistingRoutine(actor, params.id);
          if (!routine) { ctx.set.status = 404; return { error: "Routine not found" }; }
          const denied = await checkBoardCanAssignTasks(actor, routine.companyId, ctx);
          if (denied) return { error: "Missing permission: tasks:assign" };
          const run = await svc.runRoutine(routine.id, body ?? {});
          const actorInfoRun = getActorInfo(actor);
          await logActivity(db, {
            companyId: routine.companyId,
            actorType: actorInfoRun.actorType,
            actorId: actorInfoRun.actorId,
            agentId: actorInfoRun.agentId,
            runId: actorInfoRun.runId,
            action: "routine.run_triggered",
            entityType: "routine_run",
            entityId: run.id,
            details: { routineId: routine.id, source: run.source, status: run.status },
          }).catch(() => {});
          set.status = 202;
          return run;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to run routine manually");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Optional(t.Object({
          source: t.Optional(t.Union([t.Literal("manual"), t.Literal("api")])),
          triggerId: t.Optional(t.Union([t.String(), t.Null()])),
          payload: t.Optional(t.Any()),
          idempotencyKey: t.Optional(t.Union([t.String(), t.Null()])),
        })),
      },
    )

    // Update trigger
    .patch(
      "/routine-triggers/:id",
      async (ctx: any) => {
        try {
          const { params, body, actor } = ctx;
          const trigger = await svc.getTrigger(params.id);
          if (!trigger) { ctx.set.status = 404; return { error: "Routine trigger not found" }; }
          const routine = await assertCanManageExistingRoutine(actor, trigger.routineId);
          if (!routine) { ctx.set.status = 404; return { error: "Routine not found" }; }
          const denied = await checkBoardCanAssignTasks(actor, routine.companyId, ctx);
          if (denied) return { error: "Missing permission: tasks:assign" };
          const updated = await svc.updateTrigger(trigger.id, body, {
            agentId: actor.type === "agent" ? actor.agentId : null,
            userId: actor.type === "board" ? actor.userId ?? "board" : null,
          });
          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update trigger");
          throw err;
        }
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          enabled: t.Optional(t.Boolean()),
          cronExpression: t.Optional(t.String()),
          timezone: t.Optional(t.String()),
          label: t.Optional(t.String()),
        }),
      },
    )

    // Delete trigger
    .delete(
      "/routine-triggers/:id",
      async (ctx: any) => {
        try {
          const { params, actor, set } = ctx;
          const trigger = await svc.getTrigger(params.id);
          if (!trigger) { ctx.set.status = 404; return { error: "Routine trigger not found" }; }
          const routine = await assertCanManageExistingRoutine(actor, trigger.routineId);
          if (!routine) { ctx.set.status = 404; return { error: "Routine not found" }; }
          await svc.deleteTrigger(trigger.id);
          set.status = 204;
          return "";
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete trigger");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Rotate trigger secret
    .post(
      "/routine-triggers/:id/rotate-secret",
      async (ctx: any) => {
        try {
          const { params, actor, set } = ctx;
          const trigger = await svc.getTrigger(params.id);
          if (!trigger) { set.status = 404; return { error: "Routine trigger not found" }; }
          const routine = await assertCanManageExistingRoutine(actor, trigger.routineId);
          if (!routine) { set.status = 404; return { error: "Routine not found" }; }
          const denied = await checkBoardCanAssignTasks(actor, routine.companyId, ctx);
          if (denied) return { error: "Missing permission: tasks:assign" };
          const result = await svc.rotateTriggerSecret(trigger.id, {
            agentId: actor.type === "agent" ? actor.agentId : null,
            userId: actor.type === "board" ? actor.userId ?? "board" : null,
          });
          const actorInfoRotate = getActorInfo(actor);
          await logActivity(db, {
            companyId: routine.companyId,
            actorType: actorInfoRotate.actorType,
            actorId: actorInfoRotate.actorId,
            agentId: actorInfoRotate.agentId,
            runId: actorInfoRotate.runId,
            action: "routine.trigger_secret_rotated",
            entityType: "routine_trigger",
            entityId: trigger.id,
            details: { routineId: routine.id },
          }).catch(() => {});
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to rotate trigger secret");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/routine-triggers/public/:publicId/fire",
      async (ctx: any) => {
        try {
          const { params, body, request } = ctx;
          let rawBody: Buffer | null = null;
          try {
            rawBody = Buffer.from(await request.clone().arrayBuffer());
          } catch {
            rawBody = null;
          }
          const result = await svc.firePublicTrigger(params.publicId as string, {
            authorizationHeader: request.headers.get("authorization"),
            signatureHeader: request.headers.get("x-clawdev-signature"),
            timestampHeader: request.headers.get("x-clawdev-timestamp"),
            idempotencyKey: request.headers.get("idempotency-key"),
            rawBody,
            payload: typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null,
          });
          ctx.set.status = 202;
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to fire public trigger");
          throw err;
        }
      },
      { params: t.Object({ publicId: t.String() }) },
    );
}
