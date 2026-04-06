/**
 * Agent Template routes — Elysia port.
 *
 * CRUD for agent templates + instantiation.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logActivity } from "../services/index.js";
import { agentTemplateService } from "../services/agent-templates.js";

export function agentTemplateRoutes(db: Db) {
  const templates = agentTemplateService(db);

  return new Elysia()
    // List templates
    .get(
      "/companies/:companyId/agent-templates",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        return templates.list(params.companyId);
      },
      { params: companyIdParam },
    )

    // Create template
    .post(
      "/companies/:companyId/agent-templates",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const actorInfo = getActorInfo(actor);
        const tmpl = await templates.create(params.companyId, body, {
          agentId: actorInfo.agentId ?? undefined,
          userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
        });

        await logActivity(db, {
          companyId: params.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "template.created",
          entityType: "agent_template",
          entityId: tmpl.id,
          details: { name: tmpl.name },
        });

        set.status = 201;
        return tmpl;
      },
      { params: companyIdParam },
    )

    // Get template
    .get(
      "/agent-templates/:id",
      async (ctx: any) => {
        const { params, set } = ctx;
        const tmpl = await templates.getById(params.id);
        if (!tmpl) {
          set.status = 404;
          return { error: "Template not found" };
        }
        return tmpl;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update template
    .patch(
      "/agent-templates/:id",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const updated = await templates.update(params.id, body);
        if (!updated) {
          set.status = 404;
          return { error: "Template not found" };
        }
        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Delete template
    .delete(
      "/agent-templates/:id",
      async (ctx: any) => {
        const { params, set } = ctx;
        const deleted = await templates.remove(params.id);
        if (!deleted) {
          set.status = 404;
          return { error: "Template not found" };
        }
        return deleted;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Instantiate template (create agent from template)
    .post(
      "/agent-templates/:id/instantiate",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const agent = await templates.instantiate(params.id, body ?? {});
        if (!agent) {
          set.status = 404;
          return { error: "Template not found" };
        }

        const actorInfo = getActorInfo(ctx.actor as Actor);
        await logActivity(db, {
          companyId: agent.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "template.instantiated",
          entityType: "agent",
          entityId: agent.id,
          details: { templateId: params.id, agentName: agent.name },
        });

        set.status = 201;
        return agent;
      },
      { params: t.Object({ id: t.String() }) },
    );
}
