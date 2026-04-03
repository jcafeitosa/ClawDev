export type TranscriptEntry =
  | { kind: "assistant"; ts: string; text: string; delta?: boolean }
  | { kind: "user"; ts: string; text: string }
  | { kind: "thinking"; ts: string; text: string; delta?: boolean }
  | { kind: "tool_call"; ts: string; name: string; toolUseId?: string; input: unknown }
  | { kind: "tool_result"; ts: string; toolUseId: string; content: string; isError?: boolean; toolName?: string }
  | { kind: "init"; ts: string; model: string; sessionId: string }
  | { kind: "result"; ts: string; text: string; inputTokens: number; outputTokens: number; cachedTokens: number; costUsd: number; subtype: string; isError: boolean; errors: string[] }
  | { kind: "stderr"; ts: string; text: string }
  | { kind: "stdout"; ts: string; text: string }
  | { kind: "system"; ts: string; text: string };

export type TranscriptBlock =
  | { type: "message"; role: "assistant" | "user"; ts: string; text: string; streaming: boolean }
  | { type: "thinking"; ts: string; text: string; streaming: boolean }
  | { type: "tool"; ts: string; endTs?: string; name: string; toolUseId?: string; input: unknown; result?: string; isError?: boolean; status: "running" | "completed" | "error" }
  | { type: "activity"; ts: string; activityId?: string; name: string; status: "running" | "completed" }
  | { type: "command_group"; ts: string; endTs?: string; items: CommandItem[] }
  | { type: "tool_group"; ts: string; endTs?: string; items: ToolGroupItem[] }
  | { type: "stderr_group"; ts: string; endTs?: string; lines: { ts: string; text: string }[] }
  | { type: "stdout"; ts: string; text: string }
  | { type: "event"; ts: string; label: string; tone: "info" | "warn" | "error" | "neutral"; text: string };

export type CommandItem = { ts: string; endTs?: string; input: unknown; result?: string; isError?: boolean; status: "running" | "completed" | "error" };
export type ToolGroupItem = { ts: string; endTs?: string; name: string; input: unknown; result?: string; isError?: boolean; status: "running" | "completed" | "error" };

