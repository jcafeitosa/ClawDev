import { count, eq, inArray } from "drizzle-orm";
import type { Db } from "@clawdev/db";
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

export interface RouteGroupReport {
  key: string;
  label: string;
  modules: string[];
}

export interface SystemSurfaceCounts {
  companies: number;
  agents: number;
  projects: number;
  issues: number;
  routines: number;
  companySkills: number;
  approvals: number;
  plugins: number;
  pluginJobs: number;
  pluginWebhooks: number;
  executionWorkspaces: number;
  workspaceOperations: number;
  activeHeartbeatRuns: number;
}

export interface SystemReport {
  routeGroups: RouteGroupReport[];
  counts: SystemSurfaceCounts;
}

const ROUTE_GROUPS: RouteGroupReport[] = [
  {
    key: "core",
    label: "Core Control Plane",
    modules: ["companies", "agents", "issues", "projects", "goals", "access", "activity"],
  },
  {
    key: "operations",
    label: "Operations",
    modules: ["runs", "execution-workspaces", "workspace-operations", "inbox", "sidebar-badges", "dashboard"],
  },
  {
    key: "governance",
    label: "Governance",
    modules: ["approvals", "budgets", "instance-settings", "models"],
  },
  {
    key: "extensions",
    label: "Extensions",
    modules: ["plugins", "plugin-ui", "assets", "documents", "company-skills", "search", "llms"],
  },
];

async function countRows(db: Db, table: { id: unknown }) {
  const rows = (await db.select({ count: count() }).from(table as never)) as Array<{ count: number }>;
  return Number(rows[0]?.count ?? 0);
}

async function countHeartbeatRuns(db: Db): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(heartbeatRuns)
    .where(inArray(heartbeatRuns.status, ["queued", "running"]));
  return Number(row?.count ?? 0);
}

export async function buildSystemReport(db: Db): Promise<SystemReport> {
  const [
    companyCount,
    agentCount,
    projectCount,
    issueCount,
    routineCount,
    skillCount,
    approvalCount,
    pluginCount,
    pluginJobCount,
    pluginWebhookCount,
    executionWorkspaceCount,
    workspaceOperationCount,
    activeHeartbeatRunCount,
  ] = await Promise.all([
    countRows(db, companies),
    countRows(db, agents),
    countRows(db, projects),
    countRows(db, issues),
    countRows(db, routines),
    countRows(db, companySkills),
    countRows(db, approvals),
    countRows(db, plugins),
    countRows(db, pluginJobs),
    countRows(db, pluginWebhookDeliveries),
    countRows(db, executionWorkspaces),
    countRows(db, workspaceOperations),
    countHeartbeatRuns(db),
  ]);

  return {
    routeGroups: ROUTE_GROUPS,
    counts: {
      companies: companyCount,
      agents: agentCount,
      projects: projectCount,
      issues: issueCount,
      routines: routineCount,
      companySkills: skillCount,
      approvals: approvalCount,
      plugins: pluginCount,
      pluginJobs: pluginJobCount,
      pluginWebhooks: pluginWebhookCount,
      executionWorkspaces: executionWorkspaceCount,
      workspaceOperations: workspaceOperationCount,
      activeHeartbeatRuns: activeHeartbeatRunCount,
    },
  };
}
