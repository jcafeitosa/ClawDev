import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const providerModelStatus = pgTable(
  "provider_model_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adapterType: text("adapter_type").notNull(),
    modelId: text("model_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id),
    authProfileKey: text("auth_profile_key"),
    scopeKey: text("scope_key").notNull().default("global"),
    status: text("status").notNull().default("unknown"),
    statusDetail: text("status_detail"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
    cooldownReason: text("cooldown_reason"),
    lastProbeStatus: text("last_probe_status"),
    lastProbeAt: timestamp("last_probe_at", { withTimezone: true }),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    avgLatencyMs: integer("avg_latency_ms"),
    p95LatencyMs: integer("p95_latency_ms"),
    errorRatePercent: integer("error_rate_percent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    adapterModelScopeUniqueIdx: uniqueIndex("provider_model_status_adapter_model_scope_idx").on(
      table.adapterType,
      table.modelId,
      table.scopeKey,
    ),
    companyIdx: index("provider_model_status_company_idx").on(table.companyId),
    scopeIdx: index("provider_model_status_scope_idx").on(table.scopeKey),
    statusIdx: index("provider_model_status_status_idx").on(table.status),
    cooldownUntilIdx: index("provider_model_status_cooldown_until_idx").on(table.cooldownUntil),
  }),
);
