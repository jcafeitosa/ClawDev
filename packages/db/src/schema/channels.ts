import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentTeams } from "./agent_teams.js";
import { projects } from "./projects.js";

export const CHANNEL_TYPES = ["general", "public", "private", "team", "department", "direct", "topic", "external"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export const BRIDGE_TYPES = ["internal", "telegram", "whatsapp", "slack", "discord", "webhook"] as const;
export type BridgeType = (typeof BRIDGE_TYPES)[number];

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    topic: text("topic"),
    type: text("type").notNull().default("public"),
    teamId: uuid("team_id").references(() => agentTeams.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    isPrivate: boolean("is_private").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    bridgeType: text("bridge_type").notNull().default("internal"),
    bridgeConfig: jsonb("bridge_config").$type<Record<string, unknown>>().default({}),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    memberCount: integer("member_count").notNull().default(0),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyTypeIdx: index("channels_company_type_idx").on(table.companyId, table.type),
    teamIdx: index("channels_team_idx").on(table.teamId),
    companyLastMsgIdx: index("channels_company_last_msg_idx").on(table.companyId, table.lastMessageAt),
    companySlugUniq: uniqueIndex("channels_company_slug_uniq").on(table.companyId, table.slug),
  }),
);
