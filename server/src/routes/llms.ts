/**
 * LLM reflection routes — Elysia port.
 *
 * Provides text/plain endpoints for agent configuration discovery.
 * These are mounted OUTSIDE the /api prefix (at root level).
 */

import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import { AGENT_ICON_NAMES } from "@clawdev/shared";
import { listServerAdapters } from "../adapters/index.js";
import { agentService } from "../services/agents.js";

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export function llmRoutes(db: Db) {
  const agentsSvc = agentService(db);

  return new Elysia({ prefix: "/llms" })
    .get("/agent-configuration.txt", async ({ set }) => {
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
    })

    .get("/agent-icons.txt", async ({ set }) => {
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
    })

    .get(
      "/agent-configuration/:adapterType.txt",
      async ({ params, set }) => {
        const adapter = listServerAdapters().find((entry) => entry.type === params.adapterType);
        if (!adapter) {
          set.status = 404;
          set.headers["content-type"] = "text/plain; charset=utf-8";
          return `Unknown adapter type: ${params.adapterType}`;
        }
        set.headers["content-type"] = "text/plain; charset=utf-8";
        return (
          adapter.agentConfigurationDoc ??
          `# ${params.adapterType} agent configuration\n\nNo adapter-specific documentation registered.`
        );
      },
      { params: t.Object({ adapterType: t.String() }) },
    );
}
