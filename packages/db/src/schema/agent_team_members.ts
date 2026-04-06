import { pgTable, uuid, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { agentTeams } from "./agent_teams.js";
import { agents } from "./agents.js";
import { sql } from "drizzle-orm";

export const agentTeamMembers = pgTable(
  "agent_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id").notNull().references(() => agentTeams.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    addedByAgentId: uuid("added_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    addedByUserId: text("added_by_user_id"),
  },
  (table) => ({
    teamIdx: index("agent_team_members_team_idx").on(table.teamId, table.removedAt),
    agentIdx: index("agent_team_members_agent_idx").on(table.agentId, table.removedAt),
  }),
);
