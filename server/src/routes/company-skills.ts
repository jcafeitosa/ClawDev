/**
 * Company skills routes — Elysia port.
 *
 * CRUD for company-level skills that agents can use.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { companySkillService, agentService } from "../services/index.js";
import { companyIdParam } from "../middleware/index.js";

export function companySkillRoutes(db: Db) {
  const svc = companySkillService(db);

  return new Elysia()
    // List skills for a company
    .get(
      "/companies/:companyId/skills",
      async ({ params }) => {
        const skills = await svc.list(params.companyId);
        return skills;
      },
      { params: companyIdParam },
    )

    // Get a skill by ID
    .get(
      "/skills/:id",
      async ({ params }) => {
        const skill = await svc.getById(params.id);
        if (!skill) return new Response("Not found", { status: 404 });
        return skill;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Create skill
    .post(
      "/companies/:companyId/skills",
      async ({ params, body }) => {
        const skill = await svc.createLocalSkill(params.companyId, {
          name: body.name,
          description: body.description,
          markdown: body.content,
        });
        return skill;
      },
      {
        params: companyIdParam,
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          content: t.String(),
        }),
      },
    )

    // Update skill content
    .patch(
      "/skills/:id",
      async ({ params, body }) => {
        const skill = await svc.getById(params.id);
        if (!skill) return new Response("Not found", { status: 404 });
        if (body.content) {
          const updated = await svc.updateFile(skill.companyId, params.id, "SKILL.md", body.content);
          return updated;
        }
        return skill;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          name: t.Optional(t.String()),
          description: t.Optional(t.String()),
          content: t.Optional(t.String()),
        }),
      },
    )

    // Delete skill
    .delete(
      "/skills/:id",
      async ({ params }) => {
        const skill = await svc.getById(params.id);
        if (!skill) return new Response("Not found", { status: 404 });
        await svc.deleteSkill(skill.companyId, params.id);
        return { success: true };
      },
      { params: t.Object({ id: t.String() }) },
    );
}
