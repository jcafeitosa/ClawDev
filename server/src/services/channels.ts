import { and, eq, desc, sql, isNull, ne } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { channels, channelMembers, channelMessages, channelReadCursors, channelBookmarks, agents } from "@clawdev/db";
import { publishLiveEvent } from "./live-events.js";

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export function channelService(db: Db) {
  return {
    async list(companyId: string, opts?: { type?: string; includeArchived?: boolean; agentId?: string }) {
      const conditions = [eq(channels.companyId, companyId)];
      if (opts?.type) conditions.push(eq(channels.type, opts.type));
      if (!opts?.includeArchived) conditions.push(eq(channels.isArchived, false));

      const rows = await db
        .select({
          ...{
            id: channels.id,
            companyId: channels.companyId,
            name: channels.name,
            slug: channels.slug,
            description: channels.description,
            topic: channels.topic,
            type: channels.type,
            teamId: channels.teamId,
            projectId: channels.projectId,
            isPrivate: channels.isPrivate,
            isArchived: channels.isArchived,
            bridgeType: channels.bridgeType,
            bridgeConfig: channels.bridgeConfig,
            lastMessageAt: channels.lastMessageAt,
            messageCount: channels.messageCount,
            memberCount: channels.memberCount,
            createdByAgentId: channels.createdByAgentId,
            createdByUserId: channels.createdByUserId,
            metadata: channels.metadata,
            createdAt: channels.createdAt,
            updatedAt: channels.updatedAt,
          },
          ...(opts?.agentId
            ? {
                unreadCount: sql<number>`(
                  SELECT count(*) FROM channel_messages cm
                  WHERE cm.channel_id = ${channels.id}
                  AND cm.deleted_at IS NULL
                  AND cm.created_at > COALESCE(
                    (SELECT last_read_at FROM channel_read_cursors rc WHERE rc.channel_id = ${channels.id} AND rc.agent_id = ${opts.agentId}),
                    '1970-01-01'
                  )
                )`,
              }
            : {}),
        })
        .from(channels)
        .where(and(...conditions))
        .orderBy(desc(channels.lastMessageAt));

      return rows;
    },

    async getById(channelId: string) {
      const [row] = await db
        .select({
          id: channels.id,
          companyId: channels.companyId,
          name: channels.name,
          slug: channels.slug,
          description: channels.description,
          topic: channels.topic,
          type: channels.type,
          teamId: channels.teamId,
          projectId: channels.projectId,
          isPrivate: channels.isPrivate,
          isArchived: channels.isArchived,
          bridgeType: channels.bridgeType,
          bridgeConfig: channels.bridgeConfig,
          lastMessageAt: channels.lastMessageAt,
          messageCount: channels.messageCount,
          memberCount: channels.memberCount,
          createdByAgentId: channels.createdByAgentId,
          createdByUserId: channels.createdByUserId,
          metadata: channels.metadata,
          createdAt: channels.createdAt,
          updatedAt: channels.updatedAt,
          pinnedMessageCount: sql<number>`(SELECT count(*) FROM channel_messages WHERE channel_id = ${channelId} AND is_pinned = true AND deleted_at IS NULL)`,
          bookmarkCount: sql<number>`(SELECT count(*) FROM channel_bookmarks WHERE channel_id = ${channelId})`,
        })
        .from(channels)
        .where(eq(channels.id, channelId));

      return row ?? null;
    },

    async create(
      companyId: string,
      data: {
        name: string;
        description?: string;
        topic?: string;
        type?: string;
        teamId?: string;
        projectId?: string;
        isPrivate?: boolean;
        bridgeType?: string;
        bridgeConfig?: Record<string, unknown>;
      },
      createdBy?: { agentId?: string; userId?: string },
    ) {
      const slug = slugify(data.name);

      const [channel] = await db
        .insert(channels)
        .values({
          companyId,
          name: data.name,
          slug,
          description: data.description,
          topic: data.topic,
          type: data.type ?? "public",
          teamId: data.teamId,
          projectId: data.projectId,
          isPrivate: data.isPrivate ?? false,
          bridgeType: data.bridgeType ?? "internal",
          bridgeConfig: data.bridgeConfig ?? {},
          createdByAgentId: createdBy?.agentId,
          createdByUserId: createdBy?.userId,
        })
        .returning();

      if (createdBy?.agentId) {
        await db
          .insert(channelMembers)
          .values({
            channelId: channel.id,
            agentId: createdBy.agentId,
            role: "owner",
          })
          .onConflictDoNothing();

        await db
          .update(channels)
          .set({ memberCount: sql`${channels.memberCount} + 1` })
          .where(eq(channels.id, channel.id));
      }

      publishLiveEvent({
        companyId,
        type: "channel.created",
        payload: { channelId: channel.id, name: channel.name, type: channel.type },
      });

      return channel;
    },

    async update(
      channelId: string,
      data: Partial<{
        name: string;
        description: string;
        topic: string;
        isPrivate: boolean;
        isArchived: boolean;
        bridgeType: string;
        bridgeConfig: Record<string, unknown>;
      }>,
    ) {
      const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (data.name) {
        patch.slug = slugify(data.name);
      }

      const [updated] = await db.update(channels).set(patch).where(eq(channels.id, channelId)).returning();

      if (updated) {
        publishLiveEvent({
          companyId: updated.companyId,
          type: "channel.updated",
          payload: { channelId: updated.id, name: updated.name },
        });
      }

      return updated ?? null;
    },

    async archive(channelId: string) {
      const [updated] = await db
        .update(channels)
        .set({ isArchived: true, updatedAt: new Date() })
        .where(eq(channels.id, channelId))
        .returning();

      if (updated) {
        publishLiveEvent({
          companyId: updated.companyId,
          type: "channel.archived",
          payload: { channelId: updated.id, name: updated.name },
        });
      }

      return updated ?? null;
    },

    async getOrCreateGeneral(companyId: string) {
      const [existing] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.companyId, companyId), eq(channels.type, "general")));

      if (existing) return existing;

      const [channel] = await db
        .insert(channels)
        .values({
          companyId,
          name: "general",
          slug: "general",
          type: "general",
        })
        .returning();

      return channel;
    },

    async getOrCreateDirect(companyId: string, agentIdA: string, agentIdB: string) {
      const [sortedA, sortedB] = [agentIdA, agentIdB].sort();

      // Find existing direct channel with both agents as active members
      const existing = await db
        .select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .innerJoin(channels, eq(channels.id, channelMembers.channelId))
        .where(
          and(
            eq(channels.companyId, companyId),
            eq(channels.type, "direct"),
            eq(channelMembers.agentId, sortedA),
            isNull(channelMembers.leftAt),
          ),
        );

      for (const row of existing) {
        const [hasBoth] = await db
          .select({ id: channelMembers.id })
          .from(channelMembers)
          .where(
            and(
              eq(channelMembers.channelId, row.channelId),
              eq(channelMembers.agentId, sortedB),
              isNull(channelMembers.leftAt),
            ),
          );
        if (hasBoth) {
          const [ch] = await db.select().from(channels).where(eq(channels.id, row.channelId));
          return ch;
        }
      }

      // Create new direct channel
      const name = `dm-${sortedA}-${sortedB}`;
      const [channel] = await db
        .insert(channels)
        .values({
          companyId,
          name,
          slug: slugify(name),
          type: "direct",
          isPrivate: true,
          memberCount: 2,
        })
        .returning();

      await db.insert(channelMembers).values([
        { channelId: channel.id, agentId: sortedA, role: "member" },
        { channelId: channel.id, agentId: sortedB, role: "member" },
      ]);

      return channel;
    },

    async getOrCreateDepartmentChannel(
      companyId: string,
      departmentKey: string,
      channelName: string,
      description?: string,
    ) {
      const slug = slugify(channelName);

      // Look for existing department channel by slug
      const [existing] = await db
        .select()
        .from(channels)
        .where(
          and(
            eq(channels.companyId, companyId),
            eq(channels.slug, slug),
            eq(channels.type, "department"),
          ),
        );

      if (existing) return existing;

      const [channel] = await db
        .insert(channels)
        .values({
          companyId,
          name: channelName,
          slug,
          type: "department",
          description: description ?? null,
          metadata: { departmentKey },
        } as typeof channels.$inferInsert)
        .onConflictDoNothing()
        .returning();

      // Handle race condition: if insert was a no-op, re-fetch
      if (!channel) {
        const [refetched] = await db
          .select()
          .from(channels)
          .where(
            and(
              eq(channels.companyId, companyId),
              eq(channels.slug, slug),
            ),
          );
        return refetched;
      }

      publishLiveEvent({
        companyId,
        type: "channel.created",
        payload: { channelId: channel.id, name: channel.name, type: channel.type },
      });

      return channel;
    },

    async getOrCreateTeamChannel(companyId: string, teamId: string, teamName: string) {
      const [existing] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.companyId, companyId), eq(channels.teamId, teamId)));

      if (existing) return existing;

      const [channel] = await db
        .insert(channels)
        .values({
          companyId,
          name: teamName,
          slug: slugify(teamName),
          type: "team",
          teamId,
        })
        .returning();

      return channel;
    },

    async join(channelId: string, data: { agentId?: string; userId?: string; role?: string }) {
      await db
        .insert(channelMembers)
        .values({
          channelId,
          agentId: data.agentId,
          userId: data.userId,
          role: data.role ?? "member",
        })
        .onConflictDoNothing();

      await db
        .update(channels)
        .set({ memberCount: sql`${channels.memberCount} + 1`, updatedAt: new Date() })
        .where(eq(channels.id, channelId));

      const [ch] = await db.select({ companyId: channels.companyId }).from(channels).where(eq(channels.id, channelId));
      if (ch) {
        publishLiveEvent({
          companyId: ch.companyId,
          type: "channel_member.joined",
          payload: { channelId, agentId: data.agentId, userId: data.userId },
        });
      }
    },

    async leave(channelId: string, data: { agentId?: string; userId?: string }) {
      const conditions = [eq(channelMembers.channelId, channelId), isNull(channelMembers.leftAt)];
      if (data.agentId) conditions.push(eq(channelMembers.agentId, data.agentId));
      if (data.userId) conditions.push(eq(channelMembers.userId, data.userId));

      await db
        .update(channelMembers)
        .set({ leftAt: new Date() })
        .where(and(...conditions));

      await db
        .update(channels)
        .set({ memberCount: sql`GREATEST(${channels.memberCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(channels.id, channelId));

      const [ch] = await db.select({ companyId: channels.companyId }).from(channels).where(eq(channels.id, channelId));
      if (ch) {
        publishLiveEvent({
          companyId: ch.companyId,
          type: "channel_member.left",
          payload: { channelId, agentId: data.agentId, userId: data.userId },
        });
      }
    },

    async listMembers(channelId: string) {
      const rows = await db
        .select({
          id: channelMembers.id,
          channelId: channelMembers.channelId,
          agentId: channelMembers.agentId,
          userId: channelMembers.userId,
          role: channelMembers.role,
          nickname: channelMembers.nickname,
          notificationPref: channelMembers.notificationPref,
          joinedAt: channelMembers.joinedAt,
          mutedUntil: channelMembers.mutedUntil,
          metadata: channelMembers.metadata,
          agentName: agents.name,
          agentRole: agents.role,
          agentIcon: agents.icon,
        })
        .from(channelMembers)
        .leftJoin(agents, eq(agents.id, channelMembers.agentId))
        .where(and(eq(channelMembers.channelId, channelId), isNull(channelMembers.leftAt)));

      return rows;
    },

    async updateMember(
      channelId: string,
      memberId: string,
      data: Partial<{ role: string; nickname: string; notificationPref: string; mutedUntil: Date | null }>,
    ) {
      const [updated] = await db
        .update(channelMembers)
        .set(data)
        .where(and(eq(channelMembers.id, memberId), eq(channelMembers.channelId, channelId)))
        .returning();

      return updated ?? null;
    },

    async listForAgent(agentId: string) {
      const rows = await db
        .select({
          id: channels.id,
          companyId: channels.companyId,
          name: channels.name,
          slug: channels.slug,
          description: channels.description,
          topic: channels.topic,
          type: channels.type,
          teamId: channels.teamId,
          projectId: channels.projectId,
          isPrivate: channels.isPrivate,
          isArchived: channels.isArchived,
          lastMessageAt: channels.lastMessageAt,
          messageCount: channels.messageCount,
          memberCount: channels.memberCount,
          memberRole: channelMembers.role,
          unreadCount: sql<number>`(
            SELECT count(*) FROM channel_messages cm
            WHERE cm.channel_id = ${channels.id}
            AND cm.deleted_at IS NULL
            AND cm.created_at > COALESCE(
              (SELECT last_read_at FROM channel_read_cursors rc WHERE rc.channel_id = ${channels.id} AND rc.agent_id = ${agentId}),
              '1970-01-01'
            )
          )`,
        })
        .from(channelMembers)
        .innerJoin(channels, eq(channels.id, channelMembers.channelId))
        .where(and(eq(channelMembers.agentId, agentId), isNull(channelMembers.leftAt)))
        .orderBy(desc(channels.lastMessageAt));

      return rows;
    },

    async getUnreadSummary(agentId: string) {
      const rows = await db
        .select({
          channelId: channels.id,
          channelName: channels.name,
          unreadCount: sql<number>`(
            SELECT count(*) FROM channel_messages cm
            WHERE cm.channel_id = ${channels.id}
            AND cm.deleted_at IS NULL
            AND cm.created_at > COALESCE(
              (SELECT last_read_at FROM channel_read_cursors rc WHERE rc.channel_id = ${channels.id} AND rc.agent_id = ${agentId}),
              '1970-01-01'
            )
          )`,
        })
        .from(channelMembers)
        .innerJoin(channels, eq(channels.id, channelMembers.channelId))
        .where(and(eq(channelMembers.agentId, agentId), isNull(channelMembers.leftAt)));

      return rows.filter((r) => r.unreadCount > 0);
    },

    async updateReadCursor(
      channelId: string,
      principal: { agentId?: string; userId?: string },
      lastReadMessageId: string,
    ) {
      if (principal.agentId) {
        await db
          .insert(channelReadCursors)
          .values({
            channelId,
            agentId: principal.agentId,
            lastReadMessageId,
            lastReadAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [channelReadCursors.channelId, channelReadCursors.agentId],
            set: {
              lastReadMessageId,
              lastReadAt: new Date(),
            },
          });
      }

      if (principal.userId) {
        await db
          .insert(channelReadCursors)
          .values({
            channelId,
            userId: principal.userId,
            lastReadMessageId,
            lastReadAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [channelReadCursors.channelId, channelReadCursors.userId],
            set: {
              lastReadMessageId,
              lastReadAt: new Date(),
            },
          });
      }
    },

    async addBookmark(
      channelId: string,
      data: {
        title: string;
        url?: string;
        emoji?: string;
        messageId?: string;
        createdByAgentId?: string;
        createdByUserId?: string;
      },
    ) {
      // Get max position for ordering
      const [maxPos] = await db
        .select({ maxPosition: sql<number>`COALESCE(MAX(position), -1)` })
        .from(channelBookmarks)
        .where(eq(channelBookmarks.channelId, channelId));

      const [bookmark] = await db
        .insert(channelBookmarks)
        .values({
          channelId,
          title: data.title,
          url: data.url,
          emoji: data.emoji,
          messageId: data.messageId,
          createdByAgentId: data.createdByAgentId,
          createdByUserId: data.createdByUserId,
          position: (maxPos?.maxPosition ?? -1) + 1,
        })
        .returning();

      return bookmark;
    },

    async listBookmarks(channelId: string) {
      const rows = await db
        .select()
        .from(channelBookmarks)
        .where(eq(channelBookmarks.channelId, channelId))
        .orderBy(channelBookmarks.position);

      return rows;
    },

    async removeBookmark(bookmarkId: string) {
      await db.delete(channelBookmarks).where(eq(channelBookmarks.id, bookmarkId));
    },
  };
}
