/** Live events store — WebSocket connection to live event stream with toast notifications */

import { companyStore } from "./company.svelte.js";
import { toastStore, type ToastInput } from "./toast.svelte.js";

export interface LiveEvent {
  id: number;
  companyId: string;
  type: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

type EventHandler = (event: LiveEvent) => void;

let connected = $state(false);
let ws: WebSocket | null = null;
let connectedCompanyId: string | null = null;
let pendingCompanyId: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
const handlers = new Set<EventHandler>();

/**
 * Deduplication map: tracks `eventType:entityId` -> last timestamp.
 * Prevents the same event from triggering a toast within the cooldown window.
 */
const TOAST_DEDUP_COOLDOWN_MS = 5000;
const toastDedupeMap = new Map<string, number>();

function buildWsUrl(companyId: string): string {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3100";
  return `${protocol}//${host}/api/companies/${companyId}/events/ws`;
}

function resetSocketHandlers(target: WebSocket) {
  target.onopen = null;
  target.onmessage = null;
  target.onerror = null;
  target.onclose = null;
}

function closeSocketQuietly(target: WebSocket | null) {
  if (!target) return;

  if (target.readyState === WebSocket.CONNECTING) {
    // Let the handshake finish and close afterward to avoid the noisy
    // "WebSocket is closed before the connection is established" browser error.
    target.onopen = () => {
      resetSocketHandlers(target);
      target.close(1000, "provider_unmount");
    };
    target.onmessage = null;
    target.onerror = () => undefined;
    target.onclose = null;
    return;
  }

  resetSocketHandlers(target);
  if (target.readyState === WebSocket.OPEN) {
    target.close(1000, "provider_unmount");
  }
}

function connect(companyId: string) {
  if (ws && connectedCompanyId === companyId) return;
  if (connectTimer && pendingCompanyId === companyId) return;
  disconnect();
  pendingCompanyId = companyId;
  const open = () => {
    const url = buildWsUrl(companyId);
    pendingCompanyId = null;
    connectedCompanyId = companyId;
    ws = new WebSocket(url);

    ws.onopen = () => {
      connected = true;
      reconnectDelay = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as LiveEvent;
        for (const handler of handlers) {
          handler(data);
        }
        processEventToast(data);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      connected = false;
      scheduleReconnect(companyId);
    };

    ws.onerror = () => {
      // Let onclose drive reconnects. Closing synchronously here causes
      // "WebSocket is closed before the connection is established" noise.
    };
  };

  connectTimer = setTimeout(open, 0);
}

function disconnect() {
  if (connectTimer) {
    clearTimeout(connectTimer);
    connectTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  closeSocketQuietly(ws);
  ws = null;
  connected = false;
  connectedCompanyId = null;
  pendingCompanyId = null;
}

function scheduleReconnect(companyId: string) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect(companyId);
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

// ---------------------------------------------------------------------------
// Event -> Toast mapping
// ---------------------------------------------------------------------------

interface ToastMapping {
  title: (payload: Record<string, unknown>) => string;
  body?: (payload: Record<string, unknown>) => string | undefined;
  tone: (payload: Record<string, unknown>) => ToastInput["tone"];
  entityKey?: string;
}

const EVENT_TOAST_MAP: Record<string, ToastMapping> = {
  "agent.status_changed": {
    title: (p) => `Agent ${p.name ?? p.agentName ?? "unknown"} is now ${p.status ?? p.newStatus ?? "updated"}`,
    tone: () => "info",
    entityKey: "agentId",
  },
  "run.started": {
    title: (p) => `Run started for ${p.agentName ?? p.name ?? "agent"}`,
    tone: () => "info",
    entityKey: "runId",
  },
  "run.completed": {
    title: (p) => `Run completed for ${p.agentName ?? p.name ?? "agent"}`,
    body: (p) => {
      if (p.error || p.status === "failed") return typeof p.error === "string" ? p.error : "Run failed";
      return undefined;
    },
    tone: (p) => (p.error || p.status === "failed" ? "error" : "success"),
    entityKey: "runId",
  },
  "approval.created": {
    title: () => "New approval request",
    body: (p) => (p.description as string) ?? (p.title as string) ?? undefined,
    tone: () => "info",
    entityKey: "approvalId",
  },
  "approval.approved": {
    title: () => "Approval approved",
    body: (p) => (p.description as string) ?? undefined,
    tone: () => "success",
    entityKey: "approvalId",
  },
  "issue.created": {
    title: (p) => `New issue: ${p.title ?? "Untitled"}`,
    tone: () => "info",
    entityKey: "issueId",
  },
};

function isDeduplicated(eventType: string, entityId: string | undefined): boolean {
  const key = `${eventType}:${entityId ?? "global"}`;
  const now = Date.now();
  const last = toastDedupeMap.get(key);
  if (last && now - last < TOAST_DEDUP_COOLDOWN_MS) return true;

  toastDedupeMap.set(key, now);

  // Periodically clean stale entries
  if (toastDedupeMap.size > 200) {
    for (const [k, t] of toastDedupeMap) {
      if (now - t > 30000) toastDedupeMap.delete(k);
    }
  }

  return false;
}

function processEventToast(event: LiveEvent) {
  const mapping = EVENT_TOAST_MAP[event.type];
  if (!mapping) return;

  const entityId = mapping.entityKey ? (event.payload[mapping.entityKey] as string | undefined) : undefined;
  if (isDeduplicated(event.type, entityId)) return;

  const input: ToastInput = {
    title: mapping.title(event.payload),
    body: mapping.body?.(event.payload),
    tone: mapping.tone(event.payload),
    dedupeKey: `live:${event.type}:${entityId ?? ""}`,
  };

  toastStore.push(input);
}

// ---------------------------------------------------------------------------
// Public store
// ---------------------------------------------------------------------------

export const liveEventsStore = {
  get connected() {
    return connected;
  },
  /** Start listening to live events for the selected company */
  init() {
    const companyId = companyStore.selectedCompanyId;
    if (companyId) connect(companyId);
  },
  /** Reconnect when company changes */
  reconnect(companyId: string) {
    // Skip if already connected or connecting to same company
    if (connectedCompanyId === companyId && (connected || ws)) return;
    if (pendingCompanyId === companyId) return;
    connect(companyId);
  },
  disconnect,
  /** Register an event handler */
  on(handler: EventHandler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
  /** Push a toast from a live event (manual) */
  notify(input: ToastInput) {
    toastStore.push(input);
  },
};
