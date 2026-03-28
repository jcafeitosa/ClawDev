import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  companySkillCreateSchema,
  companySkillFileUpdateSchema,
  companySkillImportSchema,
  companySkillProjectScanRequestSchema,
} from "@clawdev/shared";
import { forbidden, notFound } from "../errors.js";
import { accessService, agentService, companySkillService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { authPlugin, type Actor } from "../plugins/auth.js";

function canCreateAgents(agent: { permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export function companySkillRoutes(db: Db, authPlugin: ReturnType<typeof authPlugin>) {
  const agentSvc = agentService(db);
  const access = accessService(db);
  const svc = companySkillService(db);

  async function assertCanMutateCompanySkills(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return;
      const allowed = await access.canUser(companyId, actor.userId!, "agents:create");
      if (!allowed) throw forbidden("Missing permission: agents:create");
      return;
    }
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await agentSvc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
    const allowedByGrant = await access.hasPermission(companyId, "agent", actorAgent.id, "agents:create");
    if (allowedByGrant || canCreateAgents(actorAgent)) return;
    throw forbidden("Missing permission: can create agents");
  }

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/skills", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return svc.list(params.companyId);
    })
    .get("/companies/:companyId/skills/:skillId", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const result = await svc.detail(params.companyId, params.skillId);
      if (!result) throw notFound("Skill not found");
      return result;
    })
    .get("/companies/:companyId/skills/:skillId/update-status", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const result = await svc.updateStatus(params.companyId, params.skillId);
      if (!result) throw notFound("Skill not found");
      return result;
    })
    .get("/companies/:companyId/skills/:skillId/files", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const relativePath = String((query as Record<string, string>).path ?? "SKILL.md");
      const result = await svc.readFile(params.companyId, params.skillId, relativePath);
      if (!result) throw notFound("Skill not found");
      return result;
    })
    .post("/companies/:companyId/skills", async ({ params, body, actor, set }) => {
      await assertCanMutateCompanySkills(actor, params.companyId);
      const parsed = companySkillCreateSchema.parse(body);
      const result = await svc.createLocalSkill(params.companyId, parsed);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.skill_created",
        entityType: "company_skill",
        entityId: result.id,
        details: { slug: result.slug, name: result.name },
      });
      set.status = 201;
      return result;
    })
    .patch("/companies/:companyId/skills/:skillId/files", async ({ params, body, actor }) => {
      await assertCanMutateCompanySkills(actor, params.companyId);
      const parsed = companySkillFileUpdateSchema.parse(body);
      const result = await svc.updateFile(params.companyId, params.skillId, String(parsed.path ?? ""), String(parsed.content ?? ""));
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.skill_file_updated",
        entityType: "company_skill",
        entityId: params.skillId,
        details: { path: result.path, markdown: result.markdown },
      });
      return result;
    })
    .post("/companies/:companyId/skills/import", async ({ params, body, actor, set }) => {
      await assertCanMutateCompanySkills(actor, params.companyId);
      const parsed = companySkillImportSchema.parse(body);
      const source = String(parsed.source ?? "");
      const result = await svc.importFromSource(params.companyId, source);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.skills_imported",
        entityType: "company",
        entityId: params.companyId,
        details: {
          source,
          importedCount: result.imported.length,
          importedSlugs: result.imported.map((skill: { slug: string }) => skill.slug),
          warningCount: result.warnings.length,
        },
      });
      set.status = 201;
      return result;
    })
    .post("/companies/:companyId/skills/scan-projects", async ({ params, body, actor }) => {
      await assertCanMutateCompanySkills(actor, params.companyId);
      const parsed = companySkillProjectScanRequestSchema.parse(body);
      const result = await svc.scanProjectWorkspaces(params.companyId, parsed);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
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
    })
    .delete("/companies/:companyId/skills/:skillId", async ({ params, actor }) => {
      await assertCanMutateCompanySkills(actor, params.companyId);
      const result = await svc.deleteSkill(params.companyId, params.skillId);
      if (!result) throw notFound("Skill not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.skill_deleted",
        entityType: "company_skill",
        entityId: result.id,
        details: { slug: result.slug, name: result.name },
      });
      return result;
    })
    .post("/companies/:companyId/skills/:skillId/install-update", async ({ params, actor }) => {
      await assertCanMutateCompanySkills(actor, params.companyId);
      const result = await svc.installUpdate(params.companyId, params.skillId);
      if (!result) throw notFound("Skill not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "company.skill_update_installed",
        entityType: "company_skill",
        entityId: result.id,
        details: { slug: result.slug, sourceRef: result.sourceRef },
      });
      return result;
    });
}
