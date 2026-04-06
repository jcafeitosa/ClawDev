import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentTeams } from "./agent_teams.js";
import { issues } from "./issues.js";

export const teamTasks = pgTable(
  "team_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => agentTeams.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"),
    assignedAgentId: uuid("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
    claimedByAgentId: uuid("claimed_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByAgentId: uuid("created_by_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    priority: text("priority").notNull().default("medium"),
    dependsOnTaskIds: uuid("depends_on_task_ids").array().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    teamStatusIdx: index("team_tasks_team_status_idx").on(table.teamId, table.status),
    assignedIdx: index("team_tasks_assigned_idx").on(table.assignedAgentId, table.status),
  }),
);