function asRec(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function compactWs(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function trunc(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function humanize(s: string) {
  return s.replace(/[_-]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function stripWrappedShell(cmd: string): string {
  const t = compactWs(cmd);
  const m = t.match(/^(?:(?:\/bin\/)?(?:zsh|bash|sh)|cmd(?:\.exe)?(?:\s+\/[dsc])*)\s+(?:-lc|\/c)\s+(.+)$/i);
  const inner = m?.[1] ?? t;
  const q = inner.match(/^(['"])([\s\S]*)\1$/);
  return compactWs(q?.[2] ?? inner);
}

export function isCommandTool(name: string, input: unknown): boolean {
  if (["command_execution", "shell", "shellToolCall", "bash"].includes(name)) return true;
  if (typeof input === "string") return /\b(?:bash|zsh|sh|cmd|powershell)\b/i.test(input);
  const r = asRec(input);
  return Boolean(r && (typeof r.command === "string" || typeof r.cmd === "string"));
}

export function displayToolName(name: string, input: unknown): string {
  return isCommandTool(name, input) ? "Executing command" : humanize(name);
}

export function parseStructuredResult(result: string | undefined) {
  if (!result) return null;
  const lines = result.split(/\r?\n/);
  const meta = new Map<string, string>();
  let bodyStart = lines.findIndex((l) => l.trim() === "");
  if (bodyStart === -1) bodyStart = lines.length;
  for (let i = 0; i < bodyStart; i++) {
    const m = lines[i]?.match(/^([a-z_]+):\s*(.+)$/i);
    if (m) meta.set(m[1].toLowerCase(), compactWs(m[2]));
  }
  const body = lines.slice(Math.min(bodyStart + 1, lines.length)).map((l) => compactWs(l)).filter(Boolean).join("\n");
  return { command: meta.get("command") ?? null, status: meta.get("status") ?? null, exitCode: meta.get("exit_code") ?? null, body };
}

export function summarizeToolInput(name: string, input: unknown): string {
  if (typeof input === "string") return trunc(isCommandTool(name, input) ? stripWrappedShell(input) : compactWs(input), 120);
  const r = asRec(input);
  if (!r) return trunc(compactWs(String(input)), 120);
  const cmd = typeof r.command === "string" ? r.command : typeof r.cmd === "string" ? r.cmd : null;
  if (cmd && isCommandTool(name, r)) return trunc(stripWrappedShell(cmd), 120);
  for (const k of ["command", "cmd", "path", "filePath", "file_path", "query", "url", "prompt", "message", "pattern", "name"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return trunc(compactWs(v), 120);
  }
  const keys = Object.keys(r);
  if (keys.length === 0) return `No ${name} input`;
  return trunc(`${keys.length} fields: ${keys.slice(0, 3).join(", ")}`, 120);
}

export function summarizeToolResult(result: string | undefined, isError: boolean | undefined): string {
  if (!result) return isError ? "Tool failed" : "Waiting for result";
  const s = parseStructuredResult(result);
  if (s) {
    if (s.body) return trunc(s.body.split("\n")[0] ?? s.body, 140);
    if (s.status === "completed") return "Completed";
    if (s.status === "failed" || s.status === "error") return s.exitCode ? `Failed with exit code ${s.exitCode}` : "Failed";
  }
  const firstLine = result.split(/\r?\n/).map((l) => compactWs(l)).filter(Boolean)[0] ?? result;
  return trunc(firstLine, 140);
}

export function parseSystemActivity(text: string): { activityId?: string; name: string; status: "running" | "completed" } | null {
  const m = text.match(/^item (started|completed):\s*([a-z0-9_-]+)(?:\s+\(id=([^)]+)\))?$/i);
  if (!m) return null;
  return {
    status: m[1].toLowerCase() === "started" ? "running" : "completed",
    name: humanize(m[2] ?? "Activity"),
    activityId: m[3] || undefined,
  };
}

export function parseClaudeStdoutLine(line: string, ts: string): TranscriptEntry[] {
  let parsed: Record<string, unknown> | null;
  try {
    parsed = asRec(JSON.parse(line));
  } catch {
    parsed = null;
  }
  if (!parsed) return [{ kind: "stdout", ts, text: line }];

  const type = typeof parsed.type === "string" ? parsed.type : "";

  if (type === "system" && parsed.subtype === "init") {
    return [{
      kind: "init",
      ts,
      model: typeof parsed.model === "string" ? parsed.model : "unknown",
      sessionId: typeof parsed.session_id === "string" ? parsed.session_id : "",
    }];
  }

  if (type === "assistant") {
    const msg = asRec(parsed.message) ?? {};
    const content = Array.isArray(msg.content) ? msg.content : [];
    const entries: TranscriptEntry[] = [];
    for (const raw of content) {
      const block = asRec(raw);
      if (!block) continue;
      const bt = typeof block.type === "string" ? block.type : "";
      if (bt === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (text) entries.push({ kind: "assistant", ts, text });
      } else if (bt === "thinking") {
        const text = typeof block.thinking === "string" ? block.thinking : "";
        if (text) entries.push({ kind: "thinking", ts, text });
      } else if (bt === "tool_use") {
        entries.push({
          kind: "tool_call",
          ts,
          name: typeof block.name === "string" ? block.name : "unknown",
          toolUseId: typeof block.id === "string" ? block.id : undefined,
          input: block.input ?? {},
        });
      }
    }
    return entries.length > 0 ? entries : [{ kind: "stdout", ts, text: line }];
  }

  if (type === "user") {
    const msg = asRec(parsed.message) ?? {};
    const content = Array.isArray(msg.content) ? msg.content : [];
    const entries: TranscriptEntry[] = [];
    for (const raw of content) {
      const block = asRec(raw);
      if (!block) continue;
      const bt = typeof block.type === "string" ? block.type : "";
      if (bt === "text") {
        const text = typeof block.text === "string" ? block.text : "";
        if (text) entries.push({ kind: "user", ts, text });
      } else if (bt === "tool_result") {
        const toolUseId = typeof block.tool_use_id === "string" ? block.tool_use_id : "";
        const isError = block.is_error === true;
        let text = "";
        if (typeof block.content === "string") {
          text = block.content;
        } else if (Array.isArray(block.content)) {
          text = block.content.map((p: unknown) => {
            const r = asRec(p);
            return r && typeof r.text === "string" ? r.text : "";
          }).filter(Boolean).join("\n");
        }
        entries.push({ kind: "tool_result", ts, toolUseId, content: text, isError });
      }
    }
    if (entries.length > 0) return entries;
  }

  if (type === "result") {
    const usage = asRec(parsed.usage) ?? {};
    return [{
      kind: "result",
      ts,
      text: typeof parsed.result === "string" ? parsed.result : "",
      inputTokens: Number(usage.input_tokens ?? 0),
      outputTokens: Number(usage.output_tokens ?? 0),
      cachedTokens: Number(usage.cache_read_input_tokens ?? 0),
      costUsd: typeof parsed.total_cost_usd === "number" ? parsed.total_cost_usd : 0,
      subtype: typeof parsed.subtype === "string" ? parsed.subtype : "",
      isError: parsed.is_error === true,
      errors: Array.isArray(parsed.errors) ? parsed.errors.map((e: unknown) => typeof e === "string" ? e : String(e)).filter(Boolean) : [],
    }];
  }

  return [{ kind: "stdout", ts, text: line }];
}

export function buildTranscriptFromLog(logText: string): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  let stdoutBuf = "";
  const lines = logText.split("\n");
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    let chunk: { ts?: unknown; stream?: unknown; chunk?: unknown } | null;
    try {
      chunk = asRec(JSON.parse(trimmed)) as { ts?: unknown; stream?: unknown; chunk?: unknown } | null;
    } catch {
      continue;
    }
    if (!chunk || typeof chunk.chunk !== "string") continue;

    const ts = typeof chunk.ts === "string" ? chunk.ts : new Date().toISOString();
    const stream = chunk.stream === "stderr" ? "stderr" : chunk.stream === "system" ? "system" : "stdout";

    if (stream === "stderr") {
      entries.push({ kind: "stderr", ts, text: chunk.chunk });
      continue;
    }
    if (stream === "system") {
      entries.push({ kind: "system", ts, text: chunk.chunk });
      continue;
    }

    const combined = stdoutBuf + chunk.chunk;
    const parts = combined.split(/\r?\n/);
    stdoutBuf = parts.pop() ?? "";
    for (const line of parts) {
      const t = line.trim();
      if (t) entries.push(...parseClaudeStdoutLine(t, ts));
    }
  }

  const trailing = stdoutBuf.trim();
  if (trailing) entries.push(...parseClaudeStdoutLine(trailing, new Date().toISOString()));
  return entries;
}

export function normalizeTranscript(entries: TranscriptEntry[], streaming: boolean): TranscriptBlock[] {
  const blocks: TranscriptBlock[] = [];
  const pendingTools = new Map<string, Extract<TranscriptBlock, { type: "tool" }>>();
  const pendingActivity = new Map<string, Extract<TranscriptBlock, { type: "activity" }>>();

  for (const entry of entries) {
    const prev = blocks[blocks.length - 1];

    if (entry.kind === "assistant" || entry.kind === "user") {
      const isStreaming = streaming && entry.kind === "assistant" && entry.delta === true;
      if (prev?.type === "message" && prev.role === entry.kind) {
        prev.text += prev.text.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`;
        prev.ts = entry.ts;
        prev.streaming = prev.streaming || isStreaming;
      } else {
        blocks.push({ type: "message", role: entry.kind, ts: entry.ts, text: entry.text, streaming: isStreaming });
      }
      continue;
    }

    if (entry.kind === "thinking") {
      if (prev?.type === "thinking") {
        prev.text += prev.text.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`;
        prev.ts = entry.ts;
      } else {
        blocks.push({ type: "thinking", ts: entry.ts, text: entry.text, streaming: streaming && entry.delta === true });
      }
      continue;
    }

    if (entry.kind === "tool_call") {
      const tb: Extract<TranscriptBlock, { type: "tool" }> = {
        type: "tool",
        ts: entry.ts,
        name: displayToolName(entry.name, entry.input),
        toolUseId: entry.toolUseId,
        input: entry.input,
        status: "running",
      };
      blocks.push(tb);
      if (tb.toolUseId) pendingTools.set(tb.toolUseId, tb);
      continue;
    }

    if (entry.kind === "tool_result") {
      const matched = (entry.toolUseId ? pendingTools.get(entry.toolUseId) : undefined)
        ?? [...blocks].reverse().find((b): b is Extract<TranscriptBlock, { type: "tool" }> => b.type === "tool" && b.status === "running");
      if (matched) {
        matched.result = entry.content;
        matched.isError = entry.isError;
        matched.status = entry.isError ? "error" : "completed";
        matched.endTs = entry.ts;
        if (entry.toolUseId) pendingTools.delete(entry.toolUseId);
      } else {
        blocks.push({
          type: "tool",
          ts: entry.ts,
          endTs: entry.ts,
          name: entry.toolName ?? "tool",
          toolUseId: entry.toolUseId,
          input: null,
          result: entry.content,
          isError: entry.isError,
          status: entry.isError ? "error" : "completed",
        });
      }
      continue;
    }

    if (entry.kind === "init") {
      blocks.push({ type: "event", ts: entry.ts, label: "init", tone: "info", text: `model ${entry.model}${entry.sessionId ? ` • session ${entry.sessionId}` : ""}` });
      continue;
    }

    if (entry.kind === "result") {
      blocks.push({
        type: "event",
        ts: entry.ts,
        label: "result",
        tone: entry.isError ? "error" : "info",
        text: entry.text.trim() || entry.errors[0] || (entry.isError ? "Run failed" : "Completed"),
      });
      continue;
    }

    if (entry.kind === "stderr") {
      if (prev?.type === "stderr_group") {
        prev.lines.push({ ts: entry.ts, text: entry.text });
        prev.endTs = entry.ts;
      } else {
        blocks.push({ type: "stderr_group", ts: entry.ts, endTs: entry.ts, lines: [{ ts: entry.ts, text: entry.text }] });
      }
      continue;
    }

    if (entry.kind === "system") {
      if (compactWs(entry.text).toLowerCase() === "turn started") continue;
      const act = parseSystemActivity(entry.text);
      if (act) {
        const existing = act.activityId ? pendingActivity.get(act.activityId) : undefined;
        if (existing) {
          existing.status = act.status;
          existing.ts = entry.ts;
          if (act.status === "completed" && act.activityId) pendingActivity.delete(act.activityId);
        } else {
          const ab: Extract<TranscriptBlock, { type: "activity" }> = { type: "activity", ts: entry.ts, activityId: act.activityId, name: act.name, status: act.status };
          blocks.push(ab);
          if (act.status === "running" && act.activityId) pendingActivity.set(act.activityId, ab);
        }
        continue;
      }
      blocks.push({ type: "event", ts: entry.ts, label: "system", tone: "warn", text: entry.text });
      continue;
    }

    const activeCmd = [...blocks].reverse().find((b): b is Extract<TranscriptBlock, { type: "tool" }> => b.type === "tool" && b.status === "running" && isCommandTool(b.name, b.input));
    if (activeCmd) {
      activeCmd.result = activeCmd.result
        ? `${activeCmd.result}${activeCmd.result.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`}`
        : entry.text;
      continue;
    }
    if (prev?.type === "stdout") {
      prev.text += prev.text.endsWith("\n") || entry.text.startsWith("\n") ? entry.text : `\n${entry.text}`;
      prev.ts = entry.ts;
    } else {
      blocks.push({ type: "stdout", ts: entry.ts, text: entry.text });
    }
  }

  return groupToolBlocks(groupCommandBlocks(blocks));
}

export function groupCommandBlocks(blocks: TranscriptBlock[]): TranscriptBlock[] {
  const out: TranscriptBlock[] = [];
  let pending: CommandItem[] = [];
  let gTs: string | null = null;
  let gEnd: string | undefined;
  const flush = () => {
    if (!pending.length || !gTs) return;
    out.push({ type: "command_group", ts: gTs, endTs: gEnd, items: pending });
    pending = [];
    gTs = null;
    gEnd = undefined;
  };
  for (const b of blocks) {
    if (b.type === "tool" && isCommandTool(b.name, b.input)) {
      if (!gTs) gTs = b.ts;
      gEnd = b.endTs ?? b.ts;
      pending.push({ ts: b.ts, endTs: b.endTs, input: b.input, result: b.result, isError: b.isError, status: b.status });
    } else {
      flush();
      out.push(b);
    }
  }
  flush();
  return out;
}

export function groupToolBlocks(blocks: TranscriptBlock[]): TranscriptBlock[] {
  const out: TranscriptBlock[] = [];
  let pending: ToolGroupItem[] = [];
  let gTs: string | null = null;
  let gEnd: string | undefined;
  const flush = () => {
    if (!pending.length || !gTs) return;
    if (pending.length === 1) {
      const item = pending[0]!;
      out.push({ type: "tool", ts: item.ts, endTs: item.endTs, name: item.name, input: item.input, result: item.result, isError: item.isError, status: item.status });
    } else {
      out.push({ type: "tool_group", ts: gTs, endTs: gEnd, items: pending });
    }
    pending = [];
    gTs = null;
    gEnd = undefined;
  };
  for (const b of blocks) {
    if (b.type === "tool" && !isCommandTool(b.name, b.input)) {
      if (!gTs) gTs = b.ts;
      gEnd = b.endTs ?? b.ts;
      pending.push({ ts: b.ts, endTs: b.endTs, name: b.name, input: b.input, result: b.result, isError: b.isError, status: b.status });
    } else {
      flush();
      out.push(b);
    }
  }
  flush();
  return out;
}
