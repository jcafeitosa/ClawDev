import type {
  IssueComplexity,
  ModelRoutingConstraint,
  ModelRoutingStrategy,
} from "../constants.js";

export type ModelCapability = string;

export interface ModelRoutingProfile {
  id?: string;
  companyId: string;
  name: string;
  description?: string | null;
  routingStrategy: ModelRoutingStrategy;
  defaultAdapterType?: string | null;
  defaultModelId?: string | null;
  fallbackChain: Array<{ adapterType: string; modelId: string }>;
  allowCrossProviderFallback: boolean;
  preferFreeModels: boolean;
  preferLocalModels: boolean;
  maxCostPerRequestMicro?: number | null;
  requiredCapabilities: ModelCapability[];
  minContextWindow?: number | null;
  maxLatencyMs?: number | null;
}

export interface ModelRoutingPolicy extends ModelRoutingProfile {
  agentId?: string | null;
  role?: string | null;
  complexity: ModelRoutingConstraint | IssueComplexity;
  priority: number;
}

export interface ModelRoutingAssignment {
  id?: string;
  companyId: string;
  profileId: string;
  agentId?: string | null;
  role?: string | null;
  complexity: ModelRoutingConstraint | IssueComplexity;
  priority: number;
}

export interface ModelRoutingContext {
  agentId?: string;
  role?: string;
  complexity?: IssueComplexity;
  requiredCapabilities?: ModelCapability[];
  taskPriority?: "critical" | "high" | "medium" | "low";
  companyId?: string;
}

export interface EffectiveModelAvailability {
  adapterType: string;
  modelId: string;
  label: string;
  status: "available" | "cooldown" | "unavailable" | "unknown";
  statusDetail?: string | null;
  cooldownUntil?: string | null;
  cooldownReason?: string | null;
  provider?: string | null;
  source: "adapter" | "catalog" | "effective";
  probedAt?: string | null;
}
