import { Elysia } from "elysia";
import { randomUUID } from "node:crypto";
import type { Db } from "@clawdev/db";
import { agents as agentsTable, companies, heartbeatRuns } from "@clawdev/db";
import { and, desc, eq, inArray, not, sql } from "drizzle-orm";
import {
  agentSkillSyncSchema,
  createAgentKeySchema,
  createAgentHireSchema,
  createAgentSchema,
  deriveAgentUrlKey,
  isUuidLike,
  resetAgentSessionSchema,
  testAdapterEnvironmentSchema,
  type InstanceSchedulerHeartbeatAgent,
  upsertAgentInstructionsFileSchema,
  updateAgentInstructionsBundleSchema,
  updateAgentPermissionsSchema,
  updateAgentInstructionsPathSchema,
  wakeAgentSchema,
  updateAgentSchema,
} from "@clawdev/shared";
import {
  readClawDevSkillSyncPreference,
  writeClawDevSkillSyncPreference,
} from "@clawdev/adapter-utils/server-utils";
import {
  agentService,
  agentInstructionsService,
  accessService,
  approvalService,
  companySkillService,
  budgetService,
  heartbeatService,
  issueApprovalService,
  issueService,
  logActivity,
  secretService,
  syncInstructionsBundleConfigFromFilePath,
  workspaceOperationService,
} from "../services/index.js";
import { conflict, forbidden, notFound, unauthorized, unprocessable } from "../errors.js";
import { assertBoard, assertCompanyAccess, assertInstanceAdmin, getActorInfo } from "./authz.js";
import { findServerAdapter, listAdapterModels } from "../adapters/index.js";
import { redactEventPayload } from "../redaction.js";
import { redactCurrentUserValue } from "../log-redaction.js";
import { renderOrgChartSvg, renderOrgChartPng, type OrgNode, type OrgChartStyle, ORG_CHART_STYLES } from "../routes/org-chart-svg.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import { runClaudeLogin } from "@clawdev/adapter-claude-local/server";
import {
  loadDefaultAgentInstructionsBundle,
  resolveDefaultAgentInstructionsBundleRole,
} from "../services/default-agent-instructions.js";
import { elysiaAuth, type Actor } from "../elysia-plugins/auth.js";
import {
  DEFAULT_INSTRUCTIONS_PATH_KEYS,
  DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES,
  KNOWN_INSTRUCTIONS_PATH_KEYS,
  KNOWN_INSTRUCTIONS_BUNDLE_KEYS,
  canCreateAgents,
  asRecord,
  asNonEmptyString,
  parseBooleanLike,
  parseNumberLike,
  parseSchedulerHeartbeatPolicy,
  ensureGatewayDeviceKey,
  applyCreateDefaultsByAdapterType,
  preserveInstructionsBundleConfig,
  resolveInstructionsFilePath,
  parseSourceIssueIds,
  redactForRestrictedAgentView,
  redactAgentConfiguration,
  redactConfigRevision,
  toLeanOrgNode,
  summarizeAgentUpdateDetails,
  buildUnsupportedSkillSnapshot,
  shouldMaterializeRuntimeSkillsForAdapter,
  assertAdapterConfigConstraints,
} from "./agent-helpers.js";

