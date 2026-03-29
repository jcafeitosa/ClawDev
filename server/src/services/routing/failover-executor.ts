import type { ModelCapability, RoutingDecision } from "@clawdev/shared";
import type { CircuitBreaker } from "./circuit-breaker.js";
import type { ModelRegistry } from "./model-registry.js";
import { estimateRunCostUsd } from "./budget-checker.js";
import { logger } from "../../middleware/logger.js";

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Minimal interface for the result of an adapter execution.
 * This mirrors the shape returned by adapter execute functions without
 * importing the full adapter dependency.
 */
export interface ExecutionResult {
  exitCode: number | null;
  timedOut: boolean;
  /** Raw output / transcript (optional, for logging). */
  output?: string;
}

/**
 * An adapter execution function that the failover executor wraps.
 * The caller provides this — it is typically bound to a specific adapter
 * execute() call with the workspace / session context already applied.
 */
export type ExecuteFn = (
  adapterType: string,
  model: string,
) => Promise<ExecutionResult>;

/**
 * Callback invoked each time a routing decision is produced during failover.
 * The heartbeat service can use this to persist routing decisions to the DB.
 */
export type OnRoutingDecision = (decision: RoutingDecision) => void;

export interface FailoverExecutorDeps {
  circuitBreaker: CircuitBreaker;
  modelRegistry: ModelRegistry;
}

export interface FailoverOptions {
  /** Maximum number of failover retries (default: 2). */
  maxRetries: number;
  /** The primary routing decision that selected the first model. */
  primaryDecision: RoutingDecision;
  /** Ordered list of alternative models to try on failure. */
  fallbackModels: ModelCapability[];
  /** Estimated input tokens (for cost estimation in failover decisions). */
  estimatedInputTokens: number;
  /** Estimated output tokens (for cost estimation in failover decisions). */
  estimatedOutputTokens: number;
  /** Optional callback for each routing decision emitted. */
  onRoutingDecision?: OnRoutingDecision;
}

export interface FailoverResult {
  /** The execution result from the model that ultimately ran. */
  executionResult: ExecutionResult;
  /** The final routing decision (may be updated if failover occurred). */
  finalDecision: RoutingDecision;
  /** Total number of attempts (1 = no failover). */
  attempts: number;
}

// ── Failover executor ───────────────────────────────────────────────────────

