export {
  createModelRegistry,
  type ModelRegistry,
  type ModelRegistryFilter,
} from "./model-registry.js";

export {
  classifyTask,
  type ClassificationResult,
} from "./tier-classifier.js";

export {
  scoreModels,
  type ScoredModel,
  type ScoreBreakdown,
  type ModelScorerDeps,
} from "./model-scorer.js";

export {
  createCircuitBreaker,
  type CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitState,
} from "./circuit-breaker.js";

export {
  checkBudget,
  estimateRunCostUsd,
  budgetDenialReason,
  type BudgetCheckInput,
  type BudgetCheckResult,
} from "./budget-checker.js";

export {
  createRoutingResolver,
  type RoutingResolver,
  type RoutingResolverDeps,
  type RoutingContext,
} from "./routing-resolver.js";

export {
  createFailoverExecutor,
  type ExecuteFn,
  type ExecutionResult,
  type OnRoutingDecision,
  type FailoverExecutorDeps,
  type FailoverOptions,
  type FailoverResult,
} from "./failover-executor.js";
