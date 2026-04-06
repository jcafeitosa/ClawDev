import { pgTable, uuid, text, timestamp, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentTeams } from "./agent_teams.js";

export const teamKnowledge = pgTable(
  "team_knowledge",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => agentTeams.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array().notNull().default([]),
    authorAgentId: uuid("author_agent_id").references(() => agents.id, { onDelete: "set null" }),
    supersededById: uuid("superseded_by_id").references((): AnyPgColumn => teamKnowledge.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    teamIdx: index("team_knowledge_team_idx").on(table.teamId),
  }),
);
