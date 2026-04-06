import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { channels } from "./channels.js";
import { agents } from "./agents.js";
import { channelMessages } from "./channel_messages.js";

export const channelBookmarks = pgTable(
  "channel_bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    emoji: text("emoji"),
    messageId: uuid("message_id").references(() => channelMessages.id, { onDelete: "set null" }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelIdx: index("bookmarks_channel_idx").on(table.channelId),
  }),
);
