import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const modelRoutingLog = pgTable(
  "model_routing_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    agentId: uuid("agent_id").references(() => agents.id),
    heartbeatRunId: uuid("heartbeat_run_id"),
    requestedModelId: text("requested_model_id"),
    requestedAdapterType: text("requested_adapter_type"),
    authProfileKey: text("auth_profile_key"),
    outcome: text("outcome"),
    resolvedModelId: text("resolved_model_id").notNull(),
    resolvedAdapterType: text("resolved_adapter_type").notNull(),
    resolution: text("resolution").notNull(),
    fallbackDepth: integer("fallback_depth").notNull().default(0),
    reason: text("reason"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    companyOccurredIdx: index("model_routing_log_company_occurred_idx").on(
      table.companyId,
      table.occurredAt,
    ),
    agentOccurredIdx: index("model_routing_log_agent_occurred_idx").on(
      table.agentId,
      table.occurredAt,
    ),
  }),
);
