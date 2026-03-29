import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const providerHealthEvents = pgTable(
  "provider_health_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    adapterType: varchar("adapter_type", { length: 64 }).notNull(),
    status: varchar("status", { length: 32 }).notNull(),
    detail: text("detail"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyAdapterOccurredIdx: index("provider_health_events_company_adapter_occurred_idx").on(
      table.companyId,
      table.adapterType,
      table.occurredAt,
    ),
  }),
);
