import type { ModelCapability } from "@clawdev/shared";

/**
 * Hardcoded seed data for all known models across all adapters.
 * This provides baseline cost/capability metadata used by the routing engine
 * before any dynamic discovery or DB-persisted overrides.
 */
const SEED_MODELS: ModelCapability[] = [
  // ── Claude models ─────────────────────────────────────────────────────────
  {
    id: "claude-opus-4-6",
    adapterType: "claude_local",
    displayName: "Claude Opus 4.6",
    contextWindow: 1_000_000,
    maxOutputTokens: 32_000,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    tier: 1,
    capabilities: ["code", "reasoning", "analysis", "vision"],
    isActive: true,
  },
  {
    id: "claude-sonnet-4-6",
    adapterType: "claude_local",
    displayName: "Claude Sonnet 4.6",
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    tier: 2,
    capabilities: ["code", "reasoning", "analysis"],
    isActive: true,
  },
  {
    id: "claude-haiku-4-5",
    adapterType: "claude_local",
    displayName: "Claude Haiku 4.5",
    contextWindow: 200_000,
    maxOutputTokens: 8_000,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    tier: 3,
    capabilities: ["code", "reasoning"],
    isActive: true,
  },

  // ── Copilot models ────────────────────────────────────────────────────────
  {
    id: "gpt-4.1",
    adapterType: "copilot_local",
    displayName: "GPT-4.1",
    contextWindow: 1_000_000,
    maxOutputTokens: 32_000,
    costPer1kInput: 0.002,
    costPer1kOutput: 0.008,
    tier: 2,
    capabilities: ["code", "reasoning", "analysis"],
    isActive: true,
  },
  {
    id: "o3",
    adapterType: "copilot_local",
    displayName: "o3",
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.04,
    tier: 1,
    capabilities: ["code", "reasoning", "analysis", "math"],
    isActive: true,
  },
  {
    id: "o4-mini",
    adapterType: "copilot_local",
    displayName: "o4-mini",
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.004,
    tier: 3,
    capabilities: ["code", "reasoning"],
    isActive: true,
  },

  // ── Gemini models ─────────────────────────────────────────────────────────
  {
    id: "gemini-2.5-pro",
    adapterType: "gemini_local",
    displayName: "Gemini 2.5 Pro",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_000,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.01,
    tier: 1,
    capabilities: ["code", "reasoning", "analysis", "vision"],
    isActive: true,
  },
  {
    id: "gemini-2.5-flash",
    adapterType: "gemini_local",
    displayName: "Gemini 2.5 Flash",
    contextWindow: 1_000_000,
    maxOutputTokens: 65_000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0035,
    tier: 3,
    capabilities: ["code", "reasoning"],
    isActive: true,
  },

  // ── Codex models ──────────────────────────────────────────────────────────
  {
    id: "codex",
    adapterType: "codex_local",
    displayName: "Codex (o3)",
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    costPer1kInput: 0.0,
    costPer1kOutput: 0.0,
    tier: 2,
    capabilities: ["code", "reasoning"],
    isActive: true,
  },

  // ── OpenCode models ───────────────────────────────────────────────────────
  {
    id: "opencode/big-pickle",
    adapterType: "opencode_local",
    displayName: "OpenCode Big Pickle",
    contextWindow: 128_000,
    maxOutputTokens: 16_000,
    costPer1kInput: 0.0,
    costPer1kOutput: 0.0,
    tier: 3,
    capabilities: ["code"],
    isActive: true,
  },
];

export interface ModelRegistryFilter {
  adapterType?: string;
  tier?: number;
  minContextWindow?: number;
}

export interface ModelRegistry {
  getModel(adapterType: string, modelId: string): ModelCapability | null;
  listModels(filter?: ModelRegistryFilter): ModelCapability[];
  listByTier(tier: 1 | 2 | 3): ModelCapability[];
  addModel(model: ModelCapability): void;
}

function compositeKey(adapterType: string, modelId: string): string {
  return `${adapterType}:${modelId}`;
}

export function createModelRegistry(): ModelRegistry {
  const models = new Map<string, ModelCapability>();

  for (const m of SEED_MODELS) {
    models.set(compositeKey(m.adapterType, m.id), m);
  }

  return {
    getModel(adapterType: string, modelId: string): ModelCapability | null {
      return models.get(compositeKey(adapterType, modelId)) ?? null;
    },

    listModels(filter?: ModelRegistryFilter): ModelCapability[] {
      let result = Array.from(models.values()).filter((m) => m.isActive);

      if (filter?.adapterType) {
        result = result.filter((m) => m.adapterType === filter.adapterType);
      }
      if (filter?.tier !== undefined) {
        result = result.filter((m) => m.tier === filter.tier);
      }
      if (filter?.minContextWindow !== undefined) {
        result = result.filter((m) => m.contextWindow >= filter.minContextWindow!);
      }

      return result;
    },

    listByTier(tier: 1 | 2 | 3): ModelCapability[] {
      return Array.from(models.values()).filter(
        (m) => m.isActive && m.tier === tier,
      );
    },

    addModel(model: ModelCapability): void {
      models.set(compositeKey(model.adapterType, model.id), model);
    },
  };
}
