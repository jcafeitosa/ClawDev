import { asString, asNumber, asBoolean, parseObject, parseJson } from "@clawdev/adapter-utils/server-utils";

export interface CopilotParsedOutput {
  sessionId: string | null;
  model: string | null;
  summary: string;
  usage: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };
  /** Premium (paid) requests consumed in this session */
  premiumRequests: number;
  /** Total API latency in milliseconds */
  totalApiDurationMs: number;
  /** Total session wall-clock duration in milliseconds */
  sessionDurationMs: number;
  /** Code changes made during the session */
  codeChanges: {
    linesAdded: number;
    linesRemoved: number;
    filesModified: string[];
  };
  /** Quota error info — set when the session hit a quota/billing limit */
  quotaError: {
    message: string;
    statusCode: number;
    providerCallId: string | null;
  } | null;
  errorMessage: string | null;
}

export function parseCopilotOutput(stdout: string): CopilotParsedOutput {
  let sessionId: string | null = null;
  const messages: string[] = [];
  let errorMessage: string | null = null;
  let model: string | null = null;
  let premiumRequests = 0;
  let totalApiDurationMs = 0;
  let sessionDurationMs = 0;
  const codeChanges = { linesAdded: 0, linesRemoved: 0, filesModified: [] as string[] };
  let quotaError: CopilotParsedOutput["quotaError"] = null;
  const usage = {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
  };

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const event = parseJson(line);
    if (!event) {
      if (line.length > 0) messages.push(line);
      continue;
    }

    const type = asString(event.type, "");
    const data = parseObject(event.data ?? event);

    if (type === "session.tools_updated") {
      const m = asString(data.model, "");
      if (m) model = m;
      continue;
    }

    if (type === "assistant.message") {
      const text = asString(data.content, "");
      if (text) messages.push(text);
      const outputTokens = asNumber(data.outputTokens, 0);
      if (outputTokens > 0) usage.outputTokens += outputTokens;
      continue;
    }

    if (type === "session.error") {
      const errorType = asString(data.errorType, "");
      const msg = asString(data.message, "").trim();
      if (errorType === "quota") {
        quotaError = {
          message: msg,
          statusCode: asNumber(data.statusCode, 0),
          providerCallId: asString(data.providerCallId, "") || null,
        };
      }
      if (msg) errorMessage = msg;
      continue;
    }

    if (type === "error" || type === "turn.failed") {
      const msg = asString(data.message, asString(event.message, "")).trim();
      if (msg) errorMessage = msg;
      continue;
    }

    if (type === "result") {
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;

      const resultUsage = parseObject(data.usage ?? event.usage);
      premiumRequests = asNumber(resultUsage.premiumRequests, premiumRequests);
      totalApiDurationMs = asNumber(resultUsage.totalApiDurationMs, totalApiDurationMs);
      sessionDurationMs = asNumber(resultUsage.sessionDurationMs, sessionDurationMs);

      const changes = parseObject(resultUsage.codeChanges);
      codeChanges.linesAdded = asNumber(changes.linesAdded, codeChanges.linesAdded);
      codeChanges.linesRemoved = asNumber(changes.linesRemoved, codeChanges.linesRemoved);
      if (Array.isArray(changes.filesModified)) {
        codeChanges.filesModified = changes.filesModified.filter(
          (f): f is string => typeof f === "string",
        );
      }

      const inputTokens = asNumber(resultUsage.input_tokens, asNumber(resultUsage.inputTokens, 0));
      const cachedInputTokens = asNumber(resultUsage.cached_input_tokens, asNumber(resultUsage.cachedInputTokens, 0));
      const outputTokens = asNumber(resultUsage.output_tokens, asNumber(resultUsage.outputTokens, 0));
      if (inputTokens > 0) usage.inputTokens = inputTokens;
      if (cachedInputTokens > 0) usage.cachedInputTokens = cachedInputTokens;
      if (outputTokens > 0) usage.outputTokens = outputTokens;
      continue;
    }
  }

  return {
    sessionId,
    model,
    summary: messages.join("\n\n").trim(),
    usage,
    premiumRequests,
    totalApiDurationMs,
    sessionDurationMs,
    codeChanges,
    quotaError,
    errorMessage,
  };
}
