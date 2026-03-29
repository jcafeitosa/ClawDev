import pc from "picocolors";

function asErrorText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const obj = value as Record<string, unknown>;
  const message =
    (typeof obj.message === "string" && obj.message) ||
    (typeof obj.error === "string" && obj.error) ||
    (typeof obj.code === "string" && obj.code) ||
    "";
  if (message) return message;
  try {
    return JSON.stringify(obj);
  } catch {
    return "";
  }
}

export function printCopilotStreamEvent(raw: string, debug: boolean): void {
  const line = raw.trim();
  if (!line) return;

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    console.log(line);
    return;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  // Streaming delta
  if (type === "assistant.message_delta") {
    const delta =
      typeof parsed.delta === "object" && parsed.delta !== null && !Array.isArray(parsed.delta)
        ? (parsed.delta as Record<string, unknown>)
        : {};
    const text = typeof delta.text === "string" ? delta.text : "";
    if (text) {
      process.stdout.write(pc.green(text));
    }
    return;
  }

  // Full assistant message
  if (type === "assistant.message") {
    const content = Array.isArray(parsed.content) ? parsed.content : [];
    for (const blockRaw of content) {
      if (typeof blockRaw !== "object" || blockRaw === null || Array.isArray(blockRaw)) continue;
      const block = blockRaw as Record<string, unknown>;
      const blockType = typeof block.type === "string" ? block.type : "";
      if (blockType === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (text) console.log(pc.green(`assistant: ${text}`));
      } else if (blockType === "tool_use") {
        const name = typeof block.name === "string" ? block.name : "unknown";
        console.log(pc.yellow(`tool_call: ${name}`));
        if (block.input !== undefined) {
          console.log(pc.gray(JSON.stringify(block.input, null, 2)));
        }
      }
    }
    return;
  }

  // Turn start/end
  if (type === "assistant.turn_start") {
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    console.log(pc.blue(`Copilot turn started${sessionId ? ` (session: ${sessionId})` : ""}`));
    return;
  }

  if (type === "assistant.turn_end") {
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    console.log(pc.blue(`Copilot turn ended${sessionId ? ` (session: ${sessionId})` : ""}`));
    return;
  }

  // User message
  if (type === "user.message") {
    if (debug) {
      const text =
        typeof parsed.text === "string"
          ? parsed.text
          : Array.isArray(parsed.content)
            ? parsed.content
                .filter((b: unknown): b is Record<string, unknown> => typeof b === "object" && b !== null)
                .map((b) => (typeof b.text === "string" ? b.text : ""))
                .filter(Boolean)
                .join(" ")
            : "";
      if (text) console.log(pc.cyan(`user: ${text}`));
    }
    return;
  }

  // Result event
  if (type === "result") {
    const usage =
      typeof parsed.usage === "object" && parsed.usage !== null && !Array.isArray(parsed.usage)
        ? (parsed.usage as Record<string, unknown>)
        : {};
    const input = Number(usage.input_tokens ?? usage.inputTokens ?? 0);
    const output = Number(usage.output_tokens ?? usage.outputTokens ?? 0);
    const cached = Number(usage.cache_read_input_tokens ?? usage.cachedInputTokens ?? 0);
    const premiumRequests = Number(usage.premiumRequests ?? 0);
    const totalApiDurationMs = Number(usage.totalApiDurationMs ?? 0);
    const cost = Number(parsed.total_cost_usd ?? parsed.costUsd ?? 0);
    const exitCode = Number(parsed.exitCode ?? 0);
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "";
    const isError = parsed.is_error === true || (exitCode !== 0);
    const resultText = typeof parsed.result === "string" ? parsed.result : "";
    if (resultText) {
      console.log(pc.green("result:"));
      console.log(resultText);
    }
    const errors = Array.isArray(parsed.errors) ? parsed.errors.map(asErrorText).filter(Boolean) : [];
    if (subtype.startsWith("error") || isError || errors.length > 0) {
      console.log(
        pc.red(`copilot_result: exitCode=${exitCode} subtype=${subtype || "unknown"} is_error=${isError ? "true" : "false"}`),
      );
      if (errors.length > 0) {
        console.log(pc.red(`copilot_errors: ${errors.join(" | ")}`));
      }
    }
    const tokenLine = `tokens: in=${Number.isFinite(input) ? input : 0} out=${Number.isFinite(output) ? output : 0} cached=${Number.isFinite(cached) ? cached : 0}`;
    const costLine = cost > 0 ? ` cost=$${Number.isFinite(cost) ? cost.toFixed(6) : "0.000000"}` : "";
    const premiumLine = premiumRequests > 0 ? ` premium_requests=${premiumRequests}` : "";
    const durationLine = totalApiDurationMs > 0 ? ` api_duration=${totalApiDurationMs}ms` : "";
    console.log(pc.blue(`${tokenLine}${costLine}${premiumLine}${durationLine}`));
    return;
  }

  if (debug) {
    console.log(pc.gray(line));
  }
}
