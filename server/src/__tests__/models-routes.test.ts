import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { modelRoutes } from "../routes/models.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

const mockCatalog = vi.hoisted(() => ({
  listModels: vi.fn(),
  getModel: vi.fn(),
  enrichModel: vi.fn(),
}));

const mockProviderStatus = vi.hoisted(() => ({
  getProviderSummary: vi.fn(),
  markCooldown: vi.fn(),
  updateStatus: vi.fn(),
  clearExpiredCooldowns: vi.fn(),
  clearExpiredCooldownsForScope: vi.fn(),
  listEffectiveStatuses: vi.fn(),
}));

const mockDiscovery = vi.hoisted(() => ({
  runDiscoveryCycle: vi.fn(),
  probeAdapter: vi.fn(),
}));

const mockReadiness = vi.hoisted(() => vi.fn());
const mockRemediateReadiness = vi.hoisted(() => vi.fn());

const mockRouter = vi.hoisted(() => ({
  resolveModel: vi.fn(),
  getRoutingLog: vi.fn(),
}));

let policyRowsState: Array<Record<string, unknown>> = [];

const mockListServerAdapters = vi.hoisted(() =>
  vi.fn(() => [
    {
      type: "codex_local",
      agentConfigurationDoc: "# Codex Local",
    },
  ]),
);

const mockListAdapterModels = vi.hoisted(() => vi.fn(async () => [
  { id: "gpt-5", label: "GPT-5" },
]));
const mockResolveAdapterConfigForRuntime = vi.hoisted(() =>
  vi.fn(async (_companyId: string, config: Record<string, unknown>) => ({ config })),
);
const mockDiscoverPiModelsCached = vi.hoisted(() => vi.fn(async () => []));
const mockListOpenAICompatibleModels = vi.hoisted(() => vi.fn(async () => []));

