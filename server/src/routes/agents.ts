/**
 * Agents routes — Elysia port.
 *
 * The most complex route module. Handles agent CRUD, configuration,
 * lifecycle management (pause, resume, terminate, wakeup), heartbeats,
 * task sessions, and inbox operations.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { agents } from "@clawdev/db";
import { eq, desc } from "drizzle-orm";
import { agentService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function agentRoutes(db: Db) {
  const svc = agentService(db);

  return new Elysia()
    // List agents for a company
    .get(
      "/companies/:companyId/agents",
      async ({ params }) => {
        const rows = await db
          .select()
          .from(agents)
          .where(eq(agents.companyId, params.companyId))
          .orderBy(desc(agents.createdAt));
        return rows;
      },
      { params: companyIdParam },
    )

    // Get agent by ID
    .get(
      "/agents/:id",
      async ({ params }) => {
        const agent = await svc.get(params.id);
        if (!agent) return new Response("Agent not found", { status: 404 });
        return agent;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get agent configuration
    .get(
      "/agents/:id/configuration",
      async ({ params }) => {
        const config = await svc.getConfiguration(params.id);
        if (!config) return new Response("Not found", { status: 404 });
        return config;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get agent config revisions
    .get(
      "/agents/:id/config-revisions",
      async ({ params }) => {
        const revisions = await svc.getConfigRevisions(params.id);
        return revisions;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get agent runtime state
    .get(
      "/agents/:id/runtime-state",
      async ({ params }) => {
        const state = await svc.getRuntimeState(params.id);
        if (!state) return new Response("Not found", { status: 404 });
        return state;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get agent skills
    .get(
      "/agents/:id/skills",
      async ({ params }) => {
        const skills = await svc.getSkills(params.id);
        return skills;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get agent task sessions
    .get(
      "/agents/:id/task-sessions",
      async ({ params }) => {
        const sessions = await svc.getTaskSessions(params.id);
        return sessions;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Hire agent (create)
    .post(
      "/companies/:companyId/agents",
      async ({ params, body }) => {
        const agent = await svc.create({
          companyId: params.companyId,
          ...body,
        });
        return agent;
      },
      {
        params: companyIdParam,
        body: t.Object({
          name: t.String(),
          adapterType: t.String(),
          configurationId: t.Optional(t.String()),
        }),
      },
    )

    // Update agent
    .patch(
      "/agents/:id",
      async ({ params, body }) => {
        const updated = await svc.update(params.id, body);
        if (!updated) return new Response("Not found", { status: 404 });
        return updated;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          adapterType: t.Optional(t.String()),
        }),
      },
    )

    // Lifecycle actions
    .post(
      "/agents/:id/pause",
      async ({ params }) => {
        await svc.pause(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/agents/:id/resume",
      async ({ params }) => {
        await svc.resume(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/agents/:id/terminate",
      async ({ params }) => {
        await svc.terminate(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    .post(
      "/agents/:id/wakeup",
      async ({ params }) => {
        await svc.wakeup(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Delete agent
    .delete(
      "/agents/:id",
      async ({ params }) => {
        await svc.delete(params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    );
}
