/** Dashboard refresh store — debounces live events into a single dashboard re-fetch. */

import { liveEventsStore, type LiveEvent } from "./live-events.svelte.js";

type RefreshCallback = () => void | Promise<void>;

const REFRESH_DEBOUNCE_MS = 250;

let companyId: string | null = null;
let refreshCallback: RefreshCallback | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let liveEventsUnsubscribe: (() => void) | null = null;

function scheduleRefresh() {
  if (!refreshCallback) return;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshCallback?.();
  }, REFRESH_DEBOUNCE_MS);
}

function shouldRefresh(event: LiveEvent): boolean {
  switch (event.type) {
    case "heartbeat.run.queued":
    case "heartbeat.run.status":
    case "heartbeat.run.event":
    case "heartbeat.run.log":
    case "agent.status":
    case "issue.created":
    case "issue.updated":
    case "activity.logged":
      return true;
    default:
      return false;
  }
}

export const dashboardRefreshStore = {
  init(nextCompanyId: string | null, onRefresh: RefreshCallback) {
    companyId = nextCompanyId;
    refreshCallback = onRefresh;

    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (liveEventsUnsubscribe) {
      liveEventsUnsubscribe();
      liveEventsUnsubscribe = null;
    }

    if (!companyId) return;

    liveEventsUnsubscribe = liveEventsStore.on((event) => {
      if (event.companyId !== companyId) return;
      if (!shouldRefresh(event)) return;
      scheduleRefresh();
    });

    void refreshCallback();
  },
  disconnect() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (liveEventsUnsubscribe) {
      liveEventsUnsubscribe();
      liveEventsUnsubscribe = null;
    }
    companyId = null;
    refreshCallback = null;
  },
};
