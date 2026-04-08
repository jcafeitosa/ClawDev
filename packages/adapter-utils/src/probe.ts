import type { AdapterModelStatus } from "./types.js";

export const PROBE_PROMPT = "Eu digo PING, e voce diz? Responda apenas PONG.";

export type ProbeFailureCategory =
  | "auth_required"
  | "quota_exceeded"
  | "model_unavailable"
  | "cli_not_installed"
  | "timed_out"
  | "unexpected_output"
  | "unknown";

export interface ClassifiedProbeResult {
  status: AdapterModelStatus;
  statusDetail: string;
  category: ProbeFailureCategory | "available";
}

function excerpt(text: string, max = 240): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

const AUTH_REQUIRED_PATTERNS = [
  /(?:not\s+logged\s+in|login\s+required|authentication\s+required|unauthorized|forbidden|invalid(?:\s+or\s+missing)?\s+api(?:[_\s-]?key)?|api(?:[_\s-]?key)?\s+required|please\s+run\s+`?[a-z][a-z0-9_-]*\s+login`?)/i,
  /(?:oauth|subscription)\s+required/i,
  /(?:auth|credential|token)\s+(?:is\s+)?(?:missing|expired|invalid)/i,
];

const QUOTA_REQUIRED_PATTERNS = [
  /(?:429|402)\b/,
  /(?:too\s+many\s+requests|rate\s+limit(?:ed|ing)?|quota(?:\s+exceeded)?|limit\s+exceeded|credit(?:s)?\s+(?:exhausted|depleted|insufficient|required)|insufficient\s+credits|out\s+of\s+credits|billing\s+required|payment\s+required)/i,
];

const MODEL_UNAVAILABLE_PATTERNS = [
  /(?:not\s+supported|not\s+available|unknown\s+model|invalid\s+model|model\s+not\s+found|404\b)/i,
];

const CLI_NOT_INSTALLED_PATTERNS = [
  /(?:command\s+not\s+found|ENOENT|not\s+installed|could\s+not\s+be\s+found)/i,
];

const TIMED_OUT_PATTERNS = [
  /(?:timed?\s*out|timeout|exceeded\s+time\s+limit)/i,
];

export function classifyProbeOutput(combined: string, exitCode: number | null): ClassifiedProbeResult {
  const text = combined.trim();

  if (hasAny(text, TIMED_OUT_PATTERNS)) {
    return {
      status: "unknown",
      statusDetail: "Probe timed out",
      category: "timed_out",
    };
  }

  if (hasAny(text, CLI_NOT_INSTALLED_PATTERNS)) {
    return {
      status: "unavailable",
      statusDetail: "CLI not installed",
      category: "cli_not_installed",
    };
  }

  if (hasAny(text, AUTH_REQUIRED_PATTERNS)) {
    return {
      status: "auth_required",
      statusDetail: hasAny(text, [/oauth/i]) ? "OAuth/login required" : "Auth required",
      category: "auth_required",
    };
  }

  if (hasAny(text, QUOTA_REQUIRED_PATTERNS)) {
    const quotaDetail = hasAny(text, [/credit/i])
      ? "Credits exhausted"
      : hasAny(text, [/billing|required|payment/i])
        ? "Billing or subscription required"
        : "Rate limit or quota exceeded";
    return {
      status: "quota_exceeded",
      statusDetail: quotaDetail,
      category: "quota_exceeded",
    };
  }

  if (hasAny(text, MODEL_UNAVAILABLE_PATTERNS)) {
    return {
      status: "unavailable",
      statusDetail: "Model not supported",
      category: "model_unavailable",
    };
  }

  if (/\bPONG\b/i.test(text)) {
    return {
      status: "available",
      statusDetail: "PONG received — model operational",
      category: "available",
    };
  }

  if (text.length > 0) {
    return {
      status: exitCode === 0 ? "degraded" : "unknown",
      statusDetail: `Unexpected probe output; expected PONG. ${excerpt(text)}`,
      category: "unexpected_output",
    };
  }

  return {
    status: exitCode === 0 ? "degraded" : "unknown",
    statusDetail: exitCode === 0 ? "Probe completed without PONG" : `exit code ${exitCode ?? "unknown"}`,
    category: "unexpected_output",
  };
}
