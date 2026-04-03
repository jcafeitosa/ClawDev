import { sanitizeRecord } from "../redaction.js";
import { DEFAULT_CODEX_LOCAL_MODEL } from "@clawdev/adapter-codex-local";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeAdapterConfigForAdapterType(
  adapterType: string,
  adapterConfig: unknown,
): Record<string, unknown> {
  if (!isPlainRecord(adapterConfig)) return {};
  const next = sanitizeRecord(adapterConfig);

  if (adapterType === "codex_local" && typeof next.skipGitRepoCheck !== "boolean") {
    next.skipGitRepoCheck = true;
  }
  if (adapterType === "codex_local") {
    const model = typeof next.model === "string" ? next.model.trim() : "";
    if (!model || model.toLowerCase() === "auto") {
      next.model = DEFAULT_CODEX_LOCAL_MODEL;
    }
  }

  return next;
}

export function normalizeRuntimeConfigForAdapterType(
  adapterType: string,
  runtimeConfig: unknown,
): Record<string, unknown> {
  if (!isPlainRecord(runtimeConfig)) return {};
  const next = sanitizeRecord(runtimeConfig);
  if (adapterType === "claude_local" && typeof next.model === "string") {
    const model = next.model.trim();
    if (!model || model.toLowerCase() === "auto") {
      delete next.model;
    }
  } else if (adapterType === "codex_local") {
    const model = typeof next.model === "string" ? next.model.trim() : "";
    if (!model || model.toLowerCase() === "auto") {
      next.model = DEFAULT_CODEX_LOCAL_MODEL;
    }
  }
  return next;
}
