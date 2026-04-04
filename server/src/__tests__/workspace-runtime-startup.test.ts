import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { executionWorkspaces, projectWorkspaces } from "@clawdev/db";
import { restartDesiredRuntimeServicesOnStartup } from "../services/workspace-runtime.ts";

type SelectableRow =
  | typeof projectWorkspaces.$inferSelect
  | typeof executionWorkspaces.$inferSelect;

function createDbStub(rows: {
  projectWorkspaces: Array<typeof projectWorkspaces.$inferSelect>;
  executionWorkspaces: Array<typeof executionWorkspaces.$inferSelect>;
}) {
  return {
    select() {
      return {
        from(table: unknown) {
          if (table === projectWorkspaces) return Promise.resolve(rows.projectWorkspaces);
          if (table === executionWorkspaces) return Promise.resolve(rows.executionWorkspaces);
          return Promise.resolve([] as SelectableRow[]);
        },
      };
    },
  } as never;
}

describe("restartDesiredRuntimeServicesOnStartup", () => {
  it("restarts desired runtime services for a project workspace", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const projectWorkspaceId = randomUUID();

    const db = createDbStub({
      projectWorkspaces: [
        {
          id: projectWorkspaceId,
          companyId,
          projectId,
          name: "Primary workspace",
          sourceType: "local_path",
          cwd: "/tmp/clawdev-runtime-project",
          repoUrl: null,
          repoRef: null,
          defaultRef: null,
          visibility: "default",
          setupCommand: null,
          cleanupCommand: null,
          remoteProvider: null,
          remoteWorkspaceRef: null,
          sharedWorkspaceKey: null,
          metadata: {
            runtimeConfig: {
              desiredState: "running",
              workspaceRuntime: { services: [] },
            },
          },
          isPrimary: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      executionWorkspaces: [],
    });

    const calls: Array<{ workspaceId: string | null }> = [];
    const result = await restartDesiredRuntimeServicesOnStartup(db, {
      startRuntimeServicesForWorkspaceControl: async (input) => {
        calls.push({ workspaceId: input.workspace.workspaceId });
        return [
          {
            id: randomUUID(),
            companyId: input.actor.companyId,
            projectId: input.workspace.projectId,
            projectWorkspaceId: input.workspace.workspaceId,
            executionWorkspaceId: input.executionWorkspaceId ?? null,
            issueId: input.issue?.id ?? null,
            serviceName: "web",
            status: "running",
            lifecycle: "shared",
            scopeType: "project_workspace",
            scopeId: input.workspace.workspaceId,
            reuseKey: null,
            command: null,
            cwd: input.workspace.cwd,
            port: null,
            url: null,
            provider: "local_process",
            providerRef: null,
            ownerAgentId: null,
            startedByRunId: null,
            lastUsedAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            stoppedAt: null,
            stopPolicy: null,
            healthStatus: "healthy",
            reused: false,
          },
        ] as never;
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workspaceId).toBe(projectWorkspaceId);
    expect(result).toEqual({ restarted: 1, failed: 0 });
  });

  it("restarts desired runtime services for an execution workspace", async () => {
    const companyId = randomUUID();
    const projectId = randomUUID();
    const projectWorkspaceId = randomUUID();
    const executionWorkspaceId = randomUUID();

    const db = createDbStub({
      projectWorkspaces: [],
      executionWorkspaces: [
        {
          id: executionWorkspaceId,
          companyId,
          projectId,
          projectWorkspaceId,
          sourceIssueId: null,
          mode: "isolated_workspace",
          strategyType: "git_worktree",
          name: "Execution workspace",
          status: "active",
          cwd: "/tmp/clawdev-runtime-execution",
          repoUrl: null,
          baseRef: null,
          branchName: "clawdev/runtime-startup",
          providerType: "local_fs",
          providerRef: "/tmp/clawdev-runtime-execution",
          derivedFromExecutionWorkspaceId: null,
          lastUsedAt: new Date(),
          openedAt: new Date(),
          closedAt: null,
          cleanupEligibleAt: null,
          cleanupReason: null,
          metadata: {
            config: {
              desiredState: "running",
              workspaceRuntime: { services: [] },
            },
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const calls: Array<{ workspaceId: string | null }> = [];
    const result = await restartDesiredRuntimeServicesOnStartup(db, {
      startRuntimeServicesForWorkspaceControl: async (input) => {
        calls.push({ workspaceId: input.workspace.workspaceId });
        return [
          {
            id: randomUUID(),
            companyId: input.actor.companyId,
            projectId: input.workspace.projectId,
            projectWorkspaceId: input.workspace.workspaceId,
            executionWorkspaceId: input.executionWorkspaceId ?? null,
            issueId: input.issue?.id ?? null,
            serviceName: "web",
            status: "running",
            lifecycle: "shared",
            scopeType: "project_workspace",
            scopeId: input.workspace.workspaceId,
            reuseKey: null,
            command: null,
            cwd: input.workspace.cwd,
            port: null,
            url: null,
            provider: "local_process",
            providerRef: null,
            ownerAgentId: null,
            startedByRunId: null,
            lastUsedAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            stoppedAt: null,
            stopPolicy: null,
            healthStatus: "healthy",
            reused: false,
          },
        ] as never;
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.workspaceId).toBe(projectWorkspaceId);
    expect(result).toEqual({ restarted: 1, failed: 0 });
  });
});
