/**
 * Channel Message Wakeup — triggers agent wakeups when messages are sent.
 *
 * When a human (or another agent) sends a message in a channel:
 * 1. If specific agents are @mentioned, wake those agents
 * 2. If @channel is used, wake all agents that are channel members
 * 3. If @here is used, wake all agents that are channel members
 * 4. Filter out the sender to avoid self-replies
 * 5. Auto-create a board issue so every execution has kanban traceability
 */

import { eq, and, isNull, notInArray, sql } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { channelMembers, agents, issues, companies } from "@clawdev/db";
import { logger } from "../middleware/logger.js";

/** Agent statuses that should NOT be woken up. */
const EXCLUDED_STATUSES = ["terminated", "paused", "pending_approval"];

type WakeupTriggerDetail = "manual" | "ping" | "callback" | "system";
type WakeupSource = "timer" | "assignment" | "on_demand" | "automation";

export interface ChannelWakeupDeps {
  wakeup: (
    agentId: string,
    opts: {
      source?: WakeupSource;
      triggerDetail?: WakeupTriggerDetail;
      reason?: string | null;
      payload?: Record<string, unknown> | null;
      requestedByActorType?: "user" | "agent" | "system";
      requestedByActorId?: string | null;
      contextSnapshot?: Record<string, unknown>;
    },
  ) => Promise<unknown>;
}

export interface ChannelMessageContext {
  messageId: string;
  channelId: string;
  companyId: string;
  channelName?: string;
  body: string;
  senderAgentId?: string | null;
  senderUserId?: string | null;
  senderDisplayName?: string | null;
  mentionsAgentIds: string[];
  mentionsChannel: boolean;
  mentionsHere: boolean;
  threadId?: string | null;
}

/**
 * Create a board issue for a channel-message-triggered wakeup.
 * Returns the issue ID (or null if creation fails).
 */
async function createBoardIssueForChannelMessage(
  db: Db,
  companyId: string,
  agentId: string,
  msg: ChannelMessageContext,
): Promise<string | null> {
  try {
    // Derive a short title from the message body (max 80 chars)
    const rawTitle = msg.body.replace(/\n/g, " ").trim();
    const title = rawTitle.length > 80 ? rawTitle.slice(0, 77) + "..." : rawTitle || "Channel task";

    // Generate issue identifier
    const [company] = await db
      .update(companies)
      .set({ issueCounter: sql`${companies.issueCounter} + 1` })
      .where(eq(companies.id, companyId))
      .returning({ issueCounter: companies.issueCounter, issuePrefix: companies.issuePrefix });

    if (!company) return null;

    const identifier = `${company.issuePrefix}-${company.issueCounter}`;

    const [issue] = await db
      .insert(issues)
      .values({
        companyId,
        title,
        description: msg.body.length > 200
          ? `From channel message (${msg.channelName ?? "DM"}):\n\n${msg.body}`
          : null,
        status: "in_progress",
        priority: "medium",
        assigneeAgentId: agentId,
        originKind: "channel_message",
        originId: msg.messageId,
        issueNumber: company.issueCounter,
        identifier,
        createdByAgentId: msg.senderAgentId ?? null,
        createdByUserId: msg.senderUserId ?? null,
        startedAt: new Date(),
      } as typeof issues.$inferInsert)
      .returning();

    logger.info(
      { issueId: issue.id, identifier, agentId, channelId: msg.channelId },
      `auto-created board issue ${identifier} for channel message`,
    );

    return issue.id;
  } catch (err) {
    logger.warn({ err, companyId, agentId }, "failed to auto-create board issue for channel message");
    return null;
  }
}

/**
 * Queue agent wakeups based on a new channel message.
 * Returns the list of agent IDs that were woken up.
 */