function createDbStub() {
  let preferenceRow: Record<string, unknown> | null = null;
  let agentRows: Array<Record<string, unknown>> = [];
  let providerStatusRows: Array<Record<string, unknown>> = [
    {
      adapterType: "codex_local",
      modelId: "gpt-5",
      status: "unknown",
      avgLatencyMs: null,
      p95LatencyMs: null,
      errorRatePercent: null,
      consecutiveFailures: 0,
      cooldownUntil: null,
      cooldownReason: null,
      lastProbeStatus: null,
      lastProbeAt: null,
    },
  ];

  function makeSelectChain(fields: unknown) {
    return {
      from(_table: unknown) {
        const baseName = typeof _table === "object" && _table !== null
          ? (() => {
              const sym = Object.getOwnPropertySymbols(_table).find((candidate) =>
                String(candidate).includes("drizzle:BaseName"),
              );
              const value = sym ? (_table as Record<symbol, unknown>)[sym] : undefined;
              return typeof value === "string" ? value : null;
            })()
          : null;
        const isPreferences = baseName === "company_model_preferences";
        const isAgents = baseName === "agents";
        if (fields === undefined) {
          const result: any = {
            where: () => result,
            limit: () => result,
            then: (resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
              Promise.resolve(resolve(
                isPreferences
                  ? (preferenceRow ? [preferenceRow] : [])
                  : isAgents
                    ? agentRows
                  : baseName === "model_routing_policies"
                    ? policyRowsState
                    : providerStatusRows,
              )),
          };
          return result;
        }
        const result: any = {
          where: () => result,
          limit: () => result,
          then: (resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
            Promise.resolve(resolve(isAgents ? agentRows : (preferenceRow ? [preferenceRow] : []))),
        };
        return result;
      },
    };
  }

  function makeMutateChain(kind: "update" | "insert") {
    const chain: any = {
      set(values: Record<string, unknown>) {
        if (kind === "update") {
          preferenceRow = { ...(preferenceRow ?? {}), ...values };
        }
        return {
          where: () => ({
            returning: async () => {
              if (kind === "insert") {
                preferenceRow = { companyId: COMPANY_ID, ...values };
              }
              return [preferenceRow ?? { companyId: COMPANY_ID, ...values }];
            },
          }),
        };
      },
      values(values: Record<string, unknown>) {
        if (kind === "insert") {
          if ((values as Record<string, unknown>).companyId === COMPANY_ID && "routingStrategy" in values) {
            const row = {
              id: "policy-1",
              ...values,
            };
            policyRowsState = [row];
            return {
              returning: async () => [row],
            };
          }
          preferenceRow = { ...values };
        }
        return {
          returning: async () => [preferenceRow ?? values],
        };
      },
      where: () => ({
        returning: async () => [preferenceRow ?? { companyId: COMPANY_ID }],
      }),
    };
    return chain;
  }

  return {
    __setAgentRows(rows: Array<Record<string, unknown>>) {
      agentRows = rows;
    },
    select: vi.fn((fields?: unknown) => makeSelectChain(fields)),
    update: vi.fn(() => makeMutateChain("update")),
    insert: vi.fn(() => makeMutateChain("insert")),
  };
}

vi.mock("../services/model-catalog.js", () => ({
  createModelCatalogService: () => mockCatalog,
}));

vi.mock("../services/provider-status.js", () => ({
  createProviderStatusService: () => mockProviderStatus,
  getCooldownDuration: () => 5 * 60 * 1000,
}));

vi.mock("../services/model-discovery.js", () => ({
  createModelDiscoveryService: () => mockDiscovery,
}));

vi.mock("../services/model-router.js", () => ({
  createModelRouterService: () => mockRouter,
}));

vi.mock("../services/adapter-readiness.js", () => ({
  checkAdapterReadiness: mockReadiness,
  remediateAdapterReadiness: mockRemediateReadiness,
}));

vi.mock("../adapters/registry.js", () => ({
  listServerAdapters: mockListServerAdapters,
  listAdapterModels: mockListAdapterModels,
}));

vi.mock("../services/secrets.js", () => ({
  secretService: () => ({
    resolveAdapterConfigForRuntime: mockResolveAdapterConfigForRuntime,
  }),
}));

vi.mock("@clawdev/adapter-pi-local/server", () => ({
  discoverPiModelsCached: mockDiscoverPiModelsCached,
}));

vi.mock("@clawdev/adapter-openai-compatible-local/server", () => ({
  listOpenAICompatibleModels: mockListOpenAICompatibleModels,
}));

function createApp() {
  const db = createDbStub() as any;
  const app = new Elysia({ prefix: "/api" })
    .onError(({ error, set }) => {
      set.status = 500;
      return { error: error instanceof Error ? error.message : String(error) };
    })
    .derive(() => ({
      actor: {
        type: "board",
        userId: "board-user",
        companyIds: [COMPANY_ID],
        source: "local_implicit",
        isInstanceAdmin: true,
      },
    }))
    .use(modelRoutes(db));
  return { app, db };
}

async function req(app: Elysia, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["content-type"] = "application/json";
  }
  const res = await app.handle(new Request(`http://localhost${path}`, init));
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep plain text
  }
  return { status: res.status, body: json, text };
}

