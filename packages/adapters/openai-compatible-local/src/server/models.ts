import type { AdapterModel } from "@clawdev/adapter-utils";
import { asString } from "@clawdev/adapter-utils/server-utils";

const CACHE_TTL_MS = 30_000;
const discoveryCache = new Map<string, { expiresAt: number; models: AdapterModel[] }>();

function normalizeBaseUrl(input: unknown): string {
  const raw = asString(input, "http://localhost:11434/v1").trim();
  return raw.replace(/\/$/, "");
}

function normalizeApiKey(input: unknown): string {
  return asString(input, "").trim();
}

function cacheKey(baseUrl: string, apiKey: string): string {
  return `${baseUrl}\n${apiKey.length}:${apiKey.slice(-6)}`;
}

async function fetchModelList(baseUrl: string, apiKey: string): Promise<AdapterModel[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`GET /models failed with ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: unknown };
  const data = Array.isArray(payload.data) ? payload.data : [];
  const probedAt = new Date().toISOString();
  const models: AdapterModel[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const id = asString(rec.id, "").trim();
    if (!id) continue;
    models.push({
      id,
      label: asString(rec.name, id).trim() || id,
      provider: "openai",
      status: "available",
      probedAt,
    });
  }
  return models;
}

export async function listOpenAICompatibleModels(input: {
  baseUrl?: unknown;
  apiKey?: unknown;
} = {}): Promise<AdapterModel[]> {
  const baseUrl = normalizeBaseUrl(input.baseUrl);
  const apiKey = normalizeApiKey(input.apiKey);
  const key = cacheKey(baseUrl, apiKey);
  const cached = discoveryCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.models;

  const models = await fetchModelList(baseUrl, apiKey);
  discoveryCache.set(key, { expiresAt: now + CACHE_TTL_MS, models });
  return models;
}
