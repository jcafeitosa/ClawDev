import { and, eq, desc, sql, or } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentDelegations, agents } from "@clawdev/db";
import { publishLiveEvent } from "./live-events.js";
import { agentMessageService } from "./agent-messages.js";

const DELEGATION_MESSAGE_TYPE: Record<string, string> = {
  task: "delegation",
  review: "review_request",
  consultation: "consultation",
  escalation: "escalation",
};

export function agentDelegationService(db: Db) {
  const messaging = agentMessageService(db);

  async function delegate(
    companyId: string,
    fromAgentId: string,
    data: {
      toAgentId: string;
      delegationType?: string;
      issueId?: string;
      teamTaskId?: string;
      instructions: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const delegationType = data.delegationType ?? "task";

    const [delegation] = await db
      .insert(agentDelegations)
      .values({
        companyId,
        fromAgentId,
        toAgentId: data.toAgentId,
        delegationType,
        issueId: data.issueId,
        teamTaskId: data.teamTaskId,
        instructions: data.instructions,
        metadata: data.metadata ?? {},
      })
      .returning();

    const messageType = DELEGATION_MESSAGE_TYPE[delegationType] ?? "delegation";
    await messaging.send(companyId, {
      fromAgentId,
      toAgentId: data.toAgentId,
      messageType,
      subject: `New ${delegationType}: ${data.instructions.slice(0, 80)}`,
      body: data.instructions,
      metadata: { delegationId: delegation.id },
    });

    publishLiveEvent({
      companyId,
      type: "delegation.created",
      payload: {
        delegationId: delegation.id,
        fromAgentId,
        toAgentId: data.toAgentId,
        delegationType,
      },
    });

    return delegation;
  }

  async function accept(delegationId: string, agentId: string) {
    const [updated] = await db
      .update(agentDelegations)
      .set({ status: "accepted", acceptedAt: new Date() })
      .where(
        and(
          eq(agentDelegations.id, delegationId),
          eq(agentDelegations.toAgentId, agentId),
          eq(agentDelegations.status, "pending"),
        ),
      )
      .returning();

    if (!updated) return null;

    publishLiveEvent({
      companyId: updated.companyId,
      type: "delegation.updated",
      payload: {
        delegationId: updated.id,
        status: "accepted",
        fromAgentId: updated.fromAgentId,
        toAgentId: updated.toAgentId,
      },
    });

    return updated;
  }

  async function reject(delegationId: string, agentId: string, reason: string) {
    const [updated] = await db
      .update(agentDelegations)
      .set({ status: "rejected", result: reason })
      .where(
        and(
          eq(agentDelegations.id, delegationId),
          eq(agentDelegations.toAgentId, agentId),
          eq(agentDelegations.status, "pending"),
        ),
      )
      .returning();

    if (!updated) return null;

    await messaging.send(updated.companyId, {
      fromAgentId: agentId,
      toAgentId: updated.fromAgentId,
      messageType: "delegation",
      subject: `Delegation rejected`,
      body: reason,
      metadata: { delegationId: updated.id, action: "rejected" },
    });

    publishLiveEvent({
      companyId: updated.companyId,
      type: "delegation.updated",
      payload: {
        delegationId: updated.id,
        status: "rejected",
        fromAgentId: updated.fromAgentId,
        toAgentId: updated.toAgentId,
      },
    });

    return updated;
  }

  async function complete(delegationId: string, agentId: string, result: string) {
    const [updated] = await db
      .update(agentDelegations)
      .set({ status: "completed", completedAt: new Date(), result })
      .where(
        and(
          eq(agentDelegations.id, delegationId),
          eq(agentDelegations.toAgentId, agentId),
          eq(agentDelegations.status, "accepted"),
        ),
      )
      .returning();

    if (!updated) return null;

    await messaging.send(updated.companyId, {
      fromAgentId: agentId,
      toAgentId: updated.fromAgentId,
      messageType: "delegation",
      subject: `Delegation completed`,
      body: result,
      metadata: { delegationId: updated.id, action: "completed" },
    });

    publishLiveEvent({
      companyId: updated.companyId,
      type: "delegation.updated",
      payload: {
        delegationId: updated.id,
        status: "completed",
        fromAgentId: updated.fromAgentId,
        toAgentId: updated.toAgentId,
      },
    });

    return updated;
  }

  async function escalate(delegationId: string) {
    const existing = await db
      .select()
      .from(agentDelegations)
      .where(eq(agentDelegations.id, delegationId))
      .then((rows) => rows[0] ?? null);

    if (!existing) return null;

    const fromAgent = await db
      .select({ id: agents.id, reportsTo: agents.reportsTo })
      .from(agents)
      .where(eq(agents.id, existing.fromAgentId))
      .then((rows) => rows[0] ?? null);

    if (!fromAgent?.reportsTo) return null;

    // Cancel the original delegation
    await db
      .update(agentDelegations)
      .set({ status: "cancelled" })
      .where(eq(agentDelegations.id, delegationId));

    // Create new escalation delegation to manager
    const newDelegation = await delegate(existing.companyId, existing.fromAgentId, {
      toAgentId: fromAgent.reportsTo,
      delegationType: "escalation",
      issueId: existing.issueId ?? undefined,
      teamTaskId: existing.teamTaskId ?? undefined,
      instructions: existing.instructions,
      metadata: {
        ...(existing.metadata as Record<string, unknown> | null),
        escalatedFromDelegationId: delegationId,
      },
    });

    return newDelegation;
  }

  async function cancel(delegationId: string, agentId: string) {
    const [updated] = await db
      .update(agentDelegations)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(agentDelegations.id, delegationId),
          eq(agentDelegations.fromAgentId, agentId),
        ),
      )
      .returning();

    if (!updated) return null;

    publishLiveEvent({
      companyId: updated.companyId,
      type: "delegation.updated",
      payload: {
        delegationId: updated.id,
        status: "cancelled",
        fromAgentId: updated.fromAgentId,
        toAgentId: updated.toAgentId,
      },
    });

    return updated;
  }

  async function listForAgent(
    agentId: string,
    opts?: { role?: "delegator" | "delegate"; status?: string; limit?: number },
  ) {
    const conditions: ReturnType<typeof eq>[] = [];

    if (opts?.role === "delegator") {
      conditions.push(eq(agentDelegations.fromAgentId, agentId));
    } else if (opts?.role === "delegate") {
      conditions.push(eq(agentDelegations.toAgentId, agentId));
    }

    if (opts?.status) {
      conditions.push(eq(agentDelegations.status, opts.status));
    }

    const roleCondition =
      !opts?.role
        ? or(
            eq(agentDelegations.fromAgentId, agentId),
            eq(agentDelegations.toAgentId, agentId),
          )
        : undefined;

    const whereClause = roleCondition
      ? conditions.length > 0
        ? and(roleCondition, ...conditions)
        : roleCondition
      : and(...conditions);

    const rows = await db
      .select({
        delegation: agentDelegations,
        fromAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${agentDelegations.fromAgentId})`,
        toAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${agentDelegations.toAgentId})`,
      })
      .from(agentDelegations)
      .where(whereClause)
      .orderBy(desc(agentDelegations.createdAt))
      .limit(opts?.limit ?? 50);

    return rows;
  }

  async function getById(delegationId: string) {
    const rows = await db
      .select({
        delegation: agentDelegations,
        fromAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${agentDelegations.fromAgentId})`,
        fromAgentRole: sql<string>`(SELECT role FROM agents WHERE id = ${agentDelegations.fromAgentId})`,
        toAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${agentDelegations.toAgentId})`,
        toAgentRole: sql<string>`(SELECT role FROM agents WHERE id = ${agentDelegations.toAgentId})`,
      })
      .from(agentDelegations)
      .where(eq(agentDelegations.id, delegationId));

    return rows[0] ?? null;
  }

  return { delegate, accept, reject, complete, escalate, cancel, listForAgent, getById };
}
