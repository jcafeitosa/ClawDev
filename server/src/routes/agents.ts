/**
 * Agents routes — Elysia port.
 *
 * Handles agent CRUD, configuration, lifecycle management
 * (pause, resume, terminate, wakeup), runs, runtime state, skills,
 * instructions-bundle, and permissions.
 */

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
import { and, desc, eq } from "drizzle-orm";
import {
  agentService,
  agentInstructionsService,
  accessService,
  approvalService,
  budgetService,
  companySkillService,
  heartbeatService,
  issueApprovalService,
  issueService,
  logActivity,
  secretService,
  syncInstructionsBundleConfigFromFilePath,
  workspaceOperationService,
} from "../services/index.js";
import { findServerAdapter, listAdapterModels } from "../adapters/index.js";
// Note: we use inline t.Object({ companyId: t.String() }) instead of companyIdParam
// because companyIdParam enforces UUID format which some callers don't use.
import { assertCompanyAccess, type Actor } from "../middleware/authz.js";

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
        const agent = await svc.getById(params.id);
        if (!agent) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agent.companyId);

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
      async ({ params, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const agent = await svc.getById(params.id);
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
        if (!companyId) return { skills: [] };

        const agent = await svc.getById(params.id);
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
            paperclipRuntimeSkills: initialSkillEntries,
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
        const agent = await svc.getById(params.id);
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
        const agentRecord = await svc.getById(params.id);
        if (!agentRecord) { set.status = 404; return { error: "Agent not found" }; }
        assertCompanyAccess(actor, agentRecord.companyId);

        const limit = Math.min(Number(query.limit) || 20, 100);
        const companyId = query.companyId as string | undefined;
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id);

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

    // ── Get instructions bundle ─────────────────────────────────────
    .get(
      "/agents/:id/instructions-bundle",
      async ({ params, query, set, ...ctx }: any) => {
        const actor = ctx.actor;
        const companyId = query.companyId as string | undefined;
        const agent = await svc.getById(params.id);
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
        const agent = await svc.getById(params.id);
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
        const agent = await svc.getById(params.id);
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
          adapterConfig.paperclipSkillSync = {
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
          adapterConfig.paperclipSkillSync = {
            desiredSkills,
            syncedAt: new Date().toISOString(),
          };
        }

        // Materialize managed instructions for local adapters in approval payload
        const stubAgent = {
          id: "11111111-1111-4111-8111-111111111111", // placeholder for materialization
          companyId: params.companyId,
          name: String(input.name ?? ""),
          role: String(input.role ?? "engineer"),
          adapterType: String(input.adapterType ?? "process"),
          adapterConfig,
        };
        const materializedConfig = await materializeForNewAgent(stubAgent, adapterConfig);
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
          return { error: "Not found" };
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

        // Copy other safe fields
        for (const key of ["name", "role", "title", "reportsTo", "capabilities", "runtimeConfig", "metadata", "status"]) {
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
          return { error: "Not found" };
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
              paperclipRuntimeSkills: runtimeSkillEntries,
            },
          },
          desiredSkills,
        );

        // Persist updated desired skills in adapter config
        const existingConfig = isPlain(agent.adapterConfig) ? { ...agent.adapterConfig } : {};
        const updatedConfig = {
          ...existingConfig,
          paperclipSkillSync: {
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
