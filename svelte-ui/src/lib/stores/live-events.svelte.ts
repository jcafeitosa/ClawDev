/** Live events store — WebSocket connection to live event stream */

import { companyStore } from "./company.svelte.js";
import { toastStore, type ToastInput } from "./toast.svelte.js";

export interface LiveEvent {
  type: string;
  payload: Record<string, unknown>;
}

type EventHandler = (event: LiveEvent) => void;

let connected = $state(false);
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 15000;
const handlers = new Set<EventHandler>();

function buildWsUrl(companyId: string): string {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "localhost:3100";
  return `${protocol}//${host}/api/companies/${companyId}/events/ws`;
}

function connect(companyId: string) {
  disconnect();
  const url = buildWsUrl(companyId);
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
    } catch {
      // ignore parse errors
    }
  };

  ws.onclose = () => {
    connected = false;
    scheduleReconnect(companyId);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null;
    ws.onerror = null;
    ws.close();
    ws = null;
  }
  connected = false;
}

function scheduleReconnect(companyId: string) {
  reconnectTimer = setTimeout(() => {
    connect(companyId);
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
}

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
    connect(companyId);
  },
  disconnect,
  /** Register an event handler */
  on(handler: EventHandler) {
    handlers.add(handler);
    return () => handlers.delete(handler);
  },
  /** Push a toast from a live event */
  notify(input: ToastInput) {
    toastStore.push(input);
  },
};
