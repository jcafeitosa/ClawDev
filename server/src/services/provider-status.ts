import { and, eq, lt, sql, inArray } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { modelCatalog, providerModelStatus } from "@clawdev/db";

/**
 * Exponential moving average smoothing factor.
 * 0.3 gives roughly 70% weight to the existing average, 30% to the new sample.
 */
const EMA_ALPHA = 0.3;

// ---------------------------------------------------------------------------
// Configurable cooldown durations per adapter type (in minutes)
// ---------------------------------------------------------------------------

const DEFAULT_COOLDOWN_MINUTES: Record<string, number> = {
  claude_local: 5,
  codex_local: 10,
  copilot_local: 5,
  gemini_local: 5,
  pi_local: 5,
  opencode_local: 5,
  cursor: 5,
  openclaw_gateway: 15,
};

/**
 * Returns the cooldown duration in milliseconds for a given adapter type.
 * Falls back to 5 minutes if the adapter type is not in the map.
 */
export function getCooldownDuration(adapterType: string): number {
  return (DEFAULT_COOLDOWN_MINUTES[adapterType] ?? 5) * 60 * 1000;
}

export interface ProviderStatusScope {
  companyId?: string | null;
  authProfileKey?: string | null;
}

function buildScopeKey(scope?: ProviderStatusScope): string {
  if (scope?.companyId && scope?.authProfileKey) {
    return `profile:${scope.companyId}:${scope.authProfileKey}`;
  }
  if (scope?.companyId) {
    return `company:${scope.companyId}`;
  }
  return "global";
}

function normalizeScope(scope?: ProviderStatusScope) {
  const companyId = scope?.companyId?.trim() || null;
  const authProfileKey = companyId ? scope?.authProfileKey?.trim() || null : null;
  return {
    companyId,
    authProfileKey,
    scopeKey: buildScopeKey({ companyId, authProfileKey }),
  };
}

function buildScopePrecedence(scope?: ProviderStatusScope): string[] {
  const normalized = normalizeScope(scope);
  const keys = [
    normalized.authProfileKey && normalized.companyId
      ? buildScopeKey({ companyId: normalized.companyId, authProfileKey: normalized.authProfileKey })
      : null,
    normalized.companyId
      ? buildScopeKey({ companyId: normalized.companyId })
      : null,
    "global",
  ].filter((value): value is string => Boolean(value));
  return [...new Set(keys)];
}

