export interface RoutingPolicy {
  mode: "manual" | "auto_constrained" | "full_auto";
  constraints?: RoutingConstraints;
  fallback: { adapterType: string; model: string };
}

export interface RoutingConstraints {
  maxCostPerRunUsd: number | null;
  minContextWindow: number | null;
  allowedProviders: string[] | null;
  blockedProviders: string[] | null;
  qualityBias: number; // 0.0 = cheapest, 1.0 = best quality
  preferredTier: 1 | 2 | 3 | null;
}

export interface ModelCapability {
  id: string;
  adapterType: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  tier: 1 | 2 | 3; // 1=premium, 2=standard, 3=fast
  capabilities: string[];
  isActive: boolean;
}

export interface RoutingDecision {
  selectedAdapterType: string;
  selectedModel: string;
  tier: 1 | 2 | 3;
  reasoning: string;
  estimatedCostUsd: number;
  complexityScore: number;
  alternativesConsidered: RoutingAlternative[];
  routingLatencyMs: number;
  isFailover: boolean;
  failoverReason?: string;
}

export interface RoutingAlternative {
  adapterType: string;
  model: string;
  score: number;
  reason: string;
}

export interface TaskSignals {
  estimatedInputTokens: number;
  taskType: string; // "code_generation" | "code_review" | "bug_fix" | "refactoring" | "general"
  issueTitle?: string;
  issueDescription?: string;
  projectSize?: "small" | "medium" | "large";
  priority?: string;
}

export type RoutingMode = RoutingPolicy["mode"];