export function elysiaAgentRoutes(db: Db, authPlugin: ReturnType<typeof elysiaAuth>) {
  const svc = agentService(db);
  const access = accessService(db);
  const approvalsSvc = approvalService(db);
  const budgets = budgetService(db);
  const heartbeat = heartbeatService(db);
  const issueApprovalsSvc = issueApprovalService(db);
  const secretsSvc = secretService(db);
  const instructionsSvc = agentInstructionsService();
  const companySkills = companySkillService(db);
  const workspaceOperations = workspaceOperationService(db);
  const instanceSettings = instanceSettingsService(db);
  const strictSecretsMode = process.env.CLAWDEV_SECRETS_STRICT_MODE === "true";

  async function getCurrentUserRedactionOptions() {
    return { enabled: (await instanceSettings.getGeneral()).censorUsernameInLogs };
  }

  async function buildAgentAccessState(agent: NonNullable<Awaited<ReturnType<typeof svc.getById>>>) {
    const membership = await access.getMembership(agent.companyId, "agent", agent.id);
    const grants = membership ? await access.listPrincipalGrants(agent.companyId, "agent", agent.id) : [];
    const hasExplicitTaskAssignGrant = grants.some((g) => g.permissionKey === "tasks:assign");
    if (agent.role === "ceo") return { canAssignTasks: true, taskAssignSource: "ceo_role" as const, membership, grants };
    if (canCreateAgents(agent)) return { canAssignTasks: true, taskAssignSource: "agent_creator" as const, membership, grants };
    if (hasExplicitTaskAssignGrant) return { canAssignTasks: true, taskAssignSource: "explicit_grant" as const, membership, grants };
    return { canAssignTasks: false, taskAssignSource: "none" as const, membership, grants };
  }

  async function buildAgentDetail(agent: NonNullable<Awaited<ReturnType<typeof svc.getById>>>, opts?: { restricted?: boolean }) {
    const [chainOfCommand, accessState] = await Promise.all([svc.getChainOfCommand(agent.id), buildAgentAccessState(agent)]);
    return { ...(opts?.restricted ? redactForRestrictedAgentView(agent) : agent), chainOfCommand, access: accessState };
  }

  async function applyDefaultAgentTaskAssignGrant(companyId: string, agentId: string, grantedByUserId: string | null) {
    await access.ensureMembership(companyId, "agent", agentId, "member", "active");
    await access.setPrincipalPermission(companyId, "agent", agentId, "tasks:assign", true, grantedByUserId);
  }

  async function assertCanCreateAgentsForCompany(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return null;
      const allowed = await access.canUser(companyId, actor.userId!, "agents:create");
      if (!allowed) throw forbidden("Missing permission: agents:create");
      return null;
    }
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await svc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) throw forbidden("Agent key cannot access another company");
    const allowedByGrant = await access.hasPermission(companyId, "agent", actorAgent.id, "agents:create");
    if (!allowedByGrant && !canCreateAgents(actorAgent)) throw forbidden("Missing permission: can create agents");
    return actorAgent;
  }

  async function actorCanReadConfigurationsForCompany(actor: Actor, companyId: string) {
    assertCompanyAccess(actor, companyId);
    if (actor.type === "board") {
      if (actor.source === "local_implicit" || actor.isInstanceAdmin) return true;
      return access.canUser(companyId, actor.userId!, "agents:create");
    }
    if (!actor.agentId) return false;
    const actorAgent = await svc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== companyId) return false;
    return (await access.hasPermission(companyId, "agent", actorAgent.id, "agents:create")) || canCreateAgents(actorAgent);
  }

  async function assertCanUpdateAgent(actor: Actor, targetAgent: { id: string; companyId: string }) {
    assertCompanyAccess(actor, targetAgent.companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await svc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) throw forbidden("Agent key cannot access another company");
    if (actorAgent.id === targetAgent.id) return;
    if (actorAgent.role === "ceo") return;
    const allowedByGrant = await access.hasPermission(targetAgent.companyId, "agent", actorAgent.id, "agents:create");
    if (allowedByGrant || canCreateAgents(actorAgent)) return;
    throw forbidden("Only CEO or agent creators can modify other agents");
  }

  async function assertCanReadAgent(actor: Actor, targetAgent: { companyId: string }) {
    assertCompanyAccess(actor, targetAgent.companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await svc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) throw forbidden("Agent key cannot access another company");
  }

  async function assertCanManageInstructionsPath(actor: Actor, targetAgent: { id: string; companyId: string }) {
    assertCompanyAccess(actor, targetAgent.companyId);
    if (actor.type === "board") return;
    if (!actor.agentId) throw forbidden("Agent authentication required");
    const actorAgent = await svc.getById(actor.agentId);
    if (!actorAgent || actorAgent.companyId !== targetAgent.companyId) throw forbidden("Agent key cannot access another company");
    if (actorAgent.id === targetAgent.id) return;
    const chainOfCommand = await svc.getChainOfCommand(targetAgent.id);
    if (chainOfCommand.some((m) => m.id === actorAgent.id)) return;
    throw forbidden("Only the target agent or an ancestor manager can update instructions path");
  }

  async function normalizeAgentReference(actor: Actor, rawId: string, query: Record<string, string>): Promise<string> {
    const raw = rawId.trim();
    if (isUuidLike(raw)) return raw;
    const requestedCompanyId = query.companyId?.trim() || null;
    let companyId: string | null = null;
    if (requestedCompanyId) { assertCompanyAccess(actor, requestedCompanyId); companyId = requestedCompanyId; }
    else if (actor.type === "agent" && actor.companyId) { companyId = actor.companyId; }
    if (!companyId) throw unprocessable("Agent shortname lookup requires companyId query parameter");
    const resolved = await svc.resolveByReference(companyId, raw);
    if (resolved.ambiguous) throw conflict("Agent shortname is ambiguous in this company. Use the agent ID.");
    if (!resolved.agent) throw notFound("Agent not found");
    return resolved.agent.id;
  }

  async function buildRuntimeSkillConfig(companyId: string, adapterType: string, config: Record<string, unknown>) {
    const runtimeSkillEntries = await companySkills.listRuntimeSkillEntries(companyId, { materializeMissing: shouldMaterializeRuntimeSkillsForAdapter(adapterType) });
    return { ...config, clawdevRuntimeSkills: runtimeSkillEntries };
  }

  async function resolveDesiredSkillAssignment(companyId: string, adapterType: string, adapterConfig: Record<string, unknown>, requestedDesiredSkills: string[] | undefined) {
    if (!requestedDesiredSkills) return { adapterConfig, desiredSkills: null as string[] | null, runtimeSkillEntries: null as Awaited<ReturnType<typeof companySkills.listRuntimeSkillEntries>> | null };
    const resolvedRequestedSkills = await companySkills.resolveRequestedSkillKeys(companyId, requestedDesiredSkills);
    const runtimeSkillEntries = await companySkills.listRuntimeSkillEntries(companyId, { materializeMissing: shouldMaterializeRuntimeSkillsForAdapter(adapterType) });
    const requiredSkills = runtimeSkillEntries.filter((e) => e.required).map((e) => e.key);
    const desiredSkills = Array.from(new Set([...requiredSkills, ...resolvedRequestedSkills]));
    return { adapterConfig: writeClawDevSkillSyncPreference(adapterConfig, desiredSkills), desiredSkills, runtimeSkillEntries };
  }

  async function materializeDefaultInstructionsBundleForNewAgent<T extends { id: string; companyId: string; name: string; role: string; adapterType: string; adapterConfig: unknown }>(agent: T): Promise<T> {
    if (!DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES.has(agent.adapterType)) return agent;
    const adapterConfig = asRecord(agent.adapterConfig) ?? {};
    const hasExplicit = Boolean(asNonEmptyString(adapterConfig.instructionsBundleMode)) || Boolean(asNonEmptyString(adapterConfig.instructionsRootPath)) || Boolean(asNonEmptyString(adapterConfig.instructionsEntryFile)) || Boolean(asNonEmptyString(adapterConfig.instructionsFilePath)) || Boolean(asNonEmptyString(adapterConfig.agentsMdPath));
    if (hasExplicit) return agent;
    const promptTemplate = typeof adapterConfig.promptTemplate === "string" ? adapterConfig.promptTemplate : "";
    const files = promptTemplate.trim().length === 0 ? await loadDefaultAgentInstructionsBundle(resolveDefaultAgentInstructionsBundleRole(agent.role)) : { "AGENTS.md": promptTemplate };
    const materialized = await instructionsSvc.materializeManagedBundle(agent, files, { entryFile: "AGENTS.md", replaceExisting: false });
    const nextAdapterConfig = { ...materialized.adapterConfig };
    delete nextAdapterConfig.promptTemplate;
    const updated = await svc.update(agent.id, { adapterConfig: nextAdapterConfig });
    return (updated as T | null) ?? { ...agent, adapterConfig: nextAdapterConfig };
  }

  // The route definitions follow — all 50 endpoints
  return new Elysia()
    .use(authPlugin)

    // === Adapter models ===
    .get("/companies/:companyId/adapters/:type/models", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      return listAdapterModels(params.type);
    })

    // === Test adapter environment ===
    .post("/companies/:companyId/adapters/:type/test-environment", async ({ params, body, actor }) => {
      await assertCanCreateAgentsForCompany(actor, params.companyId);
      const parsed = testAdapterEnvironmentSchema.parse(body);
      const adapter = findServerAdapter(params.type);
      if (!adapter) throw notFound(`Unknown adapter type: ${params.type}`);
      const inputConfig = ((parsed as Record<string, unknown>).adapterConfig ?? {}) as Record<string, unknown>;
      const normalized = await secretsSvc.normalizeAdapterConfigForPersistence(params.companyId, inputConfig, { strictMode: strictSecretsMode });
      const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(params.companyId, normalized);
      return adapter.testEnvironment({ companyId: params.companyId, adapterType: params.type, config: runtimeConfig });
    })

    // === Agent skills ===
    .get("/agents/:id/skills", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      await assertCanCreateAgentsForCompany(actor, agent.companyId);
      const adapter = findServerAdapter(agent.adapterType);
      if (!adapter?.listSkills) {
        const preference = readClawDevSkillSyncPreference(agent.adapterConfig as Record<string, unknown>);
        const runtimeSkillEntries = await companySkills.listRuntimeSkillEntries(agent.companyId, { materializeMissing: false });
        const requiredSkills = runtimeSkillEntries.filter((e) => e.required).map((e) => e.key);
        return buildUnsupportedSkillSnapshot(agent.adapterType, Array.from(new Set([...requiredSkills, ...preference.desiredSkills])));
      }
      const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(agent.companyId, agent.adapterConfig);
      const runtimeSkillConfig = await buildRuntimeSkillConfig(agent.companyId, agent.adapterType, runtimeConfig);
      return adapter.listSkills({ agentId: agent.id, companyId: agent.companyId, adapterType: agent.adapterType, config: runtimeSkillConfig });
    })

    // === Agent skill sync ===
    .post("/agents/:id/skills/sync", async ({ params, body, query, actor }) => {
      const parsed = agentSkillSyncSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      await assertCanUpdateAgent(actor, agent);
      const requestedSkills = Array.from(new Set((parsed.desiredSkills as string[]).map((v) => v.trim()).filter(Boolean)));
      const { adapterConfig: nextAdapterConfig, desiredSkills, runtimeSkillEntries } = await resolveDesiredSkillAssignment(agent.companyId, agent.adapterType, agent.adapterConfig as Record<string, unknown>, requestedSkills);
      if (!desiredSkills || !runtimeSkillEntries) throw unprocessable("Skill sync requires desiredSkills.");
      const actorInfo = getActorInfo(actor);
      const updated = await svc.update(agent.id, { adapterConfig: nextAdapterConfig }, { recordRevision: { createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null, source: "skill-sync" } });
      if (!updated) throw notFound("Agent not found");
      const adapter = findServerAdapter(updated.adapterType);
      const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(updated.companyId, updated.adapterConfig);
      const runtimeSkillConfig = { ...runtimeConfig, clawdevRuntimeSkills: runtimeSkillEntries };
      const snapshot = adapter?.syncSkills ? await adapter.syncSkills({ agentId: updated.id, companyId: updated.companyId, adapterType: updated.adapterType, config: runtimeSkillConfig }, desiredSkills) : adapter?.listSkills ? await adapter.listSkills({ agentId: updated.id, companyId: updated.companyId, adapterType: updated.adapterType, config: runtimeSkillConfig }) : buildUnsupportedSkillSnapshot(updated.adapterType, desiredSkills);
      await logActivity(db, { companyId: updated.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, action: "agent.skills_synced", entityType: "agent", entityId: updated.id, agentId: actorInfo.agentId, runId: actorInfo.runId, details: { adapterType: updated.adapterType, desiredSkills, mode: snapshot.mode, supported: snapshot.supported, entryCount: snapshot.entries.length, warningCount: snapshot.warnings.length } });
      return snapshot;
    })

    // === Company agents list ===
    .get("/companies/:companyId/agents", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const result = await svc.list(params.companyId);
      const canRead = await actorCanReadConfigurationsForCompany(actor, params.companyId);
      if (canRead || actor.type === "board") return result;
      return result.map((a) => redactForRestrictedAgentView(a));
    })

    // === Instance scheduler heartbeats ===
    .get("/instance/scheduler-heartbeats", async ({ actor }) => {
      assertInstanceAdmin(actor);
      const rows = await db.select({ id: agentsTable.id, companyId: agentsTable.companyId, agentName: agentsTable.name, role: agentsTable.role, title: agentsTable.title, status: agentsTable.status, adapterType: agentsTable.adapterType, runtimeConfig: agentsTable.runtimeConfig, lastHeartbeatAt: agentsTable.lastHeartbeatAt, companyName: companies.name, companyIssuePrefix: companies.issuePrefix }).from(agentsTable).innerJoin(companies, eq(agentsTable.companyId, companies.id)).orderBy(companies.name, agentsTable.name);
      return rows.map((row) => {
        const policy = parseSchedulerHeartbeatPolicy(row.runtimeConfig);
        const statusEligible = row.status !== "paused" && row.status !== "terminated" && row.status !== "pending_approval";
        return { id: row.id, companyId: row.companyId, companyName: row.companyName, companyIssuePrefix: row.companyIssuePrefix, agentName: row.agentName, agentUrlKey: deriveAgentUrlKey(row.agentName, row.id), role: row.role as InstanceSchedulerHeartbeatAgent["role"], title: row.title, status: row.status as InstanceSchedulerHeartbeatAgent["status"], adapterType: row.adapterType, intervalSec: policy.intervalSec, heartbeatEnabled: policy.enabled, schedulerActive: statusEligible && policy.enabled && policy.intervalSec > 0, lastHeartbeatAt: row.lastHeartbeatAt };
      }).filter((i) => i.status !== "paused" && i.status !== "terminated" && i.status !== "pending_approval").sort((a, b) => { if (a.schedulerActive !== b.schedulerActive) return a.schedulerActive ? -1 : 1; const c = a.companyName.localeCompare(b.companyName); return c !== 0 ? c : a.agentName.localeCompare(b.agentName); });
    })

    // === Org chart ===
    .get("/companies/:companyId/org", async ({ params, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const tree = await svc.orgForCompany(params.companyId);
      return tree.map((node) => toLeanOrgNode(node as Record<string, unknown>));
    })
    .get("/companies/:companyId/org.svg", async ({ params, query, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const style = (ORG_CHART_STYLES.includes((query as Record<string, string>).style as OrgChartStyle) ? (query as Record<string, string>).style : "warmth") as OrgChartStyle;
      const tree = await svc.orgForCompany(params.companyId);
      const leanTree = tree.map((node) => toLeanOrgNode(node as Record<string, unknown>));
      set.headers["content-type"] = "image/svg+xml";
      set.headers["cache-control"] = "no-cache";
      return renderOrgChartSvg(leanTree as unknown as OrgNode[], style);
    })
    .get("/companies/:companyId/org.png", async ({ params, query, actor, set }) => {
      assertCompanyAccess(actor, params.companyId);
      const style = (ORG_CHART_STYLES.includes((query as Record<string, string>).style as OrgChartStyle) ? (query as Record<string, string>).style : "warmth") as OrgChartStyle;
      const tree = await svc.orgForCompany(params.companyId);
      const leanTree = tree.map((node) => toLeanOrgNode(node as Record<string, unknown>));
      const png = await renderOrgChartPng(leanTree as unknown as OrgNode[], style);
      set.headers["content-type"] = "image/png";
      set.headers["cache-control"] = "no-cache";
      return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "no-cache" } });
    })

    // === Agent configurations ===
    .get("/companies/:companyId/agent-configurations", async ({ params, actor }) => {
      await assertCanCreateAgentsForCompany(actor, params.companyId);
      const rows = await svc.list(params.companyId);
      return rows.map((row) => redactAgentConfiguration(row));
    })

    // === Me endpoints ===
    .get("/agents/me", async ({ actor }) => {
      if (actor.type !== "agent" || !actor.agentId) throw unauthorized("Agent authentication required");
      const agent = await svc.getById(actor.agentId);
      if (!agent) throw notFound("Agent not found");
      return buildAgentDetail(agent);
    })
    .get("/agents/me/inbox-lite", async ({ actor }) => {
      if (actor.type !== "agent" || !actor.agentId || !actor.companyId) throw unauthorized("Agent authentication required");
      const issueSvc = issueService(db);
      const rows = await issueSvc.list(actor.companyId, { assigneeAgentId: actor.agentId, status: "todo,in_progress,blocked" });
      return rows.map((issue) => ({ id: issue.id, identifier: issue.identifier, title: issue.title, status: issue.status, priority: issue.priority, projectId: issue.projectId, goalId: issue.goalId, parentId: issue.parentId, updatedAt: issue.updatedAt, activeRun: issue.activeRun }));
    })

    // === Agent CRUD ===
    .get("/agents/:id", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      if (actor.type === "agent" && actor.agentId !== id) {
        const canRead = await actorCanReadConfigurationsForCompany(actor, agent.companyId);
        if (!canRead) return buildAgentDetail(agent, { restricted: true });
      }
      return buildAgentDetail(agent);
    })
    .get("/agents/:id/configuration", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      await assertCanCreateAgentsForCompany(actor, agent.companyId);
      return redactAgentConfiguration(agent);
    })
    .get("/agents/:id/config-revisions", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      await assertCanCreateAgentsForCompany(actor, agent.companyId);
      const revisions = await svc.listConfigRevisions(id);
      return revisions.map((r) => redactConfigRevision(r));
    })
    .get("/agents/:id/config-revisions/:revisionId", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      await assertCanCreateAgentsForCompany(actor, agent.companyId);
      const revision = await svc.getConfigRevision(id, params.revisionId);
      if (!revision) throw notFound("Revision not found");
      return redactConfigRevision(revision);
    })
    .post("/agents/:id/config-revisions/:revisionId/rollback", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanUpdateAgent(actor, existing);
      const actorInfo = getActorInfo(actor);
      const updated = await svc.rollbackConfigRevision(id, params.revisionId, { agentId: actorInfo.agentId, userId: actorInfo.actorType === "user" ? actorInfo.actorId : null });
      if (!updated) throw notFound("Revision not found");
      await logActivity(db, { companyId: updated.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.config_rolled_back", entityType: "agent", entityId: updated.id, details: { revisionId: params.revisionId } });
      return updated;
    })

    // === Runtime state ===
    .get("/agents/:id/runtime-state", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      return heartbeat.getRuntimeState(id);
    })
    .get("/agents/:id/task-sessions", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      const sessions = await heartbeat.listTaskSessions(id);
      return sessions.map((s) => ({ ...s, sessionParamsJson: redactEventPayload(s.sessionParamsJson ?? null) }));
    })
    .post("/agents/:id/runtime-state/reset-session", async ({ params, body, query, actor }) => {
      assertBoard(actor);
      const parsed = resetAgentSessionSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      const taskKey = typeof parsed.taskKey === "string" && parsed.taskKey.trim().length > 0 ? parsed.taskKey.trim() : null;
      const state = await heartbeat.resetRuntimeSession(id, { taskKey });
      await logActivity(db, { companyId: agent.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "agent.runtime_session_reset", entityType: "agent", entityId: id, details: { taskKey } });
      return state;
    })

    // === Agent hires ===
    .post("/companies/:companyId/agent-hires", async ({ params, body, actor, set }) => {
      const parsed = createAgentHireSchema.parse(body);
      await assertCanCreateAgentsForCompany(actor, params.companyId);
      const sourceIssueIds = parseSourceIssueIds(parsed as Record<string, unknown>);
      const { desiredSkills: requestedDesiredSkills, sourceIssueId: _a, sourceIssueIds: _b, ...hireInput } = parsed as Record<string, unknown>;
      const requestedAdapterConfig = applyCreateDefaultsByAdapterType(hireInput.adapterType as string, ((hireInput.adapterConfig ?? {}) as Record<string, unknown>));
      const desiredSkillAssignment = await resolveDesiredSkillAssignment(params.companyId, hireInput.adapterType as string, requestedAdapterConfig, Array.isArray(requestedDesiredSkills) ? requestedDesiredSkills as string[] : undefined);
      const normalizedAdapterConfig = await secretsSvc.normalizeAdapterConfigForPersistence(params.companyId, desiredSkillAssignment.adapterConfig, { strictMode: strictSecretsMode });
      await assertAdapterConfigConstraints(params.companyId, hireInput.adapterType as string, normalizedAdapterConfig, secretsSvc);
      const normalizedHireInput = { ...hireInput, adapterConfig: normalizedAdapterConfig } as Record<string, unknown>;
      const company = await db.select().from(companies).where(eq(companies.id, params.companyId)).then((rows) => rows[0] ?? null);
      if (!company) throw notFound("Company not found");
      const requiresApproval = company.requireBoardApprovalForNewAgents;
      const status = requiresApproval ? "pending_approval" : "idle";
      const createdAgent = await svc.create(params.companyId, { ...normalizedHireInput, status, spentMonthlyCents: 0, lastHeartbeatAt: null } as Parameters<typeof svc.create>[1]);
      const agent = await materializeDefaultInstructionsBundleForNewAgent(createdAgent);
      let approval: Awaited<ReturnType<typeof approvalsSvc.getById>> | null = null;
      const actorInfo = getActorInfo(actor);
      if (requiresApproval) {
        const redactedAdapterConfig = redactEventPayload((agent.adapterConfig ?? normalizedHireInput.adapterConfig) as Record<string, unknown>) ?? {};
        const redactedRuntimeConfig = redactEventPayload((normalizedHireInput.runtimeConfig ?? agent.runtimeConfig) as Record<string, unknown>) ?? {};
        const redactedMetadata = redactEventPayload(((normalizedHireInput.metadata ?? agent.metadata ?? {}) as Record<string, unknown>)) ?? {};
        approval = await approvalsSvc.create(params.companyId, { type: "hire_agent", requestedByAgentId: actorInfo.actorType === "agent" ? actorInfo.actorId : null, requestedByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null, status: "pending", payload: { name: normalizedHireInput.name, role: normalizedHireInput.role, title: normalizedHireInput.title ?? null, icon: normalizedHireInput.icon ?? null, reportsTo: normalizedHireInput.reportsTo ?? null, capabilities: normalizedHireInput.capabilities ?? null, adapterType: normalizedHireInput.adapterType ?? agent.adapterType, adapterConfig: redactedAdapterConfig, runtimeConfig: redactedRuntimeConfig, budgetMonthlyCents: typeof normalizedHireInput.budgetMonthlyCents === "number" ? normalizedHireInput.budgetMonthlyCents : agent.budgetMonthlyCents, desiredSkills: desiredSkillAssignment.desiredSkills, metadata: redactedMetadata, agentId: agent.id, requestedByAgentId: actorInfo.actorType === "agent" ? actorInfo.actorId : null, requestedConfigurationSnapshot: { adapterType: normalizedHireInput.adapterType ?? agent.adapterType, adapterConfig: redactedAdapterConfig, runtimeConfig: redactedRuntimeConfig, desiredSkills: desiredSkillAssignment.desiredSkills } }, decisionNote: null, decidedByUserId: null, decidedAt: null, updatedAt: new Date() } as Parameters<typeof approvalsSvc.create>[1]);
        if (sourceIssueIds.length > 0) await issueApprovalsSvc.linkManyForApproval(approval!.id, sourceIssueIds, { agentId: actorInfo.actorType === "agent" ? actorInfo.actorId : null, userId: actorInfo.actorType === "user" ? actorInfo.actorId : null });
      }
      await logActivity(db, { companyId: params.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.hire_created", entityType: "agent", entityId: agent.id, details: { name: agent.name, role: agent.role, requiresApproval, approvalId: approval?.id ?? null, issueIds: sourceIssueIds, desiredSkills: desiredSkillAssignment.desiredSkills } });
      await applyDefaultAgentTaskAssignGrant(params.companyId, agent.id, actorInfo.actorType === "user" ? actorInfo.actorId : null);
      if (approval) await logActivity(db, { companyId: params.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "approval.created", entityType: "approval", entityId: approval.id, details: { type: approval.type, linkedAgentId: agent.id } });
      set.status = 201;
      return { agent, approval };
    })

    // === Direct agent create ===
    .post("/companies/:companyId/agents", async ({ params, body, actor, set }) => {
      const parsed = createAgentSchema.parse(body);
      assertCompanyAccess(actor, params.companyId);
      if (actor.type === "agent") assertBoard(actor);
      const { desiredSkills: requestedDesiredSkills, ...createInput } = parsed as Record<string, unknown>;
      const requestedAdapterConfig = applyCreateDefaultsByAdapterType(createInput.adapterType as string, ((createInput.adapterConfig ?? {}) as Record<string, unknown>));
      const desiredSkillAssignment = await resolveDesiredSkillAssignment(params.companyId, createInput.adapterType as string, requestedAdapterConfig, Array.isArray(requestedDesiredSkills) ? requestedDesiredSkills as string[] : undefined);
      const normalizedAdapterConfig = await secretsSvc.normalizeAdapterConfigForPersistence(params.companyId, desiredSkillAssignment.adapterConfig, { strictMode: strictSecretsMode });
      await assertAdapterConfigConstraints(params.companyId, createInput.adapterType as string, normalizedAdapterConfig, secretsSvc);
      const createdAgent = await svc.create(params.companyId, { ...createInput, adapterConfig: normalizedAdapterConfig, status: "idle", spentMonthlyCents: 0, lastHeartbeatAt: null } as Parameters<typeof svc.create>[1]);
      const agent = await materializeDefaultInstructionsBundleForNewAgent(createdAgent);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: params.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.created", entityType: "agent", entityId: agent.id, details: { name: agent.name, role: agent.role, desiredSkills: desiredSkillAssignment.desiredSkills } });
      await applyDefaultAgentTaskAssignGrant(params.companyId, agent.id, actor.type === "board" ? (actor.userId ?? null) : null);
      if (agent.budgetMonthlyCents > 0) await budgets.upsertPolicy(params.companyId, { scopeType: "agent", scopeId: agent.id, amount: agent.budgetMonthlyCents, windowKind: "calendar_month_utc" }, actorInfo.actorType === "user" ? actorInfo.actorId : null);
      set.status = 201;
      return agent;
    })

    // === Permissions ===
    .patch("/agents/:id/permissions", async ({ params, body, query, actor }) => {
      const parsed = updateAgentPermissionsSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      assertCompanyAccess(actor, existing.companyId);
      if (actor.type === "agent") { const actorAgent = actor.agentId ? await svc.getById(actor.agentId) : null; if (!actorAgent || actorAgent.companyId !== existing.companyId) throw forbidden("Forbidden"); if (actorAgent.role !== "ceo") throw forbidden("Only CEO can manage permissions"); }
      const agent = await svc.updatePermissions(id, parsed);
      if (!agent) throw notFound("Agent not found");
      const effectiveCanAssignTasks = agent.role === "ceo" || Boolean(agent.permissions?.canCreateAgents) || (parsed as Record<string, unknown>).canAssignTasks;
      await access.ensureMembership(agent.companyId, "agent", agent.id, "member", "active");
      await access.setPrincipalPermission(agent.companyId, "agent", agent.id, "tasks:assign", effectiveCanAssignTasks as boolean, actor.type === "board" ? (actor.userId ?? null) : null);
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: agent.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.permissions_updated", entityType: "agent", entityId: agent.id, details: { canCreateAgents: agent.permissions?.canCreateAgents ?? false, canAssignTasks: effectiveCanAssignTasks } });
      return buildAgentDetail(agent);
    })

    // === Instructions path ===
    .patch("/agents/:id/instructions-path", async ({ params, body, query, actor }) => {
      const parsed = updateAgentInstructionsPathSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanManageInstructionsPath(actor, existing);
      const existingAdapterConfig = asRecord(existing.adapterConfig) ?? {};
      const explicitKey = asNonEmptyString((parsed as Record<string, unknown>).adapterConfigKey);
      const defaultKey = DEFAULT_INSTRUCTIONS_PATH_KEYS[existing.adapterType] ?? null;
      const adapterConfigKey = explicitKey ?? defaultKey;
      if (!adapterConfigKey) throw unprocessable(`No default instructions path key for adapter type '${existing.adapterType}'. Provide adapterConfigKey.`);
      const nextAdapterConfig: Record<string, unknown> = { ...existingAdapterConfig };
      if ((parsed as Record<string, unknown>).path === null) { delete nextAdapterConfig[adapterConfigKey]; } else { nextAdapterConfig[adapterConfigKey] = resolveInstructionsFilePath((parsed as Record<string, unknown>).path as string, existingAdapterConfig); }
      const syncedAdapterConfig = syncInstructionsBundleConfigFromFilePath(existing, nextAdapterConfig);
      const normalizedAdapterConfig = await secretsSvc.normalizeAdapterConfigForPersistence(existing.companyId, syncedAdapterConfig, { strictMode: strictSecretsMode });
      const actorInfo = getActorInfo(actor);
      const agent = await svc.update(id, { adapterConfig: normalizedAdapterConfig }, { recordRevision: { createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null, source: "instructions_path_patch" } });
      if (!agent) throw notFound("Agent not found");
      const updatedAdapterConfig = asRecord(agent.adapterConfig) ?? {};
      const pathValue = asNonEmptyString(updatedAdapterConfig[adapterConfigKey]);
      await logActivity(db, { companyId: agent.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.instructions_path_updated", entityType: "agent", entityId: agent.id, details: { adapterConfigKey, path: pathValue, cleared: (parsed as Record<string, unknown>).path === null } });
      return { agentId: agent.id, adapterType: agent.adapterType, adapterConfigKey, path: pathValue };
    })

    // === Instructions bundle ===
    .get("/agents/:id/instructions-bundle", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanReadAgent(actor, existing);
      return instructionsSvc.getBundle(existing);
    })
    .patch("/agents/:id/instructions-bundle", async ({ params, body, query, actor }) => {
      const parsed = updateAgentInstructionsBundleSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanManageInstructionsPath(actor, existing);
      const actorInfo = getActorInfo(actor);
      const { bundle, adapterConfig } = await instructionsSvc.updateBundle(existing, parsed);
      const normalizedAdapterConfig = await secretsSvc.normalizeAdapterConfigForPersistence(existing.companyId, adapterConfig, { strictMode: strictSecretsMode });
      await svc.update(id, { adapterConfig: normalizedAdapterConfig }, { recordRevision: { createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null, source: "instructions_bundle_patch" } });
      await logActivity(db, { companyId: existing.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.instructions_bundle_updated", entityType: "agent", entityId: existing.id, details: { mode: bundle.mode, rootPath: bundle.rootPath, entryFile: bundle.entryFile, clearLegacyPromptTemplate: (parsed as Record<string, unknown>).clearLegacyPromptTemplate === true } });
      return bundle;
    })
    .get("/agents/:id/instructions-bundle/file", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanReadAgent(actor, existing);
      const relativePath = typeof (query as Record<string, string>).path === "string" ? (query as Record<string, string>).path : "";
      if (!relativePath.trim()) throw unprocessable("Query parameter 'path' is required");
      return instructionsSvc.readFile(existing, relativePath);
    })
    .put("/agents/:id/instructions-bundle/file", async ({ params, body, query, actor }) => {
      const parsed = upsertAgentInstructionsFileSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanManageInstructionsPath(actor, existing);
      const actorInfo = getActorInfo(actor);
      const result = await instructionsSvc.writeFile(existing, (parsed as Record<string, unknown>).path as string, (parsed as Record<string, unknown>).content as string, { clearLegacyPromptTemplate: (parsed as Record<string, unknown>).clearLegacyPromptTemplate as boolean | undefined });
      const normalizedAdapterConfig = await secretsSvc.normalizeAdapterConfigForPersistence(existing.companyId, result.adapterConfig, { strictMode: strictSecretsMode });
      await svc.update(id, { adapterConfig: normalizedAdapterConfig }, { recordRevision: { createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null, source: "instructions_bundle_file_put" } });
      await logActivity(db, { companyId: existing.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.instructions_file_updated", entityType: "agent", entityId: existing.id, details: { path: result.file.path, size: result.file.size, clearLegacyPromptTemplate: (parsed as Record<string, unknown>).clearLegacyPromptTemplate === true } });
      return result.file;
    })
    .delete("/agents/:id/instructions-bundle/file", async ({ params, query, actor }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanManageInstructionsPath(actor, existing);
      const relativePath = typeof (query as Record<string, string>).path === "string" ? (query as Record<string, string>).path : "";
      if (!relativePath.trim()) throw unprocessable("Query parameter 'path' is required");
      const actorInfo = getActorInfo(actor);
      const result = await instructionsSvc.deleteFile(existing, relativePath);
      await logActivity(db, { companyId: existing.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.instructions_file_deleted", entityType: "agent", entityId: existing.id, details: { path: relativePath } });
      return result.bundle;
    })

    // === Agent update ===
    .patch("/agents/:id", async ({ params, body, query, actor }) => {
      const parsed = updateAgentSchema.parse(body) as Record<string, unknown>;
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const existing = await svc.getById(id);
      if (!existing) throw notFound("Agent not found");
      await assertCanUpdateAgent(actor, existing);
      if (Object.prototype.hasOwnProperty.call(parsed, "permissions")) throw unprocessable("Use /api/agents/:id/permissions for permission changes");
      const patchData = { ...parsed };
      const replaceAdapterConfig = patchData.replaceAdapterConfig === true;
      delete patchData.replaceAdapterConfig;
      if (Object.prototype.hasOwnProperty.call(patchData, "adapterConfig")) {
        const adapterConfig = asRecord(patchData.adapterConfig);
        if (!adapterConfig) throw unprocessable("adapterConfig must be an object");
        if (Object.keys(adapterConfig).some((key) => KNOWN_INSTRUCTIONS_PATH_KEYS.has(key))) await assertCanManageInstructionsPath(actor, existing);
        patchData.adapterConfig = adapterConfig;
      }
      const requestedAdapterType = typeof patchData.adapterType === "string" ? patchData.adapterType : existing.adapterType;
      const touchesAdapterConfiguration = Object.prototype.hasOwnProperty.call(patchData, "adapterType") || Object.prototype.hasOwnProperty.call(patchData, "adapterConfig");
      if (touchesAdapterConfiguration) {
        const existingAdapterConfig = asRecord(existing.adapterConfig) ?? {};
        const changingAdapterType = typeof patchData.adapterType === "string" && patchData.adapterType !== existing.adapterType;
        const requestedAdapterConfig = Object.prototype.hasOwnProperty.call(patchData, "adapterConfig") ? (asRecord(patchData.adapterConfig) ?? {}) : null;
        if (requestedAdapterConfig && replaceAdapterConfig && KNOWN_INSTRUCTIONS_BUNDLE_KEYS.some((key) => existingAdapterConfig[key] !== undefined && requestedAdapterConfig[key] === undefined)) await assertCanManageInstructionsPath(actor, existing);
        let rawEffective = requestedAdapterConfig ?? existingAdapterConfig;
        if (requestedAdapterConfig && !changingAdapterType && !replaceAdapterConfig) rawEffective = { ...existingAdapterConfig, ...requestedAdapterConfig };
        if (changingAdapterType) rawEffective = preserveInstructionsBundleConfig(existingAdapterConfig, rawEffective);
        const effective = applyCreateDefaultsByAdapterType(requestedAdapterType, rawEffective);
        const normalized = await secretsSvc.normalizeAdapterConfigForPersistence(existing.companyId, effective, { strictMode: strictSecretsMode });
        patchData.adapterConfig = syncInstructionsBundleConfigFromFilePath(existing, normalized);
      }
      if (touchesAdapterConfiguration && requestedAdapterType === "opencode_local") await assertAdapterConfigConstraints(existing.companyId, requestedAdapterType, asRecord(patchData.adapterConfig) ?? {}, secretsSvc);
      const actorInfo = getActorInfo(actor);
      const agent = await svc.update(id, patchData, { recordRevision: { createdByAgentId: actorInfo.agentId, createdByUserId: actorInfo.actorType === "user" ? actorInfo.actorId : null, source: "patch" } });
      if (!agent) throw notFound("Agent not found");
      await logActivity(db, { companyId: agent.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "agent.updated", entityType: "agent", entityId: agent.id, details: summarizeAgentUpdateDetails(patchData) });
      return agent;
    })

    // === Lifecycle ===
    .post("/agents/:id/pause", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.pause(id);
      if (!agent) throw notFound("Agent not found");
      await heartbeat.cancelActiveForAgent(id);
      await logActivity(db, { companyId: agent.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "agent.paused", entityType: "agent", entityId: agent.id });
      return agent;
    })
    .post("/agents/:id/resume", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.resume(id);
      if (!agent) throw notFound("Agent not found");
      await logActivity(db, { companyId: agent.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "agent.resumed", entityType: "agent", entityId: agent.id });
      return agent;
    })
    .post("/agents/:id/terminate", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.terminate(id);
      if (!agent) throw notFound("Agent not found");
      await heartbeat.cancelActiveForAgent(id);
      await logActivity(db, { companyId: agent.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "agent.terminated", entityType: "agent", entityId: agent.id });
      return agent;
    })
    .delete("/agents/:id", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.remove(id);
      if (!agent) throw notFound("Agent not found");
      await logActivity(db, { companyId: agent.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "agent.deleted", entityType: "agent", entityId: agent.id });
      return { ok: true };
    })

    // === API keys ===
    .get("/agents/:id/keys", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      return svc.listKeys(id);
    })
    .post("/agents/:id/keys", async ({ params, body, query, actor, set }) => {
      assertBoard(actor);
      const parsed = createAgentKeySchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const key = await svc.createApiKey(id, parsed.name);
      const agent = await svc.getById(id);
      if (agent) await logActivity(db, { companyId: agent.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "agent.key_created", entityType: "agent", entityId: agent.id, details: { keyId: key.id, name: key.name } });
      set.status = 201;
      return key;
    })
    .delete("/agents/:id/keys/:keyId", async ({ params, query, actor }) => {
      assertBoard(actor);
      const revoked = await svc.revokeKey(params.keyId);
      if (!revoked) throw notFound("Key not found");
      return { ok: true };
    })

    // === Wakeup / Heartbeat invoke ===
    .post("/agents/:id/wakeup", async ({ params, body, query, actor, set }) => {
      const parsed = wakeAgentSchema.parse(body);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      if (actor.type === "agent" && actor.agentId !== id) throw forbidden("Agent can only invoke itself");
      const run = await heartbeat.wakeup(id, { source: (parsed as Record<string, unknown>).source as "on_demand" | "timer" | "assignment" | "automation", triggerDetail: (((parsed as Record<string, unknown>).triggerDetail as string) ?? "manual") as "manual" | "system" | "ping" | "callback", reason: ((parsed as Record<string, unknown>).reason as string) ?? null, payload: ((parsed as Record<string, unknown>).payload as Record<string, unknown>) ?? null, idempotencyKey: ((parsed as Record<string, unknown>).idempotencyKey as string) ?? null, requestedByActorType: actor.type === "agent" ? "agent" : "user", requestedByActorId: actor.type === "agent" ? actor.agentId ?? null : actor.userId ?? null, contextSnapshot: { triggeredBy: actor.type, actorId: actor.type === "agent" ? actor.agentId : actor.userId, forceFreshSession: (parsed as Record<string, unknown>).forceFreshSession === true } });
      if (!run) { set.status = 202; return { status: "skipped" }; }
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: agent.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "heartbeat.invoked", entityType: "heartbeat_run", entityId: run.id, details: { agentId: id } });
      set.status = 202;
      return run;
    })
    .post("/agents/:id/heartbeat/invoke", async ({ params, query, actor, set }) => {
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      if (actor.type === "agent" && actor.agentId !== id) throw forbidden("Agent can only invoke itself");
      const run = await heartbeat.invoke(id, "on_demand" as const, { triggeredBy: actor.type, actorId: actor.type === "agent" ? actor.agentId : actor.userId }, "manual" as const, { actorType: actor.type === "agent" ? "agent" : "user", actorId: actor.type === "agent" ? actor.agentId ?? null : actor.userId ?? null });
      if (!run) { set.status = 202; return { status: "skipped" }; }
      const actorInfo = getActorInfo(actor);
      await logActivity(db, { companyId: agent.companyId, actorType: actorInfo.actorType, actorId: actorInfo.actorId, agentId: actorInfo.agentId, runId: actorInfo.runId, action: "heartbeat.invoked", entityType: "heartbeat_run", entityId: run.id, details: { agentId: id } });
      set.status = 202;
      return run;
    })

    // === Claude login ===
    .post("/agents/:id/claude-login", async ({ params, query, actor }) => {
      assertBoard(actor);
      const id = await normalizeAgentReference(actor, params.id, query as Record<string, string>);
      const agent = await svc.getById(id);
      if (!agent) throw notFound("Agent not found");
      assertCompanyAccess(actor, agent.companyId);
      if (agent.adapterType !== "claude_local") throw unprocessable("Login is only supported for claude_local agents");
      const config = asRecord(agent.adapterConfig) ?? {};
      const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(agent.companyId, config);
      return runClaudeLogin({ runId: `claude-login-${randomUUID()}`, agent: { id: agent.id, companyId: agent.companyId, name: agent.name, adapterType: agent.adapterType, adapterConfig: agent.adapterConfig }, config: runtimeConfig });
    })

    // === Heartbeat runs ===
    .get("/companies/:companyId/heartbeat-runs", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const q = query as Record<string, string>;
      const limit = q.limit ? Math.max(1, Math.min(1000, parseInt(q.limit, 10) || 200)) : undefined;
      return heartbeat.list(params.companyId, q.agentId, limit);
    })
    .get("/companies/:companyId/live-runs", async ({ params, query, actor }) => {
      assertCompanyAccess(actor, params.companyId);
      const minCount = (query as Record<string, string>).minCount ? Math.max(0, Math.min(20, parseInt((query as Record<string, string>).minCount, 10) || 0)) : 0;
      const columns = { id: heartbeatRuns.id, status: heartbeatRuns.status, invocationSource: heartbeatRuns.invocationSource, triggerDetail: heartbeatRuns.triggerDetail, startedAt: heartbeatRuns.startedAt, finishedAt: heartbeatRuns.finishedAt, createdAt: heartbeatRuns.createdAt, agentId: heartbeatRuns.agentId, agentName: agentsTable.name, adapterType: agentsTable.adapterType, issueId: sql<string | null>`${heartbeatRuns.contextSnapshot} ->> 'issueId'`.as("issueId") };
      const liveRuns = await db.select(columns).from(heartbeatRuns).innerJoin(agentsTable, eq(heartbeatRuns.agentId, agentsTable.id)).where(and(eq(heartbeatRuns.companyId, params.companyId), inArray(heartbeatRuns.status, ["queued", "running"]))).orderBy(desc(heartbeatRuns.createdAt));
      if (minCount > 0 && liveRuns.length < minCount) {
        const activeIds = liveRuns.map((r) => r.id);
        const recentRuns = await db.select(columns).from(heartbeatRuns).innerJoin(agentsTable, eq(heartbeatRuns.agentId, agentsTable.id)).where(and(eq(heartbeatRuns.companyId, params.companyId), not(inArray(heartbeatRuns.status, ["queued", "running"])), ...(activeIds.length > 0 ? [not(inArray(heartbeatRuns.id, activeIds))] : []))).orderBy(desc(heartbeatRuns.createdAt)).limit(minCount - liveRuns.length);
        return [...liveRuns, ...recentRuns];
      }
      return liveRuns;
    })
    .get("/heartbeat-runs/:runId", async ({ params, actor }) => {
      const run = await heartbeat.getRun(params.runId);
      if (!run) throw notFound("Heartbeat run not found");
      assertCompanyAccess(actor, run.companyId);
      return redactCurrentUserValue(run, await getCurrentUserRedactionOptions());
    })
    .post("/heartbeat-runs/:runId/cancel", async ({ params, actor }) => {
      assertBoard(actor);
      const run = await heartbeat.cancelRun(params.runId);
      if (run) await logActivity(db, { companyId: run.companyId, actorType: "user", actorId: actor.userId ?? "board", action: "heartbeat.cancelled", entityType: "heartbeat_run", entityId: run.id, details: { agentId: run.agentId } });
      return run;
    })
    .get("/heartbeat-runs/:runId/events", async ({ params, query, actor }) => {
      const run = await heartbeat.getRun(params.runId);
      if (!run) throw notFound("Heartbeat run not found");
      assertCompanyAccess(actor, run.companyId);
      const q = query as Record<string, string>;
      const afterSeq = Number(q.afterSeq ?? 0);
      const limit = Number(q.limit ?? 200);
      const events = await heartbeat.listEvents(params.runId, Number.isFinite(afterSeq) ? afterSeq : 0, Number.isFinite(limit) ? limit : 200);
      const opts = await getCurrentUserRedactionOptions();
      return events.map((e) => redactCurrentUserValue({ ...e, payload: redactEventPayload(e.payload) }, opts));
    })
    .get("/heartbeat-runs/:runId/log", async ({ params, query, actor }) => {
      const run = await heartbeat.getRun(params.runId);
      if (!run) throw notFound("Heartbeat run not found");
      assertCompanyAccess(actor, run.companyId);
      const q = query as Record<string, string>;
      const offset = Number(q.offset ?? 0);
      const limitBytes = Number(q.limitBytes ?? 256000);
      return heartbeat.readLog(params.runId, { offset: Number.isFinite(offset) ? offset : 0, limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000 });
    })
    .get("/heartbeat-runs/:runId/workspace-operations", async ({ params, actor }) => {
      const run = await heartbeat.getRun(params.runId);
      if (!run) throw notFound("Heartbeat run not found");
      assertCompanyAccess(actor, run.companyId);
      const context = asRecord(run.contextSnapshot);
      const executionWorkspaceId = asNonEmptyString(context?.executionWorkspaceId);
      const operations = await workspaceOperations.listForRun(params.runId, executionWorkspaceId);
      return redactCurrentUserValue(operations, await getCurrentUserRedactionOptions());
    })
    .get("/workspace-operations/:operationId/log", async ({ params, query, actor }) => {
      const operation = await workspaceOperations.getById(params.operationId);
      if (!operation) throw notFound("Workspace operation not found");
      assertCompanyAccess(actor, operation.companyId);
      const q = query as Record<string, string>;
      const offset = Number(q.offset ?? 0);
      const limitBytes = Number(q.limitBytes ?? 256000);
      return workspaceOperations.readLog(params.operationId, { offset: Number.isFinite(offset) ? offset : 0, limitBytes: Number.isFinite(limitBytes) ? limitBytes : 256000 });
    })

    // === Issue live runs ===
    .get("/issues/:issueId/live-runs", async ({ params, actor }) => {
      const rawId = params.issueId;
      const issueSvc = issueService(db);
      const issue = /^[A-Z]+-\d+$/i.test(rawId) ? await issueSvc.getByIdentifier(rawId) : await issueSvc.getById(rawId);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      return db.select({ id: heartbeatRuns.id, status: heartbeatRuns.status, invocationSource: heartbeatRuns.invocationSource, triggerDetail: heartbeatRuns.triggerDetail, startedAt: heartbeatRuns.startedAt, finishedAt: heartbeatRuns.finishedAt, createdAt: heartbeatRuns.createdAt, agentId: heartbeatRuns.agentId, agentName: agentsTable.name, adapterType: agentsTable.adapterType }).from(heartbeatRuns).innerJoin(agentsTable, eq(heartbeatRuns.agentId, agentsTable.id)).where(and(eq(heartbeatRuns.companyId, issue.companyId), inArray(heartbeatRuns.status, ["queued", "running"]), sql`${heartbeatRuns.contextSnapshot} ->> 'issueId' = ${issue.id}`)).orderBy(desc(heartbeatRuns.createdAt));
    })
    .get("/issues/:issueId/active-run", async ({ params, actor }) => {
      const rawId = params.issueId;
      const issueSvc = issueService(db);
      const issue = /^[A-Z]+-\d+$/i.test(rawId) ? await issueSvc.getByIdentifier(rawId) : await issueSvc.getById(rawId);
      if (!issue) throw notFound("Issue not found");
      assertCompanyAccess(actor, issue.companyId);
      let run = issue.executionRunId ? await heartbeat.getRun(issue.executionRunId) : null;
      if (run && run.status !== "queued" && run.status !== "running") run = null;
      if (!run && issue.assigneeAgentId && issue.status === "in_progress") {
        const candidateRun = await heartbeat.getActiveRunForAgent(issue.assigneeAgentId);
        const candidateContext = asRecord(candidateRun?.contextSnapshot);
        const candidateIssueId = asNonEmptyString(candidateContext?.issueId);
        if (candidateRun && candidateIssueId === issue.id) run = candidateRun;
      }
      if (!run) return null;
      const agent = await svc.getById(run.agentId);
      if (!agent) return null;
      return { ...redactCurrentUserValue(run, await getCurrentUserRedactionOptions()), agentId: agent.id, agentName: agent.name, adapterType: agent.adapterType };
    });
}
