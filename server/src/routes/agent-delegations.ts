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
import { agentHookService } from "../services/agent-hooks.js";
import { logger } from "../logger.js";

export function agentDelegationRoutes(db: Db) {
  const delegations = agentDelegationService(db);
  const escalation = agentEscalationService(db);
  const hookSvc = agentHookService(db);

  return new Elysia()
    // Create delegation
    .post(
      "/agents/:id/delegations",
      async (ctx: any) => {
        try {
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

          hookSvc.fireEvent(delegation.companyId, body.toAgentId, "delegation.created" as any, {
            delegationId: delegation.id, fromAgentId: params.id, delegationType: body.delegationType,
          }).catch(() => {});

          set.status = 201;
          return delegation;
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agents/:id/delegations" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // List delegations for agent
    .get(
      "/agents/:id/delegations",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          return delegations.listForAgent(params.id, {
            role: query?.role ?? undefined,
            status: query?.status ?? undefined,
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "GET /agents/:id/delegations" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get delegation by ID
    .get(
      "/agent-delegations/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const delegation = await delegations.getById(params.id);
          if (!delegation) {
            set.status = 404;
            return { error: "Delegation not found" };
          }
          return delegation;
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "GET /agent-delegations/:id" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Accept delegation
    .post(
      "/agent-delegations/:id/accept",
      async (ctx: any) => {
        try {
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
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agent-delegations/:id/accept" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Reject delegation
    .post(
      "/agent-delegations/:id/reject",
      async (ctx: any) => {
        try {
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
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agent-delegations/:id/reject" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Complete delegation
    .post(
      "/agent-delegations/:id/complete",
      async (ctx: any) => {
        try {
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

          hookSvc.fireEvent(updated.companyId, updated.fromAgentId, "delegation.completed" as any, {
            delegationId: updated.id, completedByAgentId: body.agentId, result: body.result,
          }).catch(() => {});

          return updated;
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agent-delegations/:id/complete" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Escalate delegation
    .post(
      "/agent-delegations/:id/escalate",
      async (ctx: any) => {
        try {
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
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agent-delegations/:id/escalate" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Cancel delegation
    .delete(
      "/agent-delegations/:id",
      async (ctx: any) => {
        try {
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
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "DELETE /agent-delegations/:id" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Escalation shortcuts ────────────────────────────────────────

    // Escalate to manager
    .post(
      "/agents/:id/escalate/manager",
      async (ctx: any) => {
        try {
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
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agents/:id/escalate/manager" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Escalate to team lead
    .post(
      "/agents/:id/escalate/team-lead",
      async (ctx: any) => {
        try {
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
        } catch (error) {
          logger.error("http.error", { message: (error instanceof Error ? error.message : String(error)), route: "POST /agents/:id/escalate/team-lead" });
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}
