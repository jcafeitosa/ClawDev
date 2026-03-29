import type { TranscriptEntry } from "@clawdev/adapter-utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  if (!rec) return "";
  const msg =
    (typeof rec.message === "string" && rec.message) ||
    (typeof rec.error === "string" && rec.error) ||
    (typeof rec.code === "string" && rec.code) ||
    "";
  if (msg) return msg;
  try {
    return JSON.stringify(rec);
  } catch {
    return "";
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Parse a single line of Copilot CLI JSONL output into TranscriptEntry items.
 *
 * Copilot JSONL event types:
 * - assistant.message_delta  — streaming content chunk
 * - assistant.message        — full assistant message with content blocks
 * - assistant.turn_start     — marks the beginning of an assistant turn
 * - assistant.turn_end       — marks the end of an assistant turn
 * - user.message             — user input message
 * - result                   — final result with sessionId, exitCode, usage
 */
export function parseCopilotStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const parsed = asRecord(safeJsonParse(line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: line }];
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";

  // Streaming delta — accumulate as assistant text
  if (type === "assistant.message_delta") {
    const delta = asRecord(parsed.delta) ?? {};
    const text = typeof delta.text === "string" ? delta.text : "";
    if (text) {
      return [{ kind: "assistant", ts, text }];
    }
    return [];
  }

  // Full assistant message — extract content blocks
  if (type === "assistant.message") {
    const content = Array.isArray(parsed.content) ? parsed.content : [];
    const entries: TranscriptEntry[] = [];
    for (const blockRaw of content) {
      const block = asRecord(blockRaw);
      if (!block) continue;
      const blockType = typeof block.type === "string" ? block.type : "";
      if (blockType === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (text) entries.push({ kind: "assistant", ts, text });
      } else if (blockType === "thinking") {
        const text = typeof block.thinking === "string" ? block.thinking : "";
        if (text) entries.push({ kind: "thinking", ts, text });
      } else if (blockType === "tool_use") {
        entries.push({
          kind: "tool_call",
          ts,
          name: typeof block.name === "string" ? block.name : "unknown",
          toolUseId:
            typeof block.id === "string"
              ? block.id
              : typeof block.tool_use_id === "string"
                ? block.tool_use_id
                : undefined,
          input: block.input ?? {},
        });
      }
    }
    return entries.length > 0 ? entries : [{ kind: "stdout", ts, text: line }];
  }

  // Turn start/end — system transcript markers
  if (type === "assistant.turn_start") {
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    return [{
      kind: "system",
      ts,
      text: `Copilot turn started${sessionId ? ` (session: ${sessionId})` : ""}`,
    }];
  }

  if (type === "assistant.turn_end") {
    const sessionId = typeof parsed.sessionId === "string" ? parsed.sessionId : "";
    return [{
      kind: "system",
      ts,
      text: `Copilot turn ended${sessionId ? ` (session: ${sessionId})` : ""}`,
    }];
  }

  // User message
  if (type === "user.message") {
    const content = Array.isArray(parsed.content) ? parsed.content : [];
    const entries: TranscriptEntry[] = [];
    for (const blockRaw of content) {
      const block = asRecord(blockRaw);
      if (!block) continue;
      const blockType = typeof block.type === "string" ? block.type : "";
      if (blockType === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (text) entries.push({ kind: "user", ts, text });
      } else if (blockType === "tool_result") {
        const toolUseId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
        const isError = block.is_error === true;
        let text = "";
        if (typeof block.content === "string") {
          text = block.content;
        } else if (Array.isArray(block.content)) {
          const parts: string[] = [];
          for (const part of block.content) {
            const p = asRecord(part);
            if (p && typeof p.text === "string") parts.push(p.text);
          }
          text = parts.join("\n");
        }
        entries.push({ kind: "tool_result", ts, toolUseId, content: text, isError });
      }
    }
    // Also handle flat text in user.message
    if (entries.length === 0 && typeof parsed.text === "string" && parsed.text) {
      entries.push({ kind: "user", ts, text: parsed.text });
    }
    if (entries.length > 0) return entries;
    // fall through to stdout for user messages without recognized blocks
  }

  // Result event
  if (type === "result") {
    const usage = asRecord(parsed.usage) ?? {};
    const inputTokens = asNumber(usage.input_tokens ?? usage.inputTokens);
    const outputTokens = asNumber(usage.output_tokens ?? usage.outputTokens);
    const cachedTokens = asNumber(usage.cache_read_input_tokens ?? usage.cachedInputTokens);
    const premiumRequests = asNumber(usage.premiumRequests);
    const totalApiDurationMs = asNumber(usage.totalApiDurationMs);
    const costUsd = asNumber(parsed.total_cost_usd ?? parsed.costUsd);
    const exitCode = asNumber(parsed.exitCode);
    const subtype = typeof parsed.subtype === "string" ? parsed.subtype : "";
    const isError = parsed.is_error === true || (exitCode !== 0 && exitCode !== -1);
    const errors = Array.isArray(parsed.errors) ? parsed.errors.map(errorText).filter(Boolean) : [];
    const text = typeof parsed.result === "string" ? parsed.result : "";
    return [{
      kind: "result",
      ts,
      text,
      inputTokens,
      outputTokens,
      cachedTokens,
      costUsd,
      subtype,
      isError,
      errors,
    }];
  }

  return [{ kind: "stdout", ts, text: line }];
}
