/**
 * Company skills routes — Elysia port.
 *
 * CRUD for company-level skills that agents can use.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { accessService, companySkillService, agentService, logActivity } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { isLevelCAgentRole } from "@clawdev/shared";
import { logger } from "../middleware/logger.js";

export function companySkillRoutes(db: Db) {
  const svc = companySkillService(db);
  const agents = agentService(db);
  const access = accessService(db);
  const log = logger.child({ service: "company-skills-routes" });

  function canCreateAgents(agent: { permissions: Record<string, unknown> | null | undefined; role?: string }) {
    if (agent.role && isLevelCAgentRole(agent.role)) return true;
    if (!agent.permissions || typeof agent.permissions !== "object") return false;
    return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
  }

  async function checkCanMutateCompanySkills(actor: Actor, companyId: string, ctx: any): Promise<string | null> {
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return null;
      if (actor.userId && await access.canUser(companyId, actor.userId, "agents:create")) return null;
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

    if (await access.hasPermission(companyId, "agent", actorAgent.id, "agents:create") || canCreateAgents(actorAgent)) {
      return null;
    }

    ctx.set.status = 403;
    return "Missing permission: can create agents";
  }

  return new Elysia()
    // List skills for a company
    .get(
      "/companies/:companyId/skills",
      async ({ params, ...ctx }: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const skills = await svc.list(params.companyId);
          return skills;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list skills for company");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Backward-compatible alias used by the ClawDev agent UI.
    .get(
      "/companies/:companyId/company-skills",
      async ({ params, ...ctx }: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const skills = await svc.list(params.companyId);
          return skills;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list company skills (backward-compatible)");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Get a skill by ID
    .get(
      "/skills/:id",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          const skill = await svc.getById(ctx.params.id);
          if (!skill) { ctx.set.status = 404; return { error: "Skill not found" }; }
          assertCompanyAccess(actor, skill.companyId);
          return skill;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get skill by ID");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Company-scoped detail route used by the ClawDev UI.
    .get(
      "/companies/:companyId/skills/:skillId",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const { companyId, skillId } = ctx.params;
          assertCompanyAccess(actor, companyId);
          const skill = await svc.getById(skillId);
          if (!skill || skill.companyId !== companyId) {
            ctx.set.status = 404;
            return { error: "Skill not found" };
          }
          return await svc.detail(companyId, skillId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get skill detail");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Check whether a company skill has an upstream update available.
    .get(
      "/companies/:companyId/skills/:skillId/update-status",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const { companyId, skillId } = ctx.params;
          assertCompanyAccess(actor, companyId);
          const result = await svc.updateStatus(companyId, skillId);
          if (!result) { ctx.set.status = 404; return { error: "Skill not found" }; }
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to check skill update status");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Company-scoped delete route used by the ClawDev Svelte UI.
    .delete(
      "/companies/:companyId/skills/:skillId",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const { companyId, skillId } = ctx.params;
          assertCompanyAccess(actor, companyId);
          const deniedMsg = await checkCanMutateCompanySkills(actor, companyId, ctx);
          if (deniedMsg) return { error: deniedMsg };
          const skill = await svc.getById(skillId);
          if (!skill || skill.companyId !== companyId) {
            ctx.set.status = 404;
            return { error: "Skill not found" };
          }
          const deleted = await svc.deleteSkill(companyId, skillId);
          if (!deleted) {
            ctx.set.status = 404;
            return { error: "Skill not found" };
          }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "company.skill_deleted",
            entityType: "company_skill",
            entityId: skillId,
            details: { slug: deleted.slug, name: deleted.name },
          });

          return deleted;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete skill in company scope");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Create skill
    .post(
      "/companies/:companyId/skills",
      async ({ params, body, ...ctx }: any) => {
        try {
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const deniedMsg = await checkCanMutateCompanySkills(actor, params.companyId, ctx);
          if (deniedMsg) return { error: deniedMsg };
          const skill = await svc.createLocalSkill(params.companyId, {
            name: body.name,
            description: body.description,
            markdown: body.content,
          });

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "company.skill_created",
            entityType: "company_skill",
            entityId: skill.id,
            details: { slug: skill.slug, name: skill.name },
          });

          return skill;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create skill");
          throw err;
        }
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
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const deniedMsg = await checkCanMutateCompanySkills(actor, params.companyId, ctx);
          if (deniedMsg) return { error: deniedMsg };
          const source = String(body.source ?? "");
          const result = await svc.importFromSource(params.companyId, source);

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "company.skill_imported",
            entityType: "company_skill",
            entityId: params.companyId,
            details: {
              source,
              importedCount: result.imported.length,
              importedSlugs: result.imported.map((skill: any) => skill.slug),
              warningCount: result.warnings.length,
            },
          });

          set.status = 201;
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to import skills");
          throw err;
        }
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
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          const skill = await svc.getById(params.id);
          if (!skill) { ctx.set.status = 404; return { error: "Skill not found" }; }
          assertCompanyAccess(actor, skill.companyId);
          const deniedMsg = await checkCanMutateCompanySkills(actor, skill.companyId, ctx);
          if (deniedMsg) return { error: deniedMsg };
          if (body.content) {
            const updated = await svc.updateFile(skill.companyId, params.id, "SKILL.md", body.content);

            const actorInfo = getActorInfo(actor);
            await logActivity(db, {
              companyId: skill.companyId,
              actorType: actorInfo.actorType,
              actorId: actorInfo.actorId,
              agentId: actorInfo.agentId,
              action: "company.skill_file_updated",
              entityType: "company_skill",
              entityId: params.id,
              details: { path: "SKILL.md", markdown: updated.markdown },
            });

            return updated;
          }
          return skill;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update skill content");
          throw err;
        }
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
        try {
          const actor = ctx.actor as Actor;
          assertBoard(actor);
          const skill = await svc.getById(ctx.params.id);
          if (!skill) { ctx.set.status = 404; return { error: "Skill not found" }; }
          assertCompanyAccess(actor, skill.companyId);
          const deniedMsg = await checkCanMutateCompanySkills(actor, skill.companyId, ctx);
          if (deniedMsg) return { error: deniedMsg };
          const deleted = await svc.deleteSkill(skill.companyId, ctx.params.id);
          if (!deleted) {
            ctx.set.status = 404;
            return { error: "Skill not found" };
          }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: skill.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "company.skill_deleted",
            entityType: "company_skill",
            entityId: ctx.params.id,
            details: { slug: deleted.slug, name: deleted.name },
          });

          return deleted;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete skill");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Read skill file
    .get(
      "/companies/:companyId/skills/:skillId/files",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const { companyId, skillId } = ctx.params;
          assertCompanyAccess(actor, companyId);
          const relativePath = String(ctx.query?.path ?? "SKILL.md");
          const result = await svc.readFile(companyId, skillId, relativePath);
          if (!result) { ctx.set.status = 404; return { error: "File not found" }; }
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to read skill file");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Update skill file
    .patch(
      "/companies/:companyId/skills/:skillId/files",
      async (ctx: any) => {
        try {
          const actor = ctx.actor as Actor;
          const { companyId, skillId } = ctx.params;
          assertCompanyAccess(actor, companyId);
          const deniedMsg = await checkCanMutateCompanySkills(actor, companyId, ctx);
          if (deniedMsg) return { error: deniedMsg };
          const result = await svc.updateFile(
            companyId,
            skillId,
            String(ctx.body?.path ?? ""),
            String(ctx.body?.content ?? ""),
          );
          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "company.skill_file_updated",
            entityType: "company_skill",
            entityId: skillId,
            details: {
              path: result.path,
              markdown: result.markdown,
            },
          });
          return result;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update skill file");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    )

    // Scan project workspaces for skills
    .post(
      "/companies/:companyId/skills/scan-projects",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to scan project workspaces for skills");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // Install skill update
    .post(
      "/companies/:companyId/skills/:skillId/install-update",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
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
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to install skill update");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), skillId: t.String() }) },
    );
}
