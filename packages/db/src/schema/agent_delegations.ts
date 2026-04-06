import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import { teamTasks } from "./team_tasks.js";

export const agentDelegations = pgTable(
  "agent_delegations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fromAgentId: uuid("from_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    toAgentId: uuid("to_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    teamTaskId: uuid("team_task_id").references(() => teamTasks.id, { onDelete: "set null" }),
    delegationType: text("delegation_type").notNull().default("task"),
    status: text("status").notNull().default("pending"),
    instructions: text("instructions").notNull(),
    result: text("result"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    toIdx: index("agent_delegations_to_idx").on(table.toAgentId, table.status),
    fromIdx: index("agent_delegations_from_idx").on(table.fromAgentId, table.status),
    companyIdx: index("agent_delegations_company_idx").on(table.companyId, table.createdAt),
  }),
);
