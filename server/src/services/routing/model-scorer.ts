import type { ModelCapability, RoutingConstraints, TaskSignals } from "@clawdev/shared";
import type { CircuitBreaker } from "./circuit-breaker.js";

export interface ScoredModel {
  model: ModelCapability;
  totalScore: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  costScore: number;
  capabilityScore: number;
  contextScore: number;
  tierScore: number;
  availabilityScore: number;
}

// ── Scoring factors ─────────────────────────────────────────────────────────

/**
 * Cost score: lower cost relative to the most expensive candidate yields a
 * higher score.  When qualityBias is 1.0 cost matters little; at 0.0 it
 * dominates.
 */
function computeCostScore(
  model: ModelCapability,
  allModels: ModelCapability[],
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): number {
  const estimatedCost =
    (estimatedInputTokens / 1000) * model.costPer1kInput +
    (estimatedOutputTokens / 1000) * model.costPer1kOutput;

  const maxCost = Math.max(
    ...allModels.map(
      (m) =>
        (estimatedInputTokens / 1000) * m.costPer1kInput +
        (estimatedOutputTokens / 1000) * m.costPer1kOutput,
    ),
  );

  if (maxCost === 0) return 1.0; // all free models
  return 1.0 - estimatedCost / maxCost;
}

/**
 * Capability match: fraction of required capabilities the model supports.
 */
function computeCapabilityScore(
  model: ModelCapability,
  requiredCapabilities: string[],
): number {
  if (requiredCapabilities.length === 0) return 1.0;
  const matched = requiredCapabilities.filter((c) =>
    model.capabilities.includes(c),
  ).length;
  return matched / requiredCapabilities.length;
}

/**
 * Context window adequacy: 1.0 if the window is >= estimated input tokens,
 * linearly degrading below that.
 */
function computeContextScore(
  model: ModelCapability,
  estimatedInputTokens: number,
): number {
  if (model.contextWindow >= estimatedInputTokens) return 1.0;
  return model.contextWindow / estimatedInputTokens;
}

/**
 * Tier alignment: perfect match = 1.0, one tier off = 0.6, two tiers off = 0.3.
 */
function computeTierScore(modelTier: number, taskTier: number): number {
  const diff = Math.abs(modelTier - taskTier);
  if (diff === 0) return 1.0;
  if (diff === 1) return 0.6;
  return 0.3;
}

/**
 * Availability: 1.0 if circuit breaker is closed, 0.5 if half-open, 0.0 if open.
 */
function computeAvailabilityScore(
  model: ModelCapability,
  circuitBreaker: CircuitBreaker | null,
): number {
  if (!circuitBreaker) return 1.0;
  const state = circuitBreaker.getState(model.adapterType, model.id);
  switch (state) {
    case "CLOSED":
      return 1.0;
    case "HALF_OPEN":
      return 0.5;
    case "OPEN":
      return 0.0;
  }
}

// ── Weight resolution ───────────────────────────────────────────────────────

interface ScoringWeights {
  cost: number;
  capability: number;
  context: number;
  tier: number;
  availability: number;
}

/**
 * Derive scoring weights from the qualityBias constraint.
 * qualityBias 0.0 → cost dominates.
 * qualityBias 1.0 → capability/tier dominate.
 */
function resolveWeights(qualityBias: number): ScoringWeights {
  // Base weights that shift with qualityBias
  const costWeight = 0.35 * (1 - qualityBias);
  const capWeight = 0.25 + 0.15 * qualityBias;
  const ctxWeight = 0.15;
  const tierWeight = 0.15 + 0.1 * qualityBias;
  const availWeight = 0.1;

  // Normalize to sum = 1
  const total = costWeight + capWeight + ctxWeight + tierWeight + availWeight;
  return {
    cost: costWeight / total,
    capability: capWeight / total,
    context: ctxWeight / total,
    tier: tierWeight / total,
    availability: availWeight / total,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ModelScorerDeps {
  circuitBreaker: CircuitBreaker | null;
}

/**
 * Score a list of candidate models against the given task signals and
 * constraints.  Returns the models sorted by descending total score.
 */
export function scoreModels(
  candidates: ModelCapability[],
  taskSignals: TaskSignals,
  taskTier: 1 | 2 | 3,
  constraints: RoutingConstraints,
  deps: ModelScorerDeps,
): ScoredModel[] {
  const qualityBias = constraints.qualityBias;
  const weights = resolveWeights(qualityBias);

  // Infer required capabilities from task type
  const requiredCapabilities = inferRequiredCapabilities(taskSignals.taskType);

  // Estimate output tokens as 30% of input as a reasonable heuristic
  const estimatedOutputTokens = Math.round(taskSignals.estimatedInputTokens * 0.3);

  const scored: ScoredModel[] = candidates.map((model) => {
    const costScore = computeCostScore(
      model,
      candidates,
      taskSignals.estimatedInputTokens,
      estimatedOutputTokens,
    );
    const capabilityScore = computeCapabilityScore(model, requiredCapabilities);
    const contextScore = computeContextScore(model, taskSignals.estimatedInputTokens);
    const tierScore = computeTierScore(model.tier, taskTier);
    const availabilityScore = computeAvailabilityScore(model, deps.circuitBreaker);

    const totalScore =
      costScore * weights.cost +
      capabilityScore * weights.capability +
      contextScore * weights.context +
      tierScore * weights.tier +
      availabilityScore * weights.availability;

    return {
      model,
      totalScore: Math.round(totalScore * 10000) / 10000,
      breakdown: {
        costScore: Math.round(costScore * 1000) / 1000,
        capabilityScore: Math.round(capabilityScore * 1000) / 1000,
        contextScore: Math.round(contextScore * 1000) / 1000,
        tierScore: Math.round(tierScore * 1000) / 1000,
        availabilityScore: Math.round(availabilityScore * 1000) / 1000,
      },
    };
  });

  scored.sort((a, b) => b.totalScore - a.totalScore);
  return scored;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function inferRequiredCapabilities(taskType: string): string[] {
  switch (taskType) {
    case "code_generation":
    case "code_review":
    case "bug_fix":
    case "refactoring":
      return ["code"];
    case "architecture":
    case "security":
      return ["code", "reasoning", "analysis"];
    case "documentation":
      return ["reasoning"];
    default:
      return ["code"];
  }
}
