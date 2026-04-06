import { and, eq, desc, asc, sql, isNull, lt } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { channelMessages, channelMessageReactions, channels, agents } from "@clawdev/db";
import { publishLiveEvent } from "./live-events.js";
import { queueChannelMessageWakeups, type ChannelWakeupDeps } from "./channel-message-wakeup.js";
import { heartbeatService } from "./heartbeat.js";

export function channelMessageService(db: Db) {
  return {
    async send(
      channelId: string,
      companyId: string,
      sender: { agentId?: string; userId?: string; externalId?: string; displayName?: string },
      data: {
        body: string;
        messageType?: string;
        subject?: string;
        threadId?: string;
        parentMessageId?: string;
        attachments?: unknown[];
        metadata?: Record<string, unknown>;
        mentions?: { agentIds?: string[]; channel?: boolean; here?: boolean };
      },
    ) {
      // Parse mentions from body
      let mentionsChannel = data.mentions?.channel ?? false;
      let mentionsHere = data.mentions?.here ?? false;
      const mentionedAgentIds: string[] = [...(data.mentions?.agentIds ?? [])];

      if (data.body.includes("@channel")) mentionsChannel = true;
      if (data.body.includes("@here")) mentionsHere = true;

      // Resolve @agentName mentions from body
      const mentionMatches = data.body.matchAll(/@([a-zA-Z0-9_-]+)/g);
      for (const match of mentionMatches) {
        const name = match[1];
        if (name === "channel" || name === "here") continue;
        const [agent] = await db
          .select({ id: agents.id })
          .from(agents)
          .where(and(eq(agents.companyId, companyId), eq(agents.name, name)));
        if (agent && !mentionedAgentIds.includes(agent.id)) {
          mentionedAgentIds.push(agent.id);
        }
      }

      // Handle threading
      let threadId = data.threadId;
      if (data.parentMessageId && !threadId) {
        const [parent] = await db
          .select({ threadId: channelMessages.threadId, id: channelMessages.id })
          .from(channelMessages)
          .where(eq(channelMessages.id, data.parentMessageId));
        if (parent) {
          threadId = parent.threadId ?? parent.id;
        }
      }

      // If replying, update parent
      if (data.parentMessageId) {
        await db
          .update(channelMessages)
          .set({
            replyCount: sql`${channelMessages.replyCount} + 1`,
            lastReplyAt: new Date(),
          })
          .where(eq(channelMessages.id, data.parentMessageId));
      }

      // Resolve sender display name
      let senderDisplayName = sender.displayName;
      if (!senderDisplayName && sender.agentId) {
        const [agent] = await db
          .select({ name: agents.name })
          .from(agents)
          .where(eq(agents.id, sender.agentId));
        if (agent) senderDisplayName = agent.name;
      }

      const [message] = await db
        .insert(channelMessages)
        .values({
          channelId,
          companyId,
          senderAgentId: sender.agentId,
          senderUserId: sender.userId,
          senderExternalId: sender.externalId,
          senderDisplayName,
          threadId,
          parentMessageId: data.parentMessageId,
          messageType: data.messageType ?? "chat",
          subject: data.subject,
          body: data.body,
          attachments: data.attachments as any,
          metadata: data.metadata ?? {},
          mentionsAgentIds: mentionedAgentIds.length > 0 ? mentionedAgentIds : [],
          mentionsChannel,
          mentionsHere,
        })
        .returning();

      // Update channel stats
      await db
        .update(channels)
        .set({
          lastMessageAt: new Date(),
          messageCount: sql`${channels.messageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(channels.id, channelId));

      publishLiveEvent({
        companyId,
        type: "channel_message.created",
        payload: {
          channelId,
          messageId: message.id,
          senderAgentId: sender.agentId,
          senderDisplayName,
          messageType: message.messageType,
          body: data.body.slice(0, 100),
        },
      });

      // Queue agent wakeups for this message (async, non-blocking)
      const heartbeat = heartbeatService(db);
      queueChannelMessageWakeups(db, heartbeat, {
        messageId: message.id,
        channelId,
        companyId,
        body: data.body,
        senderAgentId: sender.agentId ?? null,
        senderUserId: sender.userId ?? null,
        senderDisplayName: senderDisplayName ?? null,
        mentionsAgentIds: mentionedAgentIds,
        mentionsChannel,
        mentionsHere,
        threadId: threadId ?? null,
      }).catch((err) => {
        // Non-blocking — log but don't fail the message send
        console.error("channel-message-wakeup error:", err);
      });

      return { ...message, senderDisplayName };
    },

    async list(channelId: string, opts?: { before?: string; limit?: number; threadId?: string }) {
      const limit = opts?.limit ?? 50;
      const conditions = [eq(channelMessages.channelId, channelId), isNull(channelMessages.deletedAt)];

      if (opts?.threadId) {
        conditions.push(eq(channelMessages.threadId, opts.threadId));
      }

      if (opts?.before) {
        const [ref] = await db
          .select({ createdAt: channelMessages.createdAt })
          .from(channelMessages)
          .where(eq(channelMessages.id, opts.before));
        if (ref) {
          conditions.push(lt(channelMessages.createdAt, ref.createdAt));
        }
      }

      const rows = await db
        .select({
          id: channelMessages.id,
          channelId: channelMessages.channelId,
          companyId: channelMessages.companyId,
          senderAgentId: channelMessages.senderAgentId,
          senderUserId: channelMessages.senderUserId,
          senderExternalId: channelMessages.senderExternalId,
          senderDisplayName: channelMessages.senderDisplayName,
          threadId: channelMessages.threadId,
          parentMessageId: channelMessages.parentMessageId,
          replyCount: channelMessages.replyCount,
          lastReplyAt: channelMessages.lastReplyAt,
          messageType: channelMessages.messageType,
          subject: channelMessages.subject,
          body: channelMessages.body,
          attachments: channelMessages.attachments,
          metadata: channelMessages.metadata,
          mentionsAgentIds: channelMessages.mentionsAgentIds,
          mentionsChannel: channelMessages.mentionsChannel,
          mentionsHere: channelMessages.mentionsHere,
          isPinned: channelMessages.isPinned,
          pinnedAt: channelMessages.pinnedAt,
          editedAt: channelMessages.editedAt,
          createdAt: channelMessages.createdAt,
          senderAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          senderAgentIcon: sql<string>`(SELECT icon FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          senderAgentRole: sql<string>`(SELECT role FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          reactionsSummary: sql<string>`(
            SELECT COALESCE(json_agg(json_build_object('emoji', r.emoji, 'count', r.cnt)), '[]'::json)
            FROM (
              SELECT emoji, count(*)::int as cnt
              FROM channel_message_reactions
              WHERE message_id = "channel_messages"."id"
              GROUP BY emoji
            ) r
          )`,
          isBookmarked: sql<boolean>`EXISTS(
            SELECT 1 FROM channel_bookmarks
            WHERE message_id = "channel_messages"."id"
          )`,
        })
        .from(channelMessages)
        .where(and(...conditions))
        .orderBy(desc(channelMessages.createdAt))
        .limit(limit);

      return rows;
    },

    async getById(messageId: string) {
      const [row] = await db
        .select({
          id: channelMessages.id,
          channelId: channelMessages.channelId,
          companyId: channelMessages.companyId,
          senderAgentId: channelMessages.senderAgentId,
          senderUserId: channelMessages.senderUserId,
          senderExternalId: channelMessages.senderExternalId,
          senderDisplayName: channelMessages.senderDisplayName,
          threadId: channelMessages.threadId,
          parentMessageId: channelMessages.parentMessageId,
          replyCount: channelMessages.replyCount,
          lastReplyAt: channelMessages.lastReplyAt,
          messageType: channelMessages.messageType,
          subject: channelMessages.subject,
          body: channelMessages.body,
          attachments: channelMessages.attachments,
          metadata: channelMessages.metadata,
          mentionsAgentIds: channelMessages.mentionsAgentIds,
          mentionsChannel: channelMessages.mentionsChannel,
          mentionsHere: channelMessages.mentionsHere,
          isPinned: channelMessages.isPinned,
          pinnedAt: channelMessages.pinnedAt,
          pinnedByAgentId: channelMessages.pinnedByAgentId,
          editedAt: channelMessages.editedAt,
          deletedAt: channelMessages.deletedAt,
          createdAt: channelMessages.createdAt,
          senderAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          senderAgentIcon: sql<string>`(SELECT icon FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          senderAgentRole: sql<string>`(SELECT role FROM agents WHERE id = ${channelMessages.senderAgentId})`,
        })
        .from(channelMessages)
        .where(eq(channelMessages.id, messageId));

      return row ?? null;
    },

    async edit(messageId: string, senderAgentId: string, newBody: string) {
      const [updated] = await db
        .update(channelMessages)
        .set({ body: newBody, editedAt: new Date() })
        .where(and(eq(channelMessages.id, messageId), eq(channelMessages.senderAgentId, senderAgentId)))
        .returning();

      if (updated) {
        publishLiveEvent({
          companyId: updated.companyId,
          type: "channel_message.updated",
          payload: { channelId: updated.channelId, messageId: updated.id },
        });
      }

      return updated ?? null;
    },

    async softDelete(messageId: string, senderAgentId: string) {
      const [updated] = await db
        .update(channelMessages)
        .set({ deletedAt: new Date() })
        .where(and(eq(channelMessages.id, messageId), eq(channelMessages.senderAgentId, senderAgentId)))
        .returning();

      if (updated) {
        publishLiveEvent({
          companyId: updated.companyId,
          type: "channel_message.deleted",
          payload: { channelId: updated.channelId, messageId: updated.id },
        });
      }

      return updated ?? null;
    },

    async pin(messageId: string, agentId: string | null) {
      const [updated] = await db
        .update(channelMessages)
        .set({ isPinned: true, pinnedAt: new Date(), pinnedByAgentId: agentId || null })
        .where(eq(channelMessages.id, messageId))
        .returning();

      return updated ?? null;
    },

    async unpin(messageId: string) {
      const [updated] = await db
        .update(channelMessages)
        .set({ isPinned: false, pinnedAt: null, pinnedByAgentId: null })
        .where(eq(channelMessages.id, messageId))
        .returning();

      return updated ?? null;
    },

    async listPinned(channelId: string) {
      const rows = await db
        .select({
          id: channelMessages.id,
          channelId: channelMessages.channelId,
          senderAgentId: channelMessages.senderAgentId,
          senderDisplayName: channelMessages.senderDisplayName,
          messageType: channelMessages.messageType,
          subject: channelMessages.subject,
          body: channelMessages.body,
          isPinned: channelMessages.isPinned,
          pinnedAt: channelMessages.pinnedAt,
          pinnedByAgentId: channelMessages.pinnedByAgentId,
          createdAt: channelMessages.createdAt,
          senderAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          senderAgentIcon: sql<string>`(SELECT icon FROM agents WHERE id = ${channelMessages.senderAgentId})`,
          senderAgentRole: sql<string>`(SELECT role FROM agents WHERE id = ${channelMessages.senderAgentId})`,
        })
        .from(channelMessages)
        .where(
          and(
            eq(channelMessages.channelId, channelId),
            eq(channelMessages.isPinned, true),
            isNull(channelMessages.deletedAt),
          ),
        )
        .orderBy(desc(channelMessages.pinnedAt));

      return rows;
    },

    async addReaction(messageId: string, emoji: string, principal: { agentId?: string; userId?: string }) {
      await db
        .insert(channelMessageReactions)
        .values({
          messageId,
          emoji,
          agentId: principal.agentId,
          userId: principal.userId,
        })
        .onConflictDoNothing();

      const [msg] = await db
        .select({ channelId: channelMessages.channelId, companyId: channelMessages.companyId })
        .from(channelMessages)
        .where(eq(channelMessages.id, messageId));

      if (msg) {
        publishLiveEvent({
          companyId: msg.companyId,
          type: "channel_message.updated",
          payload: { channelId: msg.channelId, messageId, emoji, agentId: principal.agentId },
        });
      }
    },

    async removeReaction(messageId: string, emoji: string, principal: { agentId?: string; userId?: string }) {
      const conditions = [eq(channelMessageReactions.messageId, messageId), eq(channelMessageReactions.emoji, emoji)];
      if (principal.agentId) conditions.push(eq(channelMessageReactions.agentId, principal.agentId));
      if (principal.userId) conditions.push(eq(channelMessageReactions.userId, principal.userId));

      await db.delete(channelMessageReactions).where(and(...conditions));
    },

    async listReactions(messageId: string) {
      const rows = await db
        .select({
          emoji: channelMessageReactions.emoji,
          agentId: channelMessageReactions.agentId,
          userId: channelMessageReactions.userId,
        })
        .from(channelMessageReactions)
        .where(eq(channelMessageReactions.messageId, messageId));

      // Group by emoji
      const grouped = new Map<string, { emoji: string; count: number; agents: { agentId: string | null; userId: string | null }[] }>();
      for (const row of rows) {
        const existing = grouped.get(row.emoji);
        if (existing) {
          existing.count++;
          existing.agents.push({ agentId: row.agentId, userId: row.userId });
        } else {
          grouped.set(row.emoji, {
            emoji: row.emoji,
            count: 1,
            agents: [{ agentId: row.agentId, userId: row.userId }],
          });
        }
      }

      return Array.from(grouped.values());
    },

    async search(companyId: string, query: string, opts?: { channelId?: string; limit?: number }) {
      const limit = opts?.limit ?? 25;
      const conditions = [eq(channelMessages.companyId, companyId), isNull(channelMessages.deletedAt)];
      if (opts?.channelId) conditions.push(eq(channelMessages.channelId, opts.channelId));

      const pattern = `%${query}%`;
      conditions.push(sql`${channelMessages.body} ILIKE ${pattern}`);

      const rows = await db
        .select({
          id: channelMessages.id,
          channelId: channelMessages.channelId,
          senderAgentId: channelMessages.senderAgentId,
          senderDisplayName: channelMessages.senderDisplayName,
          messageType: channelMessages.messageType,
          body: channelMessages.body,
          createdAt: channelMessages.createdAt,
          senderAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${channelMessages.senderAgentId})`,
        })
        .from(channelMessages)
        .where(and(...conditions))
        .orderBy(desc(channelMessages.createdAt))
        .limit(limit);

      return rows;
    },

    sendTypingIndicator(channelId: string, agentId: string) {
      // We need the companyId to publish; fetch it from the channel
      // Since this is a lightweight indicator, we publish with a placeholder approach
      // In practice the caller should pass companyId, but we handle it gracefully
      db.select({ companyId: channels.companyId })
        .from(channels)
        .where(eq(channels.id, channelId))
        .then(([ch]) => {
          if (ch) {
            publishLiveEvent({
              companyId: ch.companyId,
              type: "channel.typing",
              payload: { channelId, agentId },
            });
          }
        });
    },
  };
}
