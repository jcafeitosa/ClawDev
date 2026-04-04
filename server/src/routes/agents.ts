/**
 * Agents routes — Elysia port.
 *
 * Handles agent CRUD, configuration, lifecycle management
 * (pause, resume, terminate, wakeup), runs, runtime state, skills,
 * instructions-bundle, and permissions.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Elysia, t } from "elysia";
import type { Db } from "@clawdev/db";
import {
  agents,
  agentRuntimeState,
  agentTaskSessions,
  agentWakeupRequests,
  companies,
  companySkills,
  heartbeatRuns,
} from "@clawdev/db";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import { agentMineInboxQuerySchema } from "@clawdev/shared";
import {
  agentService,
  agentInstructionsService,
  accessService,
  approvalService,
  budgetService,
  companySkillService,
  heartbeatService,
  instanceSettingsService,
  issueApprovalService,
  issueService,
  logActivity,
  secretService,
  syncInstructionsBundleConfigFromFilePath,
  workspaceOperationService,
  normalizeRuntimeConfigForAdapterType,
} from "../services/index.js";
import { detectAdapterModel, findServerAdapter, listAdapterModels } from "../adapters/index.js";
// Note: we use inline t.Object({ companyId: t.String() }) instead of companyIdParam
// because companyIdParam enforces UUID format which some callers don't use.
import { assertBoard, assertCompanyAccess, assertInstanceAdmin, getActorInfo, type Actor } from "../middleware/authz.js";
import { redactEventPayload } from "../redaction.js";
import { redactCurrentUserValue } from "../log-redaction.js";
import { renderOrgChartSvg, renderOrgChartPng, type OrgNode, type OrgChartStyle, ORG_CHART_STYLES } from "./org-chart-svg.js";
import { runClaudeLogin } from "@clawdev/adapter-claude-local/server";
import { unprocessable } from "../errors.js";

const LOCAL_ADAPTERS = new Set(["claude_local", "codex_local", "gemini_local", "opencode_local"]);
const MANAGED_CONFIG_KEYS = [
  "instructionsBundleMode",
  "instructionsRootPath",
  "instructionsEntryFile",
  "instructionsFilePath",
] as const;

function isPlain(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type TranscriptMessage = {
  timestamp: string;
  role: "assistant" | "user" | "tool" | "system";
  text: string;
  content?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return isPlain(value) ? value : null;
}

function parseTranscriptLine(line: string, ts: string): TranscriptMessage[] {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = asRecord(JSON.parse(line));
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return [{ timestamp: ts, role: "system", text: line, content: line }];
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "system") {
    if (parsed.subtype === "init") {
      const model = typeof parsed.model === "string" ? parsed.model : "unknown";
      const sessionId = typeof parsed.session_id === "string" ? parsed.session_id : "";
      return [{
        timestamp: ts,
        role: "system",
        text: `model ${model}${sessionId ? ` • session ${sessionId}` : ""}`,
        content: `model ${model}${sessionId ? ` • session ${sessionId}` : ""}`,
      }];
    }
    const text = typeof parsed.message === "string"
      ? parsed.message
      : typeof parsed.text === "string"
        ? parsed.text
        : line;
    return [{ timestamp: ts, role: "system", text, content: text }];
  }

  if (type === "result") {
    const text = typeof parsed.result === "string"
      ? parsed.result
      : typeof parsed.message === "string"
        ? parsed.message
        : line;
    return [{ timestamp: ts, role: "system", text, content: text }];
  }

  if (type === "assistant" || type === "user") {
    const msg = asRecord(parsed.message) ?? {};
    const content = Array.isArray(msg.content) ? msg.content : [];
    const role = type === "assistant" ? "assistant" : "user";
    const messages: TranscriptMessage[] = [];
    for (const raw of content) {
      const block = asRecord(raw);
      if (!block) continue;
      const blockType = typeof block.type === "string" ? block.type : "";
      if (blockType === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (text) messages.push({ timestamp: ts, role, text, content: text });
      } else if (blockType === "thinking") {
        const text = typeof block.thinking === "string" ? block.thinking : "";
        if (text) messages.push({ timestamp: ts, role: "system", text, content: text });
      } else if (blockType === "tool_use") {
        const name = typeof block.name === "string" ? block.name : "tool";
        messages.push({
          timestamp: ts,
          role: "tool",
          text: `${name} invoked`,
          content: `${name} invoked`,
        });
      } else if (blockType === "tool_result") {
        const text = typeof block.content === "string" ? block.content : line;
        messages.push({ timestamp: ts, role: "tool", text, content: text });
      }
    }
    if (messages.length > 0) return messages;
  }

  const fallback = typeof parsed.message === "string"
    ? parsed.message
    : typeof parsed.text === "string"
      ? parsed.text
      : line;
  return [{ timestamp: ts, role: "system", text: fallback, content: fallback }];
}

function buildTranscriptMessages(content: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];
  let stdoutBuf = "";

  for (const rawLine of content.split("\n")) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    let chunk: { ts?: unknown; stream?: unknown; chunk?: unknown } | null = null;
    try {
      chunk = asRecord(JSON.parse(trimmed)) as { ts?: unknown; stream?: unknown; chunk?: unknown } | null;
    } catch {
      chunk = null;
    }

    if (!chunk || typeof chunk.chunk !== "string") continue;

    const ts = typeof chunk.ts === "string" ? chunk.ts : new Date().toISOString();
    const stream = chunk.stream === "stderr" ? "stderr" : chunk.stream === "system" ? "system" : "stdout";

    if (stream === "stderr") {
      messages.push({ timestamp: ts, role: "system", text: chunk.chunk, content: chunk.chunk });
      continue;
    }

    if (stream === "system") {
      messages.push({ timestamp: ts, role: "system", text: chunk.chunk, content: chunk.chunk });
      continue;
    }

    const combined = stdoutBuf + chunk.chunk;
    const parts = combined.split(/\r?\n/);
    stdoutBuf = parts.pop() ?? "";
    for (const line of parts) {
      const t = line.trim();
      if (t) messages.push(...parseTranscriptLine(t, ts));
    }
  }

  const trailing = stdoutBuf.trim();
  if (trailing) {
    messages.push(...parseTranscriptLine(trailing, new Date().toISOString()));
  }

  return messages;
}

async function loadOnboardingFiles(role: string): Promise<Record<string, string>> {
  const dir = path.resolve(
    import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
    "..",
    "onboarding-assets",
    role === "ceo" ? "ceo" : "default",
  );
  const files: Record<string, string> = {};
  try {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      files[entry] = await fs.readFile(path.join(dir, entry), "utf-8");
    }
  } catch {
    // No onboarding assets for this role
  }
  return files;
}

export function agentRoutes(db: Db) {
  const svc = agentService(db);
  const instructionsSvc = agentInstructionsService();
  const access = accessService(db);
  const approval = approvalService(db);
  const budgets = budgetService(db);
  const heartbeats = heartbeatService(db);
  const issueApprovals = issueApprovalService(db);
  const issues = issueService(db);
  const secrets = secretService(db);
  const skills = companySkillService(db);
  const wsOps = workspaceOperationService(db);
  const instanceSettings = instanceSettingsService(db);

  async function getCurrentUserRedactionOptions() {
    return {
      enabled: (await instanceSettings.getGeneral()).censorUsernameInLogs,
    };
  }

  async function resolveAgentForRequest(agentId: string, companyId?: string | null) {
    if (typeof companyId !== "string" || companyId.trim().length === 0) {
      throw unprocessable("Agent shortname lookup requires companyId query parameter");
    }
    const normalizedCompanyId = companyId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId);
    if (isUuid) return await svc.getById(agentId);
    const resolved = await svc.resolveByReference(normalizedCompanyId, agentId);
    return resolved.agent ?? null;
  }

  function toLeanOrgNode(node: Record<string, unknown>): Record<string, unknown> {
    const reports = Array.isArray(node.reports)
      ? (node.reports as Array<Record<string, unknown>>).map((report) => toLeanOrgNode(report))
      : [];
    return {
      id: String(node.id),
      name: String(node.name),
      role: String(node.role),
      status: String(node.status),
      reports,
    };
  }

  async function resolveCompanyRequiresApproval(companyId: string): Promise<boolean> {
    const rows = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId));
    return rows[0]?.requireBoardApprovalForNewAgents ?? false;
  }

  async function buildAccessInfo(
    agent: { id: string; companyId: string; permissions?: Record<string, unknown> | null },
  ) {
    const grants = await access.listPrincipalGrants(agent.companyId, "agent", agent.id);
    const hasTasksAssign = grants.some((g: any) => g.permissionKey === "tasks:assign");
    const canCreate = (agent.permissions as any)?.canCreateAgents === true;

    let canAssignTasks = hasTasksAssign || canCreate;
    let taskAssignSource: string | null = null;
    if (canCreate) {
      taskAssignSource = "agent_creator";
    } else if (hasTasksAssign) {
      taskAssignSource = "explicit_grant";
    }

    return {
      canAssignTasks,
      taskAssignSource,
    };
  }

  /**
   * Materialize a managed instructions bundle for a newly created local agent.
   * Returns the adapterConfig with instructions metadata (without promptTemplate).
   */
  async function materializeForNewAgent(
    agent: Record<string, unknown>,
    adapterConfig: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    const adapterType = String(agent.adapterType ?? "");
    if (!LOCAL_ADAPTERS.has(adapterType)) return null;

    const prompt = adapterConfig.promptTemplate as string | undefined;
    const role = String(agent.role ?? "engineer");
    let files: Record<string, string>;

    if (prompt) {
      files = { "AGENTS.md": prompt };
    } else {
      files = await loadOnboardingFiles(role);
    }

    if (Object.keys(files).length === 0) return null;

    const result = await instructionsSvc.materializeManagedBundle(
      agent as any,
      files,
      { entryFile: "AGENTS.md", replaceExisting: false },
    );

    const config = { ...adapterConfig, ...result.adapterConfig };
    delete config.promptTemplate;
    return config;
  }

  return new Elysia()

    // ── List agents for a company ───────────────────────────────────
    .get(
      "/companies/:companyId/agents",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        return svc.list(params.companyId);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Get agent by ID or shortname ────────────────────────────────
    .get(
      "/agents/:id",
      async ({ params, query, set, ...ctx }) => {
        const companyId = query.companyId as string | undefined;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

        let agent: any = null;

        if (isUuid) {
          agent = await svc.getById(params.id);
        }

        if (!agent && companyId) {
          const resolved = await svc.resolveByReference(companyId, params.id);
          agent = resolved.agent;
        }

        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        const accessInfo = await buildAccessInfo(agent);
        return { ...agent, access: accessInfo };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent runtime state ─────────────────────────────────────
    .get(
      "/agents/:id/runtime-state",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await resolveAgentForRequest(params.id, ctx.query?.companyId as string | undefined);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agent.companyId);

        const rows = await db
          .select()
          .from(agentRuntimeState)
          .where(eq(agentRuntimeState.agentId, params.id))
          .limit(1);
        if (!rows[0]) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        return rows[0];
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent config revisions ──────────────────────────────────
    .get(
      "/agents/:id/config-revisions",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await resolveAgentForRequest(params.id, ctx.query?.companyId as string | undefined);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agent.companyId);
        return svc.listConfigRevisions(params.id);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent skills ────────────────────────────────────────────
    .get(
      "/agents/:id/skills",
      async ({ params, query, ...ctx }: any) => {
        const actor = ctx.actor;
        const companyId = query.companyId as string | undefined;
        if (!companyId || companyId.trim().length === 0) {
          throw unprocessable("Agent shortname lookup requires companyId query parameter");
        }

        const agent = await resolveAgentForRequest(params.id, companyId);
        if (!agent) return { skills: [] };
        assertCompanyAccess(actor, agent.companyId);

        const { config: runtimeConfig } = await secrets.resolveAdapterConfigForRuntime(
          agent.companyId,
          isPlain(agent.adapterConfig) ? agent.adapterConfig : {},
        );

        const adapter = findServerAdapter(agent.adapterType);
        if (!adapter || typeof adapter.listSkills !== "function") {
          return { skills: [] };
        }

        // First call listSkills to determine mode
        const initialSkillEntries = await skills.listRuntimeSkillEntries(companyId, {
          materializeMissing: false,
        });

        const listResult = await adapter.listSkills({
          agentId: agent.id,
          companyId: agent.companyId,
          adapterType: agent.adapterType,
          config: {
            ...runtimeConfig,
            clawdevRuntimeSkills: initialSkillEntries,
          },
        });

        // If mode is persistent (not ephemeral), re-fetch with materialization
        if (listResult.mode === "persistent") {
          await skills.listRuntimeSkillEntries(companyId, {
            materializeMissing: true,
          });
        }

        return listResult;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get agent task sessions ─────────────────────────────────────
    .get(
      "/agents/:id/task-sessions",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await resolveAgentForRequest(params.id, ctx.query?.companyId as string | undefined);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agent.companyId);

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
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const companyId = query.companyId as string | undefined;
        const agentRecord = await resolveAgentForRequest(params.id, companyId);
        if (!agentRecord) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agentRecord.companyId);

        const limit = Math.min(Number(query.limit) || 20, 100);
        const agentId = agentRecord.id;

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

    // ── Get instructions bundle ─────────────────────────────────────
    .get(
      "/agents/:id/instructions-bundle",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const companyId = query.companyId as string | undefined;
        const agent = await resolveAgentForRequest(params.id, companyId);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);
        return instructionsSvc.getBundle(agent);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Read instructions bundle file ───────────────────────────────
    .get(
      "/agents/:id/instructions-bundle/file",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const filePath = query.path as string;
        const agent = await resolveAgentForRequest(params.id, query.companyId as string | undefined);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);
        return instructionsSvc.readFile(agent, filePath);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Write instructions bundle file ──────────────────────────────
    .put(
      "/agents/:id/instructions-bundle/file",
      async ({ params, query, body, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await resolveAgentForRequest(params.id, query.companyId as string | undefined);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);

        const b = body as { path: string; content: string; clearLegacyPromptTemplate?: boolean };
        const result = await instructionsSvc.writeFile(
          agent,
          b.path,
          b.content,
          { clearLegacyPromptTemplate: b.clearLegacyPromptTemplate ?? false },
        );

        // Persist adapter config for compatibility
        if (result.adapterConfig) {
          await svc.update(params.id, { adapterConfig: result.adapterConfig }, {
            recordRevision: {
              createdByUserId: actor?.userId ?? null,
              source: "instructions_bundle_write",
            },
          });
        }

        return result;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Hire agent (create) ─────────────────────────────────────────
    .post(
      "/companies/:companyId/agents",
      async ({ params, body, set, ...ctx }) => {
        const actor = (ctx as any).actor as Actor | undefined;
        const input = body as Record<string, unknown>;

        // Resolve desired skill keys
        let desiredSkills: string[] | undefined;
        if (Array.isArray(input.desiredSkills) && input.desiredSkills.length > 0) {
          desiredSkills = await skills.resolveRequestedSkillKeys(
            params.companyId,
            input.desiredSkills as string[],
          );
        }

        // Build adapter config
        let adapterConfig = isPlain(input.adapterConfig) ? { ...input.adapterConfig } : {};

        // Attach skill sync config
        if (desiredSkills && desiredSkills.length > 0) {
          adapterConfig.clawdevSkillSync = {
            desiredSkills,
            syncedAt: new Date().toISOString(),
          };
        }

        // Normalize adapter config for persistence
        adapterConfig = await secrets.normalizeAdapterConfigForPersistence(
          params.companyId,
          adapterConfig,
        );

        const created = await svc.create(params.companyId, {
          ...input,
          adapterConfig,
          desiredSkills: undefined,
        } as any);

        // Materialize managed instructions bundle for local adapters
        const materializedConfig = await materializeForNewAgent(
          created,
          isPlain(created.adapterConfig) ? { ...created.adapterConfig as Record<string, unknown> } : {},
        );
        if (materializedConfig) {
          await svc.update(created.id, { adapterConfig: materializedConfig });
        }

        // Set up access: membership + tasks:assign grant
        await access.ensureMembership(
          params.companyId,
          "agent",
          created.id,
          "member",
          "active",
        );
        await access.setPrincipalPermission(
          params.companyId,
          "agent",
          created.id,
          "tasks:assign",
          true,
          actor?.userId ?? null,
        );

        // Set up budget policy if specified
        const budgetMonthlyCents = Number(input.budgetMonthlyCents ?? 0);
        if (budgetMonthlyCents > 0) {
          await budgets.upsertPolicy(
            params.companyId,
            {
              scopeType: "agent",
              scopeId: created.id,
              amount: budgetMonthlyCents,
              windowKind: "calendar_month_utc",
            },
            actor?.userId ?? null,
          );
        }

        // Log activity
        await logActivity(db, {
          companyId: params.companyId,
          entityType: "agent",
          entityId: created.id,
          action: "created",
          actorType: actor?.type === "agent" ? "agent" : "user",
          actorId: actor?.userId ?? actor?.agentId ?? "unknown",
        });

        set.status = 201;
        return created;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Hire agent via approval flow ────────────────────────────────
    .post(
      "/companies/:companyId/agent-hires",
      async ({ params, body, set, ...ctx }) => {
        const actor = (ctx as any).actor as Actor | undefined;
        const input = body as Record<string, unknown>;

        // Resolve desired skill keys
        let desiredSkills: string[] | undefined;
        if (Array.isArray(input.desiredSkills) && input.desiredSkills.length > 0) {
          desiredSkills = await skills.resolveRequestedSkillKeys(
            params.companyId,
            input.desiredSkills as string[],
          );
        }

        // Build adapter config
        let adapterConfig = isPlain(input.adapterConfig) ? { ...input.adapterConfig } : {};

        // Attach skill sync config
        if (desiredSkills && desiredSkills.length > 0) {
          adapterConfig.clawdevSkillSync = {
            desiredSkills,
            syncedAt: new Date().toISOString(),
          };
        }

        // Materialize managed instructions for local adapters in approval payload
        const materializationContext = {
          id: randomUUID(),
          companyId: params.companyId,
          name: String(input.name ?? ""),
          role: String(input.role ?? "engineer"),
          adapterType: String(input.adapterType ?? "process"),
          adapterConfig,
        };
        const materializedConfig = await materializeForNewAgent(materializationContext, adapterConfig);
        if (materializedConfig) {
          adapterConfig = materializedConfig;
        }

        const payload = {
          name: input.name,
          role: input.role,
          title: input.title,
          adapterType: input.adapterType,
          adapterConfig,
          budgetMonthlyCents: input.budgetMonthlyCents,
          desiredSkills: desiredSkills ?? input.desiredSkills,
          requestedConfigurationSnapshot: {
            name: input.name,
            role: input.role,
            title: input.title,
            adapterType: input.adapterType,
            adapterConfig,
            budgetMonthlyCents: input.budgetMonthlyCents,
            desiredSkills: desiredSkills ?? input.desiredSkills,
          },
        };

        const created = await approval.create(params.companyId, {
          type: "hire_agent",
          status: "pending",
          payload,
          requestedByUserId: actor?.userId ?? null,
        } as any);

        set.status = 201;
        return created;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Update agent ────────────────────────────────────────────────
    .patch(
      "/agents/:id",
      async ({ params, body, set, ...ctx }) => {
        const actor = (ctx as any).actor as Actor | undefined;
        const input = body as Record<string, unknown>;

        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        const patch: Record<string, unknown> = {};

        // Handle adapter type change
        if (input.adapterType && input.adapterType !== existing.adapterType) {
          patch.adapterType = input.adapterType;
        }

        // Handle adapter config merge
        if (input.adapterConfig !== undefined) {
          const existingConfig = isPlain(existing.adapterConfig) ? { ...existing.adapterConfig as Record<string, unknown> } : {};
          const newConfig = isPlain(input.adapterConfig) ? input.adapterConfig : {};

          if (input.replaceAdapterConfig === true) {
            // Full replacement: use only the new config
            patch.adapterConfig = newConfig;
          } else if (input.adapterType && input.adapterType !== existing.adapterType) {
            // Adapter type changed: take new config but preserve instructions metadata
            const merged = { ...newConfig };
            for (const key of MANAGED_CONFIG_KEYS) {
              if (existingConfig[key] !== undefined) {
                merged[key] = existingConfig[key];
              }
            }
            patch.adapterConfig = merged;
          } else {
            // Same adapter: merge configs, preserving all existing fields
            patch.adapterConfig = { ...existingConfig, ...newConfig };
          }

          // Normalize for persistence
          patch.adapterConfig = await secrets.normalizeAdapterConfigForPersistence(
            existing.companyId,
            patch.adapterConfig as Record<string, unknown>,
          );

          // Sync instructions bundle config from file path
          patch.adapterConfig = syncInstructionsBundleConfigFromFilePath(
            existing,
            patch.adapterConfig as Record<string, unknown>,
          );
        }

        if (input.runtimeConfig !== undefined) {
          patch.runtimeConfig = normalizeRuntimeConfigForAdapterType(
            input.adapterType && typeof input.adapterType === "string"
              ? input.adapterType
              : existing.adapterType,
            input.runtimeConfig,
          );
        }

        // Copy other safe fields
        for (const key of ["name", "role", "title", "reportsTo", "capabilities", "runtimeConfig", "metadata", "status"]) {
          if (key === "runtimeConfig") continue;
          if (input[key] !== undefined) {
            patch[key] = input[key];
          }
        }

        const updated = await svc.update(params.id, patch, {
          recordRevision: {
            createdByUserId: actor?.userId ?? null,
            source: "api",
          },
        });

        if (!updated) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        return updated;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Update agent permissions ────────────────────────────────────
    .patch(
      "/agents/:id/permissions",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const input = body as { canCreateAgents?: boolean; canAssignTasks?: boolean };

        const agent = await svc.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);

        const updated = await svc.updatePermissions(params.id, {
          canCreateAgents: input.canCreateAgents ?? false,
        });

        if (!updated) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        // When canCreateAgents is true, always grant tasks:assign
        const shouldGrantTasksAssign = input.canCreateAgents || input.canAssignTasks;
        await access.setPrincipalPermission(
          agent.companyId,
          "agent",
          agent.id,
          "tasks:assign",
          shouldGrantTasksAssign ?? false,
          actor?.userId ?? null,
        );

        const accessInfo = await buildAccessInfo(updated);
        return { ...updated, access: accessInfo };
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
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor;
        const agent = await svc.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);

        if (actor.type === "agent" && actor.agentId !== params.id) {
          set.status = 403;
          return { error: "Agent can only invoke itself" };
        }

        const result = await heartbeats.wakeup(params.id, {
          source: body?.source ?? "on_demand",
          triggerDetail: body?.triggerDetail ?? "manual",
          reason: body?.reason ?? null,
          payload: body?.payload ?? null,
          idempotencyKey: body?.idempotencyKey ?? null,
          requestedByActorType: actor.type === "agent" ? "agent" : "user",
          requestedByActorId: actor.type === "agent" ? actor.agentId ?? null : actor.userId ?? null,
          contextSnapshot: {
            triggeredBy: actor.type,
            actorId: actor.type === "agent" ? actor.agentId : actor.userId,
            forceFreshSession: body?.forceFreshSession === true,
          },
        });

        if (!result) {
          set.status = 202;
          return { status: "skipped" };
        }

        await logActivity(db, {
          companyId: agent.companyId,
          actorType: actor.type === "agent" ? "agent" : "user",
          actorId: actor.type === "agent" ? actor.agentId ?? "unknown" : actor.userId ?? "board",
          action: "heartbeat.invoked",
          entityType: "heartbeat_run",
          entityId: result.id,
          details: { agentId: params.id },
        });

        set.status = 202;
        return result;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          source: t.Optional(t.Union([
            t.Literal("timer"),
            t.Literal("assignment"),
            t.Literal("on_demand"),
            t.Literal("automation"),
          ])),
          triggerDetail: t.Optional(t.Union([
            t.Literal("manual"),
            t.Literal("ping"),
            t.Literal("callback"),
            t.Literal("system"),
          ])),
          reason: t.Optional(t.Nullable(t.String())),
          payload: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
          idempotencyKey: t.Optional(t.Nullable(t.String())),
          forceFreshSession: t.Optional(t.Boolean()),
        }),
      },
    )

    // ── Sync agent skills ───────────────────────────────────────────
    .post(
      "/agents/:id/skills/sync",
      async ({ params, body, query, ...ctx }: any) => {
        const actor = ctx.actor;
        const companyId = (query as any).companyId as string | undefined;
        const input = body as { desiredSkills?: string[] } | undefined;

        const agent = await svc.getById(params.id);
        if (!agent || !companyId) {
          return { success: false };
        }
        assertCompanyAccess(actor, agent.companyId);

        // Resolve desired skills
        let desiredSkills = input?.desiredSkills ?? [];
        if (desiredSkills.length > 0) {
          desiredSkills = await skills.resolveRequestedSkillKeys(companyId, desiredSkills);
        }

        const { config: runtimeConfig } = await secrets.resolveAdapterConfigForRuntime(
          agent.companyId,
          isPlain(agent.adapterConfig) ? agent.adapterConfig : {},
        );

        const adapter = findServerAdapter(agent.adapterType);
        if (!adapter || typeof adapter.syncSkills !== "function") {
          return { success: false, error: "Adapter does not support skills" };
        }

        const runtimeSkillEntries = await skills.listRuntimeSkillEntries(companyId, {
          materializeMissing: false,
        });

        const result = await adapter.syncSkills(
          {
            agentId: agent.id,
            companyId: agent.companyId,
            adapterType: agent.adapterType,
            config: {
              ...runtimeConfig,
              clawdevRuntimeSkills: runtimeSkillEntries,
            },
          },
          desiredSkills,
        );

        // Persist updated desired skills in adapter config
        const existingConfig = isPlain(agent.adapterConfig) ? { ...agent.adapterConfig } : {};
        const updatedConfig = {
          ...existingConfig,
          clawdevSkillSync: {
            desiredSkills,
            syncedAt: new Date().toISOString(),
          },
        };
        await svc.update(params.id, { adapterConfig: updatedConfig }, {
          recordRevision: {
            createdByUserId: actor?.userId ?? null,
            source: "skill_sync",
          },
        });

        return result;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── List adapter models ────────────────────────────────────────
    .get(
      "/companies/:companyId/adapters/:type/models",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        return listAdapterModels(params.type);
      },
      { params: t.Object({ companyId: t.String(), type: t.String() }) },
    )

    // ── Detect adapter model ──────────────────────────────────────
    .get(
      "/companies/:companyId/adapters/:type/detect-model",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        return detectAdapterModel(params.type);
      },
      { params: t.Object({ companyId: t.String(), type: t.String() }) },
    )

    // ── Test adapter environment ───────────────────────────────────
    .post(
      "/companies/:companyId/adapters/:type/test-environment",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);

        const adapter = findServerAdapter(params.type);
        if (!adapter) {
          set.status = 404;
          return { error: `Unknown adapter type: ${params.type}` };
        }

        const inputAdapterConfig = (body?.adapterConfig ?? {}) as Record<string, unknown>;
        const normalizedAdapterConfig = await secrets.normalizeAdapterConfigForPersistence(
          params.companyId,
          inputAdapterConfig,
        );
        const { config: runtimeAdapterConfig } = await secrets.resolveAdapterConfigForRuntime(
          params.companyId,
          normalizedAdapterConfig,
        );

        const result = await adapter.testEnvironment({
          companyId: params.companyId,
          adapterType: params.type,
          config: runtimeAdapterConfig,
        });

        return result;
      },
      { params: t.Object({ companyId: t.String(), type: t.String() }) },
    )

    // ── Instance scheduler heartbeats ──────────────────────────────
    .get(
      "/instance/scheduler-heartbeats",
      async ({ ...ctx }: any) => {
        const actor = ctx.actor;
        assertInstanceAdmin(actor);

        const rows = await db
          .select({
            id: agents.id,
            companyId: agents.companyId,
            agentName: agents.name,
            role: agents.role,
            title: agents.title,
            status: agents.status,
            adapterType: agents.adapterType,
            runtimeConfig: agents.runtimeConfig,
            lastHeartbeatAt: agents.lastHeartbeatAt,
            companyName: companies.name,
          })
          .from(agents)
          .innerJoin(companies, eq(agents.companyId, companies.id))
          .orderBy(companies.name, agents.name);

        const items = rows
          .filter(
            (row) =>
              row.status !== "paused" &&
              row.status !== "terminated" &&
              row.status !== "pending_approval",
          )
          .map((row) => {
            const rc = isPlain(row.runtimeConfig) ? (row.runtimeConfig as Record<string, unknown>) : {};
            const hb = isPlain(rc.heartbeat) ? (rc.heartbeat as Record<string, unknown>) : {};
            const enabled = typeof hb.enabled === "boolean" ? hb.enabled : true;
            const intervalSec = Math.max(0, Number(hb.intervalSec) || 0);

            return {
              id: row.id,
              companyId: row.companyId,
              companyName: row.companyName,
              agentName: row.agentName,
              role: row.role,
              title: row.title,
              status: row.status,
              adapterType: row.adapterType,
              intervalSec,
              heartbeatEnabled: enabled,
              schedulerActive: enabled && intervalSec > 0,
              lastHeartbeatAt: row.lastHeartbeatAt,
            };
          })
          .sort((left, right) => {
            if (left.schedulerActive !== right.schedulerActive) {
              return left.schedulerActive ? -1 : 1;
            }
            return left.companyName.localeCompare(right.companyName) || left.agentName.localeCompare(right.agentName);
          });

        return items;
      },
    )

    // ── Update heartbeat scheduling for an agent ───────────────────
    .patch(
      "/agents/:id/heartbeat-settings",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor;
        assertInstanceAdmin(actor);

        const agent = await svc.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        const input = body as { enabled?: boolean };
        if (typeof input.enabled !== "boolean") {
          set.status = 422;
          return { error: "Field 'enabled' is required" };
        }

        const existingRuntimeConfig = isPlain(agent.runtimeConfig) ? { ...agent.runtimeConfig } : {};
        const heartbeat = isPlain(existingRuntimeConfig.heartbeat)
          ? { ...(existingRuntimeConfig.heartbeat as Record<string, unknown>) }
          : {};
        heartbeat.enabled = input.enabled;
        existingRuntimeConfig.heartbeat = heartbeat;

        const normalizedRuntimeConfig = normalizeRuntimeConfigForAdapterType(
          agent.adapterType,
          existingRuntimeConfig,
        );

        const updated = await svc.update(
          params.id,
          { runtimeConfig: normalizedRuntimeConfig },
          {
            recordRevision: {
              createdByUserId: actor?.userId ?? null,
              source: "instance_scheduler_heartbeat_toggle",
            },
          },
        );

        if (!updated) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        await logActivity(db, {
          companyId: agent.companyId,
          actorType: "user",
          actorId: actor?.userId ?? "board",
          action: input.enabled ? "heartbeat.enabled" : "heartbeat.disabled",
          entityType: "agent",
          entityId: agent.id,
          details: {
            agentId: agent.id,
            enabled: input.enabled,
          },
        });

        return updated;
      },
      {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          enabled: t.Boolean(),
        }),
      },
    )

    // ── Org chart (JSON) ───────────────────────────────────────────
    .get(
      "/companies/:companyId/org",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        const tree = await svc.orgForCompany(params.companyId);
        return tree.map((node: Record<string, unknown>) => toLeanOrgNode(node));
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Org chart (SVG) ────────────────────────────────────────────
    .get(
      "/companies/:companyId/org.svg",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        const style = (ORG_CHART_STYLES.includes(query.style as OrgChartStyle) ? query.style : "warmth") as OrgChartStyle;
        const tree = await svc.orgForCompany(params.companyId);
        const leanTree = tree.map((node: Record<string, unknown>) => toLeanOrgNode(node));
        const svg = renderOrgChartSvg(leanTree as unknown as OrgNode[], style);
        set.headers = {
          ...set.headers,
          "content-type": "image/svg+xml",
          "cache-control": "no-cache",
        };
        return svg;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Org chart (PNG) ────────────────────────────────────────────
    .get(
      "/companies/:companyId/org.png",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        const style = (ORG_CHART_STYLES.includes(query.style as OrgChartStyle) ? query.style : "warmth") as OrgChartStyle;
        const tree = await svc.orgForCompany(params.companyId);
        const leanTree = tree.map((node: Record<string, unknown>) => toLeanOrgNode(node));
        const png = await renderOrgChartPng(leanTree as unknown as OrgNode[], style);
        set.headers = {
          ...set.headers,
          "content-type": "image/png",
          "cache-control": "no-cache",
        };
        return png;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Agent configurations (redacted) ────────────────────────────
    .get(
      "/companies/:companyId/agent-configurations",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        const rows = await svc.list(params.companyId);
        return rows.map((row: any) => ({
          id: row.id,
          companyId: row.companyId,
          name: row.name,
          role: row.role,
          title: row.title,
          status: row.status,
          reportsTo: row.reportsTo,
          adapterType: row.adapterType,
          adapterConfig: redactEventPayload(row.adapterConfig),
          runtimeConfig: redactEventPayload(row.runtimeConfig),
          permissions: row.permissions,
          updatedAt: row.updatedAt,
        }));
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Current agent (me) ─────────────────────────────────────────
    .get(
      "/agents/me",
      async ({ set, ...ctx }: any) => {
        const actor = ctx.actor;
        if (actor.type !== "agent" || !actor.agentId) {
          set.status = 401;
          return { error: "Agent authentication required" };
        }
        const agent = await svc.getById(actor.agentId);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        const accessInfo = await buildAccessInfo(agent);
        return { ...agent, access: accessInfo };
      },
    )

    // ── Current agent inbox (lite) ─────────────────────────────────
    .get(
      "/agents/me/inbox-lite",
      async ({ set, ...ctx }: any) => {
        const actor = ctx.actor;
        if (actor.type !== "agent" || !actor.agentId || !actor.companyId) {
          set.status = 401;
          return { error: "Agent authentication required" };
        }

        const issuesSvc = issueService(db);
        const rows = await issuesSvc.list(actor.companyId, {
          assigneeAgentId: actor.agentId,
          status: "todo,in_progress,blocked",
        });

        return rows.map((issue: any) => ({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          status: issue.status,
          priority: issue.priority,
          projectId: issue.projectId,
          goalId: issue.goalId,
          parentId: issue.parentId,
          updatedAt: issue.updatedAt,
          activeRun: issue.activeRun,
        }));
      },
    )

    .get(
      "/agents/me/inbox/mine",
      async ({ set, ...ctx }: any) => {
        const actor = ctx.actor;
        if (actor.type !== "agent" || !actor.agentId || !actor.companyId) {
          set.status = 401;
          return { error: "Agent authentication required" };
        }

        const query = agentMineInboxQuerySchema.parse(ctx.query);
        const issuesSvc = issueService(db);
        return issuesSvc.list(actor.companyId, {
          touchedByUserId: query.userId,
          inboxArchivedByUserId: query.userId,
          status: query.status,
        });
      },
    )

    // ── Get agent configuration (redacted) ─────────────────────────
    .get(
      "/agents/:id/configuration",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await svc.getById(params.id);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agent.companyId);
        return {
          id: agent.id,
          companyId: agent.companyId,
          name: agent.name,
          role: agent.role,
          title: agent.title,
          status: agent.status,
          reportsTo: agent.reportsTo,
          adapterType: agent.adapterType,
          adapterConfig: redactEventPayload(agent.adapterConfig),
          runtimeConfig: redactEventPayload(agent.runtimeConfig),
          permissions: agent.permissions,
          updatedAt: agent.updatedAt,
        };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Get single config revision ─────────────────────────────────
    .get(
      "/agents/:id/config-revisions/:revisionId",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await svc.getById(params.id);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agent.companyId);
        const revision = await svc.getConfigRevision(params.id, params.revisionId);
        if (!revision) {
          set.status = 404;
          return { error: "Revision not found" };
        }
        return revision;
      },
      { params: t.Object({ id: t.String(), revisionId: t.String() }) },
    )

    // ── Rollback config revision ───────────────────────────────────
    .post(
      "/agents/:id/config-revisions/:revisionId/rollback",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor | undefined;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor!, existing.companyId);

        const updated = await svc.rollbackConfigRevision(params.id, params.revisionId, {
          agentId: actor?.agentId ?? null,
          userId: actor?.userId ?? null,
        });
        if (!updated) {
          set.status = 404;
          return { error: "Revision not found" };
        }

        await logActivity(db, {
          companyId: updated.companyId,
          actorType: actor?.type === "agent" ? "agent" : "user",
          actorId: actor?.userId ?? actor?.agentId ?? "unknown",
          action: "agent.config_rolled_back",
          entityType: "agent",
          entityId: updated.id,
          details: { revisionId: params.revisionId },
        });

        return updated;
      },
      { params: t.Object({ id: t.String(), revisionId: t.String() }) },
    )

    // ── Reset runtime session ──────────────────────────────────────
    .post(
      "/agents/:id/runtime-state/reset-session",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor | undefined;
        const agent = await svc.getById(params.id);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor!, agent.companyId);

        const taskKey =
          typeof (body as any)?.taskKey === "string" && (body as any).taskKey.trim().length > 0
            ? (body as any).taskKey.trim()
            : null;
        const state = await heartbeats.resetRuntimeSession(params.id, { taskKey });

        await logActivity(db, {
          companyId: agent.companyId,
          actorType: "user",
          actorId: actor?.userId ?? "board",
          action: "agent.runtime_session_reset",
          entityType: "agent",
          entityId: params.id,
          details: { taskKey: taskKey ?? null },
        });

        return state;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Update instructions path ───────────────────────────────────
    .patch(
      "/agents/:id/instructions-path",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor | undefined;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor!, existing.companyId);

        const input = body as { path: string | null; adapterConfigKey?: string };
        const existingAdapterConfig = isPlain(existing.adapterConfig) ? { ...existing.adapterConfig as Record<string, unknown> } : {};

        const DEFAULT_INSTRUCTIONS_PATH_KEYS: Record<string, string> = {
          claude_local: "instructionsFilePath",
          codex_local: "instructionsFilePath",
          gemini_local: "instructionsFilePath",
          opencode_local: "instructionsFilePath",
        };
        const adapterConfigKey = input.adapterConfigKey ?? DEFAULT_INSTRUCTIONS_PATH_KEYS[existing.adapterType] ?? null;
        if (!adapterConfigKey) {
          set.status = 422;
          return { error: `No default instructions path key for adapter type '${existing.adapterType}'. Provide adapterConfigKey.` };
        }

        const nextAdapterConfig: Record<string, unknown> = { ...existingAdapterConfig };
        if (input.path === null) {
          delete nextAdapterConfig[adapterConfigKey];
        } else {
          const trimmed = input.path.trim();
          nextAdapterConfig[adapterConfigKey] = path.isAbsolute(trimmed)
            ? trimmed
            : (() => {
                const cwd = typeof existingAdapterConfig.cwd === "string" ? existingAdapterConfig.cwd : null;
                if (!cwd || !path.isAbsolute(cwd)) {
                  throw new Error("Relative instructions path requires adapterConfig.cwd to be set to an absolute path");
                }
                return path.resolve(cwd, trimmed);
              })();
        }

        const syncedAdapterConfig = syncInstructionsBundleConfigFromFilePath(existing, nextAdapterConfig);
        const normalizedAdapterConfig = await secrets.normalizeAdapterConfigForPersistence(
          existing.companyId,
          syncedAdapterConfig,
        );
        const agent = await svc.update(
          params.id,
          { adapterConfig: normalizedAdapterConfig },
          {
            recordRevision: {
              createdByUserId: actor?.userId ?? null,
              source: "instructions_path_patch",
            },
          },
        );
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }

        const updatedAdapterConfig = isPlain(agent.adapterConfig) ? agent.adapterConfig as Record<string, unknown> : {};
        const pathValue = typeof updatedAdapterConfig[adapterConfigKey] === "string" ? updatedAdapterConfig[adapterConfigKey] : null;

        await logActivity(db, {
          companyId: agent.companyId,
          actorType: actor?.type === "agent" ? "agent" : "user",
          actorId: actor?.userId ?? actor?.agentId ?? "unknown",
          action: "agent.instructions_path_updated",
          entityType: "agent",
          entityId: agent.id,
          details: {
            adapterConfigKey,
            path: pathValue,
            cleared: input.path === null,
          },
        });

        return {
          agentId: agent.id,
          adapterType: agent.adapterType,
          adapterConfigKey,
          path: pathValue,
        };
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Update instructions bundle ─────────────────────────────────
    .patch(
      "/agents/:id/instructions-bundle",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor | undefined;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor!, existing.companyId);

        const { bundle, adapterConfig } = await instructionsSvc.updateBundle(existing, body as any);
        const normalizedAdapterConfig = await secrets.normalizeAdapterConfigForPersistence(
          existing.companyId,
          adapterConfig,
        );
        await svc.update(
          params.id,
          { adapterConfig: normalizedAdapterConfig },
          {
            recordRevision: {
              createdByUserId: actor?.userId ?? null,
              source: "instructions_bundle_patch",
            },
          },
        );

        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actor?.type === "agent" ? "agent" : "user",
          actorId: actor?.userId ?? actor?.agentId ?? "unknown",
          action: "agent.instructions_bundle_updated",
          entityType: "agent",
          entityId: existing.id,
          details: {
            mode: bundle.mode,
            rootPath: bundle.rootPath,
            entryFile: bundle.entryFile,
            clearLegacyPromptTemplate: (body as any)?.clearLegacyPromptTemplate === true,
          },
        });

        return bundle;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Delete instructions bundle file ────────────────────────────
    .delete(
      "/agents/:id/instructions-bundle/file",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor | undefined;
        const existing = await svc.getById(params.id);
        if (!existing) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor!, existing.companyId);

        const relativePath = typeof query.path === "string" ? query.path : "";
        if (!relativePath.trim()) {
          set.status = 422;
          return { error: "Query parameter 'path' is required" };
        }

        const result = await instructionsSvc.deleteFile(existing, relativePath);
        await logActivity(db, {
          companyId: existing.companyId,
          actorType: actor?.type === "agent" ? "agent" : "user",
          actorId: actor?.userId ?? actor?.agentId ?? "unknown",
          action: "agent.instructions_file_deleted",
          entityType: "agent",
          entityId: existing.id,
          details: { path: relativePath },
        });

        return result.bundle;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── List agent API keys ────────────────────────────────────────
    .get(
      "/agents/:id/keys",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor;
        assertBoard(actor);
        return svc.listKeys(params.id);
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Create agent API key ───────────────────────────────────────
    .post(
      "/agents/:id/keys",
      async ({ params, body, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor;
        assertBoard(actor);
        const input = body as { name: string };
        const key = await svc.createApiKey(params.id, input.name);

        const agent = await svc.getById(params.id);
        if (agent) {
          await logActivity(db, {
            companyId: agent.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "agent.key_created",
            entityType: "agent",
            entityId: agent.id,
            details: { keyId: key.id, name: key.name },
          });
        }

        set.status = 201;
        return key;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Revoke agent API key ───────────────────────────────────────
    .delete(
      "/agents/:id/keys/:keyId",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        assertBoard(actor);
        const revoked = await svc.revokeKey(params.keyId);
        if (!revoked) {
          set.status = 404;
          return { error: "Key not found" };
        }
        return { ok: true };
      },
      { params: t.Object({ id: t.String(), keyId: t.String() }) },
    )

    // ── Heartbeat invoke (on-demand) ───────────────────────────────
    .post(
      "/agents/:id/heartbeat/invoke",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor as Actor;
        const agent = await svc.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);

        if (actor.type === "agent" && actor.agentId !== params.id) {
          set.status = 403;
          return { error: "Agent can only invoke itself" };
        }

        const run = await heartbeats.invoke(
          params.id,
          "on_demand",
          {
            triggeredBy: actor.type,
            actorId: actor.type === "agent" ? actor.agentId : actor.userId,
          },
          "manual",
          {
            actorType: actor.type === "agent" ? "agent" : "user",
            actorId: actor.type === "agent" ? actor.agentId ?? null : actor.userId ?? null,
          },
        );

        if (!run) {
          set.status = 202;
          return { status: "skipped" };
        }

        await logActivity(db, {
          companyId: agent.companyId,
          actorType: actor.type === "agent" ? "agent" : "user",
          actorId: actor.type === "agent" ? (actor.agentId ?? "unknown") : (actor.userId ?? "board"),
          action: "heartbeat.invoked",
          entityType: "heartbeat_run",
          entityId: run.id,
          details: { agentId: params.id },
        });

        set.status = 202;
        return run;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Claude login ───────────────────────────────────────────────
    .post(
      "/agents/:id/claude-login",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        assertBoard(actor);
        const agent = await svc.getById(params.id);
        if (!agent) {
          set.status = 404;
          return { error: "Agent not found" };
        }
        assertCompanyAccess(actor, agent.companyId);
        if (agent.adapterType !== "claude_local") {
          set.status = 400;
          return { error: "Login is only supported for claude_local agents" };
        }

        const config = isPlain(agent.adapterConfig) ? agent.adapterConfig : {};
        const { config: runtimeConfig } = await secrets.resolveAdapterConfigForRuntime(agent.companyId, config);
        const result = await runClaudeLogin({
          runId: `claude-login-${randomUUID()}`,
          agent: {
            id: agent.id,
            companyId: agent.companyId,
            name: agent.name,
            adapterType: agent.adapterType,
            adapterConfig: agent.adapterConfig,
          },
          config: runtimeConfig,
        });

        return result;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── List heartbeat runs for company ────────────────────────────
    .get(
      "/companies/:companyId/heartbeat-runs",
      async ({ params, query, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);
        const agentId = query.agentId as string | undefined;
        const limitParam = query.limit as string | undefined;
        const limit = limitParam ? Math.max(1, Math.min(1000, parseInt(limitParam, 10) || 200)) : undefined;
        return heartbeats.list(params.companyId, agentId, limit);
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Live runs for company ──────────────────────────────────────
    .get(
      "/companies/:companyId/live-runs",
      async ({ params, query, ...ctx }: any) => {
        const actor = ctx.actor;
        assertCompanyAccess(actor, params.companyId);

        const minCountParam = query.minCount as string | undefined;
        const minCount = minCountParam ? Math.max(0, Math.min(20, parseInt(minCountParam, 10) || 0)) : 0;

        const columns = {
          id: heartbeatRuns.id,
          status: heartbeatRuns.status,
          invocationSource: heartbeatRuns.invocationSource,
          triggerDetail: heartbeatRuns.triggerDetail,
          startedAt: heartbeatRuns.startedAt,
          finishedAt: heartbeatRuns.finishedAt,
          createdAt: heartbeatRuns.createdAt,
          agentId: heartbeatRuns.agentId,
          agentName: agents.name,
          agentIcon: agents.icon,
          agentRole: agents.role,
          adapterType: agents.adapterType,
          stdoutExcerpt: heartbeatRuns.stdoutExcerpt,
          stderrExcerpt: heartbeatRuns.stderrExcerpt,
          exitCode: heartbeatRuns.exitCode,
          error: heartbeatRuns.error,
          issueId: sql<string | null>`${heartbeatRuns.contextSnapshot} ->> 'issueId'`.as("issueId"),
        };

        const liveRuns = await db
          .select(columns)
          .from(heartbeatRuns)
          .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
          .where(
            and(
              eq(heartbeatRuns.companyId, params.companyId),
              inArray(heartbeatRuns.status, ["queued", "running"]),
            ),
          )
          .orderBy(desc(heartbeatRuns.createdAt));

        if (minCount > 0 && liveRuns.length < minCount) {
          const activeIds = liveRuns.map((r) => r.id);
          const recentRuns = await db
            .select(columns)
            .from(heartbeatRuns)
            .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
            .where(
              and(
                eq(heartbeatRuns.companyId, params.companyId),
                not(inArray(heartbeatRuns.status, ["queued", "running"])),
                ...(activeIds.length > 0 ? [not(inArray(heartbeatRuns.id, activeIds))] : []),
              ),
            )
            .orderBy(desc(heartbeatRuns.createdAt))
            .limit(minCount - liveRuns.length);

          return [...liveRuns, ...recentRuns];
        }

        return liveRuns;
      },
      { params: t.Object({ companyId: t.String() }) },
    )

    // ── Get heartbeat run by ID ────────────────────────────────────
    .get(
      "/heartbeat-runs/:runId",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const run = await heartbeats.getRun(params.runId);
        if (!run) {
          set.status = 404;
          return { error: "Heartbeat run not found" };
        }
        assertCompanyAccess(actor, run.companyId);
        return redactCurrentUserValue(run, await getCurrentUserRedactionOptions());
      },
      { params: t.Object({ runId: t.String() }) },
    )

    // ── Cancel heartbeat run ───────────────────────────────────────
    .post(
      "/heartbeat-runs/:runId/cancel",
      async ({ params, ...ctx }: any) => {
        const actor = ctx.actor as Actor;
        assertBoard(actor);
        const run = await heartbeats.cancelRun(params.runId);

        if (run) {
          await logActivity(db, {
            companyId: run.companyId,
            actorType: "user",
            actorId: actor.userId ?? "board",
            action: "heartbeat.cancelled",
            entityType: "heartbeat_run",
            entityId: run.id,
            details: { agentId: run.agentId },
          });
        }

        return run;
      },
      { params: t.Object({ runId: t.String() }) },
    )

    // ── Heartbeat run events ───────────────────────────────────────
    .get(
      "/heartbeat-runs/:runId/events",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
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
        const currentUserRedactionOptions = await getCurrentUserRedactionOptions();
        return events.map((event: any) =>
          redactCurrentUserValue({
            ...event,
            payload: redactEventPayload(event.payload),
          }, currentUserRedactionOptions),
        );
      },
      { params: t.Object({ runId: t.String() }) },
    )

    // ── Heartbeat run log ──────────────────────────────────────────
    .get(
      "/heartbeat-runs/:runId/log",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
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
      },
      { params: t.Object({ runId: t.String() }) },
    )

    // ── Heartbeat run transcript preview ──────────────────────────
    .get(
      "/heartbeat-runs/:runId/transcript",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const run = await heartbeats.getRun(params.runId);
        if (!run) {
          set.status = 404;
          return { error: "Heartbeat run not found" };
        }
        assertCompanyAccess(actor, run.companyId);

        const offset = Number(query.offset ?? 0);
        const limitBytes = Number(query.limitBytes ?? 256000);
        const result = await heartbeats.readLog(params.runId, {
          offset: Number.isFinite(offset) ? offset : 0,
          limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000,
        });

        return {
          runId: result.runId,
          store: result.store,
          logRef: result.logRef,
          content: result.content,
          nextOffset: result.nextOffset,
          messages: buildTranscriptMessages(result.content),
        };
      },
      { params: t.Object({ runId: t.String() }) },
    )

    // ── Heartbeat run workspace operations ─────────────────────────
    .get(
      "/heartbeat-runs/:runId/workspace-operations",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const run = await heartbeats.getRun(params.runId);
        if (!run) {
          set.status = 404;
          return { error: "Heartbeat run not found" };
        }
        assertCompanyAccess(actor, run.companyId);

        const context = isPlain(run.contextSnapshot) ? run.contextSnapshot as Record<string, unknown> : {};
        const executionWorkspaceId = typeof context.executionWorkspaceId === "string" && context.executionWorkspaceId.length > 0
          ? context.executionWorkspaceId
          : undefined;
        const operations = await wsOps.listForRun(params.runId, executionWorkspaceId);
        return redactCurrentUserValue(operations, await getCurrentUserRedactionOptions());
      },
      { params: t.Object({ runId: t.String() }) },
    )

    // ── Workspace operation log ────────────────────────────────────
    .get(
      "/workspace-operations/:operationId/log",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const operation = await wsOps.getById(params.operationId);
        if (!operation) {
          set.status = 404;
          return { error: "Workspace operation not found" };
        }
        assertCompanyAccess(actor, operation.companyId);

        const offset = Number(query.offset ?? 0);
        const limitBytes = Number(query.limitBytes ?? 256000);
        return wsOps.readLog(params.operationId, {
          offset: Number.isFinite(offset) ? offset : 0,
          limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000,
        });
      },
      { params: t.Object({ operationId: t.String() }) },
    )

    // ── Issue live runs ────────────────────────────────────────────
    .get(
      "/issues/:id/live-runs",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const rawId = params.id;
        const issueSvc = issueService(db);
        const isIdentifier = /^[A-Z]+-\d+$/i.test(rawId);
        const issue = isIdentifier ? await issueSvc.getByIdentifier(rawId) : await issueSvc.getById(rawId);
        if (!issue) {
          set.status = 404;
          return { error: "Issue not found" };
        }
        assertCompanyAccess(actor, issue.companyId);

        const liveRuns = await db
          .select({
            id: heartbeatRuns.id,
            status: heartbeatRuns.status,
            invocationSource: heartbeatRuns.invocationSource,
            triggerDetail: heartbeatRuns.triggerDetail,
            startedAt: heartbeatRuns.startedAt,
            finishedAt: heartbeatRuns.finishedAt,
            createdAt: heartbeatRuns.createdAt,
            agentId: heartbeatRuns.agentId,
            agentName: agents.name,
            adapterType: agents.adapterType,
          })
          .from(heartbeatRuns)
          .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
          .where(
            and(
              eq(heartbeatRuns.companyId, issue.companyId),
              inArray(heartbeatRuns.status, ["queued", "running"]),
              sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issue.id}`,
            ),
          )
          .orderBy(desc(heartbeatRuns.createdAt));

        return liveRuns;
      },
      { params: t.Object({ id: t.String() }) },
    )

    // ── Issue active run ───────────────────────────────────────────
    .get(
      "/issues/:id/active-run",
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const rawId = params.id;
        const issueSvc = issueService(db);
        const isIdentifier = /^[A-Z]+-\d+$/i.test(rawId);
        const issue: any = isIdentifier ? await issueSvc.getByIdentifier(rawId) : await issueSvc.getById(rawId);
        if (!issue) {
          set.status = 404;
          return { error: "Issue not found" };
        }
        assertCompanyAccess(actor, issue.companyId);

        let run = issue.executionRunId ? await heartbeats.getRun(issue.executionRunId) : null;
        if (run && run.status !== "queued" && run.status !== "running") {
          run = null;
        }

        if (!run && issue.assigneeAgentId && issue.status === "in_progress") {
          const candidateRun = await heartbeats.getActiveRunForAgent(issue.assigneeAgentId);
          const candidateContext = isPlain(candidateRun?.contextSnapshot)
            ? candidateRun!.contextSnapshot as Record<string, unknown>
            : {};
          const candidateIssueId = typeof candidateContext.issueId === "string" ? candidateContext.issueId : null;
          if (candidateRun && candidateIssueId === issue.id) {
            run = candidateRun;
          }
        }
        if (!run) {
          return null;
        }

        const agent = await svc.getById(run.agentId);
        if (!agent) {
          return null;
        }

        return {
          ...redactCurrentUserValue(run, await getCurrentUserRedactionOptions()),
          agentId: agent.id,
          agentName: agent.name,
          adapterType: agent.adapterType,
        };
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
