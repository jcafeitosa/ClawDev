<script lang="ts">
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Bot, Clock, MessageSquare, ArrowRight } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    companyId: string;
    prefix: string;
  }

  let { companyId, prefix }: Props = $props();

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let runs = $state<any[]>([]);
  let loading = $state(true);
  let now = $state(Date.now());
  let refreshInterval: ReturnType<typeof setInterval> | undefined;
  let tickInterval: ReturnType<typeof setInterval> | undefined;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchActiveRuns() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs?status=running&limit=10`);
      if (!res.ok) {
        // Fallback to runs endpoint
        const fallback = await api(`/api/companies/${companyId}/runs?status=running&limit=10`);
        if (fallback.ok) {
          const data = await fallback.json();
          runs = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
        }
        return;
      }
      const data = await res.json();
      runs = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
    } catch {
      runs = [];
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Duration formatting
  // ---------------------------------------------------------------------------
  function formatDuration(startedAt: string | null | undefined): string {
    if (!startedAt) return '--:--';
    const elapsed = Math.max(0, now - new Date(startedAt).getTime());
    const totalSeconds = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(() => {
    fetchActiveRuns();
    refreshInterval = setInterval(fetchActiveRuns, 10_000);
    tickInterval = setInterval(() => { now = Date.now(); }, 1_000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (tickInterval) clearInterval(tickInterval);
  });
</script>

{#if !loading && runs.length > 0}
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <div class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
        <Bot size={13} color="#10b981" />
      </div>
      <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Active Agents</h3>
      <span class="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-bold text-emerald-400 tabular-nums">
        {runs.length}
      </span>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each runs as run (run.id)}
        <a
          href="/{prefix}/runs/{run.id}"
          class="group relative flex flex-col gap-2.5 rounded-xl border px-4 py-3.5 transition-all hover:border-emerald-500/30"
          style="background-color: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.08);"
        >
          <!-- Agent name + status dot -->
          <div class="flex items-center gap-2.5">
            <div class="relative shrink-0">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full"
                style="background-color: rgba(16,185,129,0.12);"
              >
                <Bot size={14} color="#10b981" />
              </div>
              <span class="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-[--dash-text]">
                {run.agentName ?? run.agent?.name ?? run.agentSlug ?? 'Agent'}
              </p>
              <p class="text-[11px] text-emerald-400">Running</p>
            </div>
            <ArrowRight size={12} class="shrink-0 text-[--dash-muted] opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <!-- Issue identifier -->
          {#if run.issueIdentifier ?? run.issue?.identifier ?? run.issueTitle ?? run.issue?.title}
            <div class="flex items-center gap-1.5 rounded-md px-2 py-1" style="background-color: rgba(255,255,255,0.04);">
              <span class="font-mono text-[10px] text-[--dash-muted]">
                {run.issueIdentifier ?? run.issue?.identifier ?? ''}
              </span>
              <span class="truncate text-xs text-[--dash-text]">
                {run.issueTitle ?? run.issue?.title ?? ''}
              </span>
            </div>
          {/if}

          <!-- Duration + last transcript -->
          <div class="flex items-center justify-between text-[11px]">
            <div class="flex items-center gap-1 text-[--dash-muted]">
              <Clock size={11} />
              <span class="tabular-nums font-medium">{formatDuration(run.startedAt ?? run.createdAt)}</span>
            </div>
            {#if run.lastTranscriptLine ?? run.lastMessage ?? run.summary}
              <div class="flex items-center gap-1 text-[--dash-muted] max-w-[60%]">
                <MessageSquare size={10} class="shrink-0" />
                <span class="truncate">{run.lastTranscriptLine ?? run.lastMessage ?? run.summary}</span>
              </div>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  </div>
{:else if !loading && runs.length === 0}
  <!-- Hidden when no active runs — don't render anything -->
{/if}
