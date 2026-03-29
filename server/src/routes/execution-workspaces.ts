/**
 * Execution workspaces routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { issues, projects, projectWorkspaces } from "@clawdev/db";
import { and, eq } from "drizzle-orm";
import { updateExecutionWorkspaceSchema } from "@clawdev/shared";
import { executionWorkspaceService, logActivity, workspaceOperationService } from "../services/index.js";
import { parseProjectExecutionWorkspacePolicy } from "../services/execution-workspace-policy.js";
import {
  cleanupExecutionWorkspaceArtifacts,
  stopRuntimeServicesForExecutionWorkspace,
} from "../services/workspace-runtime.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { companyIdParam } from "../middleware/index.js";

const TERMINAL_ISSUE_STATUSES = new Set(["done", "cancelled"]);

export function executionWorkspaceRoutes(db: Db) {
  const svc = executionWorkspaceService(db);
  const workspaceOperationsSvc = workspaceOperationService(db);

  return new Elysia()
    .get(
      "/companies/:companyId/execution-workspaces",
      async ({ params, query }) => {
        // TODO: wire actor from auth middleware
        const companyId = params.companyId;
        const workspaces = await svc.list(companyId, {
          projectId: query.projectId,
          projectWorkspaceId: query.projectWorkspaceId,
          issueId: query.issueId,
          status: query.status,
          reuseEligible: query.reuseEligible === "true",
        });
        return workspaces;
      },
      {
        params: companyIdParam,
        query: t.Object({
          projectId: t.Optional(t.String()),
          projectWorkspaceId: t.Optional(t.String()),
          issueId: t.Optional(t.String()),
          status: t.Optional(t.String()),
          reuseEligible: t.Optional(t.String()),
        }),
      },
    )

    .get(
      "/execution-workspaces/:id",
      async ({ params, set }) => {
        const workspace = await svc.getById(params.id);
        if (!workspace) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        return workspace;
      },
      { params: t.Object({ id: t.String() }) },
    )

    .patch(
      "/execution-workspaces/:id",
      async ({ params, body, set }) => {
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }

        const patch: Record<string, unknown> = {
          ...body,
          ...(body.cleanupEligibleAt ? { cleanupEligibleAt: new Date(body.cleanupEligibleAt) } : {}),
        };

        let workspace = existing;
        let cleanupWarnings: string[] = [];

        if (body.status === "archived" && existing.status !== "archived") {
          const linkedIssues = await db
            .select({ id: issues.id, status: issues.status })
            .from(issues)
            .where(and(eq(issues.companyId, existing.companyId), eq(issues.executionWorkspaceId, existing.id)));
          const activeLinkedIssues = linkedIssues.filter((issue) => !TERMINAL_ISSUE_STATUSES.has(issue.status));

          if (activeLinkedIssues.length > 0) {
            set.status = 409;
            return {
              error: `Cannot archive execution workspace while ${activeLinkedIssues.length} linked issue(s) are still open`,
            };
          }

          const closedAt = new Date();
          const archivedWorkspace = await svc.update(params.id, {
            ...patch,
            status: "archived",
            closedAt,
            cleanupReason: null,
          });
          if (!archivedWorkspace) {
            set.status = 404;
            return { error: "Execution workspace not found" };
          }
          workspace = archivedWorkspace;

          try {
            await stopRuntimeServicesForExecutionWorkspace({
              db,
              executionWorkspaceId: existing.id,
              workspaceCwd: existing.cwd,
            });
            const projectWorkspace = existing.projectWorkspaceId
              ? await db
                  .select({ cwd: projectWorkspaces.cwd, cleanupCommand: projectWorkspaces.cleanupCommand })
                  .from(projectWorkspaces)
                  .where(
                    and(
                      eq(projectWorkspaces.id, existing.projectWorkspaceId),
                      eq(projectWorkspaces.companyId, existing.companyId),
                    ),
                  )
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
              recorder: workspaceOperationsSvc.createRecorder({
                companyId: existing.companyId,
                executionWorkspaceId: existing.id,
              }),
            });
            cleanupWarnings = cleanupResult.warnings;
            const cleanupPatch: Record<string, unknown> = {
              closedAt,
              cleanupReason: cleanupWarnings.length > 0 ? cleanupWarnings.join(" | ") : null,
            };
            if (!cleanupResult.cleaned) {
              cleanupPatch.status = "cleanup_failed";
            }
            if (cleanupResult.warnings.length > 0 || !cleanupResult.cleaned) {
              workspace = (await svc.update(params.id, cleanupPatch)) ?? workspace;
            }
          } catch (error) {
            const failureReason = error instanceof Error ? error.message : String(error);
            workspace =
              (await svc.update(params.id, {
                status: "cleanup_failed",
                closedAt,
                cleanupReason: failureReason,
              })) ?? workspace;
            set.status = 500;
            return { error: `Failed to archive execution workspace: ${failureReason}` };
          }
        } else {
          const updatedWorkspace = await svc.update(params.id, patch);
          if (!updatedWorkspace) {
            set.status = 404;
            return { error: "Execution workspace not found" };
          }
          workspace = updatedWorkspace;
        }

        return workspace;
      },
      { params: t.Object({ id: t.String() }) },
    );
}
