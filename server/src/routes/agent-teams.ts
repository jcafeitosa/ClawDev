/**
 * Agent Teams routes — Elysia port.
 *
 * CRUD for agent teams, members, messages, tasks, and delegations.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logActivity } from "../services/index.js";
import { agentTeamService } from "../services/agent-teams.js";
import { agentMessageService } from "../services/agent-messages.js";
import { teamTaskService } from "../services/team-tasks.js";
import { logger } from "../middleware/logger.js";

export function agentTeamRoutes(db: Db) {
  const log = logger.child({ service: "agent-teams-routes" });
  const teams = agentTeamService(db);
  const messages = agentMessageService(db);
  const tasks = teamTaskService(db);

  return new Elysia()
    // ── Teams CRUD ──────────────────────────────────────────────────

    // List teams for a company
    .get(
      "/companies/:companyId/agent-teams",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          return teams.list(params.companyId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list agent teams");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Create team
    .post(
      "/companies/:companyId/agent-teams",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const actorInfo = getActorInfo(actor);
          const team = await teams.create(params.companyId, body, {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "agent_team.created",
            entityType: "agent_team",
            entityId: team.id,
            details: { name: team.name, memberCount: body.memberAgentIds?.length ?? 0 },
          });

          set.status = 201;
          return team;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create agent team");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Get team by ID
    .get(
      "/agent-teams/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);
          return team;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get agent team");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update team
    .patch(
      "/agent-teams/:id",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;

          const existing = await teams.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, existing.companyId);

          const updated = await teams.update(params.id, body);
          if (!updated) {
            set.status = 404;
            return { error: "Team not found" };
          }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: existing.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "agent_team.updated",
            entityType: "agent_team",
            entityId: params.id,
            details: body,
          });

          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update agent team");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Dissolve team
    .delete(
      "/agent-teams/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;

          const existing = await teams.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, existing.companyId);

          const dissolved = await teams.dissolve(params.id);

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: existing.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "agent_team.dissolved",
            entityType: "agent_team",
            entityId: params.id,
          });

          return dissolved;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to dissolve agent team");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Members ─────────────────────────────────────────────────────

    // Add member
    .post(
      "/agent-teams/:id/members",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;

          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);

          const actorInfo = getActorInfo(actor);
          const member = await teams.addMember(params.id, body.agentId, body.role ?? "member", {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          await logActivity(db, {
            companyId: team.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "agent_team.member_added",
            entityType: "agent_team",
            entityId: params.id,
            details: { agentId: body.agentId, role: body.role },
          });

          set.status = 201;
          return member;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to add member to agent team");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Remove member
    .delete(
      "/agent-teams/:id/members/:agentId",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;

          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);

          const removed = await teams.removeMember(params.id, params.agentId);
          if (!removed) {
            set.status = 404;
            return { error: "Member not found" };
          }

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: team.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "agent_team.member_removed",
            entityType: "agent_team",
            entityId: params.id,
            details: { agentId: params.agentId },
          });

          return removed;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to remove member from agent team");
          throw err;
        }
      },
      { params: t.Object({ id: t.String(), agentId: t.String() }) },
    )

    // Transfer lead
    .post(
      "/agent-teams/:id/transfer-lead",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;

          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);

          const updated = await teams.transferLead(params.id, body.newLeadAgentId);
          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to transfer lead in agent team");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Messages ────────────────────────────────────────────────────

    // Send message
    .post(
      "/agents/:id/messages",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          // Determine companyId from the agent
          const companyId = actor.type === "agent" ? (actor as any).companyId : body.companyId;
          if (companyId) assertCompanyAccess(actor, companyId);

          const message = await messages.send(companyId ?? "", {
            fromAgentId: params.id,
            ...body,
          });

          set.status = 201;
          return message;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to send agent message");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get agent inbox
    .get(
      "/agents/:id/messages",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          return messages.listForAgent(params.id, {
            unreadOnly: query?.unreadOnly === "true",
            messageType: query?.messageType ?? undefined,
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list agent messages");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get unread count
    .get(
      "/agents/:id/messages/unread-count",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const count = await messages.getUnreadCount(params.id);
          return { count };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get unread message count");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get thread
    .get(
      "/agent-messages/thread/:threadId",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          return messages.listThread(params.threadId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list agent message thread");
          throw err;
        }
      },
      { params: t.Object({ threadId: t.String() }) },
    )

    // Mark as read
    .patch(
      "/agent-messages/:id/read",
      async (ctx: any) => {
        try {
          const { params, body } = ctx;
          return messages.markAsRead(params.id, body.agentId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to mark agent message as read");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Team messages
    .get(
      "/agent-teams/:id/messages",
      async (ctx: any) => {
        try {
          const { params, query, set } = ctx;
          const actor = ctx.actor as Actor;

          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);

          return messages.listForTeam(params.id, {
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list agent team messages");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Team Tasks ──────────────────────────────────────────────────

    // List tasks
    .get(
      "/agent-teams/:id/tasks",
      async (ctx: any) => {
        try {
          const { params, query, set } = ctx;
          const actor = ctx.actor as Actor;

          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);

          return tasks.list(params.id, {
            status: query?.status ?? undefined,
            assignedAgentId: query?.assignedAgentId ?? undefined,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list team tasks");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create task
    .post(
      "/agent-teams/:id/tasks",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;

          const team = await teams.getById(params.id);
          if (!team) {
            set.status = 404;
            return { error: "Team not found" };
          }
          assertCompanyAccess(actor, team.companyId);

          const actorInfo = getActorInfo(actor);
          const task = await tasks.create(params.id, team.companyId, {
            ...body,
            createdByAgentId: actorInfo.agentId ?? body.createdByAgentId,
          });

          await logActivity(db, {
            companyId: team.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "team_task.created",
            entityType: "team_task",
            entityId: task.id,
            details: { teamId: params.id, title: task.title },
          });

          set.status = 201;
          return task;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to create team task");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Claim task
    .post(
      "/team-tasks/:id/claim",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const claimed = await tasks.claim(params.id, body.agentId);
          if (!claimed) {
            set.status = 409;
            return { error: "Task cannot be claimed (wrong status or already claimed)" };
          }
          return claimed;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to claim team task");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update task
    .patch(
      "/team-tasks/:id",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const updated = await tasks.update(params.id, body);
          if (!updated) {
            set.status = 404;
            return { error: "Task not found" };
          }

          // Auto-unblock dependent tasks when a task is completed
          if (body.status === "completed" && updated.teamId) {
            await tasks.autoUnblock(updated.teamId);
          }

          return updated;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to update team task");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}
