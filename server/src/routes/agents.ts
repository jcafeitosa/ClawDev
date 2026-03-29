/**
 * Agents routes — Elysia port.
 *
 * Handles agent CRUD, configuration, lifecycle management
 * (pause, resume, terminate, wakeup), runs, runtime state, and skills.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  agents,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  companySkills,
  heartbeatRuns,
} from "@clawdev/db";
import { and, desc, eq } from "drizzle-orm";
import { agentService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function agentRoutes(db: Db) {
  const svc = agentService(db);

  return new Elysia()

    // ── List agents for a company ───────────────────────────────────
    .get(
      "/companies/:companyId/agents",
      async ({ params }) => {
        return svc.list(params.companyId);
      },
      { params: companyIdParam },
    )

    // ── Get agent by ID or shortname ────────────────────────────────
    // Accepts either a UUID or a shortname (e.g. "ceo").
    // When companyId is provided in the query, shortnames are resolved.
    .get(
      "/agents/:id",
      async ({ params, query, set }) => {
        const companyId = query.companyId as string | undefined;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

        let agent = null;

        if (isUuid) {
          agent = await svc.getById(params.id);
        }

        // Resolve by shortname if not found or not a UUID
        if (!agent && companyId) {
          const resolved = await svc.resolveByReference(companyId, params.id);
          agent = resolved.agent;
        }

        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        return agent;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent runtime state ─────────────────────────────────────
    .get(
      "/agents/:id/runtime-state",
      async ({ params, set }) => {
        const rows = await db
          .select()
          .from(agentRuntimeState)
          .where(eq(agentRuntimeState.agentId, params.id))
          .limit(1);
        if (!rows[0]) {
          set.status = 404;
          return { error: "Not found" };
        }
        return rows[0];
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent config revisions ──────────────────────────────────
    .get(
      "/agents/:id/config-revisions",
      async ({ params }) => {
        return svc.listConfigRevisions(params.id);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent skills ────────────────────────────────────────────
    .get(
      "/agents/:id/skills",
      async ({ params, query }) => {
        const companyId = query.companyId as string | undefined;
        if (!companyId) return { skills: [] };
        const rows = await db
          .select()
          .from(companySkills)
          .where(eq(companySkills.companyId, companyId));
        return { skills: rows };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent task sessions ─────────────────────────────────────
    .get(
      "/agents/:id/task-sessions",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(agentTaskSessions)
          .where(eq(agentTaskSessions.agentId, params.id))
          .orderBy(desc(agentTaskSessions.createdAt))
          .limit(50);
        return { sessions: rows };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent heartbeat runs ────────────────────────────────────
    .get(
      "/agents/:id/heartbeat-runs",
      async ({ params, query }) => {
        const limit = Math.min(Number(query.limit) || 20, 100);
        const companyId = query.companyId as string | undefined;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

        // Resolve shortname to UUID if needed
        let agentId = params.id;
        if (!isUuid && companyId) {
          const resolved = await svc.resolveByReference(companyId, params.id);
          if (resolved.agent) agentId = resolved.agent.id;
        }

        const conditions = [eq(heartbeatRuns.agentId, agentId)];
        if (companyId) conditions.push(eq(heartbeatRuns.companyId, companyId));

        const rows = await db
          .select({
            id: heartbeatRuns.id,
            agentId: heartbeatRuns.agentId,
            status: heartbeatRuns.status,
            invocationSource: heartbeatRuns.invocationSource,
            triggerDetail: heartbeatRuns.triggerDetail,
            startedAt: heartbeatRuns.startedAt,
            finishedAt: heartbeatRuns.finishedAt,
            error: heartbeatRuns.error,
            exitCode: heartbeatRuns.exitCode,
            errorCode: heartbeatRuns.errorCode,
            stdoutExcerpt: heartbeatRuns.stdoutExcerpt,
            createdAt: heartbeatRuns.createdAt,
          })
          .from(heartbeatRuns)
          .where(and(...conditions))
          .orderBy(desc(heartbeatRuns.createdAt))
          .limit(limit);

        return { runs: rows };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Hire agent (create) ─────────────────────────────────────────
    .post(
      "/companies/:companyId/agents",
      async ({ params, body }) => {
        const agent = await svc.create(params.companyId, body as any);
        return agent;
      },
      {
        params: companyIdParam,
        body: t.Object({
          name: t.String(),
          adapterType: t.String(),
          role: t.Optional(t.String()),
          title: t.Optional(t.String()),
          reportsTo: t.Optional(t.String()),
        }),
      },
    )

    // ── Update agent ────────────────────────────────────────────────
    .patch(
      "/agents/:id",
      async ({ params, body, set }) => {
        const updated = await svc.update(params.id, body as any);
        if (!updated) {
          set.status = 404;
          return { error: "Not found" };
        }
        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Lifecycle: pause ────────────────────────────────────────────
    .post(
      "/agents/:id/pause",
      async ({ params }) => {
        await svc.pause(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Lifecycle: resume ───────────────────────────────────────────
    .post(
      "/agents/:id/resume",
      async ({ params }) => {
        await svc.resume(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Lifecycle: terminate ────────────────────────────────────────
    .post(
      "/agents/:id/terminate",
      async ({ params }) => {
        await svc.terminate(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Lifecycle: wakeup (manual trigger) ──────────────────────────
    .post(
      "/agents/:id/wakeup",
      async ({ params, body, set }) => {
        const companyId = (body as any)?.companyId as string | undefined;
        if (!companyId) {
          set.status = 400;
          return { error: "companyId required" };
        }
        const agent = await svc.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        // Insert a wakeup request — the heartbeat loop will pick it up
        const [req] = await db
          .insert(agentWakeupRequests)
          .values({
            companyId,
            agentId: params.id,
            source: "manual",
            triggerDetail: "Manual wakeup from UI",
            reason: "User triggered",
            requestedByActorType: "user",
          })
          .returning();
        return { success: true, wakeupRequestId: req?.id };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Sync agent skills ───────────────────────────────────────────
    .post(
      "/agents/:id/skills/sync",
      async ({ params }) => {
        // Skill sync is managed externally; return success stub
        return { success: true, synced: 0 };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Delete agent ────────────────────────────────────────────────
    .delete(
      "/agents/:id",
      async ({ params }) => {
        await svc.remove(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    );
}
