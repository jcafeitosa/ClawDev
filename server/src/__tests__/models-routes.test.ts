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
}));

const mockDiscovery = vi.hoisted(() => ({
  runDiscoveryCycle: vi.fn(),
  probeAdapter: vi.fn(),
}));

const mockRouter = vi.hoisted(() => ({
  resolveModel: vi.fn(),
  getRoutingLog: vi.fn(),
}));

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

function createDbStub() {
  let preferenceRow: Record<string, unknown> | null = null;
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
        if (fields === undefined) {
          const result: any = {
            where: () => result,
            limit: () => result,
            then: (resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
              Promise.resolve(resolve(isPreferences ? (preferenceRow ? [preferenceRow] : []) : providerStatusRows)),
          };
          return result;
        }
        const result: any = {
          where: () => result,
          limit: () => result,
          then: (resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
            Promise.resolve(resolve(preferenceRow ? [preferenceRow] : [])),
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

vi.mock("../adapters/registry.js", () => ({
  listServerAdapters: mockListServerAdapters,
  listAdapterModels: mockListAdapterModels,
}));

function createApp() {
  return new Elysia({ prefix: "/api" })
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
    .use(modelRoutes(createDbStub() as any));
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
    mockDiscovery.runDiscoveryCycle.mockResolvedValue({ ok: true });
    mockDiscovery.probeAdapter.mockResolvedValue({ ok: true });
    mockRouter.resolveModel.mockResolvedValue({
      adapterType: "codex_local",
      modelId: "gpt-5",
      resolutionType: "pinned",
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
  });

  it("covers the providers and routing endpoints used by the frontend", async () => {
    const app = createApp();

    const modelsRes = await req(app, "GET", "/api/models");
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

    const providersRes = await req(app, "GET", "/api/providers/summary");
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

    const cooldownRes = await req(app, "POST", "/api/providers/codex_local/models/gpt-5/cooldown", {
      durationMinutes: 10,
      reason: "manual",
    });
    expect(cooldownRes.status).toBe(200);
    expect(mockProviderStatus.markCooldown).toHaveBeenCalledWith(
      "codex_local",
      "gpt-5",
      expect.any(Date),
      "manual",
    );

    const clearCooldownRes = await req(app, "DELETE", "/api/providers/codex_local/models/gpt-5/cooldown");
    expect(clearCooldownRes.status).toBe(200);
    expect(mockProviderStatus.updateStatus).toHaveBeenCalledWith(
      "codex_local",
      "gpt-5",
      "available",
      "cooldown cleared manually",
    );
  });
});
