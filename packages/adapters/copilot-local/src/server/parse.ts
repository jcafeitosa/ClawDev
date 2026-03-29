import type { UsageSummary } from "@clawdev/adapter-utils";
import { asString, asNumber, parseObject, parseJson } from "@clawdev/adapter-utils/server-utils";

/**
 * Copilot CLI JSONL event types:
 * - assistant.message_delta  — streaming content chunk
 * - assistant.message        — full assistant message with content blocks
 * - assistant.turn_start     — marks the beginning of an assistant turn
 * - assistant.turn_end       — marks the end of an assistant turn
 * - user.message             — user input message
 * - result                   — final result with sessionId, exitCode, usage
 */

export interface CopilotParsedStream {
  sessionId: string | null;
  model: string;
  costUsd: number | null;
  usage: UsageSummary | null;
  summary: string;
  resultJson: Record<string, unknown> | null;
}

export function parseCopilotJsonOutput(stdout: string): CopilotParsedStream {
  let sessionId: string | null = null;
  let model = "";
  let finalResult: Record<string, unknown> | null = null;
  const assistantTexts: string[] = [];

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const event = parseJson(line);
    if (!event) continue;

    const type = asString(event.type, "");

    if (type === "assistant.message_delta") {
      const delta = parseObject(event.delta);
      const text = asString(delta.text, "");
      if (text) assistantTexts.push(text);
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;
      continue;
    }

    if (type === "assistant.message") {
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;
      model = asString(event.model, model);
      const content = Array.isArray(event.content) ? event.content : [];
      for (const entry of content) {
        if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
        const block = entry as Record<string, unknown>;
        if (asString(block.type, "") === "text") {
          const text = asString(block.text, "");
          if (text) assistantTexts.push(text);
        }
      }
      const outputTokens = asNumber(
        parseObject(event.usage).output_tokens ?? parseObject(event.usage).outputTokens,
        0,
      );
      if (outputTokens > 0 && !model) {
        model = asString(event.model, "");
      }
      continue;
    }

    if (type === "assistant.turn_start" || type === "assistant.turn_end") {
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;
      continue;
    }

    if (type === "user.message") {
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;
      continue;
    }

    if (type === "result") {
      finalResult = event;
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;
      model = asString(event.model, model);
    }
  }

  if (!finalResult) {
    return {
      sessionId,
      model,
      costUsd: null,
      usage: null,
      summary: assistantTexts.join("").trim(),
      resultJson: null,
    };
  }

  const usageObj = parseObject(finalResult.usage);
  const usage: UsageSummary = {
    inputTokens: asNumber(usageObj.input_tokens ?? usageObj.inputTokens, 0),
    cachedInputTokens: asNumber(usageObj.cache_read_input_tokens ?? usageObj.cachedInputTokens, 0),
    outputTokens: asNumber(usageObj.output_tokens ?? usageObj.outputTokens, 0),
  };

  const premiumRequests = asNumber(usageObj.premiumRequests, 0);
  const totalApiDurationMs = asNumber(usageObj.totalApiDurationMs, 0);

  const costRaw = finalResult.total_cost_usd ?? finalResult.costUsd;
  const costUsd = typeof costRaw === "number" && Number.isFinite(costRaw) ? costRaw : null;
  const summary = asString(finalResult.result, assistantTexts.join("")).trim();

  return {
    sessionId,
    model,
    costUsd,
    usage,
    summary,
    resultJson: {
      ...finalResult,
      _premiumRequests: premiumRequests,
      _totalApiDurationMs: totalApiDurationMs,
    },
  };
}

function extractCopilotErrorMessages(parsed: Record<string, unknown>): string[] {
  const raw = Array.isArray(parsed.errors) ? parsed.errors : [];
  const messages: string[] = [];

  for (const entry of raw) {
    if (typeof entry === "string") {
      const msg = entry.trim();
      if (msg) messages.push(msg);
      continue;
    }

    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }

    const obj = entry as Record<string, unknown>;
    const msg = asString(obj.message, "") || asString(obj.error, "") || asString(obj.code, "");
    if (msg) {
      messages.push(msg);
      continue;
    }

    try {
      messages.push(JSON.stringify(obj));
    } catch {
      // skip non-serializable entry
    }
  }

  return messages;
}

const COPILOT_AUTH_REQUIRED_RE =
  /(?:not\s+logged\s+in|please\s+log\s+in|login\s+required|requires\s+login|unauthorized|authentication\s+required|gh\s+auth\s+login|not\s+authenticated)/i;
const URL_RE = /(https?:\/\/[^\s'"`<>()[\]{};,!?]+[^\s'"`<>()[\]{};,!.?:]+)/gi;

export function extractCopilotLoginUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match || match.length === 0) return null;
  for (const rawUrl of match) {
    const cleaned = rawUrl.replace(/[\])}.!,?;:'\"]+$/g, "");
    if (
      cleaned.includes("github") ||
      cleaned.includes("copilot") ||
      cleaned.includes("auth") ||
      cleaned.includes("login")
    ) {
      return cleaned;
    }
  }
  return match[0]?.replace(/[\])}.!,?;:'\"]+$/g, "") ?? null;
}

export function detectCopilotLoginRequired(input: {
  parsed: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}): { requiresLogin: boolean; loginUrl: string | null } {
  const resultText = asString(input.parsed?.result, "").trim();
  const messages = [
    resultText,
    ...extractCopilotErrorMessages(input.parsed ?? {}),
    input.stdout,
    input.stderr,
  ]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const requiresLogin = messages.some((line) => COPILOT_AUTH_REQUIRED_RE.test(line));
  return {
    requiresLogin,
    loginUrl: extractCopilotLoginUrl([input.stdout, input.stderr].join("\n")),
  };
}

export function describeCopilotFailure(parsed: Record<string, unknown>): string | null {
  const subtype = asString(parsed.subtype, "");
  const resultText = asString(parsed.result, "").trim();
  const exitCode = asNumber(parsed.exitCode, -1);
  const errors = extractCopilotErrorMessages(parsed);

  let detail = resultText;
  if (!detail && errors.length > 0) {
    detail = errors[0] ?? "";
  }

  const parts = ["Copilot run failed"];
  if (subtype) parts.push(`subtype=${subtype}`);
  if (exitCode !== 0 && exitCode !== -1) parts.push(`exitCode=${exitCode}`);
  if (detail) parts.push(detail);
  return parts.length > 1 ? parts.join(": ") : null;
}

export function isCopilotMaxTurnsResult(parsed: Record<string, unknown> | null | undefined): boolean {
  if (!parsed) return false;

  const subtype = asString(parsed.subtype, "").trim().toLowerCase();
  if (subtype === "error_max_turns") return true;

  const stopReason = asString(parsed.stop_reason ?? parsed.stopReason, "").trim().toLowerCase();
  if (stopReason === "max_turns") return true;

  const resultText = asString(parsed.result, "").trim();
  return /max(?:imum)?\s+turns?/i.test(resultText);
}

export function isCopilotUnknownSessionError(parsed: Record<string, unknown>): boolean {
  const resultText = asString(parsed.result, "").trim();
  const allMessages = [resultText, ...extractCopilotErrorMessages(parsed)]
    .map((msg) => msg.trim())
    .filter(Boolean);

  return allMessages.some((msg) =>
    /no conversation found|unknown session|session .* not found|invalid session/i.test(msg),
  );
}
