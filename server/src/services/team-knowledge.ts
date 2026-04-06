import { and, eq, desc, sql, isNull, arrayContains } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { teamKnowledge, agents } from "@clawdev/db";

export function teamKnowledgeService(db: Db) {
  async function add(
    teamId: string,
    companyId: string,
    data: {
      title: string;
      content: string;
      tags?: string[];
      authorAgentId: string;
    },
  ) {
    const [row] = await db
      .insert(teamKnowledge)
      .values({
        teamId,
        companyId,
        title: data.title,
        content: data.content,
        tags: data.tags ?? [],
        authorAgentId: data.authorAgentId,
      })
      .returning();
    return row;
  }

  async function list(teamId: string, opts?: { limit?: number }) {
    const limit = opts?.limit ?? 50;
    return db
      .select({
        entry: teamKnowledge,
        authorName: agents.name,
      })
      .from(teamKnowledge)
      .leftJoin(agents, eq(teamKnowledge.authorAgentId, agents.id))
      .where(
        and(
          eq(teamKnowledge.teamId, teamId),
          isNull(teamKnowledge.supersededById),
        ),
      )
      .orderBy(desc(teamKnowledge.updatedAt))
      .limit(limit);
  }

  async function search(
    teamId: string,
    opts: { query?: string; tags?: string[] },
  ) {
    const conditions = [
      eq(teamKnowledge.teamId, teamId),
      isNull(teamKnowledge.supersededById),
    ];

    if (opts.query) {
      const pattern = "%" + opts.query + "%";
      conditions.push(
        sql`${teamKnowledge.title} ILIKE ${pattern} OR ${teamKnowledge.content} ILIKE ${pattern}`,
      );
    }

    if (opts.tags && opts.tags.length > 0) {
      conditions.push(arrayContains(teamKnowledge.tags, opts.tags));
    }

    return db
      .select({
        entry: teamKnowledge,
        authorName: agents.name,
      })
      .from(teamKnowledge)
      .leftJoin(agents, eq(teamKnowledge.authorAgentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(teamKnowledge.updatedAt));
  }

  async function update(
    entryId: string,
    data: { content: string; authorAgentId: string },
  ) {
    const old = await getById(entryId);
    if (!old) {
      throw new Error(`Knowledge entry ${entryId} not found`);
    }

    // Create new version
    const [newEntry] = await db
      .insert(teamKnowledge)
      .values({
        teamId: old.entry.teamId,
        companyId: old.entry.companyId,
        title: old.entry.title,
        content: data.content,
        tags: old.entry.tags,
        authorAgentId: data.authorAgentId,
      })
      .returning();

    // Mark old entry as superseded
    await db
      .update(teamKnowledge)
      .set({ supersededById: newEntry.id })
      .where(eq(teamKnowledge.id, entryId));

    return newEntry;
  }

  async function getById(entryId: string) {
    const [row] = await db
      .select({
        entry: teamKnowledge,
        authorName: agents.name,
      })
      .from(teamKnowledge)
      .leftJoin(agents, eq(teamKnowledge.authorAgentId, agents.id))
      .where(eq(teamKnowledge.id, entryId));
    return row ?? null;
  }

  async function remove(entryId: string) {
    const [row] = await db
      .delete(teamKnowledge)
      .where(eq(teamKnowledge.id, entryId))
      .returning();
    return row ?? null;
  }

  return { add, list, search, update, getById, remove };
}
