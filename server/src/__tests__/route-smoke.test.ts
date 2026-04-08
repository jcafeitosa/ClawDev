import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDashboardSummary = vi.hoisted(() => vi.fn());
const mockSidebarBadgeGet = vi.hoisted(() => vi.fn());
const mockCompanyList = vi.hoisted(() => vi.fn());
const mockCompanyGetById = vi.hoisted(() => vi.fn());
const mockAgentsList = vi.hoisted(() => vi.fn());
const mockActivityList = vi.hoisted(() => vi.fn());
const mockCostSummary = vi.hoisted(() => vi.fn());
const mockInstanceGeneralGet = vi.hoisted(() => vi.fn());
const mockInstanceExperimentalGet = vi.hoisted(() => vi.fn());
const mockGoalList = vi.hoisted(() => vi.fn());
const mockProjectList = vi.hoisted(() => vi.fn());
const mockBudgetOverview = vi.hoisted(() => vi.fn());
const mockBudgetListPolicies = vi.hoisted(() => vi.fn());
const mockSearchSemantic = vi.hoisted(() => vi.fn());
const mockSearchSimilarIssues = vi.hoisted(() => vi.fn());
const mockListServerAdapters = vi.hoisted(() =>
  vi.fn(() => [{ type: "codex_local", agentConfigurationDoc: "# Codex Local\n" }]),
);
const mockAgentGetById = vi.hoisted(() => vi.fn());
const mockSecretListProviders = vi.hoisted(() => vi.fn());
const mockSecretList = vi.hoisted(() => vi.fn());
const mockSecretCreate = vi.hoisted(() => vi.fn());
const mockSecretGetById = vi.hoisted(() => vi.fn());
const mockSecretRotate = vi.hoisted(() => vi.fn());
const mockSecretUpdate = vi.hoisted(() => vi.fn());
const mockSecretRemove = vi.hoisted(() => vi.fn());
const mockLogActivity = vi.hoisted(() => vi.fn());
const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("../services/index.js", () => ({
  dashboardService: () => ({ summary: mockDashboardSummary }),
  agentInstructionsService: () => ({
    materializeManagedBundle: vi.fn().mockResolvedValue({
      adapterConfig: {},
    }),
  }),
  budgetService: () => ({ overview: mockBudgetOverview, listPolicies: mockBudgetListPolicies }),
  companyService: () => ({
    list: mockCompanyList,
    stats: vi.fn(),
    getById: mockCompanyGetById,
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    remove: vi.fn(),
  }),
  agentService: () => ({ list: mockAgentsList, getById: mockAgentGetById }),
  activityService: () => ({ list: mockActivityList }),
  costService: () => ({ summary: mockCostSummary }),
  financeService: () => ({
    createEvent: vi.fn(),
    summary: vi.fn(),
  }),
  costAggregateService: () => ({
    dailyTrend: vi.fn(),
  }),
  approvalService: () => ({
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }),
  issueApprovalService: () => ({
    listForIssue: vi.fn(),
    create: vi.fn(),
    getById: vi.fn(),
  }),
  issueService: () => ({
    getById: vi.fn(),
    getByIdentifier: vi.fn(),
    getAncestors: vi.fn().mockResolvedValue([]),
    findMentionedProjectIds: vi.fn().mockResolvedValue([]),
  }),
  goalService: () => ({
    list: mockGoalList,
    getById: vi.fn(),
  }),
  projectService: () => ({
    list: mockProjectList,
    getById: vi.fn(),
  }),
  companySkillService: () => ({
    list: vi.fn(),
  }),
  secretService: () => ({
    listProviders: mockSecretListProviders,
    list: mockSecretList,
    create: mockSecretCreate,
    getById: mockSecretGetById,
    rotate: mockSecretRotate,
    update: mockSecretUpdate,
    remove: mockSecretRemove,
  }),
  workspaceOperationService: () => ({
    listForExecutionWorkspace: vi.fn().mockResolvedValue([]),
  }),
  instanceSettingsService: () => ({
    getGeneral: mockInstanceGeneralGet,
    getExperimental: mockInstanceExperimentalGet,
    updateGeneral: vi.fn(),
    updateExperimental: vi.fn(),
    listCompanyIds: vi.fn().mockResolvedValue([COMPANY_ID]),
  }),
  accessService: () => ({
    canUser: vi.fn(),
    hasPermission: vi.fn(),
    listPrincipalGrants: vi.fn().mockResolvedValue([{ permissionKey: "tasks:assign" }]),
    ensureMembership: vi.fn(),
  }),
  companyPortabilityService: () => ({
    exportBundle: vi.fn(),
    previewExport: vi.fn(),
    previewImport: vi.fn(),
    importBundle: vi.fn(),
  }),
  heartbeatService: () => ({
    cancelBudgetScopeWork: vi.fn(),
    ensureWorkspace: vi.fn(),
  }),
}));

