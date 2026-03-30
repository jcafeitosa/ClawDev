import { asString, asNumber, parseObject, parseJson } from "@clawdev/adapter-utils/server-utils";

export function parseCopilotOutput(stdout: string) {
  let sessionId: string | null = null;
  const messages: string[] = [];
  let errorMessage: string | null = null;
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
      // Plain text output from copilot CLI — treat as a message
      if (line.length > 0) messages.push(line);
      continue;
    }

    const type = asString(event.type, "");

    if (type === "session.started" || type === "thread.started") {
      sessionId =
        asString(event.session_id, "") ||
        asString(event.thread_id, "") ||
        sessionId;
      continue;
    }

    if (type === "error") {
      const msg = asString(event.message, "").trim();
      if (msg) errorMessage = msg;
      continue;
    }

    if (type === "message" || type === "item.completed") {
      const item = parseObject(event.item ?? event);
      const text = asString(item.text, asString(item.content, ""));
      if (text) messages.push(text);
      continue;
    }

    if (type === "turn.completed" || type === "usage") {
      const usageObj = parseObject(event.usage ?? event);
      usage.inputTokens = asNumber(usageObj.input_tokens, usage.inputTokens);
      usage.cachedInputTokens = asNumber(usageObj.cached_input_tokens, usage.cachedInputTokens);
      usage.outputTokens = asNumber(usageObj.output_tokens, usage.outputTokens);
      continue;
    }

    if (type === "turn.failed") {
      const err = parseObject(event.error);
      const msg = asString(err.message, "").trim();
      if (msg) errorMessage = msg;
    }
  }

  return {
    sessionId,
    summary: messages.join("\n\n").trim(),
    usage,
    errorMessage,
  };
}
