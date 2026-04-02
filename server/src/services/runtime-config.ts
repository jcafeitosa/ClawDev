import { sanitizeRecord } from "../redaction.js";

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  }
  return next;
}
