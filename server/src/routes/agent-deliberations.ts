/**
 * Agent Deliberation routes — Elysia port.
 *
 * Create deliberations, cast votes, resolve decisions.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logActivity } from "../services/index.js";
import { agentDeliberationService } from "../services/agent-deliberations.js";
import { logger } from "../middleware/logger.js";



export function agentDeliberationRoutes(db: Db) {
  const deliberations = agentDeliberationService(db);

  return new Elysia()
    // List deliberations for company
    .get(
      "/companies/:companyId/agent-deliberations",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          return deliberations.list(params.companyId, {
            status: query?.status ?? undefined,
            teamId: query?.teamId ?? undefined,
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (err) {
          logger.error({ err: err }, "Error listing deliberations");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Create deliberation
    .post(
      "/companies/:companyId/agent-deliberations",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const actorInfo = getActorInfo(actor);
          const delib = await deliberations.create(params.companyId, body, {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "deliberation.created",
            entityType: "deliberation",
            entityId: delib.id,
            details: { topic: delib.topic, participantCount: body.participantAgentIds?.length ?? 0 },
          });

          set.status = 201;
          return delib;
        } catch (err) {
          logger.error({ err: err }, "Error creating deliberation");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // Get deliberation by ID
    .get(
      "/agent-deliberations/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const result = await deliberations.getById(params.id);
          if (!result) {
            set.status = 404;
            return { error: "Deliberation not found" };
          }
          return result;
        } catch (err) {
          logger.error({ err: err }, "Error getting deliberation");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Cast vote
    .post(
      "/agent-deliberations/:id/vote",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const vote = await deliberations.castVote(params.id, body.agentId, {
            position: body.position,
            reasoning: body.reasoning,
            weight: body.weight,
          });

          const actorInfo = getActorInfo(ctx.actor as Actor);
          const delibForLog = await deliberations.getById(params.id);
          await logActivity(db, {
            companyId: delibForLog?.deliberation?.companyId ?? body.companyId ?? "",
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "deliberation.vote_cast",
            entityType: "deliberation",
            entityId: params.id,
            details: { position: body.position },
          });

          set.status = 201;
          return vote;
        } catch (err) {
          logger.error({ err: err }, "Error casting vote");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get votes for deliberation
    .get(
      "/agent-deliberations/:id/votes",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          return deliberations.listVotes(params.id);
        } catch (err) {
          logger.error({ err: err }, "Error listing votes");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Resolve deliberation
    .post(
      "/agent-deliberations/:id/resolve",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const resolved = await deliberations.resolve(params.id);
          if (!resolved) {
            set.status = 422;
            return { error: "Cannot resolve deliberation" };
          }

          const actorInfo = getActorInfo(ctx.actor as Actor);
          await logActivity(db, {
            companyId: resolved.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "deliberation.resolved",
            entityType: "deliberation",
            entityId: params.id,
            details: { decision: resolved.decision },
          });

          return resolved;
        } catch (err) {
          logger.error({ err: err }, "Error resolving deliberation");
          throw err;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}
