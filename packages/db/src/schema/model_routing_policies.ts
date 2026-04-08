import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const modelRoutingPolicies = pgTable(
  "model_routing_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    role: text("role"),
    complexity: text("complexity").notNull().default("any"),
    name: text("name").notNull(),
    description: text("description"),
    routingStrategy: text("routing_strategy").notNull().default("pinned"),
    defaultAdapterType: text("default_adapter_type"),
    defaultModelId: text("default_model_id"),
    fallbackChain: jsonb("fallback_chain")
      .$type<{ adapterType: string; modelId: string }[]>()
      .notNull()
      .default([]),
    allowCrossProviderFallback: boolean("allow_cross_provider_fallback").notNull().default(true),
    preferFreeModels: boolean("prefer_free_models").notNull().default(false),
    preferLocalModels: boolean("prefer_local_models").notNull().default(false),
    maxCostPerRequestMicro: integer("max_cost_per_request_micro"),
    requiredCapabilities: jsonb("required_capabilities").$type<string[]>().notNull().default([]),
    minContextWindow: integer("min_context_window"),
    maxLatencyMs: integer("max_latency_ms"),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyPriorityIdx: index("model_routing_policies_company_priority_idx").on(
      table.companyId,
      table.priority,
    ),
    companyAgentIdx: index("model_routing_policies_company_agent_idx").on(table.companyId, table.agentId),
    companyRoleComplexityIdx: index("model_routing_policies_company_role_complexity_idx").on(
      table.companyId,
      table.role,
      table.complexity,
    ),
    companyUniqueIdx: uniqueIndex("model_routing_policies_company_name_uniq").on(
      table.companyId,
      table.name,
    ),
  }),
);
