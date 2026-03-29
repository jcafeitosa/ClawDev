<script lang="ts">
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Bot, Clock, MessageSquare, ArrowRight, ExternalLink } from 'lucide-svelte';

  interface Props {
    companyId: string;
    prefix: string;
  }

  let { companyId, prefix }: Props = $props();

  interface LiveRun {
    id: string;
    status: string;
    agentId: string;
    agentName?: string;
    adapterType?: string;
    issueId?: string | null;
    issueIdentifier?: string | null;
    issueTitle?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    createdAt: string;
    [key: string]: unknown;
  }

  interface TranscriptChunk {
    role: string;
    content: string;
    ts?: string;
  }

  let runs = $state<LiveRun[]>([]);
  let transcriptByRun = $state<Map<string, TranscriptChunk[]>>(new Map());
  let loading = $state(true);
  let now = $state(Date.now());
  let refreshInterval: ReturnType<typeof setInterval> | undefined;
  let tickInterval: ReturnType<typeof setInterval> | undefined;
  let transcriptInterval: ReturnType<typeof setInterval> | undefined;

  const ACTIVE_STATUSES = ['running', 'queued', 'in_progress'];
  const MAX_TRANSCRIPT_LINES = 5;

  function isActive(run: LiveRun): boolean {
    return ACTIVE_STATUSES.includes(run.status);
  }

  async function fetchRuns() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/live-runs?minCount=4`);
      if (res.ok) {
        const data = await res.json();
        runs = Array.isArray(data) ? data : data.runs ?? [];
      } else {
        runs = [];
      }
    } catch {
      runs = [];
    } finally {
      loading = false;
    }
  }

  async function fetchTranscripts() {
    const activeRuns = runs.filter(isActive);
    for (const run of activeRuns) {
      try {
        const res = await api(`/api/heartbeat-runs/${run.id}/log`);
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.trim()) continue;
        const lines = text.trim().split('\n');
        const chunks: TranscriptChunk[] = [];
        for (const line of lines.slice(-MAX_TRANSCRIPT_LINES * 3)) {
          try {
            const entry = JSON.parse(line);
            if (entry.chunk || entry.text || entry.content) {
              chunks.push({
                role: entry.stream ?? entry.role ?? 'assistant',
                content: entry.chunk ?? entry.text ?? entry.content ?? '',
                ts: entry.ts ?? '',
              });
            }
          } catch { /* skip */ }
        }
        transcriptByRun.set(run.id, chunks.slice(-MAX_TRANSCRIPT_LINES));
        transcriptByRun = new Map(transcriptByRun);
      } catch { /* ignore */ }
    }
  }

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

  function relativeTime(date: string | null | undefined): string {
    if (!date) return '';
    const diffSec = Math.round((now - new Date(date).getTime()) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.round(diffHr / 24)}d ago`;
  }

  function truncate(str: string, max = 100): string {
    return str.length > max ? str.slice(0, max) + '...' : str;
  }

  onMount(() => {
    fetchRuns();
    refreshInterval = setInterval(fetchRuns, 10_000);
    tickInterval = setInterval(() => { now = Date.now(); }, 1_000);
    transcriptInterval = setInterval(fetchTranscripts, 2_000);
    // Initial transcript fetch after runs load
    setTimeout(fetchTranscripts, 1500);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (tickInterval) clearInterval(tickInterval);
    if (transcriptInterval) clearInterval(transcriptInterval);
  });
</script>

{#if !loading && runs.length > 0}
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agents</h3>
    </div>

    <!-- Run cards grid -->
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {#each runs.slice(0, 4) as run (run.id)}
        {@const active = isActive(run)}
        {@const transcript = transcriptByRun.get(run.id) ?? []}
        <div
          class="flex h-[320px] flex-col overflow-hidden rounded-xl border transition-all"
          class:border-cyan-500/25={active}
          class:bg-cyan-500/[0.04]={active}
          class:shadow-[0_16px_40px_rgba(6,182,212,0.08)]={active}
          class:border-border={!active}
          class:bg-card={!active}
        >
          <!-- Header -->
          <div class="border-b border-border/60 px-3 py-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <!-- Agent name with dot -->
                <div class="flex items-center gap-2">
                  {#if active}
                    <span class="relative flex h-2.5 w-2.5 shrink-0">
                      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70"></span>
                      <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                    </span>
                  {:else}
                    <span class="h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/35"></span>
                  {/if}
                  <span class="truncate text-[11px] font-medium text-foreground">
                    {run.agentName ?? 'Agent'}
                  </span>
                </div>
                <!-- Timing label -->
                <p class="mt-2 text-[11px] text-muted-foreground">
                  {#if active}
                    Live now
                  {:else if run.finishedAt}
                    Finished {relativeTime(run.finishedAt)}
                  {:else}
                    Started {relativeTime(run.createdAt)}
                  {/if}
                </p>
              </div>
              <!-- Link button -->
              <a
                href="/{prefix}/runs/{run.id}"
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title="View run"
              >
                <ExternalLink size={10} />
              </a>
            </div>

            <!-- Issue sub-card -->
            {#if run.issueId}
              <div class="mt-3 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 text-xs">
                <a
                  href="/{prefix}/issues/{run.issueIdentifier ?? run.issueId}"
                  class="line-clamp-2 hover:underline"
                  class:text-cyan-300={active}
                  class:text-muted-foreground={!active}
                >
                  {run.issueIdentifier ?? run.issueId?.slice(0, 8)}
                  {#if run.issueTitle}
                    {' - '}{run.issueTitle}
                  {/if}
                </a>
              </div>
            {/if}
          </div>

          <!-- Transcript section -->
          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            {#if transcript.length > 0}
              <div class="space-y-1.5">
                {#each transcript as msg}
                  <div class="flex items-start gap-1.5 text-[10px] leading-4">
                    <MessageSquare size={10} class="mt-0.5 shrink-0 text-muted-foreground/50" />
                    <div class="min-w-0">
                      {#if msg.role && msg.role !== 'stdout'}
                        <span class="font-medium capitalize text-muted-foreground">{msg.role}: </span>
                      {/if}
                      <span class="text-muted-foreground/80">{truncate(msg.content)}</span>
                    </div>
                  </div>
                {/each}
                {#if active}
                  <div class="flex items-center gap-1 text-[10px] text-cyan-500/60">
                    <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500"></span>
                    streaming...
                  </div>
                {/if}
              </div>
            {:else if active}
              <p class="text-[10px] text-muted-foreground/50 italic">Waiting for output...</p>
            {:else}
              <p class="text-[10px] text-muted-foreground/50 italic">No transcript captured.</p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}
