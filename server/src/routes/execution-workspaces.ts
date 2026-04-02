/**
 * Execution workspaces routes — Elysia port.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { issues, projects, projectWorkspaces } from "@clawdev/db";
import { and, eq } from "drizzle-orm";
import { updateExecutionWorkspaceSchema, type ExecutionWorkspaceConfig } from "@clawdev/shared";
import { executionWorkspaceService, logActivity, workspaceOperationService } from "../services/index.js";
import { parseProjectExecutionWorkspacePolicy } from "../services/execution-workspace-policy.js";
import { mergeExecutionWorkspaceConfig } from "../services/execution-workspaces.js";
import { readProjectWorkspaceRuntimeConfig } from "../services/project-workspace-runtime-config.js";
import {
  cleanupExecutionWorkspaceArtifacts,
  startRuntimeServicesForWorkspaceControl,
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
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor: Actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
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
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        const workspace = await svc.getById(params.id);
        if (!workspace) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        assertCompanyAccess(actor, workspace.companyId);
        return workspace;
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/execution-workspaces/:id/close-readiness",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        const workspace = await svc.getById(params.id);
        if (!workspace) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        assertCompanyAccess(actor, workspace.companyId);
        const readiness = await svc.getCloseReadiness(params.id);
        if (!readiness) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        return readiness;
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/execution-workspaces/:id/workspace-operations",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        const workspace = await svc.getById(params.id);
        if (!workspace) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        assertCompanyAccess(actor, workspace.companyId);
        return workspaceOperationsSvc.listForExecutionWorkspace(params.id);
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/execution-workspaces/:id/runtime-services/:action",
      async (ctx: any) => {
        const { params, set } = ctx;
        const actor = ctx.actor as Actor;
        const action = String(params.action ?? "").trim().toLowerCase();
        if (action !== "start" && action !== "stop" && action !== "restart") {
          set.status = 404;
          return { error: "Runtime service action not found" };
        }

        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        assertCompanyAccess(actor, existing.companyId);

        const workspaceCwd = existing.cwd;
        if (!workspaceCwd) {
          set.status = 422;
          return { error: "Execution workspace needs a local path before ClawDev can manage local runtime services" };
        }

        const projectWorkspace = existing.projectWorkspaceId
          ? await db
              .select({
                cwd: projectWorkspaces.cwd,
                metadata: projectWorkspaces.metadata,
              })
              .from(projectWorkspaces)
              .where(
                and(
                  eq(projectWorkspaces.id, existing.projectWorkspaceId),
                  eq(projectWorkspaces.companyId, existing.companyId),
                ),
              )
              .then((rows) => rows[0] ?? null)
          : null;
        const projectWorkspaceRuntime = readProjectWorkspaceRuntimeConfig(
          (projectWorkspace?.metadata as Record<string, unknown> | null) ?? null,
        )?.workspaceRuntime ?? null;
        const effectiveRuntimeConfig = existing.config?.workspaceRuntime ?? projectWorkspaceRuntime ?? null;
        if ((action === "start" || action === "restart") && !effectiveRuntimeConfig) {
          set.status = 422;
          return { error: "Execution workspace has no runtime service configuration" };
        }

        const recorder = workspaceOperationsSvc.createRecorder({
          companyId: existing.companyId,
          executionWorkspaceId: existing.id,
        });
        let runtimeServiceCount = 0;
        const stdout: string[] = [];
        const stderr: string[] = [];

        const operation = await recorder.recordOperation({
          phase: action === "stop" ? "workspace_teardown" : "workspace_provision",
          command: `workspace runtime ${action}`,
          cwd: existing.cwd,
          metadata: {
            action,
            executionWorkspaceId: existing.id,
          },
          run: async () => {
            const onLog = async (stream: "stdout" | "stderr", chunk: string) => {
              if (stream === "stdout") stdout.push(chunk);
              else stderr.push(chunk);
            };

            if (action === "stop" || action === "restart") {
              await stopRuntimeServicesForExecutionWorkspace({
                db,
                executionWorkspaceId: existing.id,
                workspaceCwd,
              });
            }

            if (action === "start" || action === "restart") {
              const startedServices = await startRuntimeServicesForWorkspaceControl({
                db,
                actor: {
                  id: actor.agentId ?? actor.userId ?? "board",
                  name: actor.type === "board" ? "Board" : "Agent",
                  companyId: existing.companyId,
                },
                issue: existing.sourceIssueId
                  ? {
                      id: existing.sourceIssueId,
                      identifier: null,
                      title: existing.name,
                    }
                  : null,
                workspace: {
                  baseCwd: workspaceCwd,
                  source: existing.mode === "shared_workspace" ? "project_primary" : "task_session",
                  projectId: existing.projectId,
                  workspaceId: existing.projectWorkspaceId,
                  repoUrl: existing.repoUrl,
                  repoRef: existing.baseRef,
                  strategy: existing.strategyType === "git_worktree" ? "git_worktree" : "project_primary",
                  cwd: workspaceCwd,
                  branchName: existing.branchName,
                  worktreePath: existing.strategyType === "git_worktree" ? workspaceCwd : null,
                  warnings: [],
                  created: false,
                },
                executionWorkspaceId: existing.id,
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
                  ? "Stopped execution workspace runtime services.\n"
                  : action === "restart"
                    ? "Restarted execution workspace runtime services.\n"
                    : "Started execution workspace runtime services.\n",
              metadata: {
                runtimeServiceCount,
              },
            };
          },
        });

        return operation;
      },
      { params: t.Object({ id: t.String(), action: t.String() }) },
    )

    .patch(
      "/execution-workspaces/:id",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Execution workspace not found" };
        }
        assertCompanyAccess(actor, existing.companyId);

        const typedBody = body as Record<string, unknown>;
        const requestedMetadata =
          typedBody.metadata !== undefined
            ? (typedBody.metadata as Record<string, unknown> | null)
            : (existing.metadata as Record<string, unknown> | null);
        const metadata = typedBody.config !== undefined
          ? mergeExecutionWorkspaceConfig(requestedMetadata, typedBody.config as Partial<ExecutionWorkspaceConfig> | null)
          : requestedMetadata;
        const { config: _config, metadata: _metadata, ...restBody } = typedBody;
        const patch: Record<string, unknown> = {
          ...restBody,
          ...(typedBody.cleanupEligibleAt ? { cleanupEligibleAt: new Date(typedBody.cleanupEligibleAt as string) } : {}),
          metadata,
        };

        let workspace = existing;
        let cleanupWarnings: string[] = [];

        if (typedBody.status === "archived" && existing.status !== "archived") {
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
