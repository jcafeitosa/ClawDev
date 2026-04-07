/**
 * Agent hooks routes — Elysia port.
 *
 * Handles agent lifecycle hook CRUD, hook runs (execution history),
 * company hook templates, and manual test triggers.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  agentHooks,
  agentHookRuns,
  companyHookTemplates,
  agents,
} from "@clawdev/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { forbidden, notFound, unauthorized } from "../errors.js";
import { logActivity } from "../services/index.js";
import { logger } from "../middleware/logger.js";
import { agentHookService } from "../services/agent-hooks.js";

const log = logger.child({ service: "agent-hooks-route" });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveAgentCompanyId(db: Db, agentId: string): Promise<string | null> {
  const [row] = await db.select({ companyId: agents.companyId }).from(agents).where(eq(agents.id, agentId)).limit(1);
  return row?.companyId ?? null;
}

async function resolveHook(db: Db, hookId: string) {
  const [row] = await db.select().from(agentHooks).where(eq(agentHooks.id, hookId)).limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function agentHookRoutes(db: Db) {
  const hookSvc = agentHookService(db);

  return new Elysia()

    // -----------------------------------------------------------------------
    // Agent Hook CRUD
    // -----------------------------------------------------------------------

    // List all hooks in a company
    .get(
      "/companies/:companyId/agent-hooks",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, ctx.params.companyId);

        const conditions: any[] = [eq(agentHooks.companyId, ctx.params.companyId)];
        if (ctx.query?.agentId) conditions.push(eq(agentHooks.agentId, ctx.query.agentId));
        if (ctx.query?.event) conditions.push(eq(agentHooks.event, ctx.query.event));
        if (ctx.query?.enabled !== undefined && ctx.query?.enabled !== "") {
          conditions.push(eq(agentHooks.enabled, ctx.query.enabled === "true"));
        }

        const rows = await db
          .select()
          .from(agentHooks)
          .where(and(...conditions))
          .orderBy(agentHooks.priority, agentHooks.createdAt);
        return rows;
      },
      {
        params: t.Object({ companyId: t.String() }),
        query: t.Optional(
          t.Object({
            agentId: t.Optional(t.String()),
            event: t.Optional(t.String()),
            enabled: t.Optional(t.String()),
          }),
        ),
      },
    )

    // List hooks for a specific agent
    .get(
      "/agents/:id/hooks",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const agentId = ctx.params.id;
        const companyId = await resolveAgentCompanyId(db, agentId);
        if (!companyId) { ctx.set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, companyId);

        const conditions: any[] = [eq(agentHooks.agentId, agentId)];
        if (ctx.query?.event) conditions.push(eq(agentHooks.event, ctx.query.event));
        if (ctx.query?.enabled !== undefined && ctx.query?.enabled !== "") {
          conditions.push(eq(agentHooks.enabled, ctx.query.enabled === "true"));
        }

        const rows = await db
          .select()
          .from(agentHooks)
          .where(and(...conditions))
          .orderBy(agentHooks.priority, agentHooks.createdAt);
        return rows;
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Optional(
          t.Object({
            event: t.Optional(t.String()),
            enabled: t.Optional(t.String()),
          }),
        ),
      },
    )

    // Create hook for agent
    .post(
      "/agents/:id/hooks",
      async (ctx: any) => {
        const { params, body, actor, set } = ctx;
        const agentId = params.id;
        const companyId = await resolveAgentCompanyId(db, agentId);
        if (!companyId) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, companyId);

        const actorInfo = getActorInfo(actor);
        const [created] = await db
          .insert(agentHooks)
          .values({
            companyId,
            agentId,
            name: body.name,
            description: body.description ?? null,
            event: body.event,
            hookType: body.hookType,
            config: body.config ?? {},
            conditions: body.conditions ?? {},
            enabled: body.enabled ?? true,
            priority: body.priority ?? 0,
            runAsync: body.runAsync ?? false,
            timeoutMs: body.timeoutMs ?? 30000,
            retryCount: body.retryCount ?? 0,
            retryDelayMs: body.retryDelayMs ?? 1000,
            createdByAgentId: actorInfo.agentId ?? undefined,
            createdByUserId: actor.type === "board" ? actor.userId ?? "board" : undefined,
          })
          .returning();

        await logActivity(db, {
          companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "agent_hook.created",
          entityType: "agent_hook",
          entityId: created.id,
          details: { name: created.name, event: created.event, hookType: created.hookType, agentId },
        }).catch(() => {});

        log.info({ hookId: created.id, agentId, event: created.event }, "agent hook created");
        set.status = 201;
        return created;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.Nullable(t.String())),
          event: t.String(),
          hookType: t.String(),
          config: t.Optional(t.Any()),
          conditions: t.Optional(t.Any()),
          enabled: t.Optional(t.Boolean()),
          priority: t.Optional(t.Number()),
          runAsync: t.Optional(t.Boolean()),
          timeoutMs: t.Optional(t.Number()),
          retryCount: t.Optional(t.Number()),
          retryDelayMs: t.Optional(t.Number()),
        }),
      },
    )

    // Get single hook
    .get(
      "/agent-hooks/:id",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const hook = await resolveHook(db, ctx.params.id);
        if (!hook) { ctx.set.status = 404; return { error: "Hook not found" }; }
        assertCompanyAccess(actor, hook.companyId);
        return hook;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update hook
    .patch(
      "/agent-hooks/:id",
      async (ctx: any) => {
        const { params, body, actor } = ctx;
        const hook = await resolveHook(db, params.id);
        if (!hook) { ctx.set.status = 404; return { error: "Hook not found" }; }
        assertCompanyAccess(actor, hook.companyId);

        const [updated] = await db
          .update(agentHooks)
          .set({
            ...body,
            updatedAt: new Date(),
          })
          .where(eq(agentHooks.id, params.id))
          .returning();

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: hook.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "agent_hook.updated",
          entityType: "agent_hook",
          entityId: params.id,
          details: { updatedFields: Object.keys(body) },
        }).catch(() => {});

        return updated;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          event: t.Optional(t.String()),
          hookType: t.Optional(t.String()),
          config: t.Optional(t.Any()),
          conditions: t.Optional(t.Any()),
          enabled: t.Optional(t.Boolean()),
          priority: t.Optional(t.Number()),
          runAsync: t.Optional(t.Boolean()),
          timeoutMs: t.Optional(t.Number()),
          retryCount: t.Optional(t.Number()),
          retryDelayMs: t.Optional(t.Number()),
        }),
      },
    )

    // Delete hook
    .delete(
      "/agent-hooks/:id",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const hook = await resolveHook(db, ctx.params.id);
        if (!hook) { ctx.set.status = 404; return { error: "Hook not found" }; }
        assertCompanyAccess(actor, hook.companyId);

        await db.delete(agentHooks).where(eq(agentHooks.id, ctx.params.id));

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: hook.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "agent_hook.deleted",
          entityType: "agent_hook",
          entityId: ctx.params.id,
          details: { name: hook.name, event: hook.event },
        }).catch(() => {});

        log.info({ hookId: ctx.params.id }, "agent hook deleted");
        ctx.set.status = 204;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // -----------------------------------------------------------------------
    // Hook Runs (execution history)
    // -----------------------------------------------------------------------

    // List runs for a specific hook
    .get(
      "/agent-hooks/:id/runs",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const hook = await resolveHook(db, ctx.params.id);
        if (!hook) { ctx.set.status = 404; return { error: "Hook not found" }; }
        assertCompanyAccess(actor, hook.companyId);

        const limit = Number(ctx.query?.limit ?? 50);
        const conditions: any[] = [eq(agentHookRuns.hookId, ctx.params.id)];
        if (ctx.query?.status) conditions.push(eq(agentHookRuns.status, ctx.query.status));

        const rows = await db
          .select()
          .from(agentHookRuns)
          .where(and(...conditions))
          .orderBy(desc(agentHookRuns.createdAt))
          .limit(Number.isFinite(limit) ? limit : 50);
        return rows;
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Optional(
          t.Object({
            limit: t.Optional(t.String()),
            status: t.Optional(t.String()),
          }),
        ),
      },
    )

    // List all hook runs for an agent
    .get(
      "/agents/:id/hook-runs",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        const agentId = ctx.params.id;
        const companyId = await resolveAgentCompanyId(db, agentId);
        if (!companyId) { ctx.set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, companyId);

        const limit = Number(ctx.query?.limit ?? 50);
        const conditions: any[] = [eq(agentHookRuns.agentId, agentId)];
        if (ctx.query?.event) conditions.push(eq(agentHookRuns.event, ctx.query.event));

        const rows = await db
          .select()
          .from(agentHookRuns)
          .where(and(...conditions))
          .orderBy(desc(agentHookRuns.createdAt))
          .limit(Number.isFinite(limit) ? limit : 50);
        return rows;
      },
      {
        params: t.Object({ id: t.String() }),
        query: t.Optional(
          t.Object({
            limit: t.Optional(t.String()),
            event: t.Optional(t.String()),
          }),
        ),
      },
    )

    // -----------------------------------------------------------------------
    // Templates
    // -----------------------------------------------------------------------

    // List templates for a company
    .get(
      "/companies/:companyId/hook-templates",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, ctx.params.companyId);

        const rows = await db
          .select()
          .from(companyHookTemplates)
          .where(eq(companyHookTemplates.companyId, ctx.params.companyId))
          .orderBy(companyHookTemplates.name);
        return rows;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Create template
    .post(
      "/companies/:companyId/hook-templates",
      async (ctx: any) => {
        const { params, body, actor, set } = ctx;
        assertCompanyAccess(actor, params.companyId);

        const [created] = await db
          .insert(companyHookTemplates)
          .values({
            companyId: params.companyId,
            name: body.name,
            description: body.description ?? null,
            event: body.event,
            hookType: body.hookType,
            config: body.config ?? {},
            conditions: body.conditions ?? {},
            isDefault: body.isDefault ?? false,
          })
          .returning();

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: params.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "hook_template.created",
          entityType: "hook_template",
          entityId: created.id,
          details: { name: created.name, event: created.event },
        }).catch(() => {});

        set.status = 201;
        return created;
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.Nullable(t.String())),
          event: t.String(),
          hookType: t.String(),
          config: t.Optional(t.Any()),
          conditions: t.Optional(t.Any()),
          isDefault: t.Optional(t.Boolean()),
        }),
      },
    )

    // Apply template to an agent
    .post(
      "/hook-templates/:id/apply",
      async (ctx: any) => {
        const { params, body, actor, set } = ctx;

        const [template] = await db
          .select()
          .from(companyHookTemplates)
          .where(eq(companyHookTemplates.id, params.id))
          .limit(1);
        if (!template) { set.status = 404; return { error: "Template not found" }; }
        assertCompanyAccess(actor, template.companyId);

        // Verify the target agent belongs to the same company
        const agentCompanyId = await resolveAgentCompanyId(db, body.agentId);
        if (!agentCompanyId) { set.status = 404; return { error: "Agent not found" }; }
        if (agentCompanyId !== template.companyId) {
          throw forbidden("Agent does not belong to the template's company");
        }

        const actorInfo = getActorInfo(actor);
        const [created] = await db
          .insert(agentHooks)
          .values({
            companyId: template.companyId,
            agentId: body.agentId,
            name: template.name,
            description: template.description,
            event: template.event,
            hookType: template.hookType,
            config: template.config,
            conditions: template.conditions,
            createdByAgentId: actorInfo.agentId ?? undefined,
            createdByUserId: actor.type === "board" ? actor.userId ?? "board" : undefined,
          })
          .returning();

        await logActivity(db, {
          companyId: template.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "hook_template.applied",
          entityType: "agent_hook",
          entityId: created.id,
          details: { templateId: params.id, templateName: template.name, agentId: body.agentId },
        }).catch(() => {});

        set.status = 201;
        return created;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          agentId: t.String(),
        }),
      },
    )

    // Delete template
    .delete(
      "/hook-templates/:id",
      async (ctx: any) => {
        const actor = ctx.actor as Actor;

        const [template] = await db
          .select()
          .from(companyHookTemplates)
          .where(eq(companyHookTemplates.id, ctx.params.id))
          .limit(1);
        if (!template) { ctx.set.status = 404; return { error: "Template not found" }; }
        assertCompanyAccess(actor, template.companyId);

        await db.delete(companyHookTemplates).where(eq(companyHookTemplates.id, ctx.params.id));

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: template.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "hook_template.deleted",
          entityType: "hook_template",
          entityId: ctx.params.id,
          details: { name: template.name },
        }).catch(() => {});

        log.info({ templateId: ctx.params.id }, "hook template deleted");
        ctx.set.status = 204;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // -----------------------------------------------------------------------
    // Manual trigger (testing)
    // -----------------------------------------------------------------------

    .post(
      "/agent-hooks/:id/test",
      async (ctx: any) => {
        const { params, body, actor, set } = ctx;
        const hook = await resolveHook(db, params.id);
        if (!hook) { set.status = 404; return { error: "Hook not found" }; }
        assertCompanyAccess(actor, hook.companyId);

        const actorInfo = getActorInfo(actor);

        // Fire the hook using the service — this creates the run, executes, and tracks result
        const firedRunIds = await hookSvc.fireEvent(
          hook.companyId,
          hook.agentId,
          hook.event as any,
          body.payload ?? { _test: true, triggeredBy: actorInfo.actorId },
          { runId: actorInfo.runId ?? undefined },
        );

        await logActivity(db, {
          companyId: hook.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          runId: actorInfo.runId,
          action: "agent_hook.test_triggered",
          entityType: "agent_hook",
          entityId: hook.id,
          details: { hookName: hook.name, event: hook.event, firedRunIds },
        }).catch(() => {});

        log.info({ hookId: hook.id, firedRunIds }, "agent hook test triggered");
        set.status = 201;
        return { hookId: hook.id, firedRunIds };
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          payload: t.Optional(t.Any()),
        }),
      },
    );
}
