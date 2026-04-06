/**
 * Agent Delegation routes — Elysia port.
 *
 * Create, accept, reject, complete, escalate, and list delegations.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logActivity } from "../services/index.js";
import { agentDelegationService } from "../services/agent-delegations.js";
import { agentEscalationService } from "../services/agent-escalation.js";

export function agentDelegationRoutes(db: Db) {
  const delegations = agentDelegationService(db);
  const escalation = agentEscalationService(db);

  return new Elysia()
    // Create delegation
    .post(
      "/agents/:id/delegations",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const actor = ctx.actor as Actor;
        const actorInfo = getActorInfo(actor);

        const companyId = body.companyId;
        if (companyId) assertCompanyAccess(actor, companyId);

        const delegation = await delegations.delegate(companyId, params.id, {
          toAgentId: body.toAgentId,
          delegationType: body.delegationType,
          issueId: body.issueId,
          teamTaskId: body.teamTaskId,
          instructions: body.instructions,
          metadata: body.metadata,
        });

        await logActivity(db, {
          companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "delegation.created",
          entityType: "delegation",
          entityId: delegation.id,
          details: {
            fromAgentId: params.id,
            toAgentId: body.toAgentId,
            delegationType: body.delegationType ?? "task",
          },
        });

        set.status = 201;
        return delegation;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // List delegations for agent
    .get(
      "/agents/:id/delegations",
      async (ctx: any) => {
        const { params, query } = ctx;
        return delegations.listForAgent(params.id, {
          role: query?.role ?? undefined,
          status: query?.status ?? undefined,
          limit: query?.limit ? parseInt(query.limit) : undefined,
        });
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get delegation by ID
    .get(
      "/agent-delegations/:id",
      async (ctx: any) => {
        const { params, set } = ctx;
        const delegation = await delegations.getById(params.id);
        if (!delegation) {
          set.status = 404;
          return { error: "Delegation not found" };
        }
        return delegation;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Accept delegation
    .post(
      "/agent-delegations/:id/accept",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const updated = await delegations.accept(params.id, body.agentId);
        if (!updated) {
          set.status = 409;
          return { error: "Delegation cannot be accepted (wrong status or agent)" };
        }

        const actorInfo = getActorInfo(ctx.actor as Actor);
        await logActivity(db, {
          companyId: updated.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "delegation.accepted",
          entityType: "delegation",
          entityId: params.id,
        });

        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Reject delegation
    .post(
      "/agent-delegations/:id/reject",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const updated = await delegations.reject(params.id, body.agentId, body.reason);
        if (!updated) {
          set.status = 409;
          return { error: "Delegation cannot be rejected (wrong status or agent)" };
        }

        const actorInfo = getActorInfo(ctx.actor as Actor);
        await logActivity(db, {
          companyId: updated.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "delegation.rejected",
          entityType: "delegation",
          entityId: params.id,
        });

        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Complete delegation
    .post(
      "/agent-delegations/:id/complete",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const updated = await delegations.complete(params.id, body.agentId, body.result);
        if (!updated) {
          set.status = 409;
          return { error: "Delegation cannot be completed (wrong status or agent)" };
        }

        const actorInfo = getActorInfo(ctx.actor as Actor);
        await logActivity(db, {
          companyId: updated.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "delegation.completed",
          entityType: "delegation",
          entityId: params.id,
        });

        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Escalate delegation
    .post(
      "/agent-delegations/:id/escalate",
      async (ctx: any) => {
        const { params, set } = ctx;
        const newDelegation = await delegations.escalate(params.id);
        if (!newDelegation) {
          set.status = 422;
          return { error: "Cannot escalate: no manager found in chain of command" };
        }

        const actorInfo = getActorInfo(ctx.actor as Actor);
        await logActivity(db, {
          companyId: newDelegation.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "delegation.escalated",
          entityType: "delegation",
          entityId: newDelegation.id,
          details: { originalDelegationId: params.id },
        });

        return newDelegation;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Cancel delegation
    .delete(
      "/agent-delegations/:id",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const updated = await delegations.cancel(params.id, body?.agentId);
        if (!updated) {
          set.status = 404;
          return { error: "Delegation not found or not authorized" };
        }

        const actorInfo = getActorInfo(ctx.actor as Actor);
        await logActivity(db, {
          companyId: updated.companyId,
          actorType: actorInfo.actorType,
          actorId: actorInfo.actorId,
          agentId: actorInfo.agentId,
          action: "delegation.cancelled",
          entityType: "delegation",
          entityId: params.id,
        });

        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Escalation shortcuts ────────────────────────────────────────

    // Escalate to manager
    .post(
      "/agents/:id/escalate/manager",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const result = await escalation.escalateToManager(body.companyId, params.id, {
          issueId: body.issueId,
          reason: body.reason,
        });
        if (!result) {
          set.status = 422;
          return { error: "No manager found in chain of command" };
        }
        return result;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Escalate to team lead
    .post(
      "/agents/:id/escalate/team-lead",
      async (ctx: any) => {
        const { params, body, set } = ctx;
        const result = await escalation.escalateToTeamLead(body.companyId, params.id, body.teamId, {
          issueId: body.issueId,
          reason: body.reason,
        });
        if (!result) {
          set.status = 422;
          return { error: "Cannot escalate: no lead or manager found" };
        }
        return result;
      },
      { params: t.Object({ id: t.String() }) },
    );
}
