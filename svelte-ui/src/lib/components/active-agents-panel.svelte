<script lang="ts">
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { ExternalLink } from 'lucide-svelte';
  import { liveRunTranscriptsStore } from '$stores/live-run-transcripts.svelte.js';
  import RunTranscriptPreview from '$lib/components/run-transcript-preview.svelte';

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
  let allRuns = $state<any[]>([]);
  let loading = $state(true);
  let now = $state(Date.now());
  let refreshInterval: ReturnType<typeof setInterval> | undefined;
  let tickInterval: ReturnType<typeof setInterval> | undefined;
  let fetchInFlight = false;

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchRuns() {
    if (!companyId || fetchInFlight) return;
    fetchInFlight = true;
    try {
      const [liveRes, recentRes] = await Promise.all([
        api(`/api/companies/${companyId}/live-runs?minCount=0`),
        api(`/api/companies/${companyId}/heartbeat-runs?limit=5`),
      ]);

      let activeRuns: any[] = [];
      let finishedRuns: any[] = [];

      if (liveRes.ok) {
        const data = await liveRes.json();
        const arr = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
        activeRuns = arr.filter((r: any) => r.status === 'running' || r.status === 'queued');
      }

      if (recentRes.ok) {
        const data = await recentRes.json();
        finishedRuns = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
      }

      // Deduplicate: active runs first, then finished runs not already present
      const seenIds = new Set(activeRuns.map((r: any) => r.id));
      const deduped = [...activeRuns];
      for (const r of finishedRuns) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          deduped.push(r);
        }
      }

      allRuns = deduped;
    } catch {
      allRuns = [];
    } finally {
      loading = false;
      fetchInFlight = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function isActive(run: any): boolean {
    return run.status === 'running' || run.status === 'queued';
  }

  function isFailed(run: any): boolean {
    return run.status === 'error' || run.status === 'failed' || run.exitCode > 0;
  }

  function getAgentName(run: any): string {
    return run.agentName ?? run.agent?.name ?? run.agentSlug ?? 'Agent';
  }

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function formatTimeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const elapsed = Math.max(0, now - new Date(dateStr).getTime());
    const seconds = Math.floor(elapsed / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function getIssueIdentifier(run: any): string {
    return run.issueIdentifier ?? run.issue?.identifier ?? '';
  }

  function getIssueTitle(run: any): string {
    return run.issueTitle ?? run.issue?.title ?? '';
  }

  function hasIssue(run: any): boolean {
    return !!(getIssueIdentifier(run) || getIssueTitle(run));
  }

  function statusText(run: any): string {
    if (isActive(run)) return 'Live now';
    if (isFailed(run)) return `Failed ${formatTimeAgo(run.finishedAt ?? run.completedAt ?? run.updatedAt)}`;
    const ts = run.finishedAt ?? run.completedAt ?? run.updatedAt;
    if (ts) return `Finished ${formatTimeAgo(ts)}`;
    const started = run.startedAt ?? run.createdAt;
    if (started) return `Started ${formatTimeAgo(started)}`;
    return '';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(() => {
    fetchRuns();
    refreshInterval = setInterval(fetchRuns, 10_000);
    tickInterval = setInterval(() => { now = Date.now(); }, 1_000);
    liveRunTranscriptsStore.init(companyId, allRuns);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (tickInterval) clearInterval(tickInterval);
    liveRunTranscriptsStore.disconnect();
  });

  $effect(() => {
    liveRunTranscriptsStore.updateRuns(allRuns);
  });
</script>

{#if !loading && allRuns.length > 0}
  <div class="space-y-3">
    <!-- Section header -->
    <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      AGENTS
    </h3>

    <!-- Responsive grid -->
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {#each allRuns as run (run.id)}
        {@const active = isActive(run)}
        {@const name = getAgentName(run)}
        {@const initials = getInitials(name)}
        {@const issueId = getIssueIdentifier(run)}
        {@const issueTitle = getIssueTitle(run)}
        {@const transcript = liveRunTranscriptsStore.blocks(run)}

        <div
          class="flex h-[320px] flex-col overflow-hidden rounded-xl border shadow-sm {active
            ? 'border-cyan-500/25 bg-cyan-500/[0.04] shadow-[0_16px_40px_rgba(6,182,212,0.08)]'
            : 'border-border bg-background/70'}"
        >
          <!-- Card header (matches Paperclip: border-b/60, items-start justify-between) -->
          <div class="border-b border-border/60 px-3 py-3">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <!-- Dot + avatar + name row -->
                <div class="flex items-center gap-2">
                  {#if active}
                    <span class="relative flex h-2.5 w-2.5 shrink-0">
                      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70"></span>
                      <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                    </span>
                  {:else}
                    <span class="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/35"></span>
                  {/if}

                  <!-- Identity (avatar + name, gap-1.5 matching Paperclip's Identity component) -->
                  <span class="inline-flex min-w-0 items-center gap-1.5">
                    <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                      {initials}
                    </span>
                    <span class="min-w-0 truncate text-[11px]">{name}</span>
                  </span>
                </div>

                <!-- Status text (mt-2, matches Paperclip) -->
                <div class="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{isActive(run) ? 'Live now' : statusText(run)}</span>
                </div>
              </div>

              <!-- External link pill -->
              <a
                href="/{prefix}/runs/{run.id}"
                class="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                title="View run"
              >
                <ExternalLink size={10} />
              </a>
            </div>

            <!-- Issue box (inside header, mt-3, matches Paperclip) -->
            {#if hasIssue(run)}
              <div class="mt-3 rounded-lg border border-border/60 bg-background/60 px-2.5 py-2 text-xs">
                <a
                  href="/{prefix}/issues/{issueId || run.issueId}"
                  class="line-clamp-2 hover:underline {active ? 'text-cyan-700 dark:text-cyan-300' : 'text-muted-foreground hover:text-foreground'}"
                >
                  {issueId ?? run.issueId?.slice(0, 8) ?? ''}{issueTitle ? ` - ${issueTitle}` : ''}
                </a>
              </div>
            {/if}
          </div>

          <!-- Transcript preview (Paperclip-style) -->
          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <RunTranscriptPreview
              blocks={transcript}
              live={active}
              limit={8}
              emptyMessage={active ? 'Waiting for transcript...' : 'No transcript captured.'}
            />
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else if !loading && allRuns.length === 0}
  <div class="space-y-3">
    <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      AGENTS
    </h3>
    <div class="rounded-xl border border-border p-4">
      <p class="text-sm text-muted-foreground">No recent agent runs.</p>
    </div>
  </div>
{/if}
