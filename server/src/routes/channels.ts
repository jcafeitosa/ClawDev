/**
 * Channel routes — Elysia port.
 *
 * Slack-like channel system: CRUD, members, messages, reactions, pins, bookmarks, search, typing.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logActivity } from "../services/index.js";
import { channelService } from "../services/channels.js";
import { channelMessageService } from "../services/channel-messages.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "channels-routes" });

export function channelRoutes(db: Db) {
  const ch = channelService(db);
  const msg = channelMessageService(db);

  return new Elysia()
    // ── Channels CRUD ───────────────────────────────────────────────

    .get(
      "/companies/:companyId/channels",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const actorInfo = getActorInfo(actor);
          return ch.list(params.companyId, {
            type: query?.type ?? undefined,
            includeArchived: query?.includeArchived === "true",
            agentId: actorInfo.agentId ?? undefined,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list channels");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    .post(
      "/companies/:companyId/channels",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          const actorInfo = getActorInfo(actor);

          const channel = await ch.create(params.companyId, body, {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "channel.created",
            entityType: "channel",
            entityId: channel.id,
            details: { name: channel.name, type: body.type },
          });

          set.status = 201;
          return channel;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create channel");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    .get(
      "/channels/:channelId",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const channel = await ch.getById(params.channelId);
          if (!channel) { set.status = 404; return { error: "Channel not found" }; }
          return channel;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get channel");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .patch(
      "/channels/:channelId",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          return ch.update(params.channelId, body);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update channel");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .delete(
      "/channels/:channelId",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          return ch.archive(params.channelId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to archive channel");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    // ── Auto-create helpers ─────────────────────────────────────────

    .get(
      "/companies/:companyId/channels/general",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          return ch.getOrCreateGeneral(params.companyId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get or create general channel");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    .post(
      "/companies/:companyId/channels/direct",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          return ch.getOrCreateDirect(params.companyId, body.agentIdA, body.agentIdB);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get or create direct channel");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // ── Members ─────────────────────────────────────────────────────

    .get(
      "/channels/:channelId/members",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          return ch.listMembers(params.channelId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list channel members");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .post(
      "/channels/:channelId/members",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const member = await ch.join(params.channelId, body);
          set.status = 201;
          return member;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to add channel member");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .delete(
      "/channels/:channelId/members/:memberId",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          return ch.leave(params.channelId, body ?? { agentId: params.memberId });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to remove channel member");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String(), memberId: t.String() }) },
    )

    .patch(
      "/channels/:channelId/members/:memberId",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          return ch.updateMember(params.channelId, params.memberId, body);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update channel member");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String(), memberId: t.String() }) },
    )

    // ── Agent channel list + unread ─────────────────────────────────

    .get(
      "/agents/:id/channels",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          return ch.listForAgent(params.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list agent channels");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    .get(
      "/agents/:id/unread-summary",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          return ch.getUnreadSummary(params.id);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get unread summary");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Read cursor ─────────────────────────────────────────────────

    .post(
      "/channels/:channelId/read-cursor",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          return ch.updateReadCursor(params.channelId, {
            agentId: actorInfo.agentId ?? body.agentId,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : body.userId,
          }, body.lastReadMessageId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update read cursor");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    // ── Bookmarks ───────────────────────────────────────────────────

    .get(
      "/channels/:channelId/bookmarks",
      async (ctx: any) => {
        try {
          return ch.listBookmarks(ctx.params.channelId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list bookmarks");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .post(
      "/channels/:channelId/bookmarks",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          const bm = await ch.addBookmark(params.channelId, {
            ...body,
            createdByAgentId: actorInfo.agentId ?? undefined,
            createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });
          set.status = 201;
          return bm;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to add bookmark");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .delete(
      "/channel-bookmarks/:bookmarkId",
      async (ctx: any) => {
        try {
          return ch.removeBookmark(ctx.params.bookmarkId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to remove bookmark");
          throw err;
        }
      },
      { params: t.Object({ bookmarkId: t.String() }) },
    )

    // ── Messages ────────────────────────────────────────────────────

    .get(
      "/channels/:channelId/messages",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          return msg.list(params.channelId, {
            before: query?.before ?? undefined,
            limit: query?.limit ? parseInt(query.limit) : undefined,
            threadId: query?.threadId ?? undefined,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list messages");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .post(
      "/channels/:channelId/messages",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);

          const channel = await ch.getById(params.channelId);
          if (!channel) { set.status = 404; return { error: "Channel not found" }; }

          const message = await msg.send(params.channelId, channel.companyId, {
            agentId: actorInfo.agentId ?? body.senderAgentId,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : body.senderUserId,
            externalId: body.senderExternalId,
            displayName: body.senderDisplayName,
          }, body);

          set.status = 201;
          return message;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to send message");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    .get(
      "/channel-messages/:messageId",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const m = await msg.getById(ctx.params.messageId);
          if (!m) { set.status = 404; return { error: "Message not found" }; }
          return m;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get message");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    .patch(
      "/channel-messages/:messageId",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          const updated = await msg.edit(params.messageId, actorInfo.agentId ?? body.senderAgentId, body.body);
          if (!updated) { set.status = 403; return { error: "Cannot edit" }; }
          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to edit message");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    .delete(
      "/channel-messages/:messageId",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          const deleted = await msg.softDelete(params.messageId, actorInfo.agentId ?? "");
          if (!deleted) { set.status = 403; return { error: "Cannot delete" }; }
          return deleted;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to delete message");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    // ── Pins ────────────────────────────────────────────────────────

    .post(
      "/channel-messages/:messageId/pin",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          return msg.pin(params.messageId, actorInfo.agentId ?? null);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to pin message");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    .delete(
      "/channel-messages/:messageId/pin",
      async (ctx: any) => {
        try {
          return msg.unpin(ctx.params.messageId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to unpin message");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    .get(
      "/channels/:channelId/pinned",
      async (ctx: any) => {
        try {
          return msg.listPinned(ctx.params.channelId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list pinned messages");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    )

    // ── Reactions ───────────────────────────────────────────────────

    .post(
      "/channel-messages/:messageId/reactions",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          await msg.addReaction(params.messageId, body.emoji, {
            agentId: actorInfo.agentId ?? body.agentId,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : body.userId,
          });
          set.status = 201;
          return { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to add reaction");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    .delete(
      "/channel-messages/:messageId/reactions/:emoji",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          await msg.removeReaction(params.messageId, decodeURIComponent(params.emoji), {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });
          return { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to remove reaction");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String(), emoji: t.String() }) },
    )

    .get(
      "/channel-messages/:messageId/reactions",
      async (ctx: any) => {
        try {
          return msg.listReactions(ctx.params.messageId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list reactions");
          throw err;
        }
      },
      { params: t.Object({ messageId: t.String() }) },
    )

    // ── Search ──────────────────────────────────────────────────────

    .get(
      "/companies/:companyId/channels/search",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          return msg.search(params.companyId, query?.q ?? "", {
            channelId: query?.channelId ?? undefined,
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to search channels");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // ── Typing indicator ────────────────────────────────────────────

    .post(
      "/channels/:channelId/typing",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actorInfo = getActorInfo(ctx.actor as Actor);
          msg.sendTypingIndicator(params.channelId, actorInfo.agentId ?? "");
          return { ok: true };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to send typing indicator");
          throw err;
        }
      },
      { params: t.Object({ channelId: t.String() }) },
    );
}
