/**
 * Agent Pipeline routes — Elysia port.
 *
 * CRUD for pipelines + execution management.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logActivity } from "../services/index.js";
import { agentPipelineService } from "../services/agent-pipelines.js";
import { logger } from "../lib/logger.js";

export function agentPipelineRoutes(db: Db) {
  const pipelines = agentPipelineService(db);

  return new Elysia()
    // ── Pipeline CRUD ───────────────────────────────────────────────

    // List pipelines for company
    .get(
      "/companies/:companyId/agent-pipelines",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);
          return pipelines.list(params.companyId, {
            status: query?.status ?? undefined,
            teamId: query?.teamId ?? undefined,
          });
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: companyIdParam },
    )

    // Create pipeline
    .post(
      "/companies/:companyId/agent-pipelines",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const actorInfo = getActorInfo(actor);
          const pipeline = await pipelines.create(params.companyId, body, {
            agentId: actorInfo.agentId ?? undefined,
            userId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          await logActivity(db, {
            companyId: params.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "pipeline.created",
            entityType: "pipeline",
            entityId: pipeline.id,
            details: { name: pipeline.name, stepCount: body.steps?.length ?? 0 },
          });

          set.status = 201;
          return pipeline;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: companyIdParam },
    )

    // Get pipeline by ID
    .get(
      "/agent-pipelines/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const pipeline = await pipelines.getById(params.id);
          if (!pipeline) {
            set.status = 404;
            return { error: "Pipeline not found" };
          }
          assertCompanyAccess(actor, pipeline.companyId);
          return pipeline;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update pipeline
    .patch(
      "/agent-pipelines/:id",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;

          const existing = await pipelines.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Pipeline not found" };
          }
          assertCompanyAccess(actor, existing.companyId);

          const updated = await pipelines.update(params.id, body);

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: existing.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "pipeline.updated",
            entityType: "pipeline",
            entityId: params.id,
            details: body,
          });

          return updated;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Delete pipeline
    .delete(
      "/agent-pipelines/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;

          const existing = await pipelines.getById(params.id);
          if (!existing) {
            set.status = 404;
            return { error: "Pipeline not found" };
          }
          assertCompanyAccess(actor, existing.companyId);

          const deleted = await pipelines.remove(params.id);

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: existing.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "pipeline.deleted",
            entityType: "pipeline",
            entityId: params.id,
          });

          return deleted;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Execution ───────────────────────────────────────────────────

    // Execute pipeline
    .post(
      "/agent-pipelines/:id/execute",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const actor = ctx.actor as Actor;

          const pipeline = await pipelines.getById(params.id);
          if (!pipeline) {
            set.status = 404;
            return { error: "Pipeline not found" };
          }
          assertCompanyAccess(actor, pipeline.companyId);

          const actorInfo = getActorInfo(actor);
          const execution = await pipelines.execute(params.id, {
            issueId: body?.issueId,
            context: body?.context,
            triggeredByAgentId: actorInfo.agentId ?? undefined,
            triggeredByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : undefined,
          });

          if (!execution) {
            set.status = 422;
            return { error: "Pipeline cannot be executed (must be active)" };
          }

          await logActivity(db, {
            companyId: pipeline.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "pipeline.executed",
            entityType: "pipeline_execution",
            entityId: execution.id,
            details: { pipelineId: params.id, pipelineName: pipeline.name },
          });

          set.status = 201;
          return execution;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // List executions for pipeline
    .get(
      "/agent-pipelines/:id/executions",
      async (ctx: any) => {
        try {
          const { params, query, set } = ctx;
          const actor = ctx.actor as Actor;

          const pipeline = await pipelines.getById(params.id);
          if (!pipeline) {
            set.status = 404;
            return { error: "Pipeline not found" };
          }
          assertCompanyAccess(actor, pipeline.companyId);

          return pipelines.listExecutions(params.id, {
            status: query?.status ?? undefined,
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get execution
    .get(
      "/pipeline-executions/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const execution = await pipelines.getExecution(params.id);
          if (!execution) {
            set.status = 404;
            return { error: "Execution not found" };
          }
          return execution;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Report step result
    .post(
      "/pipeline-executions/:id/step-result",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const updated = await pipelines.handleStepResult(params.id, body.stepIndex, {
            status: body.status,
            result: body.result,
            error: body.error,
          });
          if (!updated) {
            set.status = 422;
            return { error: "Cannot update step (execution not running or not found)" };
          }
          return updated;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Cancel execution
    .post(
      "/pipeline-executions/:id/cancel",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const cancelled = await pipelines.cancelExecution(params.id);
          if (!cancelled) {
            set.status = 422;
            return { error: "Execution cannot be cancelled" };
          }
          return cancelled;
        } catch (error) {
          logger.error("http.error", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}
