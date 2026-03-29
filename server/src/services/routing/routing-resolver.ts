import type {
  ModelCapability,
  RoutingAlternative,
  RoutingConstraints,
  RoutingDecision,
  RoutingPolicy,
  TaskSignals,
} from "@clawdev/shared";
import { classifyTask } from "./tier-classifier.js";
import { scoreModels, type ScoredModel } from "./model-scorer.js";
import { checkBudget, budgetDenialReason, estimateRunCostUsd } from "./budget-checker.js";
import type { CircuitBreaker } from "./circuit-breaker.js";
import type { ModelRegistry } from "./model-registry.js";
import { logger } from "../../middleware/logger.js";

// ── Public types ────────────────────────────────────────────────────────────

export interface RoutingContext {
  /** The routing policy configured on the agent. */
  routingPolicy: RoutingPolicy;
  /** Whether the company has routing enabled globally. */
  companyRoutingEnabled: boolean;
  /** Task-level signals used for classification and scoring. */
  taskSignals: TaskSignals;
  /** Monthly budget limit in cents (0 = unlimited). */
  budgetMonthlyCents: number;
  /** Amount already spent this month in cents. */
  spentMonthlyCents: number;
  /** Estimated output tokens (if known); defaults to 30% of input. */
  estimatedOutputTokens?: number;
}

export interface RoutingResolver {
  resolve(ctx: RoutingContext): RoutingDecision;
}

export interface RoutingResolverDeps {
  modelRegistry: ModelRegistry;
  circuitBreaker: CircuitBreaker;
}

// ── Default constraints ─────────────────────────────────────────────────────

const DEFAULT_CONSTRAINTS: RoutingConstraints = {
  maxCostPerRunUsd: null,
  minContextWindow: null,
  allowedProviders: null,
  blockedProviders: null,
  qualityBias: 0.5,
  preferredTier: null,
};

// ── Factory ─────────────────────────────────────────────────────────────────

