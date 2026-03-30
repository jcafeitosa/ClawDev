/**
 * Goals routes — Elysia port.
 *
 * Full CRUD for company goals.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { goals } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { goalService, logActivity } from "../services/index.js";

export function goalRoutes(db: Db) {
  const svc = goalService(db);

  return new Elysia()
    // List goals for a company
    .get(
      "/companies/:companyId/goals",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const rows = await db
          .select()
          .from(goals)
          .where(eq(goals.companyId, params.companyId))
          .orderBy(desc(goals.createdAt));
        return rows;
      },
      { params: companyIdParam },
    )

    // Get goal by ID
    .get(
      "/goals/:id",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const goal = await svc.getById(ctx.params.id);
        if (!goal) {
          ctx.set.status = 404;
          return { error: "Goal not found" };
        }
        assertCompanyAccess(actor, goal.companyId);
        return goal;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create goal
    .post(
      "/companies/:companyId/goals",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const goal = await svc.create(params.companyId, body);
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
      },
      { params: companyIdParam },
    )

    // Update goal
    .patch(
      "/goals/:id",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Goal not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const goal = await svc.update(params.id, body);
        if (!goal) {
          set.status = 404;
          return { error: "Goal not found" };
        }

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: goal.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "goal.updated",
          entityType: "goal",
          entityId: goal.id,
          details: body,
        });

        return goal;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Delete goal
    .delete(
      "/goals/:id",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Goal not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const goal = await svc.remove(params.id);
        if (!goal) {
          set.status = 404;
          return { error: "Goal not found" };
        }

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
      },
      { params: t.Object({ id: t.String() }) },
    );
}
