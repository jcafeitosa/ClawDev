import { asString } from "@clawdev/adapter-utils/server-utils";

export const DEFAULT_OPENAI_COMPATIBLE_BASE_URLS = [
  "http://localhost:11434/v1",
  "http://localhost:1234/v1",
  "http://localhost:8080/v1",
  "http://127.0.0.1:11434/v1",
  "http://127.0.0.1:1234/v1",
  "http://127.0.0.1:8080/v1",
] as const;

function normalizeUrl(input: string): string {
  return input.trim().replace(/\/$/, "");
}

function urlFromHost(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return normalizeUrl(trimmed.endsWith("/v1") ? trimmed : `${trimmed.replace(/\/$/, "")}/v1`);
  }
  if (!/^https?:$/i.test(trimmed)) return null;
  return null;
}

function normalizeOpenAICompatibleBaseUrlCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return normalizeUrl(parsed.toString());
  } catch {
    // continue below
  }

  if (trimmed.includes("://")) {
    return null;
  }

  const [hostPart, portPart] = trimmed.split(":", 2);
  if (!hostPart) return null;
  if (portPart && /^\d+$/.test(portPart)) {
    return normalizeUrl(`http://${hostPart}:${portPart}/v1`);
  }
  return normalizeUrl(`http://${trimmed.replace(/\/$/, "")}/v1`);
}

export function resolveOpenAICompatibleBaseUrlCandidates(input?: unknown): string[] {
  const candidates = new Set<string>();

  const direct = asString(input, "").trim();
  if (direct) {
    candidates.add(normalizeUrl(direct));
    return [...candidates];
  }

  const envCandidates = [
    process.env.OPENAI_COMPATIBLE_LOCAL_BASE_URL,
    process.env.OPENAI_BASE_URL,
    process.env.OLLAMA_BASE_URL,
    process.env.OLLAMA_HOST,
    process.env.LM_STUDIO_BASE_URL,
    process.env.LLAMA_CPP_BASE_URL,
    process.env.EMBEDDING_BASE_URL,
  ];

  for (const value of envCandidates) {
    const normalized = normalizeOpenAICompatibleBaseUrlCandidate(asString(value, ""));
    if (normalized) candidates.add(normalized);
  }

  for (const fallback of DEFAULT_OPENAI_COMPATIBLE_BASE_URLS) {
    candidates.add(fallback);
  }

  return [...candidates];
}
