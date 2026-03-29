import { and, count, desc, eq, gte, lt, sql, sum } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { agents, costEvents, providerConfigs, providerHealthEvents } from "@clawdev/db";
import type { ProviderQuotaResult, QuotaWindow } from "@clawdev/shared";
import { AGENT_ADAPTER_TYPES, type AgentAdapterType } from "@clawdev/shared";
import { notFound } from "../errors.js";
import { listServerAdapters, findServerAdapter } from "../adapters/registry.js";
import { fetchAllQuotaWindows } from "./quota-windows.js";
import {
  createModelRegistry,
  createCircuitBreaker,
  type CircuitState,
} from "./routing/index.js";
import { logger } from "../middleware/logger.js";

// ---------------------------------------------------------------------------
// Shared singletons (same instances as routing routes — single-process model)
// ---------------------------------------------------------------------------

const modelRegistry = createModelRegistry();
const circuitBreaker = createCircuitBreaker();

// ---------------------------------------------------------------------------
// Static adapter metadata — built from the server adapter registry
// ---------------------------------------------------------------------------

interface AdapterMeta {
  type: string;
  displayName: string;
  hasTestEnvironment: boolean;
  hasQuotaWindows: boolean;
  hasSkills: boolean;
  hasSessionCodec: boolean;
  supportsLocalAgentJwt: boolean;
  modelCount: number;
}

/** Friendly display names for known adapter types. */
const ADAPTER_DISPLAY_NAMES: Record<string, string> = {
  claude_local: "Claude (Anthropic)",
  codex_local: "Codex (OpenAI)",
  copilot_local: "Copilot (GitHub)",
  cursor: "Cursor",
  gemini_local: "Gemini (Google)",
  opencode_local: "OpenCode",
  openclaw_gateway: "OpenClaw Gateway",
  pi_local: "Pi",
  hermes_local: "Hermes",
  process: "Process (generic)",
  http: "HTTP (generic)",
};

