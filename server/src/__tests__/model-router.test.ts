import { beforeEach, describe, expect, it, vi } from "vitest";
import { createModelRouterService } from "../services/model-router.js";

const COMPANY_ID = "11111111-1111-4111-8111-111111111111";

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
}) {
  const preferenceRow = options?.preferenceRow ?? null;
  const catalogRows = options?.catalogRows ?? [];
  const statusRows = options?.statusRows ?? [];

  function buildChain(resultRows: Array<Record<string, unknown>>) {
    const chain: any = {
      where() {
        return chain;
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
          return buildChain([]);
        },
      };
    },
  };
}

function createProviderStatusStub(available: Set<string>) {
  return {
    isAvailable: vi.fn(async (adapterType: string, modelId: string) =>
      available.has(`${adapterType}::${modelId}`),
    ),
  };
}

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
      catalogRows: [
        { adapterType: "claude_local", modelId: "claude-sonnet-4-6", inputPriceMicro: 30, isFree: false, isLocal: true },
        { adapterType: "codex_local", modelId: "gpt-5.3-codex", inputPriceMicro: 20, isFree: false, isLocal: true },
        { adapterType: "gemini_local", modelId: "gemini-2.5-flash", inputPriceMicro: 10, isFree: true, isLocal: true },
      ],
    } as any);
    const providerStatus = createProviderStatusStub(
      new Set([
        "codex_local::gpt-5.3-codex",
        "gemini_local::gemini-2.5-flash",
      ]),
    );
    const router = createModelRouterService(db as any, providerStatus as any);

    const result = await router.resolveModel(COMPANY_ID, "agent-1", "claude_local", "auto");

    expect(result).toMatchObject({
      adapterType: "gemini_local",
      modelId: "gemini-2.5-flash",
      resolution: "routed",
    });
  });
});
