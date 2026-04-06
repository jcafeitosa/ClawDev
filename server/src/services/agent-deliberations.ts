import { and, eq, desc, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentDeliberations, agentDeliberationVotes, agents } from "@clawdev/db";
import { publishLiveEvent } from "./live-events.js";
import { agentMessageService } from "./agent-messages.js";

export function agentDeliberationService(db: Db) {
  const messaging = agentMessageService(db);

  async function create(
    companyId: string,
    data: {
      topic: string;
      description?: string;
      teamId?: string;
      issueId?: string;
      participantAgentIds: string[];
      decisionType?: string;
      deadline?: Date;
      metadata?: Record<string, unknown>;
    },
    createdBy?: { agentId?: string; userId?: string },
  ) {
    const [deliberation] = await db
      .insert(agentDeliberations)
      .values({
        companyId,
        topic: data.topic,
        description: data.description,
        teamId: data.teamId,
        issueId: data.issueId,
        participantAgentIds: data.participantAgentIds,
        decisionType: data.decisionType ?? "majority_vote",
        deadline: data.deadline,
        metadata: data.metadata ?? {},
        createdByAgentId: createdBy?.agentId,
        createdByUserId: createdBy?.userId,
      })
      .returning();

    // Notify each participant agent
    for (const participantId of data.participantAgentIds) {
      const fromAgentId = createdBy?.agentId ?? participantId;
      await messaging.send(companyId, {
        fromAgentId,
        toAgentId: participantId,
        messageType: "deliberation",
        subject: `New deliberation: ${data.topic}`,
        body: data.description ?? data.topic,
        metadata: { deliberationId: deliberation.id },
      });
    }

    publishLiveEvent({
      companyId,
      type: "deliberation.created" as any,
      payload: { deliberationId: deliberation.id, topic: data.topic },
    });

    return deliberation;
  }

  async function castVote(
    deliberationId: string,
    agentId: string,
    data: { position: string; reasoning: string; weight?: number },
  ) {
    const [vote] = await db
      .insert(agentDeliberationVotes)
      .values({
        deliberationId,
        agentId,
        position: data.position,
        reasoning: data.reasoning,
        weight: data.weight ?? 1,
      })
      .onConflictDoUpdate({
        target: [agentDeliberationVotes.deliberationId, agentDeliberationVotes.agentId],
        set: {
          position: data.position,
          reasoning: data.reasoning,
          weight: data.weight ?? 1,
        },
      })
      .returning();

    // Look up companyId from the deliberation for the live event
    const delib = await db
      .select({ companyId: agentDeliberations.companyId })
      .from(agentDeliberations)
      .where(eq(agentDeliberations.id, deliberationId))
      .then((rows) => rows[0] ?? null);

    if (delib) {
      publishLiveEvent({
        companyId: delib.companyId,
        type: "deliberation.updated" as any,
        payload: { deliberationId, agentId, position: data.position },
      });
    }

    return vote;
  }

  async function resolve(deliberationId: string) {
    const deliberation = await db
      .select()
      .from(agentDeliberations)
      .where(eq(agentDeliberations.id, deliberationId))
      .then((rows) => rows[0] ?? null);

    if (!deliberation) return null;

    const votes = await db
      .select()
      .from(agentDeliberationVotes)
      .where(eq(agentDeliberationVotes.deliberationId, deliberationId));

    let decision: string;

    switch (deliberation.decisionType) {
      case "majority_vote": {
        const approveCount = votes.filter((v) => v.position === "approve").length;
        const rejectCount = votes.filter((v) => v.position === "reject").length;
        decision =
          approveCount >= rejectCount
            ? `Approved (${approveCount}-${rejectCount})`
            : `Rejected (${rejectCount}-${approveCount})`;
        break;
      }
      case "unanimous": {
        const allApprove = votes.length > 0 && votes.every((v) => v.position === "approve");
        decision = allApprove
          ? `Approved (unanimous)`
          : `Rejected (not unanimous, ${votes.filter((v) => v.position !== "approve").length} dissenting)`;
        break;
      }
      case "weighted": {
        const weightByPosition: Record<string, number> = {};
        for (const v of votes) {
          weightByPosition[v.position] = (weightByPosition[v.position] ?? 0) + v.weight;
        }
        const approveWeight = weightByPosition["approve"] ?? 0;
        const rejectWeight = weightByPosition["reject"] ?? 0;
        decision =
          approveWeight >= rejectWeight
            ? `Approved (weighted ${approveWeight}-${rejectWeight})`
            : `Rejected (weighted ${rejectWeight}-${approveWeight})`;
        break;
      }
      case "lead_decides": {
        decision = "Pending lead decision";
        const [updated] = await db
          .update(agentDeliberations)
          .set({ status: "voting" })
          .where(eq(agentDeliberations.id, deliberationId))
          .returning();

        publishLiveEvent({
          companyId: deliberation.companyId,
          type: "deliberation.updated" as any,
          payload: { deliberationId, status: "voting" },
        });

        return updated;
      }
      default: {
        const approveCount = votes.filter((v) => v.position === "approve").length;
        const rejectCount = votes.filter((v) => v.position === "reject").length;
        decision =
          approveCount >= rejectCount
            ? `Approved (${approveCount}-${rejectCount})`
            : `Rejected (${rejectCount}-${approveCount})`;
        break;
      }
    }

    const [updated] = await db
      .update(agentDeliberations)
      .set({ status: "decided", decision, decidedAt: new Date() })
      .where(eq(agentDeliberations.id, deliberationId))
      .returning();

    publishLiveEvent({
      companyId: deliberation.companyId,
      type: "deliberation.updated" as any,
      payload: { deliberationId, status: "decided", decision },
    });

    return updated;
  }

  async function getById(deliberationId: string) {
    const deliberation = await db
      .select()
      .from(agentDeliberations)
      .where(eq(agentDeliberations.id, deliberationId))
      .then((rows) => rows[0] ?? null);

    if (!deliberation) return null;

    const votes = await db
      .select({
        vote: agentDeliberationVotes,
        agentName: agents.name,
      })
      .from(agentDeliberationVotes)
      .leftJoin(agents, eq(agentDeliberationVotes.agentId, agents.id))
      .where(eq(agentDeliberationVotes.deliberationId, deliberationId))
      .orderBy(desc(agentDeliberationVotes.createdAt));

    return { deliberation, votes };
  }

  async function list(
    companyId: string,
    opts?: { status?: string; teamId?: string; limit?: number },
  ) {
    const conditions = [eq(agentDeliberations.companyId, companyId)];
    if (opts?.status) {
      conditions.push(eq(agentDeliberations.status, opts.status));
    }
    if (opts?.teamId) {
      conditions.push(eq(agentDeliberations.teamId, opts.teamId));
    }

    const voteCountSubquery = db
      .select({
        deliberationId: agentDeliberationVotes.deliberationId,
        voteCount: sql<number>`count(*)::int`.as("vote_count"),
      })
      .from(agentDeliberationVotes)
      .groupBy(agentDeliberationVotes.deliberationId)
      .as("vote_counts");

    const rows = await db
      .select({
        deliberation: agentDeliberations,
        voteCount: sql<number>`coalesce(${voteCountSubquery.voteCount}, 0)`,
      })
      .from(agentDeliberations)
      .leftJoin(
        voteCountSubquery,
        eq(agentDeliberations.id, voteCountSubquery.deliberationId),
      )
      .where(and(...conditions))
      .orderBy(desc(agentDeliberations.createdAt))
      .limit(opts?.limit ?? 50);

    return rows;
  }

  async function listVotes(deliberationId: string) {
    const rows = await db
      .select({
        vote: agentDeliberationVotes,
        agentName: agents.name,
      })
      .from(agentDeliberationVotes)
      .leftJoin(agents, eq(agentDeliberationVotes.agentId, agents.id))
      .where(eq(agentDeliberationVotes.deliberationId, deliberationId))
      .orderBy(desc(agentDeliberationVotes.createdAt));

    return rows;
  }

  return { create, castVote, resolve, getById, list, listVotes };
}
