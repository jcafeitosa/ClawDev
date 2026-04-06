import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { channels } from "./channels.js";
import { agents } from "./agents.js";
import { channelMessages } from "./channel_messages.js";

export const channelReadCursors = pgTable(
  "channel_read_cursors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    lastReadMessageId: uuid("last_read_message_id").references(() => channelMessages.id, { onDelete: "set null" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentUniq: uniqueIndex("read_cursors_agent_uniq").on(table.channelId, table.agentId).where(sql`agent_id IS NOT NULL`),
    userUniq: uniqueIndex("read_cursors_user_uniq").on(table.channelId, table.userId).where(sql`user_id IS NOT NULL`),
  }),
);
