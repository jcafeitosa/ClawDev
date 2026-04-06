import { and, eq, desc, sql, isNull, asc } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentTeams, agentTeamMembers, agents, teamTasks } from "@clawdev/db";

export function agentTeamService(db: Db) {
  async function list(companyId: string) {
    const rows = await db
      .select({
        id: agentTeams.id,
        companyId: agentTeams.companyId,
        name: agentTeams.name,
        description: agentTeams.description,
        leadAgentId: agentTeams.leadAgentId,
        leadAgentName: agents.name,
        status: agentTeams.status,
        metadata: agentTeams.metadata,
        createdAt: agentTeams.createdAt,
        updatedAt: agentTeams.updatedAt,
        memberCount: sql<number>`count(${agentTeamMembers.id})::int`,
      })
      .from(agentTeams)
      .leftJoin(
        agentTeamMembers,
        and(
          eq(agentTeamMembers.teamId, agentTeams.id),
          isNull(agentTeamMembers.removedAt),
        ),
      )
      .leftJoin(agents, eq(agents.id, agentTeams.leadAgentId))
      .where(eq(agentTeams.companyId, companyId))
      .groupBy(agentTeams.id, agents.name)
      .orderBy(desc(agentTeams.createdAt));

    return rows;
  }

  async function getById(teamId: string) {
    const team = await db
      .select()
      .from(agentTeams)
      .where(eq(agentTeams.id, teamId))
      .then((rows) => rows[0] ?? null);

    if (!team) return null;

    const members = await db
      .select({
        id: agentTeamMembers.id,
        teamId: agentTeamMembers.teamId,
        agentId: agentTeamMembers.agentId,
        role: agentTeamMembers.role,
        joinedAt: agentTeamMembers.joinedAt,
        addedByAgentId: agentTeamMembers.addedByAgentId,
        addedByUserId: agentTeamMembers.addedByUserId,
        agentName: agents.name,
        agentRole: agents.role,
        agentStatus: agents.status,
      })
      .from(agentTeamMembers)
      .innerJoin(agents, eq(agents.id, agentTeamMembers.agentId))
      .where(
        and(
          eq(agentTeamMembers.teamId, teamId),
          isNull(agentTeamMembers.removedAt),
        ),
      );

    const taskCounts = await db
      .select({
        pending: sql<number>`count(*) filter (where ${teamTasks.status} = 'pending')::int`,
        inProgress: sql<number>`count(*) filter (where ${teamTasks.status} = 'in_progress')::int`,
        completed: sql<number>`count(*) filter (where ${teamTasks.status} = 'completed')::int`,
      })
      .from(teamTasks)
      .where(eq(teamTasks.teamId, teamId))
      .then((rows) => rows[0] ?? { pending: 0, inProgress: 0, completed: 0 });

    return { ...team, members, taskCounts };
  }

  async function create(
    companyId: string,
    data: {
      name: string;
      description?: string;
      leadAgentId?: string;
      memberAgentIds?: string[];
      metadata?: Record<string, unknown>;
    },
    createdBy: { agentId?: string; userId?: string },
  ) {
    const [team] = await db
      .insert(agentTeams)
      .values({
        companyId,
        name: data.name,
        description: data.description,
        leadAgentId: data.leadAgentId,
        createdByAgentId: createdBy.agentId,
        createdByUserId: createdBy.userId,
        metadata: data.metadata ?? {},
      })
      .returning();

    if (data.leadAgentId) {
      await db.insert(agentTeamMembers).values({
        teamId: team.id,
        agentId: data.leadAgentId,
        role: "lead",
        addedByAgentId: createdBy.agentId,
        addedByUserId: createdBy.userId,
      });
    }

    if (data.memberAgentIds?.length) {
      const memberIds = data.memberAgentIds.filter((id) => id !== data.leadAgentId);
      if (memberIds.length > 0) {
        await db.insert(agentTeamMembers).values(
          memberIds.map((agentId) => ({
            teamId: team.id,
            agentId,
            role: "member" as const,
            addedByAgentId: createdBy.agentId,
            addedByUserId: createdBy.userId,
          })),
        );
      }
    }

    return team;
  }

  async function update(
    teamId: string,
    data: {
      name?: string;
      description?: string;
      leadAgentId?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    return db
      .update(agentTeams)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agentTeams.id, teamId))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function addMember(
    teamId: string,
    agentId: string,
    role: string,
    addedBy: { agentId?: string; userId?: string },
  ) {
    const existing = await db
      .select()
      .from(agentTeamMembers)
      .where(
        and(
          eq(agentTeamMembers.teamId, teamId),
          eq(agentTeamMembers.agentId, agentId),
          isNull(agentTeamMembers.removedAt),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existing) return existing;

    return db
      .insert(agentTeamMembers)
      .values({
        teamId,
        agentId,
        role,
        addedByAgentId: addedBy.agentId,
        addedByUserId: addedBy.userId,
      })
      .returning()
      .then((rows) => rows[0]);
  }

  async function removeMember(teamId: string, agentId: string) {
    return db
      .update(agentTeamMembers)
      .set({ removedAt: new Date() })
      .where(
        and(
          eq(agentTeamMembers.teamId, teamId),
          eq(agentTeamMembers.agentId, agentId),
          isNull(agentTeamMembers.removedAt),
        ),
      )
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function dissolve(teamId: string) {
    return db
      .update(agentTeams)
      .set({ status: "dissolved", updatedAt: new Date() })
      .where(eq(agentTeams.id, teamId))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function listMembers(teamId: string) {
    return db
      .select({
        id: agentTeamMembers.id,
        teamId: agentTeamMembers.teamId,
        agentId: agentTeamMembers.agentId,
        role: agentTeamMembers.role,
        joinedAt: agentTeamMembers.joinedAt,
        agentName: agents.name,
        agentRole: agents.role,
        agentStatus: agents.status,
      })
      .from(agentTeamMembers)
      .innerJoin(agents, eq(agents.id, agentTeamMembers.agentId))
      .where(
        and(
          eq(agentTeamMembers.teamId, teamId),
          isNull(agentTeamMembers.removedAt),
        ),
      )
      .orderBy(asc(agentTeamMembers.joinedAt));
  }

  async function transferLead(teamId: string, newLeadAgentId: string) {
    const team = await db
      .select()
      .from(agentTeams)
      .where(eq(agentTeams.id, teamId))
      .then((rows) => rows[0] ?? null);

    if (!team) return null;

    if (team.leadAgentId) {
      await db
        .update(agentTeamMembers)
        .set({ role: "member" })
        .where(
          and(
            eq(agentTeamMembers.teamId, teamId),
            eq(agentTeamMembers.agentId, team.leadAgentId),
            isNull(agentTeamMembers.removedAt),
          ),
        );
    }

    const existingMember = await db
      .select()
      .from(agentTeamMembers)
      .where(
        and(
          eq(agentTeamMembers.teamId, teamId),
          eq(agentTeamMembers.agentId, newLeadAgentId),
          isNull(agentTeamMembers.removedAt),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existingMember) {
      await db
        .update(agentTeamMembers)
        .set({ role: "lead" })
        .where(eq(agentTeamMembers.id, existingMember.id));
    } else {
      await db.insert(agentTeamMembers).values({
        teamId,
        agentId: newLeadAgentId,
        role: "lead",
      });
    }

    return db
      .update(agentTeams)
      .set({ leadAgentId: newLeadAgentId, updatedAt: new Date() })
      .where(eq(agentTeams.id, teamId))
      .returning()
      .then((rows) => rows[0] ?? null);
  }

  async function getTeamsForAgent(agentId: string) {
    return db
      .select({
        id: agentTeams.id,
        companyId: agentTeams.companyId,
        name: agentTeams.name,
        description: agentTeams.description,
        leadAgentId: agentTeams.leadAgentId,
        status: agentTeams.status,
        metadata: agentTeams.metadata,
        createdAt: agentTeams.createdAt,
        updatedAt: agentTeams.updatedAt,
        memberRole: agentTeamMembers.role,
        joinedAt: agentTeamMembers.joinedAt,
      })
      .from(agentTeamMembers)
      .innerJoin(agentTeams, eq(agentTeams.id, agentTeamMembers.teamId))
      .where(
        and(
          eq(agentTeamMembers.agentId, agentId),
          isNull(agentTeamMembers.removedAt),
        ),
      );
  }

  return {
    list,
    getById,
    create,
    update,
    addMember,
    removeMember,
    dissolve,
    listMembers,
    transferLead,
    getTeamsForAgent,
  };
}