export function createFailoverExecutor(deps: FailoverExecutorDeps) {
  const { circuitBreaker } = deps;

  return {
    /**
     * Execute with automatic failover on non-timeout failures.
     *
     * Flow:
     *   1. Run executeFn with the primary model.
     *   2. On failure (exitCode !== 0 AND not a timeout):
     *      a. Record failure in circuit breaker.
     *      b. Pick the next available fallback model.
     *      c. Emit a failover routing decision.
     *      d. Retry (up to maxRetries).
     *   3. On success, record success in circuit breaker.
     *   4. On timeout, do NOT retry (the process may still be running).
     */
    async execute(
      executeFn: ExecuteFn,
      options: FailoverOptions,
    ): Promise<FailoverResult> {
      const {
        maxRetries = 2,
        primaryDecision,
        fallbackModels,
        estimatedInputTokens,
        estimatedOutputTokens,
        onRoutingDecision,
      } = options;

      let currentDecision = primaryDecision;
      let currentAdapterType = primaryDecision.selectedAdapterType;
      let currentModel = primaryDecision.selectedModel;
      let attempts = 0;
      let fallbackIndex = 0;

      // Notify caller of the primary decision
      onRoutingDecision?.(currentDecision);

      while (attempts <= maxRetries) {
        attempts++;

        try {
          const result = await executeFn(currentAdapterType, currentModel);

          if (result.exitCode === 0 || result.exitCode === null) {
            // Success
            circuitBreaker.recordSuccess(currentAdapterType, currentModel);
            return {
              executionResult: result,
              finalDecision: currentDecision,
              attempts,
            };
          }

          // Timeout — do not retry
          if (result.timedOut) {
            logger.warn(
              { adapterType: currentAdapterType, model: currentModel },
              "routing/failover: execution timed out, not retrying",
            );
            circuitBreaker.recordFailure(currentAdapterType, currentModel);
            return {
              executionResult: result,
              finalDecision: currentDecision,
              attempts,
            };
          }

          // Non-zero exit, non-timeout — eligible for failover
          logger.warn(
            {
              adapterType: currentAdapterType,
              model: currentModel,
              exitCode: result.exitCode,
              attempt: attempts,
            },
            "routing/failover: execution failed, attempting failover",
          );

          circuitBreaker.recordFailure(currentAdapterType, currentModel);

          // Find next available fallback
          const nextModel = pickNextFallback(
            fallbackModels,
            fallbackIndex,
            circuitBreaker,
          );

          if (!nextModel) {
            logger.warn("routing/failover: no more fallback models available");
            return {
              executionResult: result,
              finalDecision: currentDecision,
              attempts,
            };
          }

          fallbackIndex = nextModel.nextIndex;

          // Build failover decision
          const failoverDecision = buildFailoverDecision(
            nextModel.model,
            currentDecision,
            estimatedInputTokens,
            estimatedOutputTokens,
            `Failover from ${currentAdapterType}:${currentModel} (exit code ${result.exitCode})`,
            attempts,
          );

          currentDecision = failoverDecision;
          currentAdapterType = nextModel.model.adapterType;
          currentModel = nextModel.model.id;

          onRoutingDecision?.(failoverDecision);
        } catch (err) {
          // Unexpected JS-level error (not an adapter exit code)
          logger.error(
            { err, adapterType: currentAdapterType, model: currentModel },
            "routing/failover: unexpected error during execution",
          );

          circuitBreaker.recordFailure(currentAdapterType, currentModel);

          const nextModel = pickNextFallback(
            fallbackModels,
            fallbackIndex,
            circuitBreaker,
          );

          if (!nextModel) {
            throw err; // re-throw if no fallbacks remain
          }

          fallbackIndex = nextModel.nextIndex;

          const failoverDecision = buildFailoverDecision(
            nextModel.model,
            currentDecision,
            estimatedInputTokens,
            estimatedOutputTokens,
            `Failover from ${currentAdapterType}:${currentModel} (error: ${(err as Error).message ?? "unknown"})`,
            attempts,
          );

          currentDecision = failoverDecision;
          currentAdapterType = nextModel.model.adapterType;
          currentModel = nextModel.model.id;

          onRoutingDecision?.(failoverDecision);
        }
      }

      // Exhausted retries — return last result as a synthetic failure
      return {
        executionResult: { exitCode: 1, timedOut: false },
        finalDecision: currentDecision,
        attempts,
      };
    },
  };
}

// ── Internal helpers ────────────────────────────────────────────────────────

function pickNextFallback(
  fallbacks: ModelCapability[],
  startIndex: number,
  cb: CircuitBreaker,
): { model: ModelCapability; nextIndex: number } | null {
  for (let i = startIndex; i < fallbacks.length; i++) {
    const m = fallbacks[i]!;
    if (cb.isAvailable(m.adapterType, m.id)) {
      return { model: m, nextIndex: i + 1 };
    }
  }
  return null;
}

function buildFailoverDecision(
  model: ModelCapability,
  previousDecision: RoutingDecision,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  failoverReason: string,
  attempt: number,
): RoutingDecision {
  const estimatedCostUsd = estimateRunCostUsd(
    estimatedInputTokens,
    estimatedOutputTokens,
    model,
  );

  return {
    selectedAdapterType: model.adapterType,
    selectedModel: model.id,
    tier: model.tier,
    reasoning: `Failover attempt ${attempt}: ${model.displayName}. ${failoverReason}`,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    complexityScore: previousDecision.complexityScore,
    alternativesConsidered: [],
    routingLatencyMs: 0,
    isFailover: true,
    failoverReason,
  };
}
