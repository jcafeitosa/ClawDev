import { describe, expect, it, vi } from "vitest";
import {
  agents,
  approvals,
  companySkills,
  companies,
  executionWorkspaces,
  heartbeatRuns,
  issues,
  pluginJobs,
  pluginWebhookDeliveries,
  plugins,
  projects,
  routines,
  workspaceOperations,
} from "@clawdev/db";
import { buildSystemReport } from "../services/system-report.js";

function createDbStub(counts: Map<unknown, number>) {
  return {
    select: vi.fn(() => {
      let table: unknown;
      const resolveCount = (resolve: (rows: Array<{ count: number }>) => unknown) =>
        Promise.resolve(resolve([{ count: counts.get(table) ?? 0 }]));
      return {
        from(nextTable: unknown) {
          table = nextTable;
          return {
            then: resolveCount,
            where() {
              return { then: resolveCount };
            },
          };
        },
      };
    }),
  } as any;
}

describe("system report", () => {
  it("aggregates route groups and surface counts", async () => {
    const counts = new Map<unknown, number>([
      [companies, 3],
      [agents, 4],
      [projects, 5],
      [issues, 6],
      [routines, 7],
      [companySkills, 8],
      [approvals, 9],
      [plugins, 10],
      [pluginJobs, 11],
      [pluginWebhookDeliveries, 12],
      [executionWorkspaces, 13],
      [workspaceOperations, 14],
      [heartbeatRuns, 15],
    ]);

    const report = await buildSystemReport(createDbStub(counts));

    expect(report.routeGroups.map((group) => group.key)).toEqual(["core", "operations", "governance", "extensions"]);
    expect(report.counts).toEqual({
      companies: 3,
      agents: 4,
      projects: 5,
      issues: 6,
      routines: 7,
      companySkills: 8,
      approvals: 9,
      plugins: 10,
      pluginJobs: 11,
      pluginWebhooks: 12,
      executionWorkspaces: 13,
      workspaceOperations: 14,
      activeHeartbeatRuns: 15,
    });
  });
});
