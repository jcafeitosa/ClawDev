import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModelRouterService } from "../services/model-router.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";
const mockListServerAdapters = vi.hoisted(() =>
  vi.fn(() => [
    { type: "claude_local" },
    { type: "codex_local" },
    { type: "copilot_local" },
    { type: "opencode_local" },
    { type: "pi_local" },
    { type: "cursor" },
    { type: "gemini_local" },
  ]),
);
const mockListAdapterModels = vi.hoisted(() =>
  vi.fn(async (adapterType: string) => {
    switch (adapterType) {
      case "claude_local":
        return [{ id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" }];
      case "codex_local":
        return [
          { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
          { id: "gpt-5.4", label: "GPT-5.4" },
          { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
        ];
      case "gemini_local":
        return [{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }];
      case "pi_local":
        return [{ id: "openai/gpt-5.4", label: "openai/gpt-5.4" }];
      default:
        return [];
    }
  }),
);

function baseNameOf(table: unknown): string | null {
  if (typeof table !== "object" || table === null) return null;
  const symbol = Object.getOwnPropertySymbols(table).find((candidate) =>
    String(candidate).includes("drizzle:BaseName"),
  );
  if (!symbol) return null;
  const value = (table as Record<symbol, unknown>)[symbol];
  return typeof value === "string" ? value : null;
}

function createDbStub(options?: {
  preferenceRow?: Record<string, unknown> | null;
  catalogRows?: Array<Record<string, unknown>>;
  statusRows?: Array<Record<string, unknown>>;
  routingLogRows?: Array<Record<string, unknown>>;
}) {
  const preferenceRow = options?.preferenceRow ?? null;
  const catalogRows = options?.catalogRows ?? [];
  const statusRows = options?.statusRows ?? [];
  const routingLogRows = options?.routingLogRows ?? [];

  function filterRowsByAdapterHint(rows: Array<Record<string, unknown>>, condition: unknown) {
    let serialized = "";
    try {
      serialized = JSON.stringify(condition) ?? "";
    } catch {
      serialized = String(condition ?? "");
    }
    const hintedAdapterType = ["claude_local", "codex_local", "copilot_local", "cursor", "gemini_local", "opencode_local", "pi_local"]
      .find((adapterType) => serialized.includes(adapterType));
    if (!hintedAdapterType) return rows;
    return rows.filter((row) => row.adapterType === hintedAdapterType);
  }

  function buildChain(resultRows: Array<Record<string, unknown>>) {
    const chain: any = {
      where(condition?: unknown) {
        return buildChain(filterRowsByAdapterHint(resultRows, condition));
      },
      limit() {
        return chain;
      },
      orderBy() {
        return chain;
      },
      then(resolve: (rows: Array<Record<string, unknown>>) => unknown) {
        return Promise.resolve(resolve(resultRows));
      },
    };
    return chain;
  }

  return {
    select() {
      return {
        from(table: unknown) {
          const name = baseNameOf(table);
          if (name === "company_model_preferences") {
            return buildChain(preferenceRow ? [preferenceRow] : []);
          }
          if (name === "model_catalog") {
            return buildChain(catalogRows);
          }
          if (name === "provider_model_status") {
            return buildChain(statusRows);
          }
          if (name === "model_routing_log") {
            return buildChain(routingLogRows);
          }
          return buildChain([]);
        },
      };
    },
  };
}

function createProviderStatusStub(
  available: Set<string>,
  statusRows: Array<Record<string, unknown>> = [],
) {
  return {
    isAvailable: vi.fn(async (adapterType: string, modelId: string) =>
      available.has(`${adapterType}::${modelId}`),
    ),
    listEffectiveStatuses: vi.fn(async (_scope?: unknown, adapterType?: string) =>
      adapterType
        ? statusRows.filter((row) => row.adapterType === adapterType)
        : statusRows,
    ),
  };
}

vi.mock("../adapters/registry.js", () => ({
  listServerAdapters: mockListServerAdapters,
  listAdapterModels: mockListAdapterModels,
}));

describe("model router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respects defaultAdapterType instead of sticking to the requested adapter", async () => {
    const db = createDbStub({
      preferenceRow: {
        companyId: COMPANY_ID,
        defaultAdapterType: "codex_local",
        defaultModelId: "gpt-5",
        fallbackChain: [],
        routingStrategy: "pinned",
        allowCrossProviderFallback: true,
        preferFreeModels: false,
        preferLocalModels: false,
      },
      catalogRows: [
        {
          adapterType: "claude_local",
          modelId: "claude-sonnet-4-6",
          inputPriceMicro: 15,
          isFree: false,
          isLocal: true,
        },
        {
          adapterType: "codex_local",
          modelId: "gpt-5",
          inputPriceMicro: 20,
          isFree: false,
          isLocal: true,
        },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set(["claude_local::claude-sonnet-4-6", "codex_local::gpt-5"]),
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", undefined);

    expect(result).toMatchObject({
      adapterType: "codex_local",
      modelId: "gpt-5",
      resolution: "default",
    });
  });

  it("chooses the cheapest available model across providers when cost optimized", async () => {
    const db = createDbStub({
      preferenceRow: {
        companyId: COMPANY_ID,
        defaultAdapterType: null,
        defaultModelId: null,
        fallbackChain: [],
        routingStrategy: "cost_optimized",
        allowCrossProviderFallback: true,
        preferFreeModels: false,
        preferLocalModels: false,
      },
      catalogRows: [
        { adapterType: "claude_local", modelId: "sonnet", inputPriceMicro: 30, isFree: false, isLocal: true },
        { adapterType: "codex_local", modelId: "gpt-5", inputPriceMicro: 20, isFree: false, isLocal: true },
        { adapterType: "gemini_local", modelId: "gemini-2.5-flash", inputPriceMicro: 10, isFree: true, isLocal: true },
      ],
      statusRows: [
        { adapterType: "claude_local", modelId: "sonnet", avgLatencyMs: 500, consecutiveFailures: 2 },
        { adapterType: "codex_local", modelId: "gpt-5", avgLatencyMs: 300, consecutiveFailures: 1 },
        { adapterType: "gemini_local", modelId: "gemini-2.5-flash", avgLatencyMs: 250, consecutiveFailures: 0 },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "claude_local::sonnet",
        "codex_local::gpt-5",
        "gemini_local::gemini-2.5-flash",
      ]),
      [
        { adapterType: "claude_local", modelId: "sonnet", avgLatencyMs: 500, consecutiveFailures: 2 },
        { adapterType: "codex_local", modelId: "gpt-5", avgLatencyMs: 300, consecutiveFailures: 1 },
        { adapterType: "gemini_local", modelId: "gemini-2.5-flash", avgLatencyMs: 250, consecutiveFailures: 0 },
      ],
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", undefined);

    expect(result).toMatchObject({
      adapterType: "gemini_local",
      modelId: "gemini-2.5-flash",
      resolution: "routed",
    });
  });

  it("prefers local models when requested even if another provider is faster", async () => {
    const db = createDbStub({
      preferenceRow: {
        companyId: COMPANY_ID,
        defaultAdapterType: null,
        defaultModelId: null,
        fallbackChain: [],
        routingStrategy: "performance_optimized",
        allowCrossProviderFallback: true,
        preferFreeModels: false,
        preferLocalModels: true,
      },
      catalogRows: [
        { adapterType: "claude_local", modelId: "sonnet", inputPriceMicro: 30, isFree: false, isLocal: true },
        { adapterType: "codex_local", modelId: "gpt-5", inputPriceMicro: 20, isFree: false, isLocal: true },
        { adapterType: "pi_local", modelId: "openai/gpt-5.4", inputPriceMicro: 5, isFree: false, isLocal: false },
      ],
      statusRows: [
        { adapterType: "claude_local", modelId: "sonnet", avgLatencyMs: 500, consecutiveFailures: 0 },
        { adapterType: "codex_local", modelId: "gpt-5", avgLatencyMs: 300, consecutiveFailures: 0 },
        { adapterType: "pi_local", modelId: "openai/gpt-5.4", avgLatencyMs: 50, consecutiveFailures: 0 },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "claude_local::sonnet",
        "codex_local::gpt-5",
        "pi_local::openai/gpt-5.4",
      ]),
      [
        { adapterType: "claude_local", modelId: "sonnet", avgLatencyMs: 500, consecutiveFailures: 0 },
        { adapterType: "codex_local", modelId: "gpt-5", avgLatencyMs: 300, consecutiveFailures: 0 },
        { adapterType: "pi_local", modelId: "openai/gpt-5.4", avgLatencyMs: 50, consecutiveFailures: 0 },
      ],
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", undefined);

    expect(result.resolution).toBe("local_preferred");
    expect(result.adapterType).toBe("codex_local");
    expect(result.modelId).toBe("gpt-5");
  });

  it("falls back across providers when no preferences are configured and the requested adapter is rate-limited", async () => {
    const db = createDbStub({
      preferenceRow: null,
      catalogRows: [],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "codex_local::gpt-5.4-mini",
        "codex_local::gpt-5.4",
        "codex_local::gpt-5.3-codex",
        "gemini_local::gemini-2.5-flash",
      ]),
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", "auto");

    expect(result).toMatchObject({
      adapterType: "codex_local",
      modelId: "gpt-5.4-mini",
      resolution: "routed",
    });
  });

  it("keeps execution on the requested adapter and skips cross-provider auto candidates", async () => {
    const db = createDbStub({
      preferenceRow: null,
      catalogRows: [
        {
          adapterType: "codex_local",
          modelId: "gpt-5.4-mini",
          inputPriceMicro: 400,
          isFree: true,
          isLocal: true,
        },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "codex_local::gpt-5.4-mini",
        "gemini_local::auto",
      ]),
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "codex_local", undefined, {
      lockAdapterType: true,
    });

    expect(result).toMatchObject({
      adapterType: "codex_local",
      modelId: "gpt-5.4-mini",
      resolution: "routed",
    });
  });

  it("reuses the most recent successful resolution for the same auth profile before generic fallback", async () => {
    const db = createDbStub({
      preferenceRow: null,
      catalogRows: [
        { adapterType: "codex_local", modelId: "gpt-5.4-mini", inputPriceMicro: 20, isFree: false, isLocal: true },
        { adapterType: "gemini_local", modelId: "gemini-2.5-flash", inputPriceMicro: 10, isFree: true, isLocal: true },
      ],
      routingLogRows: [
        {
          companyId: COMPANY_ID,
          agentId: "agent-1",
          authProfileKey: "profile-a",
          outcome: "succeeded",
          resolvedAdapterType: "codex_local",
          resolvedModelId: "gpt-5.4-mini",
          occurredAt: new Date("2026-04-08T12:00:00.000Z"),
        },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "codex_local::gpt-5.4-mini",
        "gemini_local::gemini-2.5-flash",
      ]),
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", undefined, {
      authProfileKey: "profile-a",
    });

    expect(result).toMatchObject({
      adapterType: "codex_local",
      modelId: "gpt-5.4-mini",
      resolution: "pinned",
    });
  });

  it("does not reuse a recent successful resolution from another adapter when adapter type is locked", async () => {
    const db = createDbStub({
      preferenceRow: null,
      catalogRows: [
        { adapterType: "claude_local", modelId: "claude-sonnet-4-6", inputPriceMicro: 20, isFree: false, isLocal: true },
        { adapterType: "codex_local", modelId: "gpt-5.4-mini", inputPriceMicro: 10, isFree: false, isLocal: true },
      ],
      routingLogRows: [
        {
          companyId: COMPANY_ID,
          agentId: "agent-1",
          authProfileKey: "profile-a",
          outcome: "succeeded",
          resolvedAdapterType: "codex_local",
          resolvedModelId: "gpt-5.4-mini",
          occurredAt: new Date("2026-04-08T12:00:00.000Z"),
        },
        {
          companyId: COMPANY_ID,
          agentId: "agent-1",
          authProfileKey: "profile-a",
          outcome: "failed",
          resolvedAdapterType: "claude_local",
          resolvedModelId: "claude-sonnet-4-6",
          occurredAt: new Date("2026-04-08T12:01:00.000Z"),
        },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "claude_local::claude-sonnet-4-6",
        "codex_local::gpt-5.4-mini",
      ]),
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", undefined, {
      authProfileKey: "profile-a",
      lockAdapterType: true,
    });

    expect(result).toMatchObject({
      adapterType: "claude_local",
      modelId: "claude-sonnet-4-6",
    });
  });
});