export function createProviderStatusService(db: Db) {
  async function loadRowForScope(
    adapterType: string,
    modelId: string,
    scopeKey: string,
  ) {
    const rows = await db
      .select()
      .from(providerModelStatus)
      .where(
        and(
          eq(providerModelStatus.adapterType, adapterType),
          eq(providerModelStatus.modelId, modelId),
          eq(providerModelStatus.scopeKey, scopeKey),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  return {
    /**
     * Upsert model status. When the status value changes, `statusChangedAt` is bumped.
     */
    async updateStatus(
      adapterType: string,
      modelId: string,
      status: string,
      detail?: string,
      scope?: ProviderStatusScope,
    ): Promise<void> {
      const normalizedScope = normalizeScope(scope);
      await db
        .insert(providerModelStatus)
        .values({
          adapterType,
          modelId,
          companyId: normalizedScope.companyId,
          authProfileKey: normalizedScope.authProfileKey,
          scopeKey: normalizedScope.scopeKey,
          status,
          statusDetail: detail ?? null,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            providerModelStatus.adapterType,
            providerModelStatus.modelId,
            providerModelStatus.scopeKey,
          ],
          set: {
            companyId: normalizedScope.companyId,
            authProfileKey: normalizedScope.authProfileKey,
            status,
            statusDetail: detail ?? null,
            // Only bump statusChangedAt when the status actually changes
            statusChangedAt: sql`
              CASE WHEN ${providerModelStatus.status} <> ${status}
                THEN now()
                ELSE ${providerModelStatus.statusChangedAt}
              END
            `,
            updatedAt: new Date(),
          },
        });
    },

    /**
     * Place a model into cooldown until a specified time.
     * If `until` is omitted, the configurable default duration for the adapter type is used.
     */
    async markCooldown(
      adapterType: string,
      modelId: string,
      until?: Date,
      reason?: string,
      scope?: ProviderStatusScope,
    ): Promise<void> {
      const normalizedScope = normalizeScope(scope);
      const cooldownUntil = until ?? new Date(Date.now() + getCooldownDuration(adapterType));
      const cooldownReason = reason ?? "cooldown";
      await db
        .insert(providerModelStatus)
        .values({
          adapterType,
          modelId,
          companyId: normalizedScope.companyId,
          authProfileKey: normalizedScope.authProfileKey,
          scopeKey: normalizedScope.scopeKey,
          status: "cooldown",
          cooldownUntil,
          cooldownReason,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            providerModelStatus.adapterType,
            providerModelStatus.modelId,
            providerModelStatus.scopeKey,
          ],
          set: {
            companyId: normalizedScope.companyId,
            authProfileKey: normalizedScope.authProfileKey,
            status: "cooldown",
            cooldownUntil,
            cooldownReason,
            statusChangedAt: sql`
              CASE WHEN ${providerModelStatus.status} <> 'cooldown'
                THEN now()
                ELSE ${providerModelStatus.statusChangedAt}
              END
            `,
            updatedAt: new Date(),
          },
        });
    },

    /**
     * Transition all expired cooldowns back to "available".
     * Returns the number of rows updated.
     */
    async clearExpiredCooldowns(): Promise<number> {
      const result = await db
        .update(providerModelStatus)
        .set({
          status: "available",
          cooldownUntil: null,
          cooldownReason: null,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerModelStatus.status, "cooldown"),
            lt(providerModelStatus.cooldownUntil, new Date()),
          ),
        )
        .returning({ id: providerModelStatus.id });

      return result.length;
    },

    async clearExpiredCooldownsForScope(scope?: ProviderStatusScope): Promise<number> {
      const normalizedScope = normalizeScope(scope);
      const result = await db
        .update(providerModelStatus)
        .set({
          status: "available",
          cooldownUntil: null,
          cooldownReason: null,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerModelStatus.status, "cooldown"),
            lt(providerModelStatus.cooldownUntil, new Date()),
            eq(providerModelStatus.scopeKey, normalizedScope.scopeKey),
          ),
        )
        .returning({ id: providerModelStatus.id });

      return result.length;
    },

    /**
     * Check whether a model is available for routing.
     * A model is available only if its status is "available"
     * AND it is not currently in an active cooldown window.
     *
     * If the row has status "cooldown" but cooldownUntil has passed,
     * it is automatically cleared inline and treated as available.
     */
    async isAvailable(
      adapterType: string,
      modelId: string,
      scope?: ProviderStatusScope,
    ): Promise<boolean> {
      for (const scopeKey of buildScopePrecedence(scope)) {
        const row = await loadRowForScope(adapterType, modelId, scopeKey);
        if (!row) continue;

        if (
          row.status === "available" &&
          (!row.cooldownUntil || row.cooldownUntil < new Date())
        ) {
          return true;
        }

        if (
          row.status === "cooldown" &&
          row.cooldownUntil &&
          row.cooldownUntil < new Date()
        ) {
          await db
            .update(providerModelStatus)
            .set({
              status: "available",
              cooldownUntil: null,
              cooldownReason: null,
              statusChangedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(providerModelStatus.id, row.id));
          return true;
        }

        return false;
      }

      return false;
    },

    /**
     * Return all models with status "available" that are not in cooldown.
     * Optionally filter by adapter type.
     */
    async listEffectiveStatuses(
      scope?: ProviderStatusScope,
      adapterType?: string,
    ): Promise<typeof providerModelStatus.$inferSelect[]> {
      const scopeKeys = buildScopePrecedence(scope);
      const conditions = [inArray(providerModelStatus.scopeKey, scopeKeys)];

      if (adapterType) {
        conditions.push(eq(providerModelStatus.adapterType, adapterType));
      }

      const rows = await db
        .select()
        .from(providerModelStatus)
        .where(and(...conditions));

      const scopeOrder = new Map(scopeKeys.map((scopeKey, index) => [scopeKey, index] as const));
      const effective = new Map<string, typeof rows[number]>();

      for (const row of rows.sort((a, b) => {
        const scopeA = scopeOrder.get(a.scopeKey) ?? Number.MAX_SAFE_INTEGER;
        const scopeB = scopeOrder.get(b.scopeKey) ?? Number.MAX_SAFE_INTEGER;
        if (scopeA !== scopeB) return scopeA - scopeB;
        return (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0);
      })) {
        const key = `${row.adapterType}::${row.modelId}`;
        if (!effective.has(key)) {
          effective.set(key, row);
        }
      }

      return Array.from(effective.values());
    },

    async getAvailableModels(
      adapterType?: string,
      scope?: ProviderStatusScope,
    ): Promise<
      Array<{
        adapterType: string;
        modelId: string;
        status: string;
        avgLatencyMs: number | null;
      }>
    > {
      const rows = await this.listEffectiveStatuses(scope, adapterType);
      return rows
        .filter((row) =>
          row.status === "available" &&
          (!row.cooldownUntil || row.cooldownUntil < new Date()),
        )
        .map((row) => ({
          adapterType: row.adapterType,
          modelId: row.modelId,
          status: row.status,
          avgLatencyMs: row.avgLatencyMs,
        }));
    },

    /**
     * Record the result of a health probe for a model.
     * On success: reset consecutive failures, update latency EMA.
     * On failure: increment consecutive failures.
     */
    async recordProbeResult(
      adapterType: string,
      modelId: string,
      success: boolean,
      latencyMs?: number,
      scope?: ProviderStatusScope,
    ): Promise<void> {
      const now = new Date();
      const probeStatus = success ? "ok" : "fail";
      const normalizedScope = normalizeScope(scope);

      if (success) {
        // Upsert with success: reset failures, update latency EMA
        await db
          .insert(providerModelStatus)
          .values({
            adapterType,
            modelId,
            companyId: normalizedScope.companyId,
            authProfileKey: normalizedScope.authProfileKey,
            scopeKey: normalizedScope.scopeKey,
            status: "available",
            lastProbeStatus: probeStatus,
            lastProbeAt: now,
            consecutiveFailures: 0,
            avgLatencyMs: latencyMs ?? null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              providerModelStatus.adapterType,
              providerModelStatus.modelId,
              providerModelStatus.scopeKey,
            ],
            set: {
              companyId: normalizedScope.companyId,
              authProfileKey: normalizedScope.authProfileKey,
              lastProbeStatus: probeStatus,
              lastProbeAt: now,
              consecutiveFailures: 0,
              // Exponential moving average: new = alpha * sample + (1 - alpha) * old
              avgLatencyMs:
                latencyMs != null
                  ? sql<number>`
                      CASE
                        WHEN ${providerModelStatus.avgLatencyMs} IS NULL THEN ${latencyMs}
                        ELSE ROUND(${EMA_ALPHA} * ${latencyMs} + ${1 - EMA_ALPHA} * ${providerModelStatus.avgLatencyMs})::int
                      END
                    `
                  : providerModelStatus.avgLatencyMs,
              updatedAt: now,
            },
          });
      } else {
        // Upsert with failure: increment failures
        await db
          .insert(providerModelStatus)
          .values({
            adapterType,
            modelId,
            companyId: normalizedScope.companyId,
            authProfileKey: normalizedScope.authProfileKey,
            scopeKey: normalizedScope.scopeKey,
            status: "unknown",
            lastProbeStatus: probeStatus,
            lastProbeAt: now,
            consecutiveFailures: 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              providerModelStatus.adapterType,
              providerModelStatus.modelId,
              providerModelStatus.scopeKey,
            ],
            set: {
              companyId: normalizedScope.companyId,
              authProfileKey: normalizedScope.authProfileKey,
              lastProbeStatus: probeStatus,
              lastProbeAt: now,
              consecutiveFailures: sql`${providerModelStatus.consecutiveFailures} + 1`,
              updatedAt: now,
            },
          });
      }
    },

    /**
     * Inspect an execution error and, if it indicates rate limiting or quota
     * exhaustion, automatically place the model into cooldown using the
     * adapter-specific default duration.
     */
    async handleExecutionError(
      adapterType: string,
      modelId: string,
      errorCode?: string | null,
      errorMessage?: string | null,
      scope?: ProviderStatusScope,
    ): Promise<void> {
      const isRateLimited =
        errorCode === "quota_exceeded" ||
        errorCode === "rate_limited" ||
        errorMessage?.includes("429") ||
        errorMessage?.includes("rate limit") ||
        errorMessage?.includes("quota") ||
        errorMessage?.includes("Too Many Requests");

      if (isRateLimited) {
        const duration = getCooldownDuration(adapterType);
        const until = new Date(Date.now() + duration);
        await this.markCooldown(adapterType, modelId, until, errorCode || "rate_limited", scope);
      }
    },

    /**
     * Aggregate status counts per provider (adapter type).
     */
    async getProviderSummary(scope?: ProviderStatusScope): Promise<
      Array<{
        provider: string;
        total: number;
        free: number;
        available: number;
        cooldown: number;
        unavailable: number;
      }>
    > {
      const [statusRows, catalogRows] = await Promise.all([
        this.listEffectiveStatuses(scope),
        db
          .select({
            adapterType: modelCatalog.adapterType,
            modelId: modelCatalog.modelId,
            isFree: modelCatalog.isFree,
          })
          .from(modelCatalog),
      ]);

      const catalogFreeSet = new Set(
        catalogRows
          .filter((row) => Boolean(row.isFree))
          .map((row) => `${row.adapterType}::${row.modelId}`),
      );

      const summaryByAdapter = new Map<
        string,
        { provider: string; total: number; free: number; available: number; cooldown: number; unavailable: number }
      >();

      for (const row of statusRows) {
        const current = summaryByAdapter.get(row.adapterType) ?? {
          provider: row.adapterType,
          total: 0,
          free: 0,
          available: 0,
          cooldown: 0,
          unavailable: 0,
        };
        current.total += 1;
        if (catalogFreeSet.has(`${row.adapterType}::${row.modelId}`)) current.free += 1;
        if (row.status === "available") current.available += 1;
        else if (row.status === "cooldown") current.cooldown += 1;
        else current.unavailable += 1;
        summaryByAdapter.set(row.adapterType, current);
      }

      return Array.from(summaryByAdapter.values());
    },
  };
}