export function createRoutingResolver(deps: RoutingResolverDeps): RoutingResolver {
  const { modelRegistry, circuitBreaker } = deps;

  return {
    resolve(ctx: RoutingContext): RoutingDecision {
      const start = performance.now();

      // ── Step 1: Check if routing is enabled ─────────────────────────
      if (!ctx.companyRoutingEnabled) {
        return buildFallbackDecision(ctx, start, "company routing is disabled");
      }

      if (ctx.routingPolicy.mode === "manual") {
        return buildFallbackDecision(ctx, start, "agent routing mode is manual");
      }

      // ── Step 2: Classify task complexity ────────────────────────────
      const classification = classifyTask(ctx.taskSignals);
      const constraints: RoutingConstraints = {
        ...DEFAULT_CONSTRAINTS,
        ...ctx.routingPolicy.constraints,
      };

      // ── Step 3: Gather candidate models ─────────────────────────────
      let candidates = modelRegistry.listModels({
        minContextWindow: constraints.minContextWindow ?? undefined,
      });

      // Apply provider allow/block lists
      if (constraints.allowedProviders && constraints.allowedProviders.length > 0) {
        const allowed = new Set(constraints.allowedProviders);
        candidates = candidates.filter((m) => allowed.has(m.adapterType));
      }
      if (constraints.blockedProviders && constraints.blockedProviders.length > 0) {
        const blocked = new Set(constraints.blockedProviders);
        candidates = candidates.filter((m) => !blocked.has(m.adapterType));
      }

      // In auto_constrained mode, limit to preferred tier if set
      if (ctx.routingPolicy.mode === "auto_constrained" && constraints.preferredTier !== null) {
        const tierFiltered = candidates.filter((m) => m.tier === constraints.preferredTier);
        if (tierFiltered.length > 0) {
          candidates = tierFiltered;
        }
        // If no models match the preferred tier, fall through to all candidates
      }

      if (candidates.length === 0) {
        logger.warn("routing: no candidate models after filtering, using fallback");
        return buildFallbackDecision(ctx, start, "no candidate models matched constraints");
      }

      // ── Step 4: Score candidates ────────────────────────────────────
      const scored = scoreModels(
        candidates,
        ctx.taskSignals,
        classification.tier,
        constraints,
        { circuitBreaker },
      );

      // ── Step 5: Filter by budget ────────────────────────────────────
      const estimatedOutputTokens =
        ctx.estimatedOutputTokens ?? Math.round(ctx.taskSignals.estimatedInputTokens * 0.3);

      const affordable = filterByBudget(
        scored,
        ctx,
        estimatedOutputTokens,
        constraints,
      );

      if (affordable.length === 0) {
        logger.warn("routing: no models within budget, using fallback");
        return buildFallbackDecision(ctx, start, "all candidate models exceed budget");
      }

      // ── Step 6: Filter by circuit breaker ───────────────────────────
      const available = affordable.filter((s) =>
        circuitBreaker.isAvailable(s.model.adapterType, s.model.id),
      );

      if (available.length === 0) {
        logger.warn("routing: all affordable models are circuit-broken, using fallback");
        return buildFallbackDecision(ctx, start, "all affordable models are circuit-broken");
      }

      // ── Step 7: Select best model ──────────────────────────────────
      const best = available[0]!;
      const alternatives = available.slice(1, 4).map((s) => toAlternative(s));

      const estimatedCostUsd = estimateRunCostUsd(
        ctx.taskSignals.estimatedInputTokens,
        estimatedOutputTokens,
        best.model,
      );

      const routingLatencyMs = Math.round((performance.now() - start) * 100) / 100;

      const reasoning =
        `Selected ${best.model.displayName} (score ${best.totalScore}). ` +
        `${classification.reasoning}. ` +
        `${available.length} model(s) considered.`;

      return {
        selectedAdapterType: best.model.adapterType,
        selectedModel: best.model.id,
        tier: classification.tier,
        reasoning,
        estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
        complexityScore: classification.complexityScore,
        alternativesConsidered: alternatives,
        routingLatencyMs,
        isFailover: false,
      };
    },
  };

  // ── Internal helpers ──────────────────────────────────────────────────

  function buildFallbackDecision(
    ctx: RoutingContext,
    startTime: number,
    reason: string,
  ): RoutingDecision {
    const fallback = ctx.routingPolicy.fallback;
    const fallbackModel = modelRegistry.getModel(fallback.adapterType, fallback.model);
    const estimatedOutputTokens =
      ctx.estimatedOutputTokens ?? Math.round(ctx.taskSignals.estimatedInputTokens * 0.3);

    const estimatedCostUsd = fallbackModel
      ? estimateRunCostUsd(ctx.taskSignals.estimatedInputTokens, estimatedOutputTokens, fallbackModel)
      : 0;

    return {
      selectedAdapterType: fallback.adapterType,
      selectedModel: fallback.model,
      tier: fallbackModel?.tier ?? 2,
      reasoning: `Fallback: ${reason}`,
      estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
      complexityScore: 0,
      alternativesConsidered: [],
      routingLatencyMs: Math.round((performance.now() - startTime) * 100) / 100,
      isFailover: false,
    };
  }

  function filterByBudget(
    scored: ScoredModel[],
    ctx: RoutingContext,
    estimatedOutputTokens: number,
    constraints: RoutingConstraints,
  ): ScoredModel[] {
    return scored.filter((s) => {
      // Check per-run cost limit
      if (constraints.maxCostPerRunUsd !== null) {
        const runCost = estimateRunCostUsd(
          ctx.taskSignals.estimatedInputTokens,
          estimatedOutputTokens,
          s.model,
        );
        if (runCost > constraints.maxCostPerRunUsd) return false;
      }

      // Check monthly budget if budget is set (> 0)
      if (ctx.budgetMonthlyCents > 0) {
        const result = checkBudget({
          budgetMonthlyCents: ctx.budgetMonthlyCents,
          spentMonthlyCents: ctx.spentMonthlyCents,
          estimatedInputTokens: ctx.taskSignals.estimatedInputTokens,
          estimatedOutputTokens,
          model: s.model,
        });
        if (!result.allowed) return false;
      }

      return true;
    });
  }

  function toAlternative(s: ScoredModel): RoutingAlternative {
    return {
      adapterType: s.model.adapterType,
      model: s.model.id,
      score: s.totalScore,
      reason:
        `cost=${s.breakdown.costScore} cap=${s.breakdown.capabilityScore} ` +
        `ctx=${s.breakdown.contextScore} tier=${s.breakdown.tierScore} ` +
        `avail=${s.breakdown.availabilityScore}`,
    };
  }
}
