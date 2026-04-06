import { pgTable, uuid, text, timestamp, jsonb, integer, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentTeams } from "./agent_teams.js";
import { issues } from "./issues.js";

/**
 * Pipeline step shape (stored in `steps` jsonb array):
 * {
 *   agentId: string;
 *   action: string;           // e.g. "review", "implement", "test", "deploy"
 *   dependsOn: number[];      // indexes of steps this depends on
 *   config?: Record<string, unknown>;
 * }
 */

export const agentPipelines = pgTable(
  "agent_pipelines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => agentTeams.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    steps: jsonb("steps").$type<PipelineStep[]>().notNull().default([]),
    triggerType: text("trigger_type").notNull().default("manual"),
    status: text("status").notNull().default("draft"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_pipelines_company_idx").on(table.companyId, table.status),
    teamIdx: index("agent_pipelines_team_idx").on(table.teamId),
  }),
);

export const pipelineExecutions = pgTable(
  "pipeline_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id").notNull().references(() => agentPipelines.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    triggeredByAgentId: uuid("triggered_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    triggeredByUserId: text("triggered_by_user_id"),
    status: text("status").notNull().default("running"),
    currentStep: integer("current_step").notNull().default(0),
    stepResults: jsonb("step_results").$type<StepResult[]>().notNull().default([]),
    context: jsonb("context").$type<Record<string, unknown>>().default({}),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    pipelineIdx: index("pipeline_executions_pipeline_idx").on(table.pipelineId, table.status),
    companyIdx: index("pipeline_executions_company_idx").on(table.companyId, table.startedAt),
  }),
);

export interface PipelineStep {
  agentId: string;
  action: string;
  dependsOn: number[];
  config?: Record<string, unknown>;
}

export interface StepResult {
  stepIndex: number;
  agentId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}
