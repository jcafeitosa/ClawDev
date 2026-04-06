/**
 * Channel Message Wakeup — triggers agent wakeups when messages are sent.
 *
 * When a human (or another agent) sends a message in a channel:
 * 1. If specific agents are @mentioned, wake those agents
 * 2. If @channel is used, wake all agents that are channel members
 * 3. If @here is used, wake all agents that are channel members
 * 4. Filter out the sender to avoid self-replies
 */

import { eq, and, isNull } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { channelMembers, agents } from "@clawdev/db";
import { logger } from "../middleware/logger.js";

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

  // 3. If no explicit mentions but sender is a human, wake all channel members
  //    so at least one agent can respond
  if (
    agentIdsToWake.size === 0 &&
    msg.senderUserId &&
    !msg.senderAgentId
  ) {
    const members = await db
      .select({ agentId: channelMembers.agentId })
      .from(channelMembers)
      .where(
        and(
          eq(channelMembers.channelId, msg.channelId),
          isNull(channelMembers.leftAt),
        ),
      );

    // If no members, try to find agents for this company and pick one
    if (members.length > 0) {
      for (const m of members) {
        if (m.agentId) agentIdsToWake.add(m.agentId);
      }
    } else {
      // Fallback: pick the first active agent in the company
      const [fallbackAgent] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(
          and(
            eq(agents.companyId, msg.companyId),
            eq(agents.status, "active"),
          ),
        )
        .limit(1);
      if (fallbackAgent) agentIdsToWake.add(fallbackAgent.id);
    }
  }

  // 4. Remove the sender agent (don't wake yourself)
  if (msg.senderAgentId) {
    agentIdsToWake.delete(msg.senderAgentId);
  }

  if (agentIdsToWake.size === 0) return [];

  // 5. Queue wakeups
  const wokenAgents: string[] = [];
  for (const agentId of agentIdsToWake) {
    try {
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
