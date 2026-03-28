import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import {
  createProjectSchema,
  createProjectWorkspaceSchema,
  isUuidLike,
  updateProjectSchema,
  updateProjectWorkspaceSchema,
} from "@clawdev/shared";
import { conflict, notFound, unprocessable } from "../errors.js";
import { projectService, logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import type { Actor } from "../plugins/auth.js";
import { elysiaAuth } from "../plugins/auth.js";

export function elysiaProjectRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = projectService(db);

  async function resolveCompanyIdForProjectReference(actor: Actor, query: Record<string, string>) {
    const requestedCompanyId = query.companyId?.trim() || null;
    if (requestedCompanyId) {
      assertCompanyAccess(actor, requestedCompanyId);
      return requestedCompanyId;
    }
    if (actor.type === "agent" && actor.companyId) {
      return actor.companyId;
    }
    return null;
  }

  async function normalizeProjectReference(actor: Actor, rawId: string, query: Record<string, string>) {
    if (isUuidLike(rawId)) return rawId;
    const companyId = await resolveCompanyIdForProjectReference(actor, query);
    if (!companyId) return rawId;
    const resolved = await svc.resolveByReference(companyId, rawId);
    if (resolved.ambiguous) {
      throw conflict("Project shortname is ambiguous in this company. Use the project ID.");
    }
    return resolved.project?.id ?? rawId;
  }

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/projects", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return svc.list(params.companyId);
    })
    .get("/projects/:id", async ({ params, query, actor }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const project = await svc.getById(id);
      if (!project) throw notFound("Project not found");
      assertCompanyAccess(actor, project.companyId);
      return project;
    })
    .post("/companies/:companyId/projects", async ({ params, body, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const parsed = createProjectSchema.parse(body) as Parameters<typeof svc.create>[1] & {
        workspace?: Parameters<typeof svc.createWorkspace>[1];
      };
      const { workspace, ...projectData } = parsed;
      const project = await svc.create(params.companyId, projectData);

      let createdWorkspaceId: string | null = null;
      if (workspace) {
        const createdWorkspace = await svc.createWorkspace(project.id, workspace);
        if (!createdWorkspace) {
          await svc.remove(project.id);
          throw unprocessable("Invalid project workspace payload");
        }
        createdWorkspaceId = createdWorkspace.id;
      }

      const hydratedProject = workspace ? await svc.getById(project.id) : project;
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: params.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "project.created",
        entityType: "project",
        entityId: project.id,
        details: { name: project.name, workspaceId: createdWorkspaceId },
      });
      set.status = 201;
      return hydratedProject ?? project;
    })
    .patch("/projects/:id", async ({ params, query, body, actor }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Project not found");
      assertCompanyAccess(actor, existing.companyId);
      const parsed = updateProjectSchema.parse(body) as Record<string, unknown>;
      if (typeof parsed.archivedAt === "string") {
        parsed.archivedAt = new Date(parsed.archivedAt as string);
      }
      const project = await svc.update(id, parsed);
      if (!project) throw notFound("Project not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: project.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "project.updated",
        entityType: "project",
        entityId: project.id,
        details: parsed,
      });
      return project;
    })
    .get("/projects/:id/workspaces", async ({ params, query, actor }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Project not found");
      assertCompanyAccess(actor, existing.companyId);
      return svc.listWorkspaces(id);
    })
    .post("/projects/:id/workspaces", async ({ params, query, body, actor, set }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Project not found");
      assertCompanyAccess(actor, existing.companyId);
      const parsed = createProjectWorkspaceSchema.parse(body);
      const workspace = await svc.createWorkspace(id, parsed);
      if (!workspace) throw unprocessable("Invalid project workspace payload");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "project.workspace_created",
        entityType: "project",
        entityId: id,
        details: {
          workspaceId: workspace.id,
          name: workspace.name,
          cwd: workspace.cwd,
          isPrimary: workspace.isPrimary,
        },
      });
      set.status = 201;
      return workspace;
    })
    .patch("/projects/:id/workspaces/:workspaceId", async ({ params, query, body, actor }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Project not found");
      assertCompanyAccess(actor, existing.companyId);
      const workspaceExists = (await svc.listWorkspaces(id)).some((w) => w.id === params.workspaceId);
      if (!workspaceExists) throw notFound("Project workspace not found");
      const parsed = updateProjectWorkspaceSchema.parse(body);
      const workspace = await svc.updateWorkspace(id, params.workspaceId, parsed);
      if (!workspace) throw unprocessable("Invalid project workspace payload");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "project.workspace_updated",
        entityType: "project",
        entityId: id,
        details: { workspaceId: workspace.id, changedKeys: Object.keys(parsed).sort() },
      });
      return workspace;
    })
    .delete("/projects/:id/workspaces/:workspaceId", async ({ params, query, actor }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Project not found");
      assertCompanyAccess(actor, existing.companyId);
      const workspace = await svc.removeWorkspace(id, params.workspaceId);
      if (!workspace) throw notFound("Project workspace not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "project.workspace_deleted",
        entityType: "project",
        entityId: id,
        details: { workspaceId: workspace.id, name: workspace.name },
      });
      return workspace;
    })
    .delete("/projects/:id", async ({ params, query, actor }) => {
      const id = await normalizeProjectReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Project not found");
      assertCompanyAccess(actor, existing.companyId);
      const project = await svc.remove(id);
      if (!project) throw notFound("Project not found");
      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: project.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        action: "project.deleted",
        entityType: "project",
        entityId: project.id,
      });
      return project;
    });
}