function buildAdapterMeta(): Map<string, AdapterMeta> {
  const map = new Map<string, AdapterMeta>();
  for (const adapter of listServerAdapters()) {
    map.set(adapter.type, {
      type: adapter.type,
      displayName: ADAPTER_DISPLAY_NAMES[adapter.type] ?? adapter.type,
      hasTestEnvironment: adapter.testEnvironment != null,
      hasQuotaWindows: adapter.getQuotaWindows != null,
      hasSkills: adapter.listSkills != null,
      hasSessionCodec: adapter.sessionCodec != null,
      supportsLocalAgentJwt: adapter.supportsLocalAgentJwt ?? false,
      modelCount: (adapter.models ?? []).length,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProviderConfig {
  id: string;
  companyId: string;
  adapterType: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  authMethod: string;
  credentialSecretId: string | null;
  subscriptionPlan: string | null;
  subscriptionLimitMonthly: number | null;
  subscriptionResetsAt: Date | null;
  lastHealthCheck: Date | null;
  lastHealthStatus: string | null;
  lastHealthDetail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderHealthEvent {
  id: string;
  companyId: string;
  adapterType: string;
  status: string;
  detail: string | null;
  occurredAt: Date;
}

export interface ProviderBreakerInfo {
  state: CircuitState;
  tripCount: number;
  failureCount: number;
}

/** Real-time provider details from CLI probes */
export interface ProviderLiveDetails {
  cliVersion: string | null;
  authenticatedUser: string | null;
  defaultModel: string | null;
  availableModels: string[];
  billingType: string | null;
  authCommand: string | null;
}

export interface ProviderStatus {
  adapterType: string;
  displayName: string;
  configured: boolean;
  enabled: boolean;
  priority: number;
  /** Derived connection status */
  connectionStatus: "connected" | "degraded" | "disconnected" | "rate_limited" | "auth_expired" | "unconfigured";
  authMethod: string | null;
  subscriptionPlan: string | null;
  subscriptionLimitMonthly: number | null;
  subscriptionResetsAt: string | null;
  lastHealthCheck: string | null;
  lastHealthStatus: string | null;
  lastHealthDetail: string | null;
  /** Static adapter capabilities */
  adapterMeta: AdapterMeta | null;
  /** Quota windows from the provider API (null if not supported) */
  quotaWindows: QuotaWindow[] | null;
  /** Circuit breaker states keyed by model */
  circuitBreakers: Record<string, ProviderBreakerInfo>;
  /** Monthly spend in cents for current month */
  monthlySpendCents: number;
  /** Models from the model registry for this adapter */
  models: Array<{ id: string; displayName: string; tier: number }>;
  /** Live details probed from CLI */
  liveDetails: ProviderLiveDetails | null;
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

export function providerService(db: Db) {
  const adapterMetaMap = buildAdapterMeta();

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function listConfigs(companyId: string): Promise<ProviderConfig[]> {
    const rows = await db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.companyId, companyId))
      .orderBy(providerConfigs.priority, providerConfigs.adapterType);
    return rows as ProviderConfig[];
  }

  async function getConfig(companyId: string, adapterType: string): Promise<ProviderConfig | null> {
    const [row] = await db
      .select()
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.companyId, companyId),
          eq(providerConfigs.adapterType, adapterType),
        ),
      )
      .limit(1);
    return (row as ProviderConfig) ?? null;
  }

  async function upsertConfig(
    companyId: string,
    adapterType: string,
    data: {
      displayName?: string;
      enabled?: boolean;
      priority?: number;
      authMethod?: string;
      credentialSecretId?: string | null;
      subscriptionPlan?: string | null;
      subscriptionLimitMonthly?: number | null;
      subscriptionResetsAt?: Date | null;
    },
  ): Promise<ProviderConfig> {
    const now = new Date();
    const defaultDisplayName =
      ADAPTER_DISPLAY_NAMES[adapterType] ?? adapterType;

    const [row] = await db
      .insert(providerConfigs)
      .values({
        companyId,
        adapterType,
        displayName: data.displayName ?? defaultDisplayName,
        enabled: data.enabled ?? true,
        priority: data.priority ?? 0,
        authMethod: data.authMethod ?? "none",
        credentialSecretId: data.credentialSecretId ?? null,
        subscriptionPlan: data.subscriptionPlan ?? null,
        subscriptionLimitMonthly: data.subscriptionLimitMonthly ?? null,
        subscriptionResetsAt: data.subscriptionResetsAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [providerConfigs.companyId, providerConfigs.adapterType],
        set: {
          ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
          ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
          ...(data.priority !== undefined ? { priority: data.priority } : {}),
          ...(data.authMethod !== undefined ? { authMethod: data.authMethod } : {}),
          ...(data.credentialSecretId !== undefined
            ? { credentialSecretId: data.credentialSecretId }
            : {}),
          ...(data.subscriptionPlan !== undefined
            ? { subscriptionPlan: data.subscriptionPlan }
            : {}),
          ...(data.subscriptionLimitMonthly !== undefined
            ? { subscriptionLimitMonthly: data.subscriptionLimitMonthly }
            : {}),
          ...(data.subscriptionResetsAt !== undefined
            ? { subscriptionResetsAt: data.subscriptionResetsAt }
            : {}),
          updatedAt: now,
        },
      })
      .returning();

    return row as ProviderConfig;
  }

  async function deleteConfig(companyId: string, adapterType: string): Promise<void> {
    const result = await db
      .delete(providerConfigs)
      .where(
        and(
          eq(providerConfigs.companyId, companyId),
          eq(providerConfigs.adapterType, adapterType),
        ),
      )
      .returning({ id: providerConfigs.id });

    if (result.length === 0) {
      throw notFound(`Provider config for '${adapterType}' not found`);
    }
  }

  // ── Connection status derivation ────────────────────────────────────────

  function deriveConnectionStatus(
    adapterType: string,
    config: ProviderConfig | undefined,
    quotaWindows: QuotaWindow[] | null,
    breakerEntries: Record<string, ProviderBreakerInfo>,
    meta: AdapterMeta | null,
  ): ProviderStatus["connectionStatus"] {
    // If explicit health status from last check
    if (config?.lastHealthStatus === "auth_expired") return "auth_expired";
    if (config?.lastHealthStatus === "down") return "disconnected";
    if (config?.lastHealthStatus === "degraded") return "degraded";

    // Check circuit breakers — if any model is OPEN, provider is degraded
    const breakerValues = Object.values(breakerEntries);
    const allOpen = breakerValues.length > 0 && breakerValues.every(b => b.state === "OPEN");
    const someOpen = breakerValues.some(b => b.state === "OPEN");
    if (allOpen) return "disconnected";
    if (someOpen) return "degraded";

    // Check quota — if any window > 90% used, rate limited
    if (quotaWindows && quotaWindows.length > 0) {
      const hasHighUsage = quotaWindows.some(w => w.usedPercent != null && w.usedPercent >= 90);
      if (hasHighUsage) return "rate_limited";
      // If quota windows respond, the provider is connected
      return "connected";
    }

    // For adapters that don't support quota, infer from existence
    if (meta) {
      // Free/local adapters are always "connected" if the CLI exists
      if (!meta.hasQuotaWindows) {
        // Check if adapter has test environment (all do)
        return "connected";
      }
    }

    return "unconfigured";
  }

  // ── Real-time CLI probes ───────────────────────────────────────────────────

  async function probeCli(command: string, args: string[], timeoutMs = 5000): Promise<string> {
    const { execFile } = await import("node:child_process");
    return new Promise((resolve) => {
      const proc = execFile(command, args, { timeout: timeoutMs, env: { ...process.env } }, (err, stdout) => {
        resolve(stdout?.trim() ?? "");
      });
      proc.on("error", () => resolve(""));
    });
  }

  async function probeProviderDetails(adapterType: string): Promise<ProviderLiveDetails | null> {
    try {
      switch (adapterType) {
        case "claude_local": {
          const version = await probeCli("claude", ["--version"]);
          return {
            cliVersion: version || null,
            authenticatedUser: null, // Claude doesn't expose this easily
            defaultModel: null, // Derived from quota response
            availableModels: [],
            billingType: process.env.ANTHROPIC_API_KEY ? "api" : "subscription",
            authCommand: "claude login",
          };
        }
        case "copilot_local": {
          const [version, ghAuth] = await Promise.all([
            probeCli("copilot", ["--version"]),
            probeCli("gh", ["auth", "status"]),
          ]);
          // Parse gh auth status for username
          const userMatch = ghAuth.match(/account\s+(\S+)/);
          const user = userMatch?.[1] ?? null;
          return {
            cliVersion: version ? version.split("\n")[0] : null,
            authenticatedUser: user,
            defaultModel: "gpt-4.1",
            availableModels: ["gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o3", "o4-mini"],
            billingType: "subscription",
            authCommand: "gh auth login",
          };
        }
        case "codex_local": {
          const version = await probeCli("codex", ["--version"]);
          return {
            cliVersion: version || null,
            authenticatedUser: null,
            defaultModel: "o3",
            availableModels: [],
            billingType: process.env.OPENAI_API_KEY ? "api" : "subscription",
            authCommand: "codex auth",
          };
        }
        case "opencode_local": {
          const [version, modelsRaw] = await Promise.all([
            probeCli("opencode", ["--version"]),
            probeCli("opencode", ["models"]),
          ]);
          const models = modelsRaw.split("\n").filter(Boolean);
          return {
            cliVersion: version || null,
            authenticatedUser: null,
            defaultModel: models[0] ?? null,
            availableModels: models,
            billingType: "free",
            authCommand: null,
          };
        }
        case "gemini_local": {
          const version = await probeCli("gemini", ["--version"]);
          return {
            cliVersion: version || null,
            authenticatedUser: null,
            defaultModel: "gemini-2.5-pro",
            availableModels: ["gemini-2.5-pro", "gemini-2.5-flash"],
            billingType: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "api" : "subscription",
            authCommand: "gemini auth login",
          };
        }
        case "cursor": {
          const version = await probeCli("cursor", ["--version"]).catch(() => "");
          return {
            cliVersion: version || null,
            authenticatedUser: null,
            defaultModel: null,
            availableModels: [],
            billingType: "subscription",
            authCommand: version ? null : "cursor (install from cursor.com)",
          };
        }
        case "pi_local": {
          const version = await probeCli("pi", ["--version"]).catch(() => "");
          return {
            cliVersion: version || null,
            authenticatedUser: null,
            defaultModel: null,
            availableModels: [],
            billingType: "free",
            authCommand: null,
          };
        }
        default:
          return null;
      }
    } catch (err) {
      logger.debug({ err, adapterType }, "Provider probe failed");
      return null;
    }
  }

  // Cache for probed details (5 minute TTL)
  const probeCache = new Map<string, { data: ProviderLiveDetails | null; ts: number }>();
  const PROBE_CACHE_TTL = 5 * 60 * 1000;

  async function getCachedProbe(adapterType: string): Promise<ProviderLiveDetails | null> {
    const cached = probeCache.get(adapterType);
    if (cached && Date.now() - cached.ts < PROBE_CACHE_TTL) return cached.data;
    const data = await probeProviderDetails(adapterType);
    probeCache.set(adapterType, { data, ts: Date.now() });
    return data;
  }

  // ── Consolidated status ───────────────────────────────────────────────────

  async function getConsolidatedStatus(companyId: string): Promise<ProviderStatus[]> {
    // Kick off all data-fetching in parallel
    const adaptersToProbe = ["claude_local", "copilot_local", "codex_local", "opencode_local", "gemini_local", "cursor", "pi_local"];
    const [configs, quotaResults, monthlySpend, ...probeResults] = await Promise.all([
      listConfigs(companyId),
      fetchAllQuotaWindows().catch((err: unknown) => {
        logger.warn({ err }, "Failed to fetch quota windows for consolidated status");
        return [] as ProviderQuotaResult[];
      }),
      getMonthlySpendByProvider(companyId),
      ...adaptersToProbe.map(at => getCachedProbe(at)),
    ]);
    // Build probe map
    const probeMap = new Map<string, ProviderLiveDetails | null>();
    adaptersToProbe.forEach((at, i) => probeMap.set(at, probeResults[i] ?? null));

    // Index configs by adapter type
    const configByAdapter = new Map<string, ProviderConfig>();
    for (const cfg of configs) {
      configByAdapter.set(cfg.adapterType, cfg);
    }

    // Index quota results by provider slug → QuotaWindow[]
    const quotaByProvider = new Map<string, QuotaWindow[]>();
    for (const qr of quotaResults) {
      if (qr.ok) {
        quotaByProvider.set(qr.provider, qr.windows);
      }
    }

    // Build circuit breaker snapshot indexed by adapter type
    const breakerSnapshot = circuitBreaker.snapshot();
    const breakersByAdapter = new Map<string, Record<string, ProviderBreakerInfo>>();
    for (const [key, entry] of breakerSnapshot) {
      const [adapterType] = key.split(":");
      if (!adapterType) continue;
      if (!breakersByAdapter.has(adapterType)) {
        breakersByAdapter.set(adapterType, {});
      }
      breakersByAdapter.get(adapterType)![key] = {
        state: entry.state,
        tripCount: entry.tripCount,
        failureCount: entry.failureCount,
      };
    }

    // Build synthetic quota info from live details for providers without native quota
    function buildSyntheticQuota(
      adapterType: string,
      liveDetails: ProviderLiveDetails | null,
      spendCents: number,
      config: ProviderConfig | undefined,
    ): QuotaWindow[] | null {
      const windows: QuotaWindow[] = [];
      // If provider has subscription limit configured, show usage
      if (config?.subscriptionLimitMonthly && config.subscriptionLimitMonthly > 0) {
        const pct = Math.min(100, Math.round((spendCents / config.subscriptionLimitMonthly) * 100));
        windows.push({
          label: "Monthly budget",
          usedPercent: pct,
          resetsAt: config.subscriptionResetsAt?.toISOString() ?? null,
          valueLabel: `$${(spendCents / 100).toFixed(2)} / $${(config.subscriptionLimitMonthly / 100).toFixed(2)}`,
          detail: null,
        });
      }
      // Show billing type info
      if (liveDetails?.billingType) {
        const billingLabel = liveDetails.billingType === "subscription" ? "Subscription" :
          liveDetails.billingType === "free" ? "Free tier" :
          liveDetails.billingType === "api" ? "Pay-per-use API" : liveDetails.billingType;
        windows.push({
          label: "Billing",
          usedPercent: null,
          resetsAt: null,
          valueLabel: billingLabel,
          detail: liveDetails.authenticatedUser ? `Account: ${liveDetails.authenticatedUser}` : null,
        });
      }
      // Show model count
      if (liveDetails?.availableModels && liveDetails.availableModels.length > 0) {
        windows.push({
          label: "Available models",
          usedPercent: null,
          resetsAt: null,
          valueLabel: `${liveDetails.availableModels.length} model(s)`,
          detail: liveDetails.availableModels.slice(0, 5).join(", ") + (liveDetails.availableModels.length > 5 ? ` (+${liveDetails.availableModels.length - 5} more)` : ""),
        });
      }
      return windows.length > 0 ? windows : null;
    }

    // Build the list for ALL known adapter types
    const statuses: ProviderStatus[] = [];

    for (const adapterType of AGENT_ADAPTER_TYPES) {
      const config = configByAdapter.get(adapterType);
      const meta = adapterMetaMap.get(adapterType) ?? null;

      // Resolve quota windows — native API first, then synthetic from live details
      const providerSlug = adapterTypeToProviderSlug(adapterType);
      const nativeQuota = quotaByProvider.get(providerSlug) ?? null;
      const liveDetails = probeMap.get(adapterType) ?? null;
      const spendCents = monthlySpend.get(adapterType) ?? 0;
      const syntheticQuota = !nativeQuota ? buildSyntheticQuota(adapterType, liveDetails, spendCents, config) : null;
      const quotaWindows = nativeQuota ?? syntheticQuota;

      // Models from registry
      const registryModels = modelRegistry
        .listModels({ adapterType })
        .map((m) => ({ id: m.id, displayName: m.displayName, tier: m.tier }));

      const adapterBreakers = breakersByAdapter.get(adapterType) ?? {};
      const connectionStatus = deriveConnectionStatus(adapterType, config, quotaWindows, adapterBreakers, meta);

      statuses.push({
        adapterType,
        displayName: config?.displayName ?? ADAPTER_DISPLAY_NAMES[adapterType] ?? adapterType,
        configured: config != null,
        enabled: config?.enabled ?? (connectionStatus === "connected" || connectionStatus === "rate_limited"),
        priority: config?.priority ?? 0,
        connectionStatus,
        authMethod: config?.authMethod ?? null,
        subscriptionPlan: config?.subscriptionPlan ?? null,
        subscriptionLimitMonthly: config?.subscriptionLimitMonthly ?? null,
        subscriptionResetsAt: config?.subscriptionResetsAt?.toISOString() ?? null,
        lastHealthCheck: config?.lastHealthCheck?.toISOString() ?? null,
        lastHealthStatus: config?.lastHealthStatus ?? null,
        lastHealthDetail: config?.lastHealthDetail ?? null,
        adapterMeta: meta,
        quotaWindows,
        circuitBreakers: adapterBreakers,
        monthlySpendCents: monthlySpend.get(adapterType) ?? 0,
        models: registryModels,
        liveDetails: probeMap.get(adapterType) ?? null,
      });
    }

    return statuses;
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async function testConnection(
    companyId: string,
    adapterType: string,
  ): Promise<{ status: string; detail: string; latencyMs: number }> {
    const adapter = findServerAdapter(adapterType);
    if (!adapter || !adapter.testEnvironment) {
      return { status: "unsupported", detail: "Adapter does not support test environment", latencyMs: 0 };
    }

    const start = Date.now();
    try {
      const result = await adapter.testEnvironment({
        companyId,
        adapterType,
        config: {},
      });
      const latencyMs = Date.now() - start;
      const status = result.status === "pass" ? "ok" : "error";
      const detail =
        result.checks
          ?.map((c) => `[${c.level}] ${c.code}: ${c.message}`)
          .join("; ") ?? result.status;

      // Persist health data on the provider_config row
      await updateHealthOnConfig(companyId, adapterType, status, detail);
      // Also record an event
      await recordHealthEvent(companyId, adapterType, status, detail);

      return { status, detail, latencyMs };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const detail = err instanceof Error ? err.message : String(err);
      await updateHealthOnConfig(companyId, adapterType, "error", detail);
      await recordHealthEvent(companyId, adapterType, "error", detail);
      return { status: "error", detail, latencyMs };
    }
  }

  async function recordHealthEvent(
    companyId: string,
    adapterType: string,
    status: string,
    detail?: string,
  ): Promise<void> {
    await db.insert(providerHealthEvents).values({
      companyId,
      adapterType,
      status,
      detail: detail ?? null,
      occurredAt: new Date(),
    });
  }

  async function getHealthHistory(
    companyId: string,
    adapterType: string,
    limit = 50,
  ): Promise<ProviderHealthEvent[]> {
    const rows = await db
      .select()
      .from(providerHealthEvents)
      .where(
        and(
          eq(providerHealthEvents.companyId, companyId),
          eq(providerHealthEvents.adapterType, adapterType),
        ),
      )
      .orderBy(desc(providerHealthEvents.occurredAt))
      .limit(limit);
    return rows as ProviderHealthEvent[];
  }

  // ── Agent usage map ───────────────────────────────────────────────────────

  async function getAgentUsageMap(
    companyId: string,
  ): Promise<Record<string, { total: number; usingCompanyProvider: number; usingOverride: number }>> {
    // Count agents per adapter type, distinguishing those with a routing
    // policy override from those using the company default provider
    const rows = await db
      .select({
        adapterType: agents.adapterType,
        total: count(),
        hasRoutingPolicy: sql<number>`count(*) filter (where ${agents.routingPolicy} is not null)`,
      })
      .from(agents)
      .where(eq(agents.companyId, companyId))
      .groupBy(agents.adapterType);

    const result: Record<string, { total: number; usingCompanyProvider: number; usingOverride: number }> = {};
    for (const row of rows) {
      const totalCount = Number(row.total);
      const overrideCount = Number(row.hasRoutingPolicy);
      result[row.adapterType] = {
        total: totalCount,
        usingCompanyProvider: totalCount - overrideCount,
        usingOverride: overrideCount,
      };
    }
    return result;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  async function updateHealthOnConfig(
    companyId: string,
    adapterType: string,
    status: string,
    detail: string,
  ): Promise<void> {
    await db
      .update(providerConfigs)
      .set({
        lastHealthCheck: new Date(),
        lastHealthStatus: status,
        lastHealthDetail: detail,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(providerConfigs.companyId, companyId),
          eq(providerConfigs.adapterType, adapterType),
        ),
      );
  }

  async function getMonthlySpendByProvider(companyId: string): Promise<Map<string, number>> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = await db
      .select({
        provider: costEvents.provider,
        totalCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)`,
      })
      .from(costEvents)
      .where(
        and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, monthStart),
        ),
      )
      .groupBy(costEvents.provider);

    // The cost_events.provider values use provider slugs (e.g. "anthropic"),
    // we need to map them back to adapter types.
    const result = new Map<string, number>();
    for (const row of rows) {
      const adapterType = providerSlugToAdapterType(row.provider);
      const current = result.get(adapterType) ?? 0;
      result.set(adapterType, current + Number(row.totalCents));
    }
    return result;
  }

  // ── Exposed API ──────────────────────────────────────────────────────────

  return {
    listConfigs,
    getConfig,
    upsertConfig,
    deleteConfig,
    getConsolidatedStatus,
    testConnection,
    recordHealthEvent,
    getHealthHistory,
    getAgentUsageMap,
    /** Expose the circuit breaker for reset operations. */
    circuitBreaker,
  };
}

// ---------------------------------------------------------------------------
// Provider slug ↔ adapter type mapping
// ---------------------------------------------------------------------------

const ADAPTER_TO_PROVIDER_SLUG: Record<string, string> = {
  claude_local: "anthropic",
  codex_local: "openai",
  copilot_local: "github",
  cursor: "cursor",
  gemini_local: "google",
  opencode_local: "opencode",
  openclaw_gateway: "openclaw",
  pi_local: "pi",
  hermes_local: "hermes",
  process: "process",
  http: "http",
};

const PROVIDER_SLUG_TO_ADAPTER: Record<string, string> = Object.fromEntries(
  Object.entries(ADAPTER_TO_PROVIDER_SLUG).map(([k, v]) => [v, k]),
);

function adapterTypeToProviderSlug(adapterType: string): string {
  return ADAPTER_TO_PROVIDER_SLUG[adapterType] ?? adapterType;
}

function providerSlugToAdapterType(providerSlug: string): string {
  return PROVIDER_SLUG_TO_ADAPTER[providerSlug] ?? providerSlug;
}