vi.mock("../services/sidebar-badges.js", () => ({
  sidebarBadgeService: () => ({ get: mockSidebarBadgeGet }),
}));

vi.mock("../services/dashboard.js", () => ({
  dashboardService: () => ({ summary: mockDashboardSummary }),
}));

vi.mock("../services/budgets.js", () => ({
  budgetService: () => ({ overview: mockBudgetOverview, listPolicies: mockBudgetListPolicies }),
}));

vi.mock("../services/embedding-service.js", () => ({
  embeddingService: () => ({
    commandPaletteSearch: mockSearchSemantic,
    findSimilarIssues: mockSearchSimilarIssues,
  }),
}));

vi.mock("../adapters/index.js", () => ({
  listServerAdapters: mockListServerAdapters,
}));

vi.mock("../services/agents.js", () => ({
  agentService: () => ({ getById: mockAgentGetById }),
}));

vi.mock("../services/activity.js", () => ({
  activityService: () => ({
    list: mockActivityList,
    create: vi.fn(),
    issuesForRun: vi.fn().mockResolvedValue([{ issueId: "issue-1" }]),
    runsForIssue: vi.fn().mockResolvedValue([{ id: "run-1" }]),
    forIssue: vi.fn().mockResolvedValue([{ id: "activity-1" }]),
  }),
}));

vi.mock("../services/secrets.js", () => ({
  secretService: () => ({
    listProviders: mockSecretListProviders,
    list: mockSecretList,
    create: mockSecretCreate,
    getById: mockSecretGetById,
    rotate: mockSecretRotate,
    update: mockSecretUpdate,
    remove: mockSecretRemove,
  }),
}));

vi.mock("../services/activity-log.js", () => ({
  logActivity: mockLogActivity,
}));

function createDbStub(joinRequestCount = 0) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          then: (resolve: (rows: Array<{ count: number }>) => unknown) =>
            Promise.resolve(resolve([{ count: joinRequestCount }])),
        })),
      })),
    })),
  } as any;
}

async function createApp() {
  const [{ companyRoutes }, { companyIssueRoutes }, { agentRoutes }, { dashboardRoutes }, { sidebarBadgeRoutes }, { budgetRoutes }, { searchRoutes }, { llmRoutes }, { secretRoutes }, { activityRoutes }, { instanceSettingsRoutes }, { costRoutes }] =
    await Promise.all([
      import("../routes/companies.js"),
      import("../routes/issues.js"),
      import("../routes/agents.js"),
      import("../routes/dashboard.js"),
      import("../routes/sidebar-badges.js"),
      import("../routes/budgets.js"),
      import("../routes/search.js"),
      import("../routes/llms.js"),
      import("../routes/secrets.js"),
      import("../routes/activity.js"),
      import("../routes/instance-settings.js"),
      import("../routes/costs.js"),
    ]);

  return new Elysia()
    .derive(() => ({
      actor: {
        type: "board",
        source: "local_implicit",
        userId: "user-1",
        companyIds: [COMPANY_ID],
      },
    }))
    .use(dashboardRoutes({} as any))
    .use(companyRoutes({} as any, {} as any))
    .use(companyIssueRoutes({} as any))
    .use(agentRoutes({} as any))
    .use(activityRoutes({} as any))
    .use(instanceSettingsRoutes({} as any))
    .use(costRoutes({} as any))
    .use(sidebarBadgeRoutes(createDbStub(3) as any))
    .use(budgetRoutes({} as any))
    .use(searchRoutes({} as any, null))
    .use(llmRoutes({} as any))
    .use(secretRoutes({} as any));
}

