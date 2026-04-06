import { pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { channels } from "./channels.js";
import { agents } from "./agents.js";

export const CHANNEL_MEMBER_ROLES = ["owner", "admin", "member", "readonly"] as const;
export type ChannelMemberRole = (typeof CHANNEL_MEMBER_ROLES)[number];

export const NOTIFICATION_PREFS = ["all", "mentions", "nothing"] as const;

export const channelMembers = pgTable(
  "channel_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    role: text("role").notNull().default("member"),
    nickname: text("nickname"),
    notificationPref: text("notification_pref").notNull().default("all"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  },
  (table) => ({
    channelActiveIdx: index("channel_members_channel_idx").on(table.channelId),
    agentActiveIdx: index("channel_members_agent_idx").on(table.agentId),
    agentUniq: uniqueIndex("channel_members_agent_uniq").on(table.channelId, table.agentId).where(sql`left_at IS NULL AND agent_id IS NOT NULL`),
    userUniq: uniqueIndex("channel_members_user_uniq").on(table.channelId, table.userId).where(sql`left_at IS NULL AND user_id IS NOT NULL`),
  }),
);
