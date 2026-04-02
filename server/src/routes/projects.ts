/**
 * Projects routes — Elysia port.
 *
 * Full CRUD for projects and project workspaces.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { projects } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { projectService, logActivity, workspaceOperationService } from "../services/index.js";
import { isUuidLike, deriveProjectUrlKey } from "@clawdev/shared";
import { conflict } from "../errors.js";
import { startRuntimeServicesForWorkspaceControl, stopRuntimeServicesForProjectWorkspace } from "../services/workspace-runtime.js";
import { readProjectWorkspaceRuntimeConfig } from "../services/project-workspace-runtime-config.js";

export function projectRoutes(db: Db) {
  const svc = projectService(db);

  async function resolveCompanyIdForProjectReference(actor: Actor, query: Record<string, unknown>) {
    const companyIdQuery = query.companyId;
    const requestedCompanyId =
      typeof companyIdQuery === "string" && companyIdQuery.trim().length > 0
        ? companyIdQuery.trim()
        : null;
    if (requestedCompanyId) {
      assertCompanyAccess(actor, requestedCompanyId);
      return requestedCompanyId;
    }
    if (actor.type === "agent" && actor.companyId) {
      return actor.companyId;
    }
    return null;
  }

  async function normalizeProjectReference(actor: Actor, query: Record<string, unknown>, rawId: string) {
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
    // List projects for a company
    .get(
      "/companies/:companyId/projects",
      async (ctx: any) => {
        const { params } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);
        const rows = await db
          .select()
          .from(projects)
          .where(eq(projects.companyId, params.companyId))
          .orderBy(desc(projects.createdAt));
        return rows.map((r) => ({ ...r, urlKey: deriveProjectUrlKey(r.name, r.id) }));
      },
      { params: companyIdParam },
    )

    // Get project by ID or urlKey
    .get(
      "/projects/:id",
      async (ctx: any) => {
        const { params, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        let project = null;
        if (isUuidLike(resolvedId)) {
          project = await svc.getById(resolvedId);
        }
        if (!project) {
          // urlKey lookup fallback
          const allRows = await db.select().from(projects);
          const match = allRows.find((r) => deriveProjectUrlKey(r.name, r.id) === params.id);
          if (match) project = await svc.getById(match.id);
        }
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, project.companyId);
        return project;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create project
    .post(
      "/companies/:companyId/projects",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const { workspace, ...projectData } = body;
        const project = await svc.create(params.companyId, projectData);
        let createdWorkspaceId: string | null = null;
        if (workspace) {
          const createdWorkspace = await svc.createWorkspace(project.id, workspace);
          if (!createdWorkspace) {
            await svc.remove(project.id);
            set.status = 422;
            return { error: "Invalid project workspace payload" };
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
          details: {
            name: project.name,
            workspaceId: createdWorkspaceId,
          },
        });

        set.status = 201;
        return hydratedProject ?? project;
      },
      { params: companyIdParam },
    )

    // Update project
    .patch(
      "/projects/:id",
      async (ctx: any) => {
        const { params, body, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        const existing = await svc.getById(resolvedId);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const patchData = { ...body };
        if (typeof patchData.archivedAt === "string") {
          patchData.archivedAt = new Date(patchData.archivedAt);
        }
        const project = await svc.update(resolvedId, patchData);
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: project.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "project.updated",
          entityType: "project",
          entityId: project.id,
          details: body,
        });

        return project;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Delete project
    .delete(
      "/projects/:id",
      async (ctx: any) => {
        const { params, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        const existing = await svc.getById(resolvedId);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const project = await svc.remove(resolvedId);
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }

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
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Project workspaces ─────────────────────────────────────────

    // List workspaces
    .get(
      "/projects/:id/workspaces",
      async (ctx: any) => {
        const { params, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        const existing = await svc.getById(resolvedId);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        return svc.listWorkspaces(resolvedId);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create workspace
    .post(
      "/projects/:id/workspaces",
      async (ctx: any) => {
        const { params, body, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        const existing = await svc.getById(resolvedId);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const workspace = await svc.createWorkspace(resolvedId, body);
        if (!workspace) {
          set.status = 422;
          return { error: "Invalid project workspace payload" };
        }

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "project.workspace_created",
          entityType: "project",
          entityId: resolvedId,
          details: {
            workspaceId: workspace.id,
            name: workspace.name,
            cwd: workspace.cwd,
            isPrimary: workspace.isPrimary,
          },
        });

        set.status = 201;
        return workspace;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update workspace
    .patch(
      "/projects/:id/workspaces/:workspaceId",
      async (ctx: any) => {
        const { params, body, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        const existing = await svc.getById(resolvedId);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const workspaceExists = (await svc.listWorkspaces(resolvedId)).some(
          (ws) => ws.id === params.workspaceId,
        );
        if (!workspaceExists) {
          set.status = 404;
          return { error: "Project workspace not found" };
        }
        const workspace = await svc.updateWorkspace(resolvedId, params.workspaceId, body);
        if (!workspace) {
          set.status = 422;
          return { error: "Invalid project workspace payload" };
        }

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "project.workspace_updated",
          entityType: "project",
          entityId: resolvedId,
          details: {
            workspaceId: workspace.id,
            changedKeys: Object.keys(body).sort(),
          },
        });

        return workspace;
      },
      { params: t.Object({ id: t.String(), workspaceId: t.String() }) },
    )

    .post(
      "/projects/:id/workspaces/:workspaceId/runtime-services/:action",
      async (ctx: any) => {
        const { params, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);
        const action = String(params.action ?? "").trim().toLowerCase();
        if (action !== "start" && action !== "stop" && action !== "restart") {
          set.status = 404;
          return { error: "Runtime service action not found" };
        }

        const project = await svc.getById(resolvedId);
        if (!project) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, project.companyId);

        const workspace = project.workspaces.find((entry) => entry.id === params.workspaceId) ?? null;
        if (!workspace) {
          set.status = 404;
          return { error: "Project workspace not found" };
        }

        const workspaceCwd = workspace.cwd;
        if (!workspaceCwd) {
          set.status = 422;
          return { error: "Project workspace needs a local path before ClawDev can manage local runtime services" };
        }

        const effectiveRuntimeConfig = workspace.runtimeConfig ?? readProjectWorkspaceRuntimeConfig(workspace.metadata);
        if ((action === "start" || action === "restart") && !effectiveRuntimeConfig) {
          set.status = 422;
          return { error: "Project workspace has no runtime service configuration" };
        }

        const workspaceOperations = workspaceOperationService(db);
        const recorder = workspaceOperations.createRecorder({ companyId: project.companyId });
        let runtimeServiceCount = 0;
        const stdout: string[] = [];
        const stderr: string[] = [];

        const operation = await recorder.recordOperation({
          phase: action === "stop" ? "workspace_teardown" : "workspace_provision",
          command: `workspace runtime ${action}`,
          cwd: workspace.cwd,
          metadata: {
            action,
            projectId: project.id,
            projectWorkspaceId: workspace.id,
          },
          run: async () => {
            const onLog = async (stream: "stdout" | "stderr", chunk: string) => {
              if (stream === "stdout") stdout.push(chunk);
              else stderr.push(chunk);
            };

            if (action === "stop" || action === "restart") {
              await stopRuntimeServicesForProjectWorkspace({
                db,
                projectWorkspaceId: workspace.id,
              });
            }

            if (action === "start" || action === "restart") {
              const startedServices = await startRuntimeServicesForWorkspaceControl({
                db,
                actor: {
                  id: actor.agentId ?? actor.userId ?? "board",
                  name: actor.type === "board" ? "Board" : "Agent",
                  companyId: project.companyId,
                },
                issue: null,
                workspace: {
                  baseCwd: workspaceCwd,
                  source: workspace.isPrimary ? "project_primary" : "task_session",
                  projectId: project.id,
                  workspaceId: workspace.id,
                  repoUrl: workspace.repoUrl,
                  repoRef: workspace.repoRef,
                  strategy: workspace.sourceType === "git_repo" ? "git_worktree" : "project_primary",
                  cwd: workspaceCwd,
                  branchName: null,
                  worktreePath: workspace.sourceType === "git_repo" ? workspaceCwd : null,
                  warnings: [],
                  created: false,
                },
                config: { workspaceRuntime: effectiveRuntimeConfig },
                adapterEnv: {},
                onLog,
              });
              runtimeServiceCount = startedServices.length;
            }

            return {
              status: "succeeded",
              stdout: stdout.join(""),
              stderr: stderr.join(""),
              system:
                action === "stop"
                  ? "Stopped project workspace runtime services.\n"
                  : action === "restart"
                    ? "Restarted project workspace runtime services.\n"
                    : "Started project workspace runtime services.\n",
              metadata: {
                runtimeServiceCount,
              },
            };
          },
        });

        return operation;
      },
      { params: t.Object({ id: t.String(), workspaceId: t.String(), action: t.String() }) },
    )

    // Delete workspace
    .delete(
      "/projects/:id/workspaces/:workspaceId",
      async (ctx: any) => {
        const { params, query, set } = ctx;
        const actor = ctx.actor as Actor;
        const resolvedId = await normalizeProjectReference(actor, query ?? {}, params.id);

        const existing = await svc.getById(resolvedId);
        if (!existing) {
          set.status = 404;
          return { error: "Project not found" };
        }
        assertCompanyAccess(actor, existing.companyId);
        const workspace = await svc.removeWorkspace(resolvedId, params.workspaceId);
        if (!workspace) {
          set.status = 404;
          return { error: "Project workspace not found" };
        }

        const actorInfo = getActorInfo(actor);
        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "project.workspace_deleted",
          entityType: "project",
          entityId: resolvedId,
          details: {
            workspaceId: workspace.id,
            name: workspace.name,
          },
        });

        return workspace;
      },
      { params: t.Object({ id: t.String(), workspaceId: t.String() }) },
    );
}
