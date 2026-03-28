import { Elysia } from "elysia";
import { and, eq } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { issues, projects, projectWorkspaces } from "@clawdev/db";
import { updateExecutionWorkspaceSchema } from "@clawdev/shared";
import { conflict, notFound } from "../errors.js";
import { executionWorkspaceService, logActivity, workspaceOperationService } from "../services/index.js";
import { parseProjectExecutionWorkspacePolicy } from "../services/execution-workspace-policy.js";
import {
  cleanupExecutionWorkspaceArtifacts,
  stopRuntimeServicesForExecutionWorkspace,
} from "../services/workspace-runtime.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { elysiaAuth } from "../elysia-plugins/auth.js";

const TERMINAL_ISSUE_STATUSES = new Set(["done", "cancelled"]);

export function elysiaExecutionWorkspaceRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = executionWorkspaceService(db);
  const workspaceOperationsSvc = workspaceOperationService(db);

  return new Elysia()
    .use(authPlugin)
    .get("/companies/:companyId/execution-workspaces", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const q = query as Record<string, string>;
      return svc.list(params.companyId, {
        projectId: q.projectId,
        projectWorkspaceId: q.projectWorkspaceId,
        issueId: q.issueId,
        status: q.status,
        reuseEligible: q.reuseEligible === "true",
      });
    })
    .get("/execution-workspaces/:id", async ({ params, actor }) => {
      const workspace = await svc.getById(params.id);
      if (!workspace) throw notFound("Execution workspace not found");
      assertCompanyAccess(actor, workspace.companyId);
      return workspace;
    })
    .patch("/execution-workspaces/:id", async ({ params, body, actor, set }) => {
      const parsed = updateExecutionWorkspaceSchema.parse(body) as Record<string, unknown>;
      const existing = await svc.getById(params.id);
      if (!existing) throw notFound("Execution workspace not found");
      assertCompanyAccess(actor, existing.companyId);

      const patch: Record<string, unknown> = {
        ...parsed,
        ...(parsed.cleanupEligibleAt ? { cleanupEligibleAt: new Date(parsed.cleanupEligibleAt as string) } : {}),
      };

      let workspace = existing;
      let cleanupWarnings: string[] = [];

      if (parsed.status === "archived" && existing.status !== "archived") {
        const linkedIssues = await db
          .select({ id: issues.id, status: issues.status })
          .from(issues)
          .where(and(eq(issues.companyId, existing.companyId), eq(issues.executionWorkspaceId, existing.id)));
        const activeLinkedIssues = linkedIssues.filter((issue) => !TERMINAL_ISSUE_STATUSES.has(issue.status));

        if (activeLinkedIssues.length > 0) {
          throw conflict(`Cannot archive execution workspace while ${activeLinkedIssues.length} linked issue(s) are still open`);
        }

        const closedAt = new Date();
        const archivedWorkspace = await svc.update(params.id, { ...patch, status: "archived", closedAt, cleanupReason: null });
        if (!archivedWorkspace) throw notFound("Execution workspace not found");
        workspace = archivedWorkspace;

        try {
          await stopRuntimeServicesForExecutionWorkspace({ db, executionWorkspaceId: existing.id, workspaceCwd: existing.cwd });
          const projectWorkspace = existing.projectWorkspaceId
            ? await db
                .select({ cwd: projectWorkspaces.cwd, cleanupCommand: projectWorkspaces.cleanupCommand })
                .from(projectWorkspaces)
                .where(and(eq(projectWorkspaces.id, existing.projectWorkspaceId), eq(projectWorkspaces.companyId, existing.companyId)))
                .then((rows) => rows[0] ?? null)
            : null;
          const projectPolicy = existing.projectId
            ? await db
                .select({ executionWorkspacePolicy: projects.executionWorkspacePolicy })
                .from(projects)
                .where(and(eq(projects.id, existing.projectId), eq(projects.companyId, existing.companyId)))
                .then((rows) => parseProjectExecutionWorkspacePolicy(rows[0]?.executionWorkspacePolicy))
            : null;
          const cleanupResult = await cleanupExecutionWorkspaceArtifacts({
            workspace: existing,
            projectWorkspace,
            teardownCommand: projectPolicy?.workspaceStrategy?.teardownCommand ?? null,
            recorder: workspaceOperationsSvc.createRecorder({ companyId: existing.companyId, executionWorkspaceId: existing.id }),
          });
          cleanupWarnings = cleanupResult.warnings;
          const cleanupPatch: Record<string, unknown> = { closedAt, cleanupReason: cleanupWarnings.length > 0 ? cleanupWarnings.join(" | ") : null };
          if (!cleanupResult.cleaned) cleanupPatch.status = "cleanup_failed";
          if (cleanupResult.warnings.length > 0 || !cleanupResult.cleaned) {
            workspace = (await svc.update(params.id, cleanupPatch)) ?? workspace;
          }
        } catch (error) {
          const failureReason = error instanceof Error ? error.message : String(error);
          workspace = (await svc.update(params.id, { status: "cleanup_failed", closedAt, cleanupReason: failureReason })) ?? workspace;
          set.status = 500;
          return { error: `Failed to archive execution workspace: ${failureReason}` };
        }
      } else {
        const updatedWorkspace = await svc.update(params.id, patch);
        if (!updatedWorkspace) throw notFound("Execution workspace not found");
        workspace = updatedWorkspace;
      }

      const actorInfo = getActorInfo(actor);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actorInfo.actorType,
        actorId: actorInfo.actorId,
        agentId: actorInfo.agentId,
        runId: actorInfo.runId,
        action: "execution_workspace.updated",
        entityType: "execution_workspace",
        entityId: workspace.id,
        details: {
          changedKeys: Object.keys(parsed).sort(),
          ...(cleanupWarnings.length > 0 ? { cleanupWarnings } : {}),
        },
      });
      return workspace;
    });
}
