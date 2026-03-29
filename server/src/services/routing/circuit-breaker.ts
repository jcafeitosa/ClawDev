/**
 * In-memory circuit breaker tracking failures per (adapterType, model).
 *
 * States:
 *   CLOSED    – normal operation, requests flow through
 *   OPEN      – too many failures, requests are rejected
 *   HALF_OPEN – cooldown expired, one probe request allowed
 *
 * Transitions:
 *   CLOSED  → OPEN       after `failureThreshold` consecutive failures within
 *                         `failureWindowMs`
 *   OPEN    → HALF_OPEN  after `cooldownMs` elapsed
 *   HALF_OPEN → CLOSED   on first success
 *   HALF_OPEN → OPEN     on first failure (resets cooldown timer)
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface BreakerEntry {
  state: CircuitState;
  /** Timestamps (epoch ms) of consecutive failures. */
  failures: number[];
  /** When the circuit was opened (epoch ms), used to compute cooldown. */
  openedAt: number;
  /** Total number of times this breaker has tripped since process start. */
  tripCount: number;
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures to trip the breaker.  Default: 3 */
  failureThreshold: number;
  /** Window (ms) in which failures must occur to count.  Default: 5 min */
  failureWindowMs: number;
  /** How long (ms) the breaker stays open before half-opening.  Default: 2 min */
  cooldownMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  failureWindowMs: 5 * 60 * 1000,
  cooldownMs: 2 * 60 * 1000,
};

export interface CircuitBreaker {
  /** Get the current logical state (accounts for cooldown transitions). */
  getState(adapterType: string, modelId: string): CircuitState;
  /** Report a successful execution — may close a half-open breaker. */
  recordSuccess(adapterType: string, modelId: string): void;
  /** Report a failed execution — may trip the breaker. */
  recordFailure(adapterType: string, modelId: string): void;
  /** Check if a model is available (CLOSED or HALF_OPEN). */
  isAvailable(adapterType: string, modelId: string): boolean;
  /** Reset a specific breaker (e.g. on manual admin action). */
  reset(adapterType: string, modelId: string): void;
  /** Reset all breakers. */
  resetAll(): void;
  /** Return a snapshot of all tracked entries (for diagnostics). */
  snapshot(): Map<string, { state: CircuitState; tripCount: number; failureCount: number }>;
}

function entryKey(adapterType: string, modelId: string): string {
  return `${adapterType}:${modelId}`;
}

export function createCircuitBreaker(
  config: Partial<CircuitBreakerConfig> = {},
): CircuitBreaker {
  const cfg: CircuitBreakerConfig = { ...DEFAULT_CONFIG, ...config };
  const entries = new Map<string, BreakerEntry>();

  function getOrCreate(key: string): BreakerEntry {
    let entry = entries.get(key);
    if (!entry) {
      entry = { state: "CLOSED", failures: [], openedAt: 0, tripCount: 0 };
      entries.set(key, entry);
    }
    return entry;
  }

  /**
   * Resolve the effective state: if the breaker is OPEN and the cooldown has
   * elapsed, transition to HALF_OPEN.
   */
  function resolveState(entry: BreakerEntry, now: number): CircuitState {
    if (entry.state === "OPEN" && now - entry.openedAt >= cfg.cooldownMs) {
      entry.state = "HALF_OPEN";
    }
    return entry.state;
  }

  /**
   * Prune failure timestamps outside the rolling window.
   */
  function pruneFailures(entry: BreakerEntry, now: number): void {
    const cutoff = now - cfg.failureWindowMs;
    entry.failures = entry.failures.filter((ts) => ts >= cutoff);
  }

  return {
    getState(adapterType: string, modelId: string): CircuitState {
      const key = entryKey(adapterType, modelId);
      const entry = getOrCreate(key);
      return resolveState(entry, Date.now());
    },

    recordSuccess(adapterType: string, modelId: string): void {
      const key = entryKey(adapterType, modelId);
      const entry = getOrCreate(key);
      const now = Date.now();
      resolveState(entry, now);

      if (entry.state === "HALF_OPEN") {
        // Probe succeeded — close the breaker
        entry.state = "CLOSED";
        entry.failures = [];
      } else if (entry.state === "CLOSED") {
        // Clear accumulated failures on success
        entry.failures = [];
      }
      // If somehow called while OPEN, ignore (shouldn't route here)
    },

    recordFailure(adapterType: string, modelId: string): void {
      const key = entryKey(adapterType, modelId);
      const entry = getOrCreate(key);
      const now = Date.now();
      resolveState(entry, now);

      if (entry.state === "HALF_OPEN") {
        // Probe failed — re-open the breaker
        entry.state = "OPEN";
        entry.openedAt = now;
        entry.tripCount++;
        return;
      }

      if (entry.state === "CLOSED") {
        pruneFailures(entry, now);
        entry.failures.push(now);

        if (entry.failures.length >= cfg.failureThreshold) {
          entry.state = "OPEN";
          entry.openedAt = now;
          entry.tripCount++;
        }
      }
      // If OPEN, additional failures are no-ops (already tripped)
    },

    isAvailable(adapterType: string, modelId: string): boolean {
      const state = this.getState(adapterType, modelId);
      return state !== "OPEN";
    },

    reset(adapterType: string, modelId: string): void {
      entries.delete(entryKey(adapterType, modelId));
    },

    resetAll(): void {
      entries.clear();
    },

    snapshot(): Map<string, { state: CircuitState; tripCount: number; failureCount: number }> {
      const now = Date.now();
      const result = new Map<string, { state: CircuitState; tripCount: number; failureCount: number }>();
      for (const [key, entry] of entries) {
        resolveState(entry, now);
        result.set(key, {
          state: entry.state,
          tripCount: entry.tripCount,
          failureCount: entry.failures.length,
        });
      }
      return result;
    },
  };
}
