/**
 * Company skills routes — Elysia port.
 *
 * CRUD for company-level skills that agents can use.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companySkillService, agentService, logActivity } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import { getActorInfo, type Actor } from "../middleware/authz.js";

export function companySkillRoutes(db: Db) {
  const svc = companySkillService(db);
  const agents = agentService(db);

  function canCreateAgents(agent: { permissions: Record<string, unknown> | null | undefined }) {
    if (!agent.permissions || typeof agent.permissions !== "object") return false;
    return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
  }

  async function checkCanMutateCompanySkills(actor: Actor, companyId: string, ctx: any): Promise<string | null> {
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return null;
      ctx.set.status = 403;
      return "Missing permission: agents:create";
    }

    if (!actor.agentId) {
      ctx.set.status = 403;
      return "Agent authentication required";
    }

    const actorAgent = await agents.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) {
      ctx.set.status = 403;
      return "Agent key cannot access another company";
    }

    if (canCreateAgents(actorAgent)) {
      return null;
    }

    ctx.set.status = 403;
    return "Missing permission: can create agents";
  }

  return new Elysia()
    // List skills for a company
    .get(
      "/companies/:companyId/skills",
      async ({ params }: any) => {
        const skills = await svc.list(params.companyId);
        return skills;
      },
      { params: companyIdParam },
    )

    // Get a skill by ID
    .get(
      "/skills/:id",
      async (ctx: any) => {
        const skill = await svc.getById(ctx.params.id);
        if (!skill) { ctx.set.status = 404; return { error: "Not found" }; }
        return skill;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create skill
    .post(
      "/companies/:companyId/skills",
      async ({ params, body }: any) => {
        const skill = await svc.createLocalSkill(params.companyId, {
          name: body.name,
          description: body.description,
          markdown: body.content,
        });
        return skill;
      },
      {
        params: companyIdParam,
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          content: t.String(),
        }),
      },
    )

    // Import skills from source
    .post(
      "/companies/:companyId/skills/import",
      async (ctx: any) => {
        const { params, body, actor, set } = ctx;
        const deniedMsg = await checkCanMutateCompanySkills(actor, params.companyId, ctx);
        if (deniedMsg) return { error: deniedMsg };
        const source = String(body.source ?? "");
        const result = await svc.importFromSource(params.companyId, source);
        set.status = 201;
        return result;
      },
      {
        params: t.Object({ companyId: t.String() }),
        body: t.Object({
          source: t.String(),
        }),
      },
    )

    // Update skill content
    .patch(
      "/skills/:id",
      async (ctx: any) => {
        const { params, body } = ctx;
        const skill = await svc.getById(params.id);
        if (!skill) { ctx.set.status = 404; return { error: "Not found" }; }
        if (body.content) {
          const updated = await svc.updateFile(skill.companyId, params.id, "SKILL.md", body.content);
          return updated;
        }
        return skill;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          content: t.Optional(t.String()),
        }),
      },
    )

    // Delete skill
    .delete(
      "/skills/:id",
      async (ctx: any) => {
        const skill = await svc.getById(ctx.params.id);
        if (!skill) { ctx.set.status = 404; return { error: "Not found" }; }
        await svc.deleteSkill(skill.companyId, ctx.params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Read skill file
    .get(
      "/companies/:companyId/skills/:skillId/files",
      async (ctx: any) => {
        const { companyId, skillId } = ctx.params;
        const relativePath = String(ctx.query?.path ?? "SKILL.md");
        const result = await svc.readFile(companyId, skillId, relativePath);
        if (!result) { ctx.set.status = 404; return { error: "File not found" }; }
        return result;
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Update skill file
    .patch(
      "/companies/:companyId/skills/:skillId/files",
      async (ctx: any) => {
        const { companyId, skillId } = ctx.params;
        const deniedMsg = await checkCanMutateCompanySkills(ctx.actor, companyId, ctx);
        if (deniedMsg) return { error: deniedMsg };
        const result = await svc.updateFile(
          companyId,
          skillId,
          String(ctx.body?.path ?? ""),
          String(ctx.body?.content ?? ""),
        );
        return result;
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Scan project workspaces for skills
    .post(
      "/companies/:companyId/skills/scan-projects",
      async (ctx: any) => {
        const { params, body } = ctx;
        const actor = ctx.actor as Actor;
        const deniedMsg = await checkCanMutateCompanySkills(actor, params.companyId, ctx);
        if (deniedMsg) return { error: deniedMsg };
        const result = await svc.scanProjectWorkspaces(params.companyId, body);

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: params.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "company.skills_scanned",
          entityType: "company",
          entityId: params.companyId,
          details: {
            scannedProjects: result.scannedProjects,
            scannedWorkspaces: result.scannedWorkspaces,
            discovered: result.discovered,
            importedCount: result.imported.length,
            updatedCount: result.updated.length,
            conflictCount: result.conflicts.length,
            warningCount: result.warnings.length,
          },
        });

        return result;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Install skill update
    .post(
      "/companies/:companyId/skills/:skillId/install-update",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        const deniedMsg = await checkCanMutateCompanySkills(actor, params.companyId, ctx);
        if (deniedMsg) return { error: deniedMsg };
        const result = await svc.installUpdate(params.companyId, params.skillId);
        if (!result) {
          set.status = 404;
          return { error: "Skill not found" };
        }

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: params.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "company.skill_update_installed",
          entityType: "company_skill",
          entityId: result.id,
          details: {
            slug: result.slug,
            sourceRef: result.sourceRef,
          },
        });

        return result;
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    );
}
