import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INBOX_MINE_ISSUE_STATUS_FILTER } from "@clawdev/shared";
import { HttpError } from "../errors.js";
import { agentRoutes } from "../routes/agents.js";

const agentId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";

const baseAgent = {
  id: agentId,
  companyId,
  name: "Builder",
  urlKey: "builder",
  role: "engineer",
  title: "Builder",
  icon: null,
  status: "idle",
  reportsTo: null,
  capabilities: null,
  adapterType: "process",
  adapterConfig: {},
  runtimeConfig: {},
  budgetMonthlyCents: 0,
  spentMonthlyCents: 0,
  pauseReason: null,
  pausedAt: null,
  permissions: { canCreateAgents: false },
  lastHeartbeatAt: null,
  metadata: null,
  createdAt: new Date("2026-03-19T00:00:00.000Z"),
  updatedAt: new Date("2026-03-19T00:00:00.000Z"),
};

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updatePermissions: vi.fn(),
  getChainOfCommand: vi.fn(),
  resolveByReference: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  canUser: vi.fn(),
  hasPermission: vi.fn(),
  getMembership: vi.fn(),
  ensureMembership: vi.fn(),
  listPrincipalGrants: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockApprovalService = vi.hoisted(() => ({
  create: vi.fn(),
  getById: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({
  upsertPolicy: vi.fn(),
}));

const mockHeartbeatService = vi.hoisted(() => ({
  listTaskSessions: vi.fn(),
  resetRuntimeSession: vi.fn(),
  wakeup: vi.fn(),
}));

const mockIssueApprovalService = vi.hoisted(() => ({
  linkManyForApproval: vi.fn(),
}));

const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(),
  resolveAdapterConfigForRuntime: vi.fn(),
}));

const mockAgentInstructionsService = vi.hoisted(() => ({
  materializeManagedBundle: vi.fn(),
}));
const mockListAdapterModels = vi.hoisted(() => vi.fn(async () => [
  { id: "gpt-5", label: "GPT-5" },
]));
const mockFindServerAdapter = vi.hoisted(() => vi.fn(() => ({
  testEnvironment: vi.fn(async () => ({ ok: true })),
})));
const mockCompanySkillService = vi.hoisted(() => ({
  listRuntimeSkillEntries: vi.fn(),
  resolveRequestedSkillKeys: vi.fn(),
}));
const mockWorkspaceOperationService = vi.hoisted(() => ({}));
const mockChannelService = vi.hoisted(() => ({
  getOrCreateGeneral: vi.fn(),
  join: vi.fn(),
}));
const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  agentService: () => mockAgentService,
  agentInstructionsService: () => mockAgentInstructionsService,
  accessService: () => mockAccessService,
  approvalService: () => mockApprovalService,
  companySkillService: () => mockCompanySkillService,
  budgetService: () => mockBudgetService,
  heartbeatService: () => mockHeartbeatService,
  issueApprovalService: () => mockIssueApprovalService,
  issueService: () => mockIssueService,
  logActivity: mockLogActivity,
  secretService: () => mockSecretService,
  normalizeRuntimeConfigForAdapterType: vi.fn((_adapterType, runtimeConfig) => runtimeConfig),
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
  workspaceOperationService: () => mockWorkspaceOperationService,
  channelService: () => mockChannelService,
  instanceSettingsService: () => ({ getGeneral: vi.fn(async () => ({ censorUsernameInLogs: false })) }),
}));

vi.mock("../services/channels.js", () => ({
  channelService: () => mockChannelService,
}));

vi.mock("../redaction.js", () => ({
  redactEventPayload: vi.fn((v: unknown) => v),
}));

vi.mock("../log-redaction.js", () => ({
  redactCurrentUserValue: vi.fn((v: unknown) => v),
}));

vi.mock("../routes/org-chart-svg.js", () => ({
  renderOrgChartSvg: vi.fn(() => "<svg/>"),
  renderOrgChartPng: vi.fn(async () => Buffer.from("")),
  ORG_CHART_STYLES: ["warmth"],
}));

vi.mock("../adapters/index.js", () => ({
  listAdapterModels: mockListAdapterModels,
  findServerAdapter: mockFindServerAdapter,
  listServerAdapters: vi.fn(() => []),
}));

