import type { ModelCapability } from "@clawdev/shared";

export interface BudgetCheckInput {
  /** Monthly budget limit in cents (from budget policy or agent config). */
  budgetMonthlyCents: number;
  /** Amount already spent this month in cents. */
  spentMonthlyCents: number;
  /** Estimated number of input tokens for this run. */
  estimatedInputTokens: number;
  /** Estimated number of output tokens for this run. */
  estimatedOutputTokens: number;
  /** The model being considered. */
  model: ModelCapability;
}

export interface BudgetCheckResult {
  /** Whether the estimated run cost fits within the remaining budget. */
  allowed: boolean;
  /** Remaining budget in USD after subtracting what has been spent. */
  remainingBudgetUsd: number;
  /** Estimated cost for this single run in USD. */
  estimatedCostUsd: number;
  /** How much of the monthly budget has been consumed (0–1). */
  utilizationRatio: number;
}

/**
 * Estimate the cost of a single run given token counts and model pricing.
 */
export function estimateRunCostUsd(
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
  model: ModelCapability,
): number {
  const inputCost = (estimatedInputTokens / 1000) * model.costPer1kInput;
  const outputCost = (estimatedOutputTokens / 1000) * model.costPer1kOutput;
  return inputCost + outputCost;
}

/**
 * Check whether a planned run fits within the available budget.
 *
 * This is a pre-routing check — it does not mutate any state.  The actual cost
 * event is recorded after execution completes (by the cost service).
 */
export function checkBudget(input: BudgetCheckInput): BudgetCheckResult {
  const budgetUsd = input.budgetMonthlyCents / 100;
  const spentUsd = input.spentMonthlyCents / 100;
  const remainingBudgetUsd = Math.max(budgetUsd - spentUsd, 0);

  const estimatedCostUsd = estimateRunCostUsd(
    input.estimatedInputTokens,
    input.estimatedOutputTokens,
    input.model,
  );

  const utilizationRatio = budgetUsd > 0 ? spentUsd / budgetUsd : 1;

  const allowed = estimatedCostUsd <= remainingBudgetUsd;

  return {
    allowed,
    remainingBudgetUsd: Math.round(remainingBudgetUsd * 10000) / 10000,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    utilizationRatio: Math.round(utilizationRatio * 10000) / 10000,
  };
}

/**
 * Convenience: check budget and return a human-readable denial reason if the
 * budget is insufficient.  Returns null when the run is allowed.
 */
export function budgetDenialReason(result: BudgetCheckResult): string | null {
  if (result.allowed) return null;
  return (
    `Budget exceeded: estimated run cost $${result.estimatedCostUsd.toFixed(4)} ` +
    `exceeds remaining budget $${result.remainingBudgetUsd.toFixed(4)} ` +
    `(${(result.utilizationRatio * 100).toFixed(1)}% of monthly budget used)`
  );
}
