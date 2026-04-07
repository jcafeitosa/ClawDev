/**
 * Team Knowledge routes — Elysia port.
 *
 * CRUD for team knowledge base entries.
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { assertCompanyAccess, getActorInfo, type Actor } from "../middleware/authz.js";
import { logger } from "../middleware/logger.js";
import { logActivity } from "../services/index.js";
import { teamKnowledgeService } from "../services/team-knowledge.js";
import { agentTeamService } from "../services/agent-teams.js";

export function teamKnowledgeRoutes(db: Db) {
  const knowledge = teamKnowledgeService(db);
  const teams = agentTeamService(db);

  return new Elysia()
    // List knowledge for team
    .get(
      "/agent-teams/:id/knowledge",
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

          return knowledge.list(params.id, {
            limit: query?.limit ? parseInt(query.limit) : undefined,
          });
        } catch (error) {
          logger.error("GET /agent-teams/:id/knowledge error:", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Search knowledge
    .get(
      "/agent-teams/:id/knowledge/search",
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

          return knowledge.search(params.id, {
            query: query?.q ?? undefined,
            tags: query?.tags ? query.tags.split(",") : undefined,
          });
        } catch (error) {
          logger.error("GET /agent-teams/:id/knowledge/search error:", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Add knowledge entry
    .post(
      "/agent-teams/:id/knowledge",
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

          const entry = await knowledge.add(params.id, team.companyId, body);

          const actorInfo = getActorInfo(actor);
          await logActivity(db, {
            companyId: team.companyId,
            actorType: actorInfo.actorType,
            actorId: actorInfo.actorId,
            agentId: actorInfo.agentId,
            action: "knowledge.added",
            entityType: "team_knowledge",
            entityId: entry.id,
            details: { teamId: params.id, title: entry.title },
          });

          set.status = 201;
          return entry;
        } catch (error) {
          logger.error("POST /agent-teams/:id/knowledge error:", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Get knowledge entry
    .get(
      "/team-knowledge/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const entry = await knowledge.getById(params.id);
          if (!entry) {
            set.status = 404;
            return { error: "Entry not found" };
          }
          return entry;
        } catch (error) {
          logger.error("GET /team-knowledge/:id error:", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Update knowledge (creates new version)
    .patch(
      "/team-knowledge/:id",
      async (ctx: any) => {
        try {
          const { params, body, set } = ctx;
          const updated = await knowledge.update(params.id, body);
          if (!updated) {
            set.status = 404;
            return { error: "Entry not found" };
          }
          return updated;
        } catch (error) {
          logger.error("PATCH /team-knowledge/:id error:", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    )

    // Delete knowledge entry
    .delete(
      "/team-knowledge/:id",
      async (ctx: any) => {
        try {
          const { params, set } = ctx;
          const deleted = await knowledge.remove(params.id);
          if (!deleted) {
            set.status = 404;
            return { error: "Entry not found" };
          }
          return deleted;
        } catch (error) {
          logger.error("DELETE /team-knowledge/:id error:", error);
          throw error;
        }
      },
      { params: t.Object({ id: t.String() }) },
    );
}
