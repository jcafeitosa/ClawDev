import os from "os";
import path from "path";

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

const PI_THINKING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);

export type PiModelSelection = {
  provider: string | null;
  modelId: string | null;
  canonicalModel: string | null;
  thinking: string | null;
  hasExplicitModel: boolean;
};

export function normalizePiModelSelection(input: {
  model?: unknown;
  provider?: unknown;
  thinking?: unknown;
}): PiModelSelection {
  const configuredProvider = asNonEmptyString(input.provider);
  const configuredThinking = asNonEmptyString(input.thinking);
  const rawModel = asNonEmptyString(input.model);
  const modelValue = rawModel && rawModel.toLowerCase() !== "auto" ? rawModel : null;

  let provider = configuredProvider;
  let modelId: string | null = null;
  let thinking = configuredThinking;

  if (modelValue) {
    let normalizedModel = modelValue;
    const thinkingSeparator = normalizedModel.lastIndexOf(":");
    if (thinkingSeparator > normalizedModel.lastIndexOf("/")) {
      const suffix = normalizedModel.slice(thinkingSeparator + 1).trim().toLowerCase();
      if (PI_THINKING_LEVELS.has(suffix)) {
        if (!thinking) thinking = suffix;
        normalizedModel = normalizedModel.slice(0, thinkingSeparator).trim();
      }
    }

    if (normalizedModel.includes("/")) {
      provider = normalizedModel.slice(0, normalizedModel.indexOf("/")).trim() || provider;
      modelId = normalizedModel.slice(normalizedModel.indexOf("/") + 1).trim() || null;
    } else {
      modelId = normalizedModel;
    }
  }

  const canonicalModel =
    provider && modelId ? `${provider}/${modelId}` : modelId;

  return {
    provider,
    modelId,
    canonicalModel,
    thinking,
    hasExplicitModel: Boolean(modelId),
  };
}

export function resolvePiHome(env: Record<string, string>): string {
  return path.resolve(env.HOME || process.env.HOME || os.homedir());
}

export function resolvePiPaths(env: Record<string, string>) {
  const home = resolvePiHome(env);
  return {
    home,
    sessionsDir: path.join(home, ".pi", "clawdevs"),
    skillsDir: path.join(home, ".pi", "agent", "skills"),
  };
}