describe("model routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    policyRowsState = [];
    mockCatalog.listModels.mockResolvedValue([
      {
        id: "gpt-5",
        adapterType: "codex_local",
        modelId: "gpt-5",
        label: "GPT-5",
        tier: "paid",
        capabilities: ["code"],
        contextWindow: 128000,
        isFree: false,
        lastProbedAt: "2026-03-19T00:00:00.000Z",
      },
    ]);
    mockCatalog.getModel.mockResolvedValue({
      id: "gpt-5",
      adapterType: "codex_local",
      modelId: "gpt-5",
      label: "GPT-5",
    });
    mockCatalog.enrichModel.mockResolvedValue({
      id: "gpt-5",
      adapterType: "codex_local",
      modelId: "gpt-5",
      label: "GPT-5",
      tier: "paid",
    });
    mockProviderStatus.getProviderSummary.mockResolvedValue([
      {
        provider: "codex_local",
        total: 1,
        available: 1,
        cooldown: 0,
        unavailable: 0,
      },
    ]);
    mockProviderStatus.markCooldown.mockResolvedValue(undefined);
    mockProviderStatus.updateStatus.mockResolvedValue(undefined);
    mockProviderStatus.clearExpiredCooldowns.mockResolvedValue(0);
    mockProviderStatus.clearExpiredCooldownsForScope.mockResolvedValue(0);
    mockProviderStatus.listEffectiveStatuses.mockResolvedValue([
      {
        adapterType: "codex_local",
        modelId: "gpt-5",
        status: "unknown",
        avgLatencyMs: null,
        p95LatencyMs: null,
        errorRatePercent: null,
        consecutiveFailures: 0,
        cooldownUntil: null,
        cooldownReason: null,
        lastProbeStatus: null,
        lastProbeAt: null,
      },
    ]);
    mockDiscovery.runDiscoveryCycle.mockResolvedValue({ ok: true });
    mockDiscovery.probeAdapter.mockResolvedValue({ ok: true });
    mockReadiness.mockResolvedValue([
      {
        adapterType: "codex_local",
        installed: true,
        upToDate: true,
        currentVersion: "0.3.1",
        minimumVersion: "0.0.0",
        needsInstall: false,
        needsUpdate: false,
        remediation: {
          kind: "manual",
          command: "codex --version",
          installCommand: "npm install -g @openai/codex",
          updateCommand: "npm install -g @openai/codex@latest",
          reason: "Version probe is adapter-defined; install/update automation is adapter-specific.",
        },
      },
    ]);
    mockRouter.resolveModel.mockResolvedValue({
      adapterType: "codex_local",
      modelId: "gpt-5",
      resolutionType: "pinned",
    });
    mockRemediateReadiness.mockResolvedValue({
      adapterType: "codex_local",
      mode: "install",
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: "installed",
      stderr: "",
    });
    mockRouter.getRoutingLog.mockResolvedValue([
      {
        timestamp: "2026-03-19T00:00:00.000Z",
        agentName: "Builder",
        requestedModel: "gpt-5",
        resolvedModel: "gpt-5",
        resolutionType: "pinned",
        fallbackDepth: 0,
        reason: "default",
      },
    ]);
    mockResolveAdapterConfigForRuntime.mockImplementation(async (_companyId, config) => ({ config }));
    mockDiscoverPiModelsCached.mockResolvedValue([]);
    mockListOpenAICompatibleModels.mockResolvedValue([]);
  });

  it("covers the providers and routing endpoints used by the frontend", async () => {
    const { app } = createApp();

    const readinessRes = await req(app, "GET", "/api/adapters/readiness");
    expect(readinessRes.status).toBe(200);
    expect(readinessRes.body).toEqual({
      adapters: expect.arrayContaining([
        expect.objectContaining({
          adapterType: "codex_local",
          installed: true,
          needsInstall: false,
        }),
      ]),
    });

    const modelsRes = await req(app, "GET", `/api/models?companyId=${COMPANY_ID}`);
    expect(modelsRes.status).toBe(200);
    expect(modelsRes.body).toEqual({
      models: expect.arrayContaining([
        expect.objectContaining({
          id: "gpt-5",
          adapterType: "codex_local",
          modelId: "gpt-5",
          circuitState: "unknown",
        }),
      ]),
    });

    const providersRes = await req(app, "GET", `/api/providers/summary?companyId=${COMPANY_ID}`);
    expect(providersRes.status).toBe(200);
    expect(providersRes.body).toEqual({
      providers: expect.arrayContaining([
        expect.objectContaining({
          adapterType: "codex_local",
          total: 1,
          available: 1,
        }),
      ]),
    });

    const preferencesRes = await req(app, "GET", `/api/companies/${COMPANY_ID}/model-preferences`);
    expect(preferencesRes.status).toBe(200);
    expect(preferencesRes.body).toEqual({
      companyId: COMPANY_ID,
      defaultAdapterType: null,
      defaultModelId: null,
      fallbackChain: [],
      routingStrategy: "pinned",
      allowCrossProviderFallback: true,
      preferFreeModels: false,
      preferLocalModels: false,
      maxCostPerRequestMicro: null,
    });

    const updatePreferencesRes = await req(app, "PUT", `/api/companies/${COMPANY_ID}/model-preferences`, {
      defaultAdapterType: "codex_local",
      defaultModelId: "gpt-5",
      fallbackChain: [{ adapterType: "codex_local", modelId: "gpt-5" }],
      routingStrategy: "performance_optimized",
      allowCrossProviderFallback: false,
      preferFreeModels: true,
      preferLocalModels: true,
      maxCostPerRequestMicro: 5000,
    });
    expect(updatePreferencesRes.status).toBe(200);
    expect(updatePreferencesRes.body).toEqual(expect.objectContaining({
      defaultAdapterType: "codex_local",
      defaultModelId: "gpt-5",
      routingStrategy: "performance_optimized",
      allowCrossProviderFallback: false,
    }));

    const policyRes = await req(app, "PUT", `/api/companies/${COMPANY_ID}/model-routing-policies`, {
      companyId: COMPANY_ID,
      name: "CEO critical routing",
      role: "ceo",
      complexity: "critical",
      routingStrategy: "performance_optimized",
      fallbackChain: [{ adapterType: "codex_local", modelId: "gpt-5" }],
      allowCrossProviderFallback: true,
      preferFreeModels: false,
      preferLocalModels: true,
      priority: 10,
    });
    expect(policyRes.status).toBe(200);
    expect(policyRes.body).toEqual(expect.objectContaining({
      name: "CEO critical routing",
      role: "ceo",
      complexity: "critical",
      routingStrategy: "performance_optimized",
    }));

    const resolveRes = await req(app, "POST", `/api/companies/${COMPANY_ID}/model-resolve`, {
      agentId: "agent-1",
      adapterType: "codex_local",
      modelId: "auto",
      role: "ceo",
      taskComplexity: "critical",
      taskPriority: "critical",
      requiredCapabilities: ["code"],
    });
    expect(resolveRes.status).toBe(200);
    expect(mockRouter.resolveModel).toHaveBeenCalledWith(
      COMPANY_ID,
      "agent-1",
      "codex_local",
      "auto",
      expect.objectContaining({
        routingContext: expect.objectContaining({
          role: "ceo",
          complexity: "critical",
          taskPriority: "critical",
          requiredCapabilities: ["code"],
        }),
      }),
    );

    const remediateRes = await req(app, "POST", "/api/adapters/codex_local/readiness/remediate", {
      mode: "install",
    });
    expect(remediateRes.status).toBe(200);
    expect(mockRemediateReadiness).toHaveBeenCalledWith("codex_local", "install");

    const routingLogRes = await req(app, "GET", `/api/companies/${COMPANY_ID}/model-routing-log?limit=5`);
    expect(routingLogRes.status).toBe(200);
    expect(routingLogRes.body).toEqual({
      entries: expect.arrayContaining([
        expect.objectContaining({
          agentName: "Builder",
          requestedModel: "gpt-5",
          resolvedModel: "gpt-5",
        }),
      ]),
    });

    const syncRes = await req(app, "POST", "/api/models/sync");
    expect(syncRes.status).toBe(200);
    expect(mockDiscovery.runDiscoveryCycle).toHaveBeenCalled();

    const cooldownRes = await req(app, "POST", `/api/providers/codex_local/models/gpt-5/cooldown?companyId=${COMPANY_ID}`, {
      durationMinutes: 10,
      reason: "manual",
    });
    expect(cooldownRes.status).toBe(200);
    expect(mockProviderStatus.markCooldown).toHaveBeenCalledWith(
      "codex_local",
      "gpt-5",
      expect.any(Date),
      "manual",
      { companyId: COMPANY_ID },
    );

    const clearCooldownRes = await req(app, "DELETE", `/api/providers/codex_local/models/gpt-5/cooldown?companyId=${COMPANY_ID}`);
    expect(clearCooldownRes.status).toBe(200);
    expect(mockProviderStatus.updateStatus).toHaveBeenCalledWith(
      "codex_local",
      "gpt-5",
      "available",
      "cooldown cleared manually",
      { companyId: COMPANY_ID },
    );

    const clearExpiredRes = await req(app, "POST", `/api/providers/clear-expired-cooldowns?companyId=${COMPANY_ID}`);
    expect(clearExpiredRes.status).toBe(200);
    expect(clearExpiredRes.body).toEqual({ cleared: 0, companyId: COMPANY_ID });
    expect(mockProviderStatus.clearExpiredCooldownsForScope).toHaveBeenCalledWith({ companyId: COMPANY_ID });
  });

  it("uses company-scoped pi_local runtime config for live discovery", async () => {
    const { app, db } = createApp();
    db.__setAgentRows([
      {
        adapterConfig: {
          command: "pi",
          cwd: "/tmp/company-a",
          env: {
            OPENAI_API_KEY: "company-openai-key",
          },
        },
      },
    ]);
    mockDiscoverPiModelsCached.mockResolvedValue([
      { id: "openai/gpt-5.4", label: "GPT-5.4", provider: "openai", status: "available" },
    ]);

    const res = await req(app, "GET", `/api/providers/summary?companyId=${COMPANY_ID}`);

    expect(res.status).toBe(200);
    expect(mockDiscoverPiModelsCached).toHaveBeenCalledWith(expect.objectContaining({
      command: "pi",
      cwd: "/tmp/company-a",
      env: expect.objectContaining({
        OPENAI_API_KEY: "company-openai-key",
        XAI_API_KEY: "",
      }),
    }));
    expect((res.body as { providers: Array<Record<string, unknown>> }).providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          adapterType: "codex_local",
        }),
      ]),
    );
  });

  it("uses company-scoped openai-compatible config for live discovery", async () => {
    const { app, db } = createApp();
    db.__setAgentRows([
      {
        adapterConfig: {
          baseUrl: "http://127.0.0.1:11434/v1",
          apiKey: "local-token",
        },
      },
    ]);
    mockListServerAdapters.mockReturnValue([
      {
        type: "openai_compatible_local",
        authMethods: ["api"],
        agentConfigurationDoc: "# OpenAI Compatible Local",
      },
    ]);
    mockProviderStatus.getProviderSummary.mockResolvedValue([
      {
        provider: "openai_compatible_local",
        total: 1,
        available: 1,
        cooldown: 0,
        unavailable: 0,
      },
    ]);
    mockProviderStatus.listEffectiveStatuses.mockResolvedValue([
      {
        adapterType: "openai_compatible_local",
        modelId: "llama3.2",
        status: "available",
        avgLatencyMs: null,
        p95LatencyMs: null,
        errorRatePercent: null,
        consecutiveFailures: 0,
        cooldownUntil: null,
        cooldownReason: null,
        lastProbeStatus: null,
        lastProbeAt: null,
      },
    ]);
    mockListOpenAICompatibleModels.mockResolvedValue([
      { id: "llama3.2", label: "Llama 3.2", status: "available" },
    ]);

    const res = await req(
      app,
      "GET",
      `/api/models?companyId=${COMPANY_ID}&adapterType=openai_compatible_local`,
    );

    expect(res.status).toBe(200);
    expect(mockListOpenAICompatibleModels).toHaveBeenCalledWith({
      baseUrl: "http://127.0.0.1:11434/v1",
      apiKey: "local-token",
    });
    expect(res.body).toEqual({
      models: expect.arrayContaining([
        expect.objectContaining({
          id: "llama3.2",
          modelId: "llama3.2",
          status: "available",
        }),
      ]),
    });
  });
});
