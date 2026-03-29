import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const providerConfigs = pgTable(
  "provider_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    adapterType: varchar("adapter_type", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    authMethod: varchar("auth_method", { length: 32 }).notNull().default("none"),
    credentialSecretId: uuid("credential_secret_id"),
    subscriptionPlan: varchar("subscription_plan", { length: 64 }),
    subscriptionLimitMonthly: integer("subscription_limit_monthly"),
    subscriptionResetsAt: timestamp("subscription_resets_at", { withTimezone: true }),
    lastHealthCheck: timestamp("last_health_check", { withTimezone: true }),
    lastHealthStatus: varchar("last_health_status", { length: 32 }),
    lastHealthDetail: text("last_health_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAdapterUniqueIdx: uniqueIndex("provider_configs_company_adapter_unique_idx").on(
      table.companyId,
      table.adapterType,
    ),
  }),
);
