import type { AdapterModel, AdapterModelStatus } from "./types.js";
import { models as codexFallbackModels } from "@clawdev/adapter-codex-local";
import { readConfigFile } from "../config-file.js";

const OPENAI_MODELS_ENDPOINT = "https://api.openai.com/v1/models";
const OPENAI_MODELS_TIMEOUT_MS = 5000;
const OPENAI_MODELS_CACHE_TTL_MS = 60_000;

let cached: { keyFingerprint: string; expiresAt: number; models: AdapterModel[] } | null = null;

function fingerprint(apiKey: string): string {
  return `${apiKey.length}:${apiKey.slice(-6)}`;
}

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ ...model, id, label: model.label.trim() || id });
  }
  return deduped;
}

function withProvider(models: AdapterModel[]): AdapterModel[] {
  return models.map((m) => (m.provider ? m : { ...m, provider: "openai" }));
}

function mergedWithFallback(models: AdapterModel[]): AdapterModel[] {
  return dedupeModels([
    ...models,
    ...withProvider(codexFallbackModels),
  ]).sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }));
}

function resolveOpenAiApiKey(): string | null {
  const envKey = process.env.OPENAI_API_KEY?.trim();
  if (envKey) return envKey;

  const config = readConfigFile();
  if (config?.llm?.provider !== "openai") return null;
  const configKey = config.llm.apiKey?.trim();
  return configKey && configKey.length > 0 ? configKey : null;
}

interface FetchResult {
  models: AdapterModel[];
  status: AdapterModelStatus;
  statusDetail: string;
}

async function fetchOpenAiModels(apiKey: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_MODELS_TIMEOUT_MS);
  const probedAt = new Date().toISOString();
  try {
    const response = await fetch(OPENAI_MODELS_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const status: AdapterModelStatus =
        response.status === 401 ? "auth_required" :
        response.status === 429 ? "quota_exceeded" :
        "unavailable";
      const statusDetail = `OpenAI API ${response.status} ${response.statusText}`;
      return { models: [], status, statusDetail };
    }

    const payload = (await response.json()) as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id !== "string" || id.trim().length === 0) continue;
      models.push({ id, label: id, provider: "openai", status: "available", probedAt });
    }
    return { models: dedupeModels(models), status: "available", statusDetail: `${models.length} models discovered` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes("abort");
    return {
      models: [],
      status: "unknown",
      statusDetail: isTimeout ? `Probe timed out: ${message}` : message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  const apiKey = resolveOpenAiApiKey();
  const probedAt = new Date().toISOString();
  if (!apiKey) {
    // No API key — return fallback models with auth_required status
    return dedupeModels(codexFallbackModels).map((m) => ({
      ...m,
      provider: "openai",
      status: "auth_required" as AdapterModelStatus,
      statusDetail: "No OpenAI API key configured",
      probedAt,
    }));
  }

  const now = Date.now();
  const keyFingerprint = fingerprint(apiKey);
  if (cached && cached.keyFingerprint === keyFingerprint && cached.expiresAt > now) {
    return cached.models;
  }

  const result = await fetchOpenAiModels(apiKey);
  if (result.models.length > 0) {
    const merged = mergedWithFallback(result.models);
    cached = {
      keyFingerprint,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: merged,
    };
    return merged;
  }

  // Fetch returned no models — annotate fallback with the probe status
  const fallbackWithStatus = dedupeModels(codexFallbackModels).map((m) => ({
    ...m,
    provider: "openai",
    status: result.status,
    statusDetail: result.statusDetail,
    probedAt,
  }));

  if (cached && cached.keyFingerprint === keyFingerprint && cached.models.length > 0) {
    return cached.models;
  }

  return fallbackWithStatus;
}

export function resetCodexModelsCacheForTests() {
  cached = null;
}
