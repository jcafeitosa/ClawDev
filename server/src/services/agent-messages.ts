import { and, eq, desc, asc, isNull, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agentMessages, agents } from "@clawdev/db";
import { publishLiveEvent } from "./live-events.js";

export function agentMessageService(db: Db) {
  async function send(
    companyId: string,
    data: {
      fromAgentId: string;
      toAgentId?: string;
      toTeamId?: string;
      messageType?: string;
      subject?: string;
      body: string;
      threadId?: string;
      parentMessageId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    let { threadId } = data;

    if (!threadId && data.parentMessageId) {
      const parent = await db
        .select({ threadId: agentMessages.threadId })
        .from(agentMessages)
        .where(eq(agentMessages.id, data.parentMessageId))
        .then((rows) => rows[0] ?? null);
      if (parent?.threadId) {
        threadId = parent.threadId;
      }
    }

    const [message] = await db
      .insert(agentMessages)
      .values({
        companyId,
        fromAgentId: data.fromAgentId,
        toAgentId: data.toAgentId,
        toTeamId: data.toTeamId,
        messageType: data.messageType ?? "chat",
        subject: data.subject,
        body: data.body,
        threadId: threadId ?? undefined,
        parentMessageId: data.parentMessageId,
        metadata: data.metadata ?? {},
      })
      .returning();

    if (!threadId && !data.parentMessageId) {
      const [updated] = await db
        .update(agentMessages)
        .set({ threadId: message.id })
        .where(eq(agentMessages.id, message.id))
        .returning();
      Object.assign(message, updated);
    }

    publishLiveEvent({
      companyId,
      type: "agent_message.created",
      payload: {
        messageId: message.id,
        fromAgentId: message.fromAgentId,
        toAgentId: message.toAgentId,
        toTeamId: message.toTeamId,
        messageType: message.messageType,
      },
    });

    return message;
  }

  async function listForAgent(
    agentId: string,
    opts?: { unreadOnly?: boolean; messageType?: string; limit?: number },
  ) {
    const conditions = [eq(agentMessages.toAgentId, agentId)];
    if (opts?.unreadOnly) {
      conditions.push(isNull(agentMessages.readAt));
    }
    if (opts?.messageType) {
      conditions.push(eq(agentMessages.messageType, opts.messageType));
    }

    const rows = await db
      .select({
        message: agentMessages,
        fromAgentName: agents.name,
        fromAgentRole: agents.role,
      })
      .from(agentMessages)
      .leftJoin(agents, eq(agentMessages.fromAgentId, agents.id))
      .where(and(...conditions))
      .orderBy(desc(agentMessages.createdAt))
      .limit(opts?.limit ?? 50);

    return rows;
  }

  async function listForTeam(teamId: string, opts?: { limit?: number }) {
    const rows = await db
      .select({
        message: agentMessages,
        fromAgentName: agents.name,
        fromAgentRole: agents.role,
      })
      .from(agentMessages)
      .leftJoin(agents, eq(agentMessages.fromAgentId, agents.id))
      .where(eq(agentMessages.toTeamId, teamId))
      .orderBy(desc(agentMessages.createdAt))
      .limit(opts?.limit ?? 50);

    return rows;
  }

  async function listThread(threadId: string) {
    const rows = await db
      .select({
        message: agentMessages,
        fromAgentName: agents.name,
        fromAgentRole: agents.role,
      })
      .from(agentMessages)
      .leftJoin(agents, eq(agentMessages.fromAgentId, agents.id))
      .where(eq(agentMessages.threadId, threadId))
      .orderBy(asc(agentMessages.createdAt));

    return rows;
  }

  async function markAsRead(messageId: string, agentId: string) {
    const [updated] = await db
      .update(agentMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(agentMessages.id, messageId),
          eq(agentMessages.toAgentId, agentId),
          isNull(agentMessages.readAt),
        ),
      )
      .returning();

    return updated ?? null;
  }

  async function getUnreadCount(agentId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(agentMessages)
      .where(
        and(
          eq(agentMessages.toAgentId, agentId),
          isNull(agentMessages.readAt),
        ),
      );

    return row?.count ?? 0;
  }

  return {
    send,
    listForAgent,
    listForTeam,
    listThread,
    markAsRead,
    getUnreadCount,
  };
}
