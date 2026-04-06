import { type AnyPgColumn, pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentTeams } from "./agent_teams.js";

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    fromAgentId: uuid("from_agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    toAgentId: uuid("to_agent_id").references(() => agents.id, { onDelete: "set null" }),
    toTeamId: uuid("to_team_id").references(() => agentTeams.id, { onDelete: "set null" }),
    threadId: uuid("thread_id"),
    parentMessageId: uuid("parent_message_id").references((): AnyPgColumn => agentMessages.id, { onDelete: "set null" }),
    messageType: text("message_type").notNull().default("chat"),
    subject: text("subject"),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    toAgentIdx: index("agent_messages_to_agent_idx").on(table.toAgentId, table.createdAt),
    toTeamIdx: index("agent_messages_to_team_idx").on(table.toTeamId, table.createdAt),
    threadIdx: index("agent_messages_thread_idx").on(table.threadId, table.createdAt),
    companyIdx: index("agent_messages_company_idx").on(table.companyId, table.createdAt),
  }),
);
