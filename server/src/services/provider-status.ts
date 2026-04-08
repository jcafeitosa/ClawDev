import { and, eq, lt, sql, isNull, or, inArray } from "drizzle-orm";
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

export function createProviderStatusService(db: Db) {
  return {
    /**
     * Upsert model status. When the status value changes, `statusChangedAt` is bumped.
     */
    async updateStatus(
      adapterType: string,
      modelId: string,
      status: string,
      detail?: string,
    ): Promise<void> {
      await db
        .insert(providerModelStatus)
        .values({
          adapterType,
          modelId,
          status,
          statusDetail: detail ?? null,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [providerModelStatus.adapterType, providerModelStatus.modelId],
          set: {
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
    ): Promise<void> {
      const cooldownUntil = until ?? new Date(Date.now() + getCooldownDuration(adapterType));
      const cooldownReason = reason ?? "cooldown";
      await db
        .insert(providerModelStatus)
        .values({
          adapterType,
          modelId,
          status: "cooldown",
          cooldownUntil,
          cooldownReason,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [providerModelStatus.adapterType, providerModelStatus.modelId],
          set: {
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

    /**
     * Check whether a model is available for routing.
     * A model is available only if its status is "available"
     * AND it is not currently in an active cooldown window.
     *
     * If the row has status "cooldown" but cooldownUntil has passed,
     * it is automatically cleared inline and treated as available.
     */
    async isAvailable(adapterType: string, modelId: string): Promise<boolean> {
      const rows = await db
        .select({ id: providerModelStatus.id })
        .from(providerModelStatus)
        .where(
          and(
            eq(providerModelStatus.adapterType, adapterType),
            eq(providerModelStatus.modelId, modelId),
            eq(providerModelStatus.status, "available"),
            or(
              isNull(providerModelStatus.cooldownUntil),
              lt(providerModelStatus.cooldownUntil, new Date()),
            ),
          ),
        )
        .limit(1);

      // If there is no row at all the model has never been tracked — treat as available
      if (rows.length > 0) return true;

      const existsRows = await db
        .select({
          id: providerModelStatus.id,
          status: providerModelStatus.status,
          cooldownUntil: providerModelStatus.cooldownUntil,
        })
        .from(providerModelStatus)
        .where(
          and(
            eq(providerModelStatus.adapterType, adapterType),
            eq(providerModelStatus.modelId, modelId),
          ),
        )
        .limit(1);

      // No row in the table means the model is untracked — assume available
      if (existsRows.length === 0) return true;

      // Auto-clear expired cooldowns inline: if the row is in "cooldown" but
      // cooldownUntil has already passed, transition it to "available" and return true.
      const row = existsRows[0]!;
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
    },

    /**
     * Return all models with status "available" that are not in cooldown.
     * Optionally filter by adapter type.
     */
    async getAvailableModels(
      adapterType?: string,
    ): Promise<
      Array<{
        adapterType: string;
        modelId: string;
        status: string;
        avgLatencyMs: number | null;
      }>
    > {
      const conditions = [
        eq(providerModelStatus.status, "available"),
        or(
          isNull(providerModelStatus.cooldownUntil),
          lt(providerModelStatus.cooldownUntil, new Date()),
        ),
      ];

      if (adapterType) {
        conditions.push(eq(providerModelStatus.adapterType, adapterType));
      }

      return db
        .select({
          adapterType: providerModelStatus.adapterType,
          modelId: providerModelStatus.modelId,
          status: providerModelStatus.status,
          avgLatencyMs: providerModelStatus.avgLatencyMs,
        })
        .from(providerModelStatus)
        .where(and(...conditions));
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
    ): Promise<void> {
      const now = new Date();
      const probeStatus = success ? "ok" : "fail";

      if (success) {
        // Upsert with success: reset failures, update latency EMA
        await db
          .insert(providerModelStatus)
          .values({
            adapterType,
            modelId,
            status: "available",
            lastProbeStatus: probeStatus,
            lastProbeAt: now,
            consecutiveFailures: 0,
            avgLatencyMs: latencyMs ?? null,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [providerModelStatus.adapterType, providerModelStatus.modelId],
            set: {
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
            status: "unknown",
            lastProbeStatus: probeStatus,
            lastProbeAt: now,
            consecutiveFailures: 1,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [providerModelStatus.adapterType, providerModelStatus.modelId],
            set: {
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
        await this.markCooldown(adapterType, modelId, until, errorCode || "rate_limited");
      }
    },

    /**
     * Aggregate status counts per provider (adapter type).
     */
    async getProviderSummary(): Promise<
      Array<{
        provider: string;
        total: number;
        free: number;
        available: number;
        cooldown: number;
        unavailable: number;
      }>
    > {
      return db
        .select({
          provider: providerModelStatus.adapterType,
          total: sql<number>`count(*)::int`,
          free: sql<number>`
            count(*) FILTER (
              WHERE EXISTS (
                SELECT 1
                FROM ${modelCatalog} mc
                WHERE mc.adapter_type = ${providerModelStatus.adapterType}
                  AND mc.model_id = ${providerModelStatus.modelId}
                  AND mc.is_free = true
              )
            )::int
          `,
          available: sql<number>`count(*) FILTER (WHERE ${providerModelStatus.status} = 'available')::int`,
          cooldown: sql<number>`count(*) FILTER (WHERE ${providerModelStatus.status} = 'cooldown')::int`,
          unavailable: sql<number>`count(*) FILTER (WHERE ${providerModelStatus.status} IN ('unknown', 'unavailable', 'degraded', 'quota_exceeded', 'auth_required'))::int`,
        })
        .from(providerModelStatus)
        .groupBy(providerModelStatus.adapterType);
    },
  };
}
