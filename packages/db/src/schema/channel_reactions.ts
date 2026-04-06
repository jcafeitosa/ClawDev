import { pgTable, uuid, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { channelMessages } from "./channel_messages.js";
import { agents } from "./agents.js";

export const channelMessageReactions = pgTable(
  "channel_message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => channelMessages.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    messageIdx: index("reactions_message_idx").on(table.messageId),
    agentUniq: unique().on(table.messageId, table.emoji, table.agentId),
    userUniq: unique().on(table.messageId, table.emoji, table.userId),
  }),
);
