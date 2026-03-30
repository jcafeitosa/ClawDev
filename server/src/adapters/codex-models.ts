import type { AdapterModel, AdapterModelStatus } from "./types.js";
import { models as codexFallbackModels } from "@clawdev/adapter-codex-local";
import { codexHomeDir } from "@clawdev/adapter-codex-local/server";
import { readConfigFile } from "../config-file.js";
import fs from "node:fs/promises";
import path from "node:path";

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

interface CodexModelsCacheEntry {
  slug: string;
  display_name?: string;
  description?: string;
  default_reasoning_level?: string;
  supported_reasoning_levels?: Array<{ effort: string; description?: string }>;
  shell_type?: string;
  visibility?: "list" | "hide";
  supported_in_api?: boolean;
  priority?: number;
  upgrade?: { model: string; migration_markdown?: string } | null;
}

interface CodexModelsCache {
  fetched_at?: string;
  client_version?: string;
  models?: CodexModelsCacheEntry[];
}

let disableModelsCache = false;

async function readCodexModelsCache(): Promise<CodexModelsCacheEntry[]> {
  if (disableModelsCache) return [];
  const cachePath = path.join(codexHomeDir(), "models_cache.json");
  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as CodexModelsCache;
    if (!Array.isArray(parsed.models)) return [];
    return parsed.models.filter(
      (m): m is CodexModelsCacheEntry =>
        typeof m === "object" && m !== null && typeof m.slug === "string" && m.slug.trim().length > 0,
    );
  } catch {
    return [];
  }
}

function enrichModelsWithCache(models: AdapterModel[], cacheEntries: CodexModelsCacheEntry[]): AdapterModel[] {
  const cacheBySlug = new Map<string, CodexModelsCacheEntry>();
  for (const entry of cacheEntries) {
    cacheBySlug.set(entry.slug.trim(), entry);
  }

  const enriched = models.map((model) => {
    const entry = cacheBySlug.get(model.id);
    if (!entry) return model;
    const details: string[] = [];
    if (entry.description) details.push(entry.description);
    if (entry.default_reasoning_level) details.push(`reasoning: ${entry.default_reasoning_level}`);
    return {
      ...model,
      label: entry.display_name?.trim() || model.label,
      ...(details.length > 0 ? { statusDetail: details.join(" — ") } : {}),
    };
  });

  // Add cache-only models that are not yet in the list and are visible
  const existingIds = new Set(models.map((m) => m.id));
  const probedAt = new Date().toISOString();
  for (const entry of cacheEntries) {
    const slug = entry.slug.trim();
    if (existingIds.has(slug)) continue;
    if (entry.visibility === "hide") continue;
    const details: string[] = [];
    if (entry.description) details.push(entry.description);
    if (entry.default_reasoning_level) details.push(`reasoning: ${entry.default_reasoning_level}`);
    enriched.push({
      id: slug,
      label: entry.display_name?.trim() || slug,
      provider: "openai",
      status: "available" as AdapterModelStatus,
      ...(details.length > 0 ? { statusDetail: details.join(" — ") } : {}),
      probedAt,
    });
  }

  return enriched;
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  const apiKey = resolveOpenAiApiKey();
  const probedAt = new Date().toISOString();

  // Read the local models cache (best-effort, never blocks)
  const cacheEntries = await readCodexModelsCache();
  const hiddenSlugs = new Set(
    cacheEntries.filter((e) => e.visibility === "hide").map((e) => e.slug.trim()),
  );

  function applyCache(models: AdapterModel[]): AdapterModel[] {
    const enriched = cacheEntries.length > 0 ? enrichModelsWithCache(models, cacheEntries) : models;
    // Filter out hidden models
    return hiddenSlugs.size > 0 ? enriched.filter((m) => !hiddenSlugs.has(m.id)) : enriched;
  }

  if (!apiKey) {
    // No API key — return fallback models with auth_required status
    const fallback = dedupeModels(codexFallbackModels).map((m) => ({
      ...m,
      provider: "openai",
      status: "auth_required" as AdapterModelStatus,
      statusDetail: "No OpenAI API key configured",
      probedAt,
    }));
    return applyCache(fallback);
  }

  const now = Date.now();
  const keyFingerprint = fingerprint(apiKey);
  if (cached && cached.keyFingerprint === keyFingerprint && cached.expiresAt > now) {
    return applyCache(cached.models);
  }

  const result = await fetchOpenAiModels(apiKey);
  if (result.models.length > 0) {
    const merged = mergedWithFallback(result.models);
    const final = applyCache(merged);
    cached = {
      keyFingerprint,
      expiresAt: now + OPENAI_MODELS_CACHE_TTL_MS,
      models: final,
    };
    return final;
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
    return applyCache(cached.models);
  }

  return applyCache(fallbackWithStatus);
}

export function resetCodexModelsCacheForTests() {
  cached = null;
  disableModelsCache = true;
}
