import { Elysia } from "elysia";
import type { Db } from "@clawdev/db";
import { AGENT_ICON_NAMES } from "@clawdev/shared";
import { forbidden } from "../errors.js";
import { listServerAdapters } from "../adapters/index.js";
import { agentService } from "../services/agents.js";
import { elysiaAuth, type Actor } from "../plugins/auth.js";

function hasCreatePermission(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export function elysiaLlmRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const agentsSvc = agentService(db);

  async function assertCanRead(actor: Actor) {
    if (actor.type === "board") return;
    if (actor.type !== "agent" || !actor.agentId) {
      throw forbidden("Board or permitted agent authentication required");
    }
    const actorAgent = await agentsSvc.getById(actor.agentId);
    if (!actorAgent || !hasCreatePermission(actorAgent)) {
      throw forbidden("Missing permission to read agent configuration reflection");
    }
  }

  return new Elysia()
    .use(authPlugin)
    .get("/llms/agent-configuration.txt", async ({ actor, set }) => {
      await assertCanRead(actor);
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
      set.headers["content-type"] = "text/plain";
      return lines.join("\n");
    })
    .get("/llms/agent-icons.txt", async ({ actor, set }) => {
      await assertCanRead(actor);
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
      set.headers["content-type"] = "text/plain";
      return lines.join("\n");
    })
    .get("/llms/agent-configuration/:adapterFile", async ({ params, actor, set }) => {
      await assertCanRead(actor);
      const adapterType = params.adapterFile.replace(/\.txt$/, "");
      const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
      if (!adapter) {
        set.status = 404;
        set.headers["content-type"] = "text/plain";
        return `Unknown adapter type: ${adapterType}`;
      }
      set.headers["content-type"] = "text/plain";
      return (
        adapter.agentConfigurationDoc ??
        `# ${adapterType} agent configuration\n\nNo adapter-specific documentation registered.`
      );
    });
}
