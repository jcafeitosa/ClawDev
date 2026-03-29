export interface AdapterMeta {
  type: string;
  label: string;
  icon: string;
  authMethods: ("api_key" | "cli_auth" | "oauth" | "none")[];
  envVarNames: string[];
  docsUrl: string;
  supportsQuota: boolean;
  supportsHealthCheck: boolean;
  billingModel: "metered_api" | "subscription" | "credits" | "free";
}

export interface ProviderConfig {
  id: string;
  companyId: string;
  adapterType: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  authMethod: string;
  credentialSecretId: string | null;
  subscriptionPlan: string | null;
  subscriptionLimitMonthly: number | null;
  subscriptionResetsAt: string | null;
  lastHealthCheck: string | null;
  lastHealthStatus: string | null;
  lastHealthDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStatus {
  adapterType: string;
  displayName: string;
  enabled: boolean;
  priority: number;
  connectionStatus: "connected" | "degraded" | "disconnected" | "rate_limited" | "auth_expired" | "unconfigured";
  authMethod: string;
  hasCredential: boolean;
  quotaWindows: Array<{ label: string; usedPercent: number | null; resetsAt: string | null; valueLabel: string | null }>;
  spendCurrentMonthCents: number;
  models: ProviderModelSummary[];
  subscriptionPlan: string | null;
  subscriptionLimitMonthly: number | null;
  subscriptionResetsAt: string | null;
  circuitBreakerDetails: Array<{ modelId: string; state: string; failureCount: number; tripCount: number }>;
  config: ProviderConfig | null;
  meta: AdapterMeta;
}

export interface ProviderModelSummary {
  id: string;
  displayName: string;
  tier: 1 | 2 | 3;
  costPer1kInput: number;
  costPer1kOutput: number;
  circuitState: string;
  isActive: boolean;
}

export interface ProviderHealthEvent {
  id: string;
  companyId: string;
  adapterType: string;
  status: string;
  detail: string | null;
  occurredAt: string;
}