describe("route smoke coverage", () => {
  beforeEach(() => {
    mockDashboardSummary.mockReset();
    mockSidebarBadgeGet.mockReset();
    mockCompanyList.mockReset();
    mockCompanyGetById.mockReset();
    mockAgentsList.mockReset();
    mockActivityList.mockReset();
    mockCostSummary.mockReset();
    mockInstanceGeneralGet.mockReset();
    mockInstanceExperimentalGet.mockReset();
    mockGoalList.mockReset();
    mockProjectList.mockReset();
    mockBudgetOverview.mockReset();
    mockBudgetListPolicies.mockReset();
    mockSearchSemantic.mockReset();
    mockSearchSimilarIssues.mockReset();
    mockListServerAdapters.mockClear();
    mockAgentGetById.mockReset();
    mockSecretListProviders.mockReset();
    mockSecretList.mockReset();
    mockSecretCreate.mockReset();
    mockSecretGetById.mockReset();
    mockSecretRotate.mockReset();
    mockSecretUpdate.mockReset();
    mockSecretRemove.mockReset();
    mockLogActivity.mockReset();
  });

  it("mounts company-scoped issue routes", async () => {
    const app = await createApp();
    const res = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/issues?limit=1`));
    expect(res.status).not.toBe(404);
  });

  it(
    "covers dashboard, sidebar badges, budgets, search, llms, and secrets endpoints",
    async () => {
    mockCompanyList.mockResolvedValue([{ id: COMPANY_ID, name: "Company One" }]);
    mockCompanyGetById.mockResolvedValue({ id: COMPANY_ID, name: "Company One" });
    mockAgentsList.mockResolvedValue([{ id: "agent-1", name: "Agent One", status: "active", role: "ceo", adapterType: "codex_local" }]);
    mockActivityList.mockResolvedValue([{ id: "activity-1" }]);
    mockCostSummary.mockResolvedValue({ totalCost: 1234, budget: 10000 });
    mockInstanceGeneralGet.mockResolvedValue({ censorUsernameInLogs: false });
    mockInstanceExperimentalGet.mockResolvedValue({ enableIsolatedWorkspaces: true, autoRestartDevServerWhenIdle: false });
    mockDashboardSummary.mockResolvedValue({
      agents: { error: 1 },
      costs: { monthBudgetCents: 10000, monthUtilizationPercent: 90 },
    });
    mockSidebarBadgeGet.mockResolvedValue({
      failedRuns: 0,
      approvals: 2,
      inbox: 0,
    });
    mockBudgetOverview.mockResolvedValue({
      companyId: COMPANY_ID,
      policies: [{
        policyId: "policy-1",
        companyId: COMPANY_ID,
        scopeType: "company",
        scopeId: COMPANY_ID,
        scopeName: "Company",
        metric: "billed_cents",
        windowKind: "calendar_month_utc",
        amount: 1000,
        observedAmount: 250,
        remainingAmount: 750,
        utilizationPercent: 25,
        warnPercent: 80,
        hardStopEnabled: true,
        notifyEnabled: true,
        isActive: true,
        status: "ok",
        paused: false,
        pauseReason: null,
        windowStart: new Date("2026-01-01T00:00:00.000Z"),
        windowEnd: new Date("2026-01-31T23:59:59.999Z"),
      }],
      activeIncidents: [],
      pausedAgentCount: 0,
      pausedProjectCount: 0,
      pendingApprovalCount: 0,
    });
    mockBudgetListPolicies.mockResolvedValue([{ id: "policy-1" }]);
    mockSearchSemantic.mockResolvedValue([{ id: "issue-1" }]);
    mockSearchSimilarIssues.mockResolvedValue([{ id: "issue-2" }]);
    mockSecretListProviders.mockResolvedValue([{ provider: "local_encrypted" }]);
    mockSecretList.mockResolvedValue([{ id: "secret-1" }]);
    mockSecretCreate.mockResolvedValue({
      id: "secret-2",
      companyId: COMPANY_ID,
      name: "API key",
      provider: "local_encrypted",
    });
    mockSecretGetById.mockResolvedValue({
      id: "secret-1",
      companyId: COMPANY_ID,
      name: "API key",
    });
    mockSecretRotate.mockResolvedValue({
      id: "secret-1",
      companyId: COMPANY_ID,
      latestVersion: 2,
    });
    mockSecretUpdate.mockResolvedValue({
      id: "secret-1",
      companyId: COMPANY_ID,
      name: "Rotated key",
    });
    mockSecretRemove.mockResolvedValue({
      id: "secret-1",
      companyId: COMPANY_ID,
      name: "Rotated key",
    });
    mockAgentGetById.mockResolvedValue({
      id: "agent-1",
      companyId: COMPANY_ID,
      permissions: { canCreateAgents: true },
    });

    const app = await createApp();

    const companiesRes = await app.handle(new Request("http://localhost/companies"));
    expect(companiesRes.status).toBe(200);
    expect(await companiesRes.json()).toEqual([{ id: COMPANY_ID, name: "Company One" }]);

    const companyRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}`));
    expect(companyRes.status).toBe(200);
    expect(await companyRes.json()).toEqual({ id: COMPANY_ID, name: "Company One" });

    const dashboardRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/dashboard`));
    expect(dashboardRes.status).toBe(200);
    expect(await dashboardRes.json()).toEqual({
      agents: { error: 1 },
      costs: { monthBudgetCents: 10000, monthUtilizationPercent: 90 },
    });

    const agentsRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/agents`));
    expect(agentsRes.status).toBe(200);
    expect(await agentsRes.json()).toEqual([{ id: "agent-1", name: "Agent One", status: "active", role: "ceo", adapterType: "codex_local" }]);

    const activityRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/activity?limit=10`));
    expect(activityRes.status).toBe(200);
    expect(await activityRes.json()).toEqual([{ id: "activity-1" }]);

    const costSummaryRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/costs/summary`));
    expect(costSummaryRes.status).toBe(200);
    expect(await costSummaryRes.json()).toEqual({ totalCost: 1234, budget: 10000 });

    const instanceGeneralRes = await app.handle(new Request("http://localhost/instance/settings/general"));
    expect(instanceGeneralRes.status).toBe(200);
    expect(await instanceGeneralRes.json()).toEqual({ censorUsernameInLogs: false });

    const instanceExperimentalRes = await app.handle(new Request("http://localhost/instance/settings/experimental"));
    expect(instanceExperimentalRes.status).toBe(200);
    expect(await instanceExperimentalRes.json()).toEqual({ enableIsolatedWorkspaces: true, autoRestartDevServerWhenIdle: false });

    const badgesRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/sidebar-badges`));
    expect(badgesRes.status).toBe(200);
    expect(await badgesRes.json()).toEqual({
      failedRuns: 0,
      approvals: 2,
      inbox: 10,
    });

    const budgetsRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/budgets`));
    expect(budgetsRes.status).toBe(200);
    expect(await budgetsRes.json()).toMatchObject({
      companyId: COMPANY_ID,
      policies: [{
        policyId: "policy-1",
        companyId: COMPANY_ID,
        scopeType: "company",
        scopeId: COMPANY_ID,
        scopeName: "Company",
        amount: 1000,
        observedAmount: 250,
      }],
      activeIncidents: [],
      pausedAgentCount: 0,
      pausedProjectCount: 0,
      pendingApprovalCount: 0,
    });

    const policiesRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/budgets/policies`));
    expect(policiesRes.status).toBe(200);
    expect(await policiesRes.json()).toEqual({ policies: [{ id: "policy-1" }] });

    const semanticRes = await app.handle(new Request(`http://localhost/search/companies/${COMPANY_ID}/semantic?q=hello`));
    expect(semanticRes.status).toBe(200);
    expect(await semanticRes.json()).toEqual({ results: [{ id: "issue-1" }] });

    const similarRes = await app.handle(
      new Request(`http://localhost/search/companies/${COMPANY_ID}/similar-issues`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "hello world" }),
      }),
    );
    expect(similarRes.status).toBe(200);
    expect(await similarRes.json()).toEqual({ results: [{ id: "issue-2" }] });

    const llmsIndexRes = await app.handle(new Request("http://localhost/llms/agent-configuration.txt"));
    expect(llmsIndexRes.status).toBe(200);
    expect(llmsIndexRes.headers.get("content-type")).toContain("text/plain");
    expect(await llmsIndexRes.text()).toContain("/llms/agent-configuration/codex_local.txt");

    const llmsIconsRes = await app.handle(new Request("http://localhost/llms/agent-icons.txt"));
    expect(llmsIconsRes.status).toBe(200);
    expect(await llmsIconsRes.text()).toContain("icon");

    const llmsAdapterRes = await app.handle(
      new Request("http://localhost/llms/agent-configuration/codex_local.txt"),
    );
    expect(llmsAdapterRes.status).toBe(200);
    expect(await llmsAdapterRes.text()).toContain("Codex Local");

    const providersRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/secret-providers`));
    expect(providersRes.status).toBe(200);
    expect(await providersRes.json()).toEqual([{ provider: "local_encrypted" }]);

    const secretsListRes = await app.handle(new Request(`http://localhost/companies/${COMPANY_ID}/secrets`));
    expect(secretsListRes.status).toBe(200);
    expect(await secretsListRes.json()).toEqual([{ id: "secret-1" }]);

    const createSecretRes = await app.handle(
      new Request(`http://localhost/companies/${COMPANY_ID}/secrets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "API key",
          value: "secret-value",
        }),
      }),
    );
    expect(createSecretRes.status).toBe(201);
    expect(await createSecretRes.json()).toEqual({
      id: "secret-2",
      companyId: COMPANY_ID,
      name: "API key",
      provider: "local_encrypted",
    });

    const rotateSecretRes = await app.handle(
      new Request("http://localhost/secrets/secret-1/rotate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value: "rotated-value" }),
      }),
    );
    expect(rotateSecretRes.status).toBe(200);
    expect(await rotateSecretRes.json()).toEqual({
      id: "secret-1",
      companyId: COMPANY_ID,
      latestVersion: 2,
    });

    const updateSecretRes = await app.handle(
      new Request("http://localhost/secrets/secret-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Rotated key" }),
      }),
    );
    expect(updateSecretRes.status).toBe(200);
    expect(await updateSecretRes.json()).toEqual({
      id: "secret-1",
      companyId: COMPANY_ID,
      name: "Rotated key",
    });

    const deleteSecretRes = await app.handle(
      new Request("http://localhost/secrets/secret-1", { method: "DELETE" }),
    );
    expect(deleteSecretRes.status).toBe(200);
    expect(await deleteSecretRes.json()).toEqual({ ok: true });
    },
    30_000,
  );
});