export async function queueChannelMessageWakeups(
  db: Db,
  heartbeat: ChannelWakeupDeps,
  msg: ChannelMessageContext,
): Promise<string[]> {
  const agentIdsToWake = new Set<string>();

  // 1. Add specifically @mentioned agents
  for (const id of msg.mentionsAgentIds) {
    agentIdsToWake.add(id);
  }

  // 2. If @channel or @here, add all agent members of this channel
  if (msg.mentionsChannel || msg.mentionsHere) {
    const members = await db
      .select({ agentId: channelMembers.agentId })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, msg.channelId),
          isNull(channelMembers.leftAt),
        ),
      );
    for (const m of members) {
      if (m.agentId) agentIdsToWake.add(m.agentId);
    }
  }

  // 3. If no explicit mentions but sender is a human, wake ONLY the CEO
  //    (the orchestrator). Other agents only respond when @mentioned or
  //    involved in an active task/delegation.
  if (
    agentIdsToWake.size === 0 &&
    msg.senderUserId &&
    !msg.senderAgentId
  ) {
    // Find the CEO agent for this company (any non-terminated/non-paused status)
    const [ceoAgent] = await db
      .select({ id: agents.id })
      .from(agents)
      .where(
        and(
          eq(agents.companyId, msg.companyId),
          eq(agents.role, "ceo"),
          notInArray(agents.status, EXCLUDED_STATUSES),
        ),
      )
      .limit(1);

    if (ceoAgent) {
      agentIdsToWake.add(ceoAgent.id);
    } else {
      // Fallback: if no CEO, check channel members
      const members = await db
        .select({ agentId: channelMembers.agentId })
        .from(channelMembers)
        .where(
          and(
            eq(channelMembers.channelId, msg.channelId),
            isNull(channelMembers.leftAt),
          ),
        );

      if (members.length > 0) {
        // Still only pick first member as fallback (not all)
        const first = members[0];
        if (first.agentId) agentIdsToWake.add(first.agentId);
      } else {
        // Last resort: pick the first available agent in the company
        const [fallbackAgent] = await db
          .select({ id: agents.id })
          .from(agents)
          .where(
            and(
              eq(agents.companyId, msg.companyId),
              notInArray(agents.status, EXCLUDED_STATUSES),
            ),
          )
          .limit(1);
        if (fallbackAgent) agentIdsToWake.add(fallbackAgent.id);
      }
    }
  }

  // 4. Remove the sender agent (don't wake yourself)
  if (msg.senderAgentId) {
    agentIdsToWake.delete(msg.senderAgentId);
  }

  if (agentIdsToWake.size === 0) return [];

  // 5. Auto-create board issues and queue wakeups with issue context
  const wokenAgents: string[] = [];
  for (const agentId of agentIdsToWake) {
    try {
      // Create a board issue for traceability — every agent run should be visible on the kanban
      const issueId = await createBoardIssueForChannelMessage(db, msg.companyId, agentId, msg);

      await heartbeat.wakeup(agentId, {
        source: "automation",
        triggerDetail: "callback",
        reason: "channel_message_received",
        payload: {
          channelId: msg.channelId,
          messageId: msg.messageId,
          channelName: msg.channelName,
          senderDisplayName: msg.senderDisplayName,
          bodyPreview: msg.body.slice(0, 200),
          threadId: msg.threadId ?? null,
        },
        requestedByActorType: msg.senderUserId ? "user" : msg.senderAgentId ? "agent" : "system",
        requestedByActorId: msg.senderUserId ?? msg.senderAgentId ?? null,
        contextSnapshot: {
          channelId: msg.channelId,
          messageId: msg.messageId,
          threadId: msg.threadId ?? null,
          source: "channel_message",
          // Link the run to the auto-created issue for kanban traceability
          ...(issueId ? { issueId } : {}),
        },
      });
      wokenAgents.push(agentId);
    } catch (err) {
      logger.warn({ err, agentId, messageId: msg.messageId }, "failed to wake agent for channel message");
    }
  }

  if (wokenAgents.length > 0) {
    logger.info(
      { channelId: msg.channelId, messageId: msg.messageId, wokenAgents },
      `woke ${wokenAgents.length} agent(s) for channel message`,
    );
  }

  return wokenAgents;
}
