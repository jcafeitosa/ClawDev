/**
 * Run routes — Elysia.
 *
 * Exposes heartbeat-runs (agent execution records) via three aliases
 * that the frontend uses: /runs, /heartbeat-runs, and /live-runs.
 */

import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { agents, heartbeatRuns } from "@clawdev/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { companyIdParam } from "../middleware/index.js";
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";

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
  return new Elysia()

    // ── GET /companies/:id/heartbeat-runs ───────────────────────────
    .get(
      "/companies/:companyId/heartbeat-runs",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const rawLimit = Number(query.limit);
        const limit = rawLimit === 0 ? 0 : Math.min(rawLimit || 50, 200);
        const status = query.status as string | undefined;

        const conditions = [eq(heartbeatRuns.companyId, params.companyId)];
        if (status) conditions.push(eq(heartbeatRuns.status, status));

        if (limit === 0) {
          const rows = await db
            .select({ id: heartbeatRuns.id })
            .from(heartbeatRuns)
            .where(and(...conditions));
          return { count: rows.length, runs: [] };
        }

        const rows = await db
          .select(runSelect)
          .from(heartbeatRuns)
          .leftJoin(agents, eq(agents.id, heartbeatRuns.agentId))
          .where(and(...conditions))
          .orderBy(desc(heartbeatRuns.createdAt))
          .limit(limit);

        return { runs: rows, total: rows.length };
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/runs (alias) ────────────────────────────
    .get(
      "/companies/:companyId/runs",
      async (ctx: any) => {
        const { params, query } = ctx;
        const actor = ctx.actor as Actor;
        assertCompanyAccess(actor, params.companyId);

        const rawLimit = Number(query.limit);
        const limit = rawLimit === 0 ? 0 : Math.min(rawLimit || 50, 200);
        const status = query.status as string | undefined;

        const conditions = [eq(heartbeatRuns.companyId, params.companyId)];
        if (status) conditions.push(eq(heartbeatRuns.status, status));

        if (limit === 0) {
          const rows = await db
            .select({ id: heartbeatRuns.id })
            .from(heartbeatRuns)
            .where(and(...conditions));
          return { count: rows.length, runs: [] };
        }

        const rows = await db
          .select(runSelect)
          .from(heartbeatRuns)
          .leftJoin(agents, eq(agents.id, heartbeatRuns.agentId))
          .where(and(...conditions))
          .orderBy(desc(heartbeatRuns.createdAt))
          .limit(limit);

        return { runs: rows, total: rows.length };
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/live-runs ───────────────────────────────
    .get(
      "/companies/:companyId/live-runs",
      async (ctx: any) => {
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

        return { runs: rows, count: rows.length };
      },
      { params: companyIdParam },
    )

    // ── GET /companies/:id/heartbeat-runs/:runId ────────────────────
    .get(
      "/companies/:companyId/heartbeat-runs/:runId",
      async (ctx: any) => {
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
      },
    );
}
