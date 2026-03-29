<script lang="ts">
  /**
   * LiveRunWidget — displays an active/recent run for an issue or agent.
   * Auto-refreshes every 5 seconds while a run is active.
   * Renders nothing if no active run is found.
   */
  import { api } from '$lib/api';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import { MessageSquare, ExternalLink } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    issueId?: string;
    agentId?: string;
    companyId: string;
    companyPrefix?: string;
  }

  let { issueId, agentId, companyId, companyPrefix }: Props = $props();

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface ActiveRun {
    id: string;
    status?: string;
    agentName?: string | null;
    agentId?: string | null;
    startedAt?: string | null;
    createdAt?: string | null;
    summary?: string | null;
    [key: string]: unknown;
  }

  interface TranscriptMessage {
    role?: string;
    content?: string;
    text?: string;
    timestamp?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let run = $state<ActiveRun | null>(null);
  let transcript = $state<TranscriptMessage[]>([]);
  let loading = $state(true);
  let elapsedSeconds = $state(0);

  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let durationInterval: ReturnType<typeof setInterval> | null = null;

  const ACTIVE_STATUSES = ['running', 'in_progress', 'active', 'queued', 'pending'];

  let isActive = $derived(
    run != null && ACTIVE_STATUSES.includes(run.status ?? '')
  );

  let borderColor = $derived(
    isActive ? 'border-l-green-500' : 'border-l-zinc-600'
  );

  let lastMessages = $derived(transcript.slice(-3));

  let prefix = $derived(companyPrefix ?? $page.params.companyPrefix ?? '');

  // ---------------------------------------------------------------------------
  // Computed duration
  // ---------------------------------------------------------------------------
  let formattedDuration = $derived.by(() => {
    const total = elapsedSeconds;
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  });

  // ---------------------------------------------------------------------------
  // Fetching
  // ---------------------------------------------------------------------------
  async function fetchActiveRun(): Promise<ActiveRun | null> {
    try {
      if (issueId) {
        // Try dedicated active-run endpoint first, fall back to runs list
        const res = await api(`/api/issues/${issueId}/active-run`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) return data;
        }
        // Fallback: fetch runs list and find active one
        const listRes = await api(`/api/issues/${issueId}/runs`);
        if (listRes.ok) {
          const runs: ActiveRun[] = (await listRes.json()) ?? [];
          return runs.find(r => ACTIVE_STATUSES.includes(r.status ?? '')) ?? null;
        }
        return null;
      }
      if (agentId) {
        const res = await api(`/api/agents/${agentId}/runtime-state`);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.activeRun ?? data?.currentRun ?? (data?.status === 'running' ? data : null);
      }
      return null;
    } catch {
      return null;
    }
  }

  async function fetchTranscript(runId: string): Promise<TranscriptMessage[]> {
    try {
      const res = await api(`/api/heartbeat-runs/${runId}/transcript`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.messages ?? [];
    } catch {
      return [];
    }
  }

  async function refresh() {
    const activeRun = await fetchActiveRun();
    if (!activeRun) {
      run = null;
      transcript = [];
      return;
    }

    run = activeRun;

    // Update elapsed time from start timestamp
    const startStr = activeRun.startedAt ?? activeRun.createdAt;
    if (startStr) {
      const startMs = new Date(startStr).getTime();
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    }

    // Fetch transcript for last messages preview
    const messages = await fetchTranscript(activeRun.id);
    transcript = messages;
  }

  function startDurationTimer() {
    if (durationInterval) return;
    durationInterval = setInterval(() => {
      if (isActive) {
        elapsedSeconds += 1;
      }
    }, 1000);
  }

  function startRefreshTimer() {
    if (refreshInterval) return;
    refreshInterval = setInterval(() => {
      refresh();
    }, 5000);
  }

  function stopTimers() {
    if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
    if (durationInterval) { clearInterval(durationInterval); durationInterval = null; }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(async () => {
    await refresh();
    loading = false;
    if (run) {
      startDurationTimer();
      startRefreshTimer();
    }
  });

  // Manage timers based on active state
  $effect(() => {
    if (isActive) {
      startDurationTimer();
      startRefreshTimer();
    } else if (!loading) {
      stopTimers();
    }
  });

  onDestroy(() => {
    stopTimers();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function messageText(msg: TranscriptMessage): string {
    return msg.content ?? msg.text ?? '';
  }

  function truncate(str: string, max = 120): string {
    return str.length > max ? str.slice(0, max) + '...' : str;
  }
</script>

{#if !loading && run}
  <div class="rounded-lg bg-card border border-zinc-800 border-l-4 {borderColor} overflow-hidden">
    <!-- Header -->
    <div class="px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        {#if isActive}
          <!-- Pulsing green dot -->
          <span class="relative flex h-2.5 w-2.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
          </span>
        {:else}
          <span class="inline-flex h-2.5 w-2.5 rounded-full bg-zinc-500"></span>
        {/if}
        <span class="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
          {isActive ? 'Live Run' : 'Recent Run'}
        </span>
        <StatusBadge status={run.status ?? 'unknown'} />
      </div>
      <span class="text-xs font-mono text-zinc-500">{formattedDuration}</span>
    </div>

    <!-- Run info -->
    <div class="px-4 pb-2 flex items-center gap-3 text-xs text-zinc-400">
      {#if run.agentName}
        <span class="text-zinc-300 font-medium">{run.agentName}</span>
      {:else if run.agentId}
        <span class="text-zinc-300 font-medium">{run.agentId.slice(0, 8)}</span>
      {/if}
      <span class="font-mono">{run.id.slice(0, 8)}</span>
    </div>

    <!-- Transcript preview -->
    {#if lastMessages.length > 0}
      <div class="px-4 pb-3 space-y-1.5">
        {#each lastMessages as msg}
          <div class="flex items-start gap-2 text-xs">
            <MessageSquare class="w-3 h-3 text-zinc-600 mt-0.5 shrink-0" />
            <div class="min-w-0">
              {#if msg.role}
                <span class="font-medium text-zinc-400 capitalize">{msg.role}: </span>
              {/if}
              <span class="text-zinc-500">{truncate(messageText(msg))}</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Footer link -->
    {#if prefix}
      <div class="px-4 py-2 border-t border-zinc-800">
        <a
          href="/{prefix}/runs/{run.id}"
          class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink class="w-3 h-3" />
          View Full Transcript
        </a>
      </div>
    {/if}
  </div>
{/if}