vi.mock("@clawdev/adapter-claude-local/server", () => ({
  execute: vi.fn(),
  runClaudeLogin: vi.fn(async () => ({ success: true })),
  listClaudeSkills: vi.fn(async () => []),
  syncClaudeSkills: vi.fn(async () => []),
  testEnvironment: vi.fn(async () => ({ ok: true })),
  sessionCodec: { parse: vi.fn(), serialize: vi.fn() },
  getQuotaWindows: vi.fn(async () => []),
}));

function createDbStub() {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: vi.fn().mockResolvedValue([{
            id: companyId,
            name: "ClawDev",
            requireBoardApprovalForNewAgents: false,
          }]),
        }),
      }),
    }),
  };
}

function createApp(actor: Record<string, unknown>) {
  return new Elysia({ prefix: "/api" })
    .onError(({ error, set }) => {
      if (error instanceof HttpError) {
        set.status = error.status;
        return error.details ? { error: error.message, details: error.details } : { error: error.message };
      }
      set.status = 500;
      return { error: "Internal server error" };
    })
    .derive(() => ({ actor }))
    .use(agentRoutes(createDbStub() as any));
}

async function req(app: any, method: string, path: string, body?: any, headers?: Record<string, string>) {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) { init.body = JSON.stringify(body); (init.headers as any)["content-type"] = "application/json"; }
  const res = await app.handle(new Request("http://localhost" + path, init));
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, text };
}

