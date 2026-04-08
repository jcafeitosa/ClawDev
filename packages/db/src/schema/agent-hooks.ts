import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

export type AgentHookEvent =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "task.checkout"
  | "task.completed"
  | "task.blocked"
  | "delegation.created"
  | "delegation.completed"
  | "message.received"
  | "channel.message_received"
  | "heartbeat"
  | "hire.approved"
  | "escalation.triggered";

export type AgentHookType =
  | "webhook"
  | "wake_agent"
  | "create_issue"
  | "notify_channel";

export type AgentHookRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "timed_out"
  | "skipped";

// ---------------------------------------------------------------------------
// agent_hooks
// ---------------------------------------------------------------------------

export const agentHooks = pgTable(
  "agent_hooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    event: text("event").notNull().$type<AgentHookEvent>(),
    hookType: text("hook_type").notNull().$type<AgentHookType>(),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    conditions: jsonb("conditions")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    runAsync: boolean("run_async").notNull().default(false),
    timeoutMs: integer("timeout_ms").notNull().default(30000),
    retryCount: integer("retry_count").notNull().default(0),
    retryDelayMs: integer("retry_delay_ms").notNull().default(1000),
    createdByAgentId: uuid("created_by_agent_id").references(
      () => agents.id,
      { onDelete: "set null" },
    ),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_hooks_company_idx").on(table.companyId),
    agentIdx: index("agent_hooks_agent_idx").on(table.agentId),
    agentEventIdx: index("agent_hooks_agent_event_idx").on(
      table.agentId,
      table.event,
    ),
    companyEventIdx: index("agent_hooks_company_event_idx").on(
      table.companyId,
      table.event,
    ),
  }),
);

// ---------------------------------------------------------------------------
// agent_hook_runs
// ---------------------------------------------------------------------------

export const agentHookRuns = pgTable(
  "agent_hook_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hookId: uuid("hook_id")
      .notNull()
      .references(() => agentHooks.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    event: text("event").notNull().$type<AgentHookEvent>(),
    eventPayload: jsonb("event_payload").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("pending").$type<AgentHookRunStatus>(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    error: text("error"),
    attempt: integer("attempt").notNull().default(1),
    durationMs: integer("duration_ms"),
    triggeredByRunId: uuid("triggered_by_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    hookIdx: index("agent_hook_runs_hook_idx").on(table.hookId),
    agentIdx: index("agent_hook_runs_agent_idx").on(table.agentId),
    statusIdx: index("agent_hook_runs_status_idx").on(table.status),
  }),
);

// ---------------------------------------------------------------------------
// company_hook_templates
// ---------------------------------------------------------------------------

export const companyHookTemplates = pgTable(
  "company_hook_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    event: text("event").notNull().$type<AgentHookEvent>(),
    hookType: text("hook_type").notNull().$type<AgentHookType>(),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    conditions: jsonb("conditions")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    companyIdx: index("company_hook_templates_company_idx").on(table.companyId),
    companyNameUq: uniqueIndex("company_hook_templates_company_name_uq").on(
      table.companyId,
      table.name,
    ),
  }),
);
