import { pgTable, uuid, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";

export const providerModelStatus = pgTable(
  "provider_model_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adapterType: text("adapter_type").notNull(),
    modelId: text("model_id").notNull(),
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
    adapterModelUniqueIdx: uniqueIndex("provider_model_status_adapter_model_idx").on(
      table.adapterType,
      table.modelId,
    ),
    statusIdx: index("provider_model_status_status_idx").on(table.status),
    cooldownUntilIdx: index("provider_model_status_cooldown_until_idx").on(table.cooldownUntil),
  }),
);
