/** Live run transcript store — keeps dashboard run previews in sync with live events and log polling. */

import { api } from "$lib/api";
import {
  buildTranscriptFromLog,
  normalizeTranscript,
  type TranscriptBlock,
  type TranscriptEntry,
} from "$lib/transcript/run-transcript";
import { liveEventsStore, type LiveEvent } from "./live-events.svelte.js";

interface RunLike {
  id: string;
  status?: string | null;
  stdoutExcerpt?: string | null;
  stderrExcerpt?: string | null;
  lastTranscriptLine?: string | null;
  lastMessage?: string | null;
  summary?: string | null;
}

const POLL_INTERVAL_MS = 2000;
const LIMIT_BYTES = 256_000;

let companyId: string | null = null;
let runs: RunLike[] = [];
let active = false;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let transcriptOffsetByRun = new Map<string, number>();
let entriesByRun = $state(new Map<string, TranscriptEntry[]>());
let seenEntryKeysByRun = new Map<string, Set<string>>();
let liveEventsUnsubscribe: (() => void) | null = null;

function isTerminalStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "timed_out" || status === "cancelled" || status === "succeeded";
}

function cleanExcerpt(raw: string | null | undefined, maxLines = 5): string {
  if (!raw) return "";
  const lines = String(raw)
    .split("\n")
    .map((line) => line.replace(/^\[clawdev\]\s*/i, "").trim())
    .filter((line) => line.length > 0 && !/^\/?Users\//.test(line) && !/^Injected\s/i.test(line) && !/^Using ClawDev-managed/i.test(line) && !/^seeded from/i.test(line));
  return lines.slice(-maxLines).join("\n");
}

function makeEntryKey(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case "assistant":
    case "user":
    case "thinking":
    case "stderr":
    case "stdout":
    case "system":
      return `${entry.kind}:${entry.ts}:${entry.text}`;
    case "tool_call":
      return `${entry.kind}:${entry.ts}:${entry.toolUseId ?? ""}:${entry.name}:${JSON.stringify(entry.input ?? null)}`;
    case "tool_result":
      return `${entry.kind}:${entry.ts}:${entry.toolUseId}:${entry.content}:${entry.isError ? "1" : "0"}`;
    case "init":
      return `${entry.kind}:${entry.ts}:${entry.model}:${entry.sessionId}`;
    case "result":
      return `${entry.kind}:${entry.ts}:${entry.text}:${entry.subtype}:${entry.isError ? "1" : "0"}`;
  }
}

function appendEntries(runId: string, nextEntries: TranscriptEntry[]) {
  if (nextEntries.length === 0) return;
  const next = new Map(entriesByRun);
  const existing = [...(next.get(runId) ?? [])];
  const seen = seenEntryKeysByRun.get(runId) ?? new Set<string>();
  let changed = false;

  for (const entry of nextEntries) {
    const key = makeEntryKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    existing.push(entry);
    changed = true;
  }

  if (!changed) return;
  seenEntryKeysByRun.set(runId, seen);
  next.set(runId, existing.slice(-220));
  entriesByRun = next;
}

async function readRunTranscript(run: RunLike) {
  const offset = transcriptOffsetByRun.get(run.id) ?? 0;
  try {
    const res = await api(`/api/heartbeat-runs/${run.id}/transcript?offset=${offset}&limitBytes=${LIMIT_BYTES}`);
    if (!res.ok) return;
    const data = await res.json();
    const parsedEntries = buildTranscriptFromLog(typeof data?.content === "string" ? data.content : "");
    appendEntries(run.id, parsedEntries);

    if (Number.isFinite(data?.nextOffset)) {
      transcriptOffsetByRun.set(run.id, Number(data.nextOffset));
    } else if (typeof data?.content === "string" && data.content.length > 0) {
      transcriptOffsetByRun.set(run.id, offset + data.content.length);
    }
  } catch {
    // Ignore transient read failures while runs are booting.
  }
}

async function refreshTranscripts() {
  if (!active) return;
  const activeRuns = runs.filter((run) => !isTerminalStatus(run.status));
  await Promise.all(activeRuns.map((run) => readRunTranscript(run)));
}

function pruneState(knownRunIds: Set<string>) {
  const nextEntries = new Map<string, TranscriptEntry[]>();
  for (const [runId, entries] of entriesByRun) {
    if (knownRunIds.has(runId)) {
      nextEntries.set(runId, entries);
    }
  }
  if (nextEntries.size !== entriesByRun.size) {
    entriesByRun = nextEntries;
  }

  for (const [runId, seen] of seenEntryKeysByRun) {
    if (!knownRunIds.has(runId)) {
      seenEntryKeysByRun.delete(runId);
      continue;
    }
    if ((entriesByRun.get(runId) ?? []).length === 0) {
      seen.clear();
    }
  }

  for (const runId of transcriptOffsetByRun.keys()) {
    if (!knownRunIds.has(runId)) {
      transcriptOffsetByRun.delete(runId);
    }
  }
}

