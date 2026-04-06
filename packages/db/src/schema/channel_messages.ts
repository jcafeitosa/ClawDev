import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { channels } from "./channels.js";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const channelMessages = pgTable(
  "channel_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),

    // Sender (polymorphic: agent, user, or external)
    senderAgentId: uuid("sender_agent_id").references(() => agents.id, { onDelete: "set null" }),
    senderUserId: text("sender_user_id"),
    senderExternalId: text("sender_external_id"),
    senderDisplayName: text("sender_display_name"),

    // Threading
    threadId: uuid("thread_id"),
    parentMessageId: uuid("parent_message_id").references((): AnyPgColumn => channelMessages.id, { onDelete: "set null" }),
    replyCount: integer("reply_count").notNull().default(0),
    lastReplyAt: timestamp("last_reply_at", { withTimezone: true }),

    // Content
    messageType: text("message_type").notNull().default("chat"),
    subject: text("subject"),
    body: text("body").notNull(),
    attachments: jsonb("attachments").$type<Attachment[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

    // Mentions
    mentionsAgentIds: uuid("mentions_agent_ids").array().default([]),
    mentionsChannel: boolean("mentions_channel").notNull().default(false),
    mentionsHere: boolean("mentions_here").notNull().default(false),

    // Pinning
    isPinned: boolean("is_pinned").notNull().default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedByAgentId: uuid("pinned_by_agent_id").references(() => agents.id, { onDelete: "set null" }),

    // State
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    channelCreatedIdx: index("channel_msgs_channel_created_idx").on(table.channelId, table.createdAt),
    threadIdx: index("channel_msgs_thread_idx").on(table.threadId, table.createdAt),
    companyIdx: index("channel_msgs_company_idx").on(table.companyId, table.createdAt),
    senderAgentIdx: index("channel_msgs_sender_agent_idx").on(table.senderAgentId, table.createdAt),
  }),
);

export interface Attachment {
  type: "file" | "image" | "link" | "code" | "snippet";
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  content?: string;
}
