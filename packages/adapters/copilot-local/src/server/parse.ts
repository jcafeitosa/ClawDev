import { asString, asNumber, parseObject, parseJson } from "@clawdev/adapter-utils/server-utils";

export function parseCopilotOutput(stdout: string) {
  let sessionId: string | null = null;
  const messages: string[] = [];
  let errorMessage: string | null = null;
  let model: string | null = null;
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

    if (type === "error" || type === "turn.failed") {
      const msg = asString(data.message, asString(event.message, "")).trim();
      if (msg) errorMessage = msg;
      continue;
    }

    if (type === "result") {
      sessionId = asString(event.sessionId, sessionId ?? "") || sessionId;
      const resultUsage = parseObject(data.usage ?? event.usage);
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
    errorMessage,
  };
}
