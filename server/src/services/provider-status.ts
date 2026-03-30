import { and, eq, lt, sql, isNull, or, inArray } from "drizzle-orm";
import type { Db } from "@clawdev/db";
import { providerModelStatus } from "@clawdev/db";

/**
 * Exponential moving average smoothing factor.
 * 0.3 gives roughly 70% weight to the existing average, 30% to the new sample.
 */
const EMA_ALPHA = 0.3;

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
     */
    async markCooldown(
      adapterType: string,
      modelId: string,
      until: Date,
      reason: string,
    ): Promise<void> {
      await db
        .insert(providerModelStatus)
        .values({
          adapterType,
          modelId,
          status: "cooldown",
          cooldownUntil: until,
          cooldownReason: reason,
          statusChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [providerModelStatus.adapterType, providerModelStatus.modelId],
          set: {
            status: "cooldown",
            cooldownUntil: until,
            cooldownReason: reason,
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
     * A model is available if its status is "available" or "unknown"
     * AND it is not currently in an active cooldown window.
     */
    async isAvailable(adapterType: string, modelId: string): Promise<boolean> {
      const rows = await db
        .select({ id: providerModelStatus.id })
        .from(providerModelStatus)
        .where(
          and(
            eq(providerModelStatus.adapterType, adapterType),
            eq(providerModelStatus.modelId, modelId),
            inArray(providerModelStatus.status, ["available", "unknown"]),
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
        .select({ id: providerModelStatus.id })
        .from(providerModelStatus)
        .where(
          and(
            eq(providerModelStatus.adapterType, adapterType),
            eq(providerModelStatus.modelId, modelId),
          ),
        )
        .limit(1);

      // No row in the table means the model is untracked — assume available
      return existsRows.length === 0;
    },

    /**
     * Return all models with status "available" or "unknown" that are not in cooldown.
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
        inArray(providerModelStatus.status, ["available", "unknown"]),
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
     * Aggregate status counts per provider (adapter type).
     */
    async getProviderSummary(): Promise<
      Array<{
        provider: string;
        total: number;
        available: number;
        cooldown: number;
        unavailable: number;
      }>
    > {
      return db
        .select({
          provider: providerModelStatus.adapterType,
          total: sql<number>`count(*)::int`,
          available: sql<number>`count(*) FILTER (WHERE ${providerModelStatus.status} IN ('available', 'unknown'))::int`,
          cooldown: sql<number>`count(*) FILTER (WHERE ${providerModelStatus.status} = 'cooldown')::int`,
          unavailable: sql<number>`count(*) FILTER (WHERE ${providerModelStatus.status} IN ('unavailable', 'degraded', 'quota_exceeded', 'auth_required'))::int`,
        })
        .from(providerModelStatus)
        .groupBy(providerModelStatus.adapterType);
    },
  };
}
