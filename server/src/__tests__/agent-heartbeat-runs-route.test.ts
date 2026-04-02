import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

const heartbeatRows = [
  {
    id: "run-1",
    agentId,
    status: "running",
    invocationSource: "manual",
    triggerDetail: "Manual run",
    startedAt: new Date("2026-03-19T00:00:00.000Z"),
    finishedAt: null,
    error: null,
    exitCode: null,
    errorCode: null,
    stdoutExcerpt: "hello",
    createdAt: new Date("2026-03-19T00:00:00.000Z"),
  },
];

const mockAgentService = vi.hoisted(() => ({
  getById: vi.fn(),
  resolveByReference: vi.fn(),
  listConfigRevisions: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
  setPrincipalPermission: vi.fn(),
  listPrincipalGrants: vi.fn(),
}));

const mockBudgetService = vi.hoisted(() => ({ upsertPolicy: vi.fn() }));
const mockHeartbeatService = vi.hoisted(() => ({
  listTaskSessions: vi.fn(),
  resetRuntimeSession: vi.fn(),
  getRun: vi.fn(),
  readLog: vi.fn(),
  getActiveRunForAgent: vi.fn(),
}));
const mockIssueApprovalService = vi.hoisted(() => ({ linkManyForApproval: vi.fn() }));
const mockIssueService = vi.hoisted(() => ({
  list: vi.fn(),
  getById: vi.fn(),
  getByIdentifier: vi.fn(),
}));
const mockApprovalService = vi.hoisted(() => ({ create: vi.fn(), getById: vi.fn() }));
const mockSecretService = vi.hoisted(() => ({
  normalizeAdapterConfigForPersistence: vi.fn(async (_companyId: string, config: Record<string, unknown>) => config),
  resolveAdapterConfigForRuntime: vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({ config })),
}));
const mockAgentInstructionsService = vi.hoisted(() => ({ materializeManagedBundle: vi.fn() }));
const mockCompanySkillService = vi.hoisted(() => ({
  listRuntimeSkillEntries: vi.fn(async () => []),
  resolveRequestedSkillKeys: vi.fn(async (_companyId: string, requested: string[]) => requested),
}));
const mockWorkspaceOperationService = vi.hoisted(() => ({}));
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
  syncInstructionsBundleConfigFromFilePath: vi.fn((_agent, config) => config),
  workspaceOperationService: () => mockWorkspaceOperationService,
  instanceSettingsService: () => ({ getGeneral: vi.fn(async () => ({ censorUsernameInLogs: false })) }),
}));

vi.mock("../redaction.js", () => ({ redactEventPayload: vi.fn((v: unknown) => v) }));
vi.mock("../log-redaction.js", () => ({ redactCurrentUserValue: vi.fn((v: unknown) => v) }));
vi.mock("../routes/org-chart-svg.js", () => ({
  renderOrgChartSvg: vi.fn(() => "<svg/>"),
  renderOrgChartPng: vi.fn(async () => Buffer.from("")),
  ORG_CHART_STYLES: ["warmth"],
}));
vi.mock("@clawdev/adapter-claude-local/server", () => ({
  execute: vi.fn(),
  runClaudeLogin: vi.fn(async () => ({ success: true })),
  testEnvironment: vi.fn(async () => ({ ok: true })),
  listClaudeSkills: vi.fn(async () => []),
  syncClaudeSkills: vi.fn(async () => []),
  getQuotaWindows: vi.fn(async () => []),
  sessionCodec: { parse: vi.fn(), serialize: vi.fn() },
}));

function createDbStub() {
  const terminal: any = {
    orderBy: vi.fn(() => terminal),
    limit: vi.fn(async () => heartbeatRows),
    then: vi.fn((resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve(heartbeatRows))),
  };

  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(terminal),
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

async function req(app: any, method: string, path: string) {
  const res = await app.handle(new Request("http://localhost" + path, { method }));
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

describe("agent heartbeat runs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgentService.getById.mockResolvedValue(baseAgent);
    mockAgentService.resolveByReference.mockResolvedValue({ ambiguous: false, agent: baseAgent });
    mockAgentService.listConfigRevisions.mockResolvedValue([]);
    mockIssueService.list.mockResolvedValue([]);
    mockIssueService.getById.mockResolvedValue({
      id: "issue-1",
      identifier: "PAP-910",
      companyId,
      executionRunId: null,
      assigneeAgentId: agentId,
      status: "in_progress",
    });
    mockIssueService.getByIdentifier.mockResolvedValue({
      id: "issue-1",
      identifier: "PAP-910",
      companyId,
      executionRunId: null,
      assigneeAgentId: agentId,
      status: "in_progress",
    });
    mockHeartbeatService.getRun.mockResolvedValue({
      id: "run-1",
      companyId,
      agentId,
      status: "running",
      logStore: "local_file",
      logRef: "run-1.ndjson",
    });
    mockHeartbeatService.getActiveRunForAgent.mockResolvedValue({
      id: "run-1",
      companyId,
      agentId,
      status: "running",
      invocationSource: "manual",
      triggerDetail: "Manual run",
      startedAt: new Date("2026-03-19T00:00:00.000Z"),
      finishedAt: null,
      error: null,
      exitCode: null,
      errorCode: null,
      stdoutExcerpt: "hello",
      createdAt: new Date("2026-03-19T00:00:00.000Z"),
      logStore: "local_file",
      logRef: "run-1.ndjson",
      contextSnapshot: { issueId: "issue-1" },
    });
    mockHeartbeatService.readLog.mockResolvedValue({
      runId: "run-1",
      store: "local_file",
      logRef: "run-1.ndjson",
      content: JSON.stringify({
        ts: "2026-03-19T00:00:01.000Z",
        stream: "stdout",
        chunk: JSON.stringify({
          type: "assistant",
          message: {
            content: [{ type: "text", text: "hello world" }],
          },
        }) + "\n",
      }) + "\n",
      nextOffset: undefined,
    });
  });

  it("resolves shortname agents when companyId is provided", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      companyIds: [companyId],
      isInstanceAdmin: true,
    });

    const res = await req(app, "GET", `/api/agents/ceo/heartbeat-runs?companyId=${companyId}&limit=20`);

    expect(res.status).toBe(200);
    expect(mockAgentService.resolveByReference).toHaveBeenCalledWith(companyId, "ceo");
    expect(res.body.runs).toHaveLength(1);
    expect(res.body.runs[0].id).toBe("run-1");
  });

  it("returns transcript messages for heartbeat runs", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      companyIds: [companyId],
      isInstanceAdmin: true,
    });

    const res = await req(app, "GET", "/api/heartbeat-runs/run-1/transcript");

    expect(res.status).toBe(200);
    expect(mockHeartbeatService.getRun).toHaveBeenCalledWith("run-1");
    expect(res.body.runId).toBe("run-1");
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages[0]).toMatchObject({ role: "assistant", text: "hello world" });
  });

  it("returns the active run for an issue", async () => {
    const app = createApp({
      type: "board",
      userId: "board-user",
      source: "local_implicit",
      companyIds: [companyId],
      isInstanceAdmin: true,
    });

    const res = await req(app, "GET", "/api/issues/PAP-910/active-run");

    expect(res.status).toBe(200);
    expect(mockHeartbeatService.getActiveRunForAgent).toHaveBeenCalledWith(agentId);
    expect(res.body).toMatchObject({
      id: "run-1",
      companyId,
      agentId,
      agentName: "Builder",
      adapterType: "process",
    });
  });
});
