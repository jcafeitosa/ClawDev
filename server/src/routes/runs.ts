/**
 * Run routes — Elysia.
 *
 * Exposes heartbeat-runs (agent execution records) via three aliases
 * that the frontend uses: /runs, /heartbeat-runs, and /live-runs.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { agents, heartbeatRuns } from "@clawdev/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";
import { activityService, heartbeatService, workspaceOperationService } from "../services/index.js";
import { redactCurrentUserValue } from "../log-redaction.js";
import { redactEventPayload } from "../redaction.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "runs-routes" });

const RUNNING_STATUSES = ["queued", "running"] as const;

const runSelect = {
  id: heartbeatRuns.id,
  agentId: heartbeatRuns.agentId,
  status: heartbeatRuns.status,
  invocationSource: heartbeatRuns.invocationSource,
  triggerDetail: heartbeatRuns.triggerDetail,
  startedAt: heartbeatRuns.startedAt,
  finishedAt: heartbeatRuns.finishedAt,
  error: heartbeatRuns.error,
  exitCode: heartbeatRuns.exitCode,
  stdoutExcerpt: heartbeatRuns.stdoutExcerpt,
  stderrExcerpt: heartbeatRuns.stderrExcerpt,
  errorCode: heartbeatRuns.errorCode,
  externalRunId: heartbeatRuns.externalRunId,
  createdAt: heartbeatRuns.createdAt,
  agentName: agents.name,
  agentIcon: agents.icon,
  agentRole: agents.role,
};

export function runRoutes(db: Db) {
  const heartbeats = heartbeatService(db);
  const wsOps = workspaceOperationService(db);
  const activity = activityService(db);

  return new Elysia()

    // ── GET /companies/:id/heartbeat-runs ───────────────────────────
    .get(
      "/companies/:companyId/heartbeat-runs",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const rawLimit = Number(query.limit);
          const limit = rawLimit === 0 ? 0 : Math.min(rawLimit || 50, 200);
          const status = query.status as string | undefined;

          const conditions = [eq(heartbeatRuns.companyId, params.companyId)];
          if (status) conditions.push(eq(heartbeatRuns.status, status));

          if (limit === 0) {
            return [];
          }

          const rows = await db
            .select(runSelect)
            .from(heartbeatRuns)
            .leftJoin(agents, eq(agents.id, heartbeatRuns.agentId))
            .where(and(...conditions))
            .orderBy(desc(heartbeatRuns.createdAt))
            .limit(limit);

          return rows;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list heartbeat runs");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/runs (alias) ────────────────────────────
    .get(
      "/companies/:companyId/runs",
      async (ctx: any) => {
        try {
          const { params, query } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const rawLimit = Number(query.limit);
          const limit = rawLimit === 0 ? 0 : Math.min(rawLimit || 50, 200);
          const status = query.status as string | undefined;

          const conditions = [eq(heartbeatRuns.companyId, params.companyId)];
          if (status) conditions.push(eq(heartbeatRuns.status, status));

          if (limit === 0) {
            return [];
          }

          const rows = await db
            .select(runSelect)
            .from(heartbeatRuns)
            .leftJoin(agents, eq(agents.id, heartbeatRuns.agentId))
            .where(and(...conditions))
            .orderBy(desc(heartbeatRuns.createdAt))
            .limit(limit);

          return rows;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list runs");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:companyId/runs/:runId/issues ───────────────
    .get(
      "/companies/:companyId/runs/:runId/issues",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const run = await heartbeats.getRun(params.runId);
          if (!run || run.companyId !== params.companyId) {
            set.status = 404;
            return { error: "Run not found" };
          }
          assertCompanyAccess(actor, run.companyId);
          return activity.issuesForRun(params.runId);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list issues for run");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), runId: t.String() }) },
    )

    // ── GET /companies/:id/live-runs ───────────────────────────────
    .get(
      "/companies/:companyId/live-runs",
      async (ctx: any) => {
        try {
          const { params } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const rows = await db
            .select(runSelect)
            .from(heartbeatRuns)
            .leftJoin(agents, eq(agents.id, heartbeatRuns.agentId))
            .where(
              and(
                eq(heartbeatRuns.companyId, params.companyId),
                inArray(heartbeatRuns.status, [...RUNNING_STATUSES]),
              ),
            )
            .orderBy(desc(heartbeatRuns.startedAt))
            .limit(100);

          return rows;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list live runs");
          throw err;
        }
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/heartbeat-runs/:runId ────────────────────
    .get(
      "/companies/:companyId/heartbeat-runs/:runId",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          assertCompanyAccess(actor, params.companyId);

          const rows = await db
            .select({
              ...runSelect,
              usageJson: heartbeatRuns.usageJson,
              resultJson: heartbeatRuns.resultJson,
              logStore: heartbeatRuns.logStore,
              logRef: heartbeatRuns.logRef,
            })
            .from(heartbeatRuns)
            .leftJoin(agents, eq(agents.id, heartbeatRuns.agentId))
            .where(
              and(
                eq(heartbeatRuns.companyId, params.companyId),
                eq(heartbeatRuns.id, params.runId),
              ),
            )
            .limit(1);

          if (!rows[0]) {
            set.status = 404;
            return { error: "Run not found" };
          }

          return { run: rows[0] };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to get heartbeat run details");
          throw err;
        }
      },
    )

    // ── GET /companies/:companyId/heartbeat-runs/:runId/log ───────
    .get(
      "/companies/:companyId/heartbeat-runs/:runId/log",
      async (ctx: any) => {
        try {
          const { params, query, set } = ctx;
          const actor = ctx.actor as Actor;
          const run = await heartbeats.getRun(params.runId);
          if (!run) {
            set.status = 404;
            return { error: "Heartbeat run not found" };
          }
          assertCompanyAccess(actor, run.companyId);

          const offset = Number(query.offset ?? 0);
          const limitBytes = Number(query.limitBytes ?? 256000);
          return heartbeats.readLog(params.runId, {
            offset: Number.isFinite(offset) ? offset : 0,
            limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to read heartbeat run log");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), runId: t.String() }) },
    )

    // ── GET /companies/:companyId/heartbeat-runs/:runId/events ────
    .get(
      "/companies/:companyId/heartbeat-runs/:runId/events",
      async (ctx: any) => {
        try {
          const { params, query, set } = ctx;
          const actor = ctx.actor as Actor;
          const run = await heartbeats.getRun(params.runId);
          if (!run) {
            set.status = 404;
            return { error: "Heartbeat run not found" };
          }
          assertCompanyAccess(actor, run.companyId);

          const afterSeq = Number(query.afterSeq ?? 0);
          const limit = Number(query.limit ?? 200);
          const events = await heartbeats.listEvents(
            params.runId,
            Number.isFinite(afterSeq) ? afterSeq : 0,
            Number.isFinite(limit) ? limit : 200,
          );
          return events.map((event: any) => redactCurrentUserValue({
            ...event,
            payload: redactEventPayload(event.payload),
          }));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list heartbeat run events");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), runId: t.String() }) },
    )

    // ── GET /companies/:companyId/heartbeat-runs/:runId/workspace-operations ─
    .get(
      "/companies/:companyId/heartbeat-runs/:runId/workspace-operations",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const actor = ctx.actor as Actor;
          const run = await heartbeats.getRun(params.runId);
          if (!run) {
            set.status = 404;
            return { error: "Heartbeat run not found" };
          }
          assertCompanyAccess(actor, run.companyId);

          const context = typeof run.contextSnapshot === "object" && run.contextSnapshot !== null && !Array.isArray(run.contextSnapshot)
            ? run.contextSnapshot as Record<string, unknown>
            : {};
          const executionWorkspaceId = typeof context.executionWorkspaceId === "string" && context.executionWorkspaceId.length > 0
            ? context.executionWorkspaceId
            : undefined;
          const operations = await wsOps.listForRun(params.runId, executionWorkspaceId);
          return redactCurrentUserValue(operations);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log.error({ category: "http.error", err: errMsg }, "Failed to list workspace operations for run");
          throw err;
        }
      },
      { params: t.Object({ companyId: t.String(), runId: t.String() }) },
    );
}