function appendLiveEventEntry(runId: string, event: LiveEvent) {
  const payload = event.payload ?? {};

  if (event.type === "heartbeat.run.log") {
    const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
    if (!chunk) return;
    appendEntries(runId, [{ kind: "stdout", ts: typeof payload.ts === "string" ? payload.ts : event.createdAt, text: chunk }]);
    return;
  }

  if (event.type === "heartbeat.run.event") {
    const message = typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : typeof payload.eventType === "string" && payload.eventType.trim()
        ? payload.eventType
        : "";
    if (!message) return;
    appendEntries(runId, [{ kind: "system", ts: event.createdAt, text: message }]);
    return;
  }

  if (event.type === "heartbeat.run.status") {
    const status = typeof payload.status === "string" ? payload.status : "";
    if (!status) return;
    appendEntries(runId, [{ kind: "system", ts: event.createdAt, text: `run ${status}` }]);
  }
}

function syncEvent(event: LiveEvent) {
  const payload = event.payload ?? {};
  const runId = typeof payload.runId === "string" && payload.runId.trim() ? payload.runId : null;
  if (!runId) return;

  appendLiveEventEntry(runId, event);
}

function flattenBlocksToText(blocks: TranscriptBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "message":
        case "thinking":
        case "stdout":
          return block.text;
        case "tool":
          return block.result ?? "";
        case "tool_group":
          return block.items.map((item) => item.result ?? item.name).join("\n");
        case "command_group":
          return block.items.map((item) => item.result ?? "").join("\n");
        case "stderr_group":
          return block.lines.map((line) => line.text).join("\n");
        case "activity":
          return block.name;
        case "event":
          return block.text;
      }
    })
    .filter((text) => text.trim().length > 0)
    .join("\n");
}

function blocksForRun(run: RunLike): TranscriptBlock[] {
  const entries = entriesByRun.get(run.id) ?? [];
  return normalizeTranscript(entries, !isTerminalStatus(run.status));
}

export const liveRunTranscriptsStore = {
  get entriesByRun() {
    return entriesByRun;
  },
  init(nextCompanyId: string | null, nextRuns: RunLike[]) {
    companyId = nextCompanyId;
    runs = nextRuns;
    active = !!companyId;
    pruneState(new Set(nextRuns.map((run) => run.id)));

    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (liveEventsUnsubscribe) {
      liveEventsUnsubscribe();
      liveEventsUnsubscribe = null;
    }

    if (!companyId) return;

    refreshTimer = setInterval(() => {
      void refreshTranscripts();
    }, POLL_INTERVAL_MS);

    liveEventsUnsubscribe = liveEventsStore.on((event) => {
      if (event.companyId !== companyId) return;
      syncEvent(event);
    });

    void refreshTranscripts();
  },
  updateRuns(nextRuns: RunLike[]) {
    runs = nextRuns;
    pruneState(new Set(nextRuns.map((run) => run.id)));
  },
  disconnect() {
    active = false;
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (liveEventsUnsubscribe) {
      liveEventsUnsubscribe();
      liveEventsUnsubscribe = null;
    }
    companyId = null;
    runs = [];
  },
  blocks(run: RunLike): TranscriptBlock[] {
    return blocksForRun(run);
  },
  messages(run: RunLike) {
    return blocksForRun(run).flatMap((block) => {
      if (block.type === "message") {
        return [{ timestamp: block.ts, role: block.role, text: block.text, content: block.text }];
      }
      if (block.type === "thinking") {
        return [{ timestamp: block.ts, role: "system", text: block.text, content: block.text }];
      }
      if (block.type === "tool") {
        return [{ timestamp: block.ts, role: "tool", text: block.result ?? block.name, content: block.result ?? block.name }];
      }
      if (block.type === "tool_group") {
        return block.items.map((item) => ({ timestamp: item.ts, role: "tool", text: item.result ?? item.name, content: item.result ?? item.name }));
      }
      if (block.type === "command_group") {
        return block.items.map((item) => ({ timestamp: item.ts, role: "tool", text: item.result ?? "command", content: item.result ?? "command" }));
      }
      if (block.type === "stderr_group") {
        return block.lines.map((line) => ({ timestamp: line.ts, role: "system", text: line.text, content: line.text }));
      }
      if (block.type === "stdout") {
        return [{ timestamp: block.ts, role: "system", text: block.text, content: block.text }];
      }
      if (block.type === "activity" || block.type === "event") {
        return [{ timestamp: block.ts, role: "system", text: block.type === "activity" ? block.name : block.text, content: block.type === "activity" ? block.name : block.text }];
      }
      return [];
    });
  },
  stdout(run: RunLike): string {
    const blocks = blocksForRun(run);
    const live = flattenBlocksToText(blocks);
    return cleanExcerpt([run.stdoutExcerpt, live, run.lastTranscriptLine, run.lastMessage, run.summary].filter(Boolean).join("\n"));
  },
  stderr(run: RunLike): string {
    const blocks = blocksForRun(run);
    const live = blocks
      .filter((entry) => entry.type === "stderr_group" || (entry.type === "event" && entry.tone === "error"))
      .flatMap((entry) => {
        if (entry.type === "stderr_group") return entry.lines.map((line) => line.text);
        if (entry.type === "event") return [entry.text];
        return [];
      })
      .join("\n");
    return cleanExcerpt([run.stderrExcerpt, live].filter(Boolean).join("\n"));
  },
};