describe("agent permission routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue(baseAgent);
    mockAgentService.list.mockResolvedValue([baseAgent]);
    mockAgentService.getChainOfCommand.mockResolvedValue([]);
    mockAgentService.resolveByReference.mockResolvedValue({ ambiguous: false, agent: baseAgent });
    mockAgentService.create.mockResolvedValue(baseAgent);
    mockAgentService.update.mockResolvedValue(baseAgent);
    mockAgentService.updatePermissions.mockResolvedValue(baseAgent);
    mockAccessService.getMembership.mockResolvedValue({
      id: "membership-1",
      companyId,
      principalType: "agent",
      principalId: agentId,
      status: "active",
      membershipRole: "member",
      createdAt: new Date("2026-03-19T00:00:00.000Z"),
      updatedAt: new Date("2026-03-19T00:00:00.000Z"),
    });
    mockAccessService.listPrincipalGrants.mockResolvedValue([]);
    mockAccessService.ensureMembership.mockResolvedValue(undefined);
    mockAccessService.setPrincipalPermission.mockResolvedValue(undefined);
    mockCompanySkillService.listRuntimeSkillEntries.mockResolvedValue([]);
    mockCompanySkillService.resolveRequestedSkillKeys.mockImplementation(async (_companyId, requested) => requested);
    mockBudgetService.upsertPolicy.mockResolvedValue(undefined);
    mockAgentInstructionsService.materializeManagedBundle.mockImplementation(
      async (agent: Record<string, unknown>, files: Record<string, string>) => ({
        bundle: null,
        adapterConfig: {
          ...((agent.adapterConfig as Record<string, unknown> | undefined) ?? {}),
          instructionsBundleMode: "managed",
          instructionsRootPath: `/tmp/${String(agent.id)}/instructions`,
          instructionsEntryFile: "AGENTS.md",
          instructionsFilePath: `/tmp/${String(agent.id)}/instructions/AGENTS.md`,
          promptTemplate: files["AGENTS.md"] ?? "",
        },
      }),
    );
    mockCompanySkillService.listRuntimeSkillEntries.mockResolvedValue([]);
    mockCompanySkillService.resolveRequestedSkillKeys.mockImplementation(
      async (_companyId: string, requested: string[]) => requested,
    );
    mockSecretService.normalizeAdapterConfigForPersistence.mockImplementation(async (_companyId, config) => config);
    mockSecretService.resolveAdapterConfigForRuntime.mockImplementation(async (_companyId, config) => ({ config }));
    mockChannelService.getOrCreateGeneral.mockResolvedValue({ id: "general-channel", companyId, type: "general" });
    mockChannelService.join.mockResolvedValue(undefined);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("grants tasks:assign by default when board creates a new agent", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app,
      "POST", `/api/companies/${companyId}/agents`,
      {
        name: "Builder",
        role: "engineer",
        adapterType: "process",
        adapterConfig: {},
      });

    expect(res.status).toBe(201);
    expect(mockAccessService.ensureMembership).toHaveBeenCalledWith(
      companyId,
      "agent",
      agentId,
      "member",
      "active",
    );
    expect(mockAccessService.setPrincipalPermission).toHaveBeenCalledWith(
      companyId,
      "agent",
      agentId,
      "tasks:assign",
      true,
      "board-user",
    );
  });

  it("exposes explicit task assignment access on agent detail", async () => {
    mockAccessService.listPrincipalGrants.mockResolvedValue([
      {
        id: "grant-1",
        companyId,
        principalType: "agent",
        principalId: agentId,
        permissionKey: "tasks:assign",
        scope: null,
        grantedByUserId: "board-user",
        createdAt: new Date("2026-03-19T00:00:00.000Z"),
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
      },
    ]);

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app, "GET", `/api/agents/${agentId}`);

    expect(res.status).toBe(200);
    expect(res.body.access.canAssignTasks).toBe(true);
    expect(res.body.access.taskAssignSource).toBe("explicit_grant");
  });

  it("keeps task assignment enabled when agent creation privilege is enabled", async () => {
    mockAgentService.updatePermissions.mockResolvedValue({
      ...baseAgent,
      permissions: { canCreateAgents: true },
    });

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app,
      "PATCH", `/api/agents/${agentId}/permissions`,
      { canCreateAgents: true, canAssignTasks: false });

    expect(res.status).toBe(200);
    expect(mockAccessService.setPrincipalPermission).toHaveBeenCalledWith(
      companyId,
      "agent",
      agentId,
      "tasks:assign",
      true,
      "board-user",
    );
    expect(res.body.access.canAssignTasks).toBe(true);
    expect(res.body.access.taskAssignSource).toBe("agent_creator");
  });

  it("converts postgres uuid errors into a client error when listing agents", async () => {
    mockAgentService.list.mockRejectedValueOnce({ code: "22P02" });

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app, "GET", "/api/companies/default/agents");

    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Company id must be a UUID" });
  });

  it("allows changing an agent provider through the edit route", async () => {
    mockAgentService.update.mockResolvedValue({
      ...baseAgent,
      adapterType: "codex_local",
      runtimeConfig: { model: "gpt-5.3-codex" },
    });

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app, "PATCH", `/api/agents/${agentId}`, {
      adapterType: "codex_local",
      runtimeConfig: { model: "gpt-5.3-codex" },
    });

    expect(res.status).toBe(200);
    expect(mockAgentService.update).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({
        adapterType: "codex_local",
        runtimeConfig: { model: "gpt-5.3-codex" },
      }),
      expect.objectContaining({
        recordRevision: expect.objectContaining({
          source: "api",
        }),
      }),
    );
    expect(res.body.adapterType).toBe("codex_local");
  });

  it("toggles instance heartbeat scheduling without dropping runtime config fields", async () => {
    mockAgentService.getById.mockResolvedValueOnce({
      ...baseAgent,
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 300,
        },
        keepMe: "yes",
      },
    });
    mockAgentService.update.mockResolvedValueOnce({
      ...baseAgent,
      runtimeConfig: {
        heartbeat: {
          enabled: false,
          intervalSec: 300,
        },
        keepMe: "yes",
      },
    });

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app, "PATCH", `/api/agents/${agentId}/heartbeat-settings`, {
      enabled: false,
    });

    expect(res.status).toBe(200);
    expect(mockAgentService.update).toHaveBeenCalledWith(
      agentId,
      {
        runtimeConfig: {
          heartbeat: {
            enabled: false,
            intervalSec: 300,
          },
          keepMe: "yes",
        },
      },
      expect.objectContaining({
        recordRevision: expect.objectContaining({
          source: "instance_scheduler_heartbeat_toggle",
          createdByUserId: "board-user",
        }),
      }),
    );
    expect(mockLogActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        companyId,
        actorType: "user",
        actorId: "board-user",
        action: "heartbeat.disabled",
        entityType: "agent",
        entityId: agentId,
      }),
    );
  });

  it("exposes the agent inbox mine route", async () => {
    mockIssueService.list.mockResolvedValue([
      {
        id: "issue-1",
        identifier: "PAP-910",
        title: "Inbox follow-up",
        status: "todo",
      },
    ]);

    const app = createApp({
      type: "agent",
      agentId,
      companyId,
      runId: "run-1",
      source: "agent_key",
    });

    const res = await req(app, "GET", "/api/agents/me/inbox/mine?userId=board-user");

    expect(res.status).toBe(200);
    expect(mockIssueService.list).toHaveBeenCalledWith(companyId, {
      touchedByUserId: "board-user",
      inboxArchivedByUserId: "board-user",
      status: INBOX_MINE_ISSUE_STATUS_FILTER,
    });
    expect(res.body).toEqual([
      {
        id: "issue-1",
        identifier: "PAP-910",
        title: "Inbox follow-up",
        status: "todo",
      },
    ]);
  });

  it("exposes the agent inbox-lite route", async () => {
    mockIssueService.list.mockResolvedValue([
      {
        id: "issue-1",
        identifier: "PAP-911",
        title: "Inbox lite follow-up",
        status: "todo",
        priority: "high",
        projectId: null,
        goalId: null,
        parentId: null,
        updatedAt: new Date("2026-03-19T00:00:00.000Z"),
        activeRun: null,
      },
    ]);

    const app = createApp({
      type: "agent",
      agentId,
      companyId,
      runId: "run-1",
      source: "agent_key",
    });

    const res = await req(app, "GET", "/api/agents/me/inbox-lite");

    expect(res.status).toBe(200);
    expect(mockIssueService.list).toHaveBeenCalledWith(companyId, {
      assigneeAgentId: agentId,
      status: "todo,in_progress,blocked",
    });
    expect(res.body).toEqual([
      {
        id: "issue-1",
        identifier: "PAP-911",
        title: "Inbox lite follow-up",
        status: "todo",
        priority: "high",
        projectId: null,
        goalId: null,
        parentId: null,
        updatedAt: new Date("2026-03-19T00:00:00.000Z").toISOString(),
        activeRun: null,
      },
    ]);
  });

  it("lists adapter models and tests adapter environments for onboarding", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      companyIds: [companyId],
      source: "local_implicit",
      isInstanceAdmin: true,
    });

    const modelsRes = await req(app, "GET", `/api/companies/${companyId}/adapters/codex_local/models`);
    expect(modelsRes.status).toBe(200);
    expect(mockListAdapterModels).toHaveBeenCalledWith("codex_local");
    expect(modelsRes.body).toEqual([{ id: "gpt-5", label: "GPT-5" }]);

    const envRes = await req(app, "POST", `/api/companies/${companyId}/adapters/codex_local/test-environment`, {
      adapterConfig: { apiKey: "secret" },
    });
    expect(envRes.status).toBe(200);
    expect(mockFindServerAdapter).toHaveBeenCalledWith("codex_local");
    expect(envRes.body).toEqual({ ok: true });
  });

  it("wakes up an agent without requiring companyId in the body", async () => {
    mockHeartbeatService.wakeup.mockResolvedValue({
      id: "run-1",
      companyId,
      agentId,
      status: "queued",
    });

    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      isInstanceAdmin: true,
      companyIds: [companyId],
    });

    const res = await req(app, "POST", `/api/agents/${agentId}/wakeup`, {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "manual",
      payload: { source: "dashboard" },
      forceFreshSession: true,
    });

    expect(res.status).toBe(202);
    expect(mockHeartbeatService.wakeup).toHaveBeenCalledWith(agentId, {
      source: "on_demand",
      triggerDetail: "manual",
      reason: "manual",
      payload: { source: "dashboard" },
      idempotencyKey: null,
      requestedByActorType: "user",
      requestedByActorId: "board-user",
      contextSnapshot: {
        triggeredBy: "board",
        actorId: "board-user",
        forceFreshSession: true,
      },
    });
    expect(res.body).toEqual({
      id: "run-1",
      companyId,
      agentId,
      status: "queued",
    });
  });
});
