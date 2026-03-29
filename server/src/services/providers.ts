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

export interface ProviderStatus {
  adapterType: string;
  displayName: string;
  configured: boolean;
  enabled: boolean;
  priority: number;
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

  // ── Consolidated status ───────────────────────────────────────────────────

  async function getConsolidatedStatus(companyId: string): Promise<ProviderStatus[]> {
    // Kick off all data-fetching in parallel
    const [configs, quotaResults, monthlySpend] = await Promise.all([
      listConfigs(companyId),
      fetchAllQuotaWindows().catch((err: unknown) => {
        logger.warn({ err }, "Failed to fetch quota windows for consolidated status");
        return [] as ProviderQuotaResult[];
      }),
      getMonthlySpendByProvider(companyId),
    ]);

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

    // Build the list for ALL known adapter types
    const statuses: ProviderStatus[] = [];

    for (const adapterType of AGENT_ADAPTER_TYPES) {
      const config = configByAdapter.get(adapterType);
      const meta = adapterMetaMap.get(adapterType) ?? null;

      // Resolve quota windows — map adapter type to provider slug
      const providerSlug = adapterTypeToProviderSlug(adapterType);
      const quotaWindows = quotaByProvider.get(providerSlug) ?? null;

      // Models from registry
      const registryModels = modelRegistry
        .listModels({ adapterType })
        .map((m) => ({ id: m.id, displayName: m.displayName, tier: m.tier }));

      statuses.push({
        adapterType,
        displayName: config?.displayName ?? ADAPTER_DISPLAY_NAMES[adapterType] ?? adapterType,
        configured: config != null,
        enabled: config?.enabled ?? false,
        priority: config?.priority ?? 0,
        authMethod: config?.authMethod ?? null,
        subscriptionPlan: config?.subscriptionPlan ?? null,
        subscriptionLimitMonthly: config?.subscriptionLimitMonthly ?? null,
        subscriptionResetsAt: config?.subscriptionResetsAt?.toISOString() ?? null,
        lastHealthCheck: config?.lastHealthCheck?.toISOString() ?? null,
        lastHealthStatus: config?.lastHealthStatus ?? null,
        lastHealthDetail: config?.lastHealthDetail ?? null,
        adapterMeta: meta,
        quotaWindows,
        circuitBreakers: breakersByAdapter.get(adapterType) ?? {},
        monthlySpendCents: monthlySpend.get(adapterType) ?? 0,
        models: registryModels,
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
