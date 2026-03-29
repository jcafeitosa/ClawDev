import {
  pgTable,
  uuid,
  text,
  smallint,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";

export const routingDecisions = pgTable(
  "routing_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runId: uuid("run_id").notNull(),
    agentId: uuid("agent_id").notNull().references(() => agents.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    selectedAdapterType: text("selected_adapter_type").notNull(),
    selectedModel: text("selected_model").notNull(),
    tier: smallint("tier").notNull(),
    reasoning: text("reasoning").notNull(),
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }),
    complexityScore: numeric("complexity_score", { precision: 3, scale: 2 }).notNull(),
    alternativesConsidered: jsonb("alternatives_considered").notNull().default([]),
    taskSignals: jsonb("task_signals").notNull().default({}),
    constraintsSnapshot: jsonb("constraints_snapshot").notNull().default({}),
    routingLatencyMs: integer("routing_latency_ms").notNull(),
    isFailover: boolean("is_failover").notNull().default(false),
    failoverReason: text("failover_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runIdx: index("idx_routing_decisions_run").on(table.runId),
    agentCreatedAtIdx: index("idx_routing_decisions_agent").on(table.agentId, table.createdAt),
    companyCreatedAtIdx: index("idx_routing_decisions_company").on(table.companyId, table.createdAt),
  }),
);
