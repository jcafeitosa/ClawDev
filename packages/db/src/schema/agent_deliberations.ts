import { pgTable, uuid, text, timestamp, jsonb, integer, index, unique } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { agentTeams } from "./agent_teams.js";
import { issues } from "./issues.js";

export const agentDeliberations = pgTable(
  "agent_deliberations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => agentTeams.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    topic: text("topic").notNull(),
    description: text("description"),
    status: text("status").notNull().default("open"),
    decisionType: text("decision_type").notNull().default("majority_vote"),
    deadline: timestamp("deadline", { withTimezone: true }),
    decision: text("decision"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id"),
    participantAgentIds: uuid("participant_agent_ids").array().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("agent_deliberations_company_idx").on(table.companyId, table.status),
    teamIdx: index("agent_deliberations_team_idx").on(table.teamId),
  }),
);

export const agentDeliberationVotes = pgTable(
  "agent_deliberation_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliberationId: uuid("deliberation_id").notNull().references(() => agentDeliberations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    position: text("position").notNull().default("abstain"),
    reasoning: text("reasoning").notNull(),
    weight: integer("weight").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deliberationIdx: index("delib_votes_deliberation_idx").on(table.deliberationId),
    uniqueVote: unique().on(table.deliberationId, table.agentId),
  }),
);
