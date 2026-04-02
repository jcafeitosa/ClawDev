/** Live run transcript store — keeps dashboard run previews in sync with live events and log polling. */

import { api } from "$lib/api";
import { liveEventsStore, type LiveEvent } from "./live-events.svelte.js";

type TranscriptStream = "stdout" | "stderr" | "system";

interface TranscriptChunk {
  ts: string;
  stream: TranscriptStream;
  chunk: string;
}

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
let chunksByRun = $state(new Map<string, TranscriptChunk[]>());
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

function appendLiveChunk(runId: string, chunk: TranscriptChunk) {
  const next = new Map(chunksByRun);
  const existing = [...(next.get(runId) ?? [])];
  existing.push(chunk);
  next.set(runId, existing.slice(-120));
  chunksByRun = next;
}

async function readRunTranscript(run: RunLike) {
  const offset = transcriptOffsetByRun.get(run.id) ?? 0;
  try {
    const res = await api(`/api/heartbeat-runs/${run.id}/transcript?offset=${offset}&limitBytes=${LIMIT_BYTES}`);
    if (!res.ok) return;
    const data = await res.json();
    const content = typeof data?.content === "string" ? data.content : "";
    if (content) {
      const lines = content.split("\n").map((line: string) => line.trim()).filter(Boolean);
      for (const line of lines) {
        appendLiveChunk(run.id, { ts: new Date().toISOString(), stream: "stdout", chunk: line });
      }
    }
    if (Number.isFinite(data?.nextOffset)) {
      transcriptOffsetByRun.set(run.id, Number(data.nextOffset));
    } else if (content.length > 0) {
      transcriptOffsetByRun.set(run.id, offset + content.length);
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
  const nextChunks = new Map<string, TranscriptChunk[]>();
  for (const [runId, chunks] of chunksByRun) {
    if (knownRunIds.has(runId)) {
      nextChunks.set(runId, chunks);
    }
  }
  if (nextChunks.size !== chunksByRun.size) {
    chunksByRun = nextChunks;
  }

  for (const runId of transcriptOffsetByRun.keys()) {
    if (!knownRunIds.has(runId)) {
      transcriptOffsetByRun.delete(runId);
    }
  }
}

function syncEvent(event: LiveEvent) {
  const payload = event.payload ?? {};
  const runId = typeof payload.runId === "string" && payload.runId.trim() ? payload.runId : null;
  if (!runId) return;

  if (event.type === "heartbeat.run.log") {
    const chunk = typeof payload.chunk === "string" ? payload.chunk : "";
    if (!chunk) return;
    appendLiveChunk(runId, {
      ts: typeof payload.ts === "string" ? payload.ts : event.createdAt,
      stream: payload.stream === "stderr" ? "stderr" : payload.stream === "system" ? "system" : "stdout",
      chunk,
    });
    return;
  }

  if (event.type === "heartbeat.run.event") {
    const message = typeof payload.message === "string" && payload.message.trim()
      ? payload.message
      : typeof payload.eventType === "string"
        ? payload.eventType
        : "";
    if (!message) return;
    appendLiveChunk(runId, {
      ts: event.createdAt,
      stream: payload.level === "error" ? "stderr" : "system",
      chunk: message,
    });
    return;
  }

  if (event.type === "heartbeat.run.status") {
    const status = typeof payload.status === "string" ? payload.status : "";
    if (!status) return;
    appendLiveChunk(runId, {
      ts: event.createdAt,
      stream: status === "failed" || status === "timed_out" || status === "cancelled" ? "stderr" : "system",
      chunk: `run ${status}`,
    });
  }
}

export const liveRunTranscriptsStore = {
  get chunksByRun() {
    return chunksByRun;
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
  stdout(run: RunLike): string {
    const live = (chunksByRun.get(run.id) ?? [])
      .filter((entry) => entry.stream === "stdout" || entry.stream === "system")
      .map((entry) => entry.chunk)
      .join("\n");
    return cleanExcerpt([run.stdoutExcerpt, live, run.lastTranscriptLine, run.lastMessage, run.summary].filter(Boolean).join("\n"));
  },
  stderr(run: RunLike): string {
    const live = (chunksByRun.get(run.id) ?? [])
      .filter((entry) => entry.stream === "stderr")
      .map((entry) => entry.chunk)
      .join("\n");
    return cleanExcerpt([run.stderrExcerpt, live].filter(Boolean).join("\n"));
  },
};
