/**
 * Embeddings table — stores vector embeddings for semantic search.
 *
 * Each row links an entity (issue, goal, activity) to its embedding vector.
 * Uses pgvector's vector type for efficient similarity search.
 *
 * Embedding model: text-embedding-3-small (1536 dimensions).
 */

import { pgTable, uuid, text, timestamp, index, customType } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

/**
 * Custom pgvector column type.
 * Drizzle doesn't have built-in vector support, so we define it manually.
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value) as number[];
  },
});

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // "issue" | "goal" | "activity"
    entityId: text("entity_id").notNull(),
    content: text("content").notNull(), // The text that was embedded
    embedding: vector("embedding").notNull(),
    model: text("model").notNull().default("text-embedding-3-small"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("embeddings_company_entity_idx").on(table.companyId, table.entityType, table.entityId),
    index("embeddings_company_type_idx").on(table.companyId, table.entityType),
  ],
);
