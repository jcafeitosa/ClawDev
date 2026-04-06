import { and, eq, desc, sql, inArray } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { teamTasks, agents } from "@clawdev/db";

const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

async function enrichWithAgentNames<T extends typeof teamTasks.$inferSelect>(db: Db, tasks: T[]) {
  const agentIds = [
    ...new Set(
      tasks.flatMap((t) =>
        [t.assignedAgentId, t.claimedByAgentId, t.createdByAgentId].filter(Boolean),
      ),
    ),
  ];
  const agentMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const agentRows = await db
      .select({ id: agents.id, name: agents.name })
      .from(agents)
      .where(inArray(agents.id, agentIds as string[]));
    for (const a of agentRows) agentMap.set(a.id, a.name);
  }
  return tasks.map((t) => ({
    ...t,
    assignedAgentName: t.assignedAgentId ? agentMap.get(t.assignedAgentId) ?? null : null,
    claimedByAgentName: t.claimedByAgentId ? agentMap.get(t.claimedByAgentId) ?? null : null,
    createdByAgentName: agentMap.get(t.createdByAgentId) ?? "Unknown",
  }));
}

export function teamTaskService(db: Db) {
  return {
    create: async (
      teamId: string,
      companyId: string,
      data: {
        title: string;
        description?: string;
        assignedAgentId?: string;
        createdByAgentId: string;
        priority?: string;
        dependsOnTaskIds?: string[];
        issueId?: string;
        metadata?: Record<string, unknown>;
      },
    ) => {
      let status = "pending";

      if (data.dependsOnTaskIds && data.dependsOnTaskIds.length > 0) {
        const depTasks = await db
          .select({ id: teamTasks.id, status: teamTasks.status })
          .from(teamTasks)
          .where(inArray(teamTasks.id, data.dependsOnTaskIds));

        const hasIncomplete = depTasks.some((t) => t.status !== "completed");
        if (hasIncomplete) {
          status = "blocked";
        }
      }

      return db
        .insert(teamTasks)
        .values({
          teamId,
          companyId,
          title: data.title,
          description: data.description ?? null,
          assignedAgentId: data.assignedAgentId ?? null,
          createdByAgentId: data.createdByAgentId,
          priority: data.priority ?? "medium",
          dependsOnTaskIds: data.dependsOnTaskIds ?? [],
          issueId: data.issueId ?? null,
          metadata: data.metadata ?? {},
          status,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    list: async (teamId: string, opts?: { status?: string; assignedAgentId?: string }) => {
      const conditions = [eq(teamTasks.teamId, teamId)];
      if (opts?.status) conditions.push(eq(teamTasks.status, opts.status));
      if (opts?.assignedAgentId) conditions.push(eq(teamTasks.assignedAgentId, opts.assignedAgentId));

      const tasks = await db
        .select()
        .from(teamTasks)
        .where(and(...conditions))
        .orderBy(
          sql`CASE ${teamTasks.priority}
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
            ELSE 4
          END`,
          desc(teamTasks.createdAt),
        );

      return enrichWithAgentNames(db, tasks);
    },

    getById: async (taskId: string) => {
      const tasks = await db
        .select()
        .from(teamTasks)
        .where(eq(teamTasks.id, taskId));

      if (tasks.length === 0) return null;

      const enriched = await enrichWithAgentNames(db, tasks);
      return enriched[0];
    },

    claim: async (taskId: string, agentId: string) => {
      const now = new Date();
      return db
        .update(teamTasks)
        .set({
          claimedByAgentId: agentId,
          claimedAt: now,
          status: "claimed",
        })
        .where(and(eq(teamTasks.id, taskId), eq(teamTasks.status, "pending")))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    updateStatus: async (taskId: string, status: string, agentId: string) => {
      const patch: Partial<typeof teamTasks.$inferInsert> = { status };

      if (status === "completed") {
        patch.completedAt = new Date();
      }

      if (status === "in_progress") {
        const existing = await db
          .select({ claimedByAgentId: teamTasks.claimedByAgentId })
          .from(teamTasks)
          .where(eq(teamTasks.id, taskId))
          .then((rows) => rows[0] ?? null);

        if (existing && !existing.claimedByAgentId) {
          patch.claimedByAgentId = agentId;
          patch.claimedAt = new Date();
        }
      }

      return db
        .update(teamTasks)
        .set(patch)
        .where(eq(teamTasks.id, taskId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    update: async (
      taskId: string,
      data: {
        title?: string;
        description?: string;
        assignedAgentId?: string;
        priority?: string;
        status?: string;
      },
    ) => {
      const patch: Partial<typeof teamTasks.$inferInsert> = {};
      if (data.title !== undefined) patch.title = data.title;
      if (data.description !== undefined) patch.description = data.description;
      if (data.assignedAgentId !== undefined) patch.assignedAgentId = data.assignedAgentId;
      if (data.priority !== undefined) patch.priority = data.priority;
      if (data.status !== undefined) patch.status = data.status;

      return db
        .update(teamTasks)
        .set(patch)
        .where(eq(teamTasks.id, taskId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    autoUnblock: async (teamId: string) => {
      const blockedTasks = await db
        .select()
        .from(teamTasks)
        .where(and(eq(teamTasks.teamId, teamId), eq(teamTasks.status, "blocked")));

      if (blockedTasks.length === 0) return 0;

      const allDepIds = [
        ...new Set(blockedTasks.flatMap((t) => t.dependsOnTaskIds ?? [])),
      ];

      if (allDepIds.length === 0) return 0;

      const depTasks = await db
        .select({ id: teamTasks.id, status: teamTasks.status })
        .from(teamTasks)
        .where(inArray(teamTasks.id, allDepIds));

      const completedSet = new Set(depTasks.filter((t) => t.status === "completed").map((t) => t.id));

      const toUnblock = blockedTasks.filter((t) => {
        const deps = t.dependsOnTaskIds ?? [];
        return deps.length > 0 && deps.every((depId) => completedSet.has(depId));
      });

      if (toUnblock.length === 0) return 0;

      const toUnblockIds = toUnblock.map((t) => t.id);
      await db
        .update(teamTasks)
        .set({ status: "pending" })
        .where(inArray(teamTasks.id, toUnblockIds));

      return toUnblockIds.length;
    },
  };
}
