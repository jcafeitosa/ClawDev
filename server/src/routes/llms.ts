/**
 * LLM reflection routes — Elysia port.
 *
 * Provides text/plain endpoints for agent configuration discovery.
 * These are mounted OUTSIDE the /api prefix (at root level).
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { AGENT_ICON_NAMES, isLevelCAgentRole } from "@clawdev/shared";
import { listServerAdapters } from "../adapters/index.js";
import { agentService } from "../services/agents.js";
import { assertBoard, type Actor } from "../middleware/authz.js";
import { forbidden } from "../errors.js";
import { logger } from "../logger.js";

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (isLevelCAgentRole(agent.role)) return true;
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

/**
 * Assert that the caller is either a board user or an agent with canCreateAgents.
 * LLM reflection endpoints are consumed by agents that need to discover configuration.
 */
async function assertLlmAccess(actor: Actor, agentsSvc: ReturnType<typeof agentService>) {
  if (actor.type === "board") return;
  if (actor.type === "agent" && actor.agentId) {
    const agent = await agentsSvc.getById(actor.agentId);
    if (agent && hasCreatePermission(agent)) return;
  }
  throw forbidden("Board access or agent with canCreateAgents permission required");
}

export function llmRoutes(db: Db) {
  const agentsSvc = agentService(db);

  return new Elysia({ prefix: "/llms" })
    .get("/agent-configuration.txt", async ({ set, ...ctx }: any) => {
      try {
        await assertLlmAccess(ctx.actor, agentsSvc);
        const adapters = listServerAdapters().sort((a, b) => a.type.localeCompare(b.type));
        const lines = [
          "# ClawDev Agent Configuration Index",
          "",
          "Installed adapters:",
          ...adapters.map((adapter) => `- ${adapter.type}: /llms/agent-configuration/${adapter.type}.txt`),
          "",
          "Related API endpoints:",
          "- GET /api/companies/:companyId/agent-configurations",
          "- GET /api/agents/:id/configuration",
          "- POST /api/companies/:companyId/agent-hires",
          "",
          "Agent identity references:",
          "- GET /llms/agent-icons.txt",
          "",
          "Notes:",
          "- Sensitive values are redacted in configuration read APIs.",
          "- New hires may be created in pending_approval state depending on company settings.",
          "",
        ];
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return lines.join("\n");
      } catch (error) {
        logger.error("GET /agent-configuration.txt error", error);
        throw error;
      }
    })

    .get("/agent-icons.txt", async ({ set, ...ctx }: any) => {
      try {
        await assertLlmAccess(ctx.actor, agentsSvc);
        const lines = [
          "# ClawDev Agent Icon Names",
          "",
          "Set the `icon` field on hire/create payloads to one of:",
          ...AGENT_ICON_NAMES.map((name) => `- ${name}`),
          "",
          "Example:",
          '{ "name": "SearchOps", "role": "researcher", "icon": "search" }',
          "",
        ];
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return lines.join("\n");
      } catch (error) {
        logger.error("GET /agent-icons.txt error", error);
        throw error;
      }
    })

    .get(
      "/agent-configuration/*",
      async ({ params, set, ...ctx }: any) => {
        try {
          await assertLlmAccess(ctx.actor, agentsSvc);
          const rawTail = (params as Record<string, string>)["*"] ?? "";
          const adapterType = rawTail.replace(/\.txt$/, "").trim();
          if (!adapterType) {
            set.status = 404;
            set.headers["content-type"] = "text/plain; charset=utf-8";
            return "Unknown adapter type";
          }
          const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
          if (!adapter) {
            set.status = 404;
            set.headers["content-type"] = "text/plain; charset=utf-8";
            return `Unknown adapter type: ${adapterType}`;
          }
          set.headers["content-type"] = "text/plain; charset=utf-8";
          return (
            adapter.agentConfigurationDoc ??
            `# ${adapterType} agent configuration\n\nNo adapter-specific documentation registered.`
          );
        } catch (error) {
          logger.error("GET /agent-configuration/* error", error);
          throw error;
        }
      },
    );
}
