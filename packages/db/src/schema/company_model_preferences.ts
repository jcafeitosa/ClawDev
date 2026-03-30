import { pgTable, uuid, text, integer, timestamp, boolean, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const companyModelPreferences = pgTable(
  "company_model_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    defaultAdapterType: text("default_adapter_type"),
    defaultModelId: text("default_model_id"),
    fallbackChain: jsonb("fallback_chain")
      .$type<{ adapterType: string; modelId: string }[]>()
      .notNull()
      .default([]),
    routingStrategy: text("routing_strategy").notNull().default("pinned"),
    allowCrossProviderFallback: boolean("allow_cross_provider_fallback").notNull().default(true),
    preferFreeModels: boolean("prefer_free_models").notNull().default(false),
    preferLocalModels: boolean("prefer_local_models").notNull().default(false),
    maxCostPerRequestMicro: integer("max_cost_per_request_micro"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUniqueIdx: uniqueIndex("company_model_preferences_company_idx").on(table.companyId),
  }),
);
