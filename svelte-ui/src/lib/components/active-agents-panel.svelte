<script lang="ts">
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Copy, ChevronRight, ExternalLink } from 'lucide-svelte';

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

  /** Track which expandable sections are open per run, keyed by `${runId}:${section}` */
  let expandedSections = $state<Set<string>>(new Set());

  /** Track copied run IDs for brief feedback */
  let copiedRunId = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchRuns() {
    if (!companyId) return;
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
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function isActive(run: any): boolean {
    return run.status === 'running' || run.status === 'queued';
  }

  function isFailed(run: any): boolean {
    return run.status === 'failed' || run.status === 'error';
  }

  function getAgentName(run: any): string {
    return run.agentName ?? run.agent?.name ?? run.agentSlug ?? 'Agent';
  }

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  /** Simple deterministic color from a string */
  function avatarColor(name: string): string {
    const colors = [
      '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
      '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
    return colors[Math.abs(hash) % colors.length];
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

  function getStdout(run: any): string {
    return run.stdoutExcerpt ?? run.stdout ?? run.lastTranscriptLine ?? run.lastMessage ?? run.summary ?? '';
  }

  function getErrorText(run: any): string {
    return run.error ?? run.stderrExcerpt ?? '';
  }

  function getResult(run: any): string {
    return run.result ?? run.exitCode != null ? `Exit code ${run.exitCode}` : '';
  }

  function toggleSection(runId: string, section: string) {
    const key = `${runId}:${section}`;
    const next = new Set(expandedSections);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    expandedSections = next;
  }

  function isSectionOpen(runId: string, section: string): boolean {
    return expandedSections.has(`${runId}:${section}`);
  }

  async function copyRunId(e: MouseEvent, runId: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(runId);
      copiedRunId = runId;
      setTimeout(() => { if (copiedRunId === runId) copiedRunId = null; }, 1500);
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(() => {
    fetchRuns();
    refreshInterval = setInterval(fetchRuns, 10_000);
    tickInterval = setInterval(() => { now = Date.now(); }, 1_000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (tickInterval) clearInterval(tickInterval);
  });
</script>

{#if !loading && allRuns.length > 0}
  <div class="space-y-3">
    <!-- Section header -->
    <h3 class="text-sm font-semibold uppercase tracking-wide text-[--dash-muted]">
      Agents
    </h3>

    <!-- Horizontal scroll container -->
    <div class="flex gap-3 overflow-x-auto pb-2" style="-webkit-overflow-scrolling: touch;">
      {#each allRuns as run (run.id)}
        {@const active = isActive(run)}
        {@const failed = isFailed(run)}
        {@const name = getAgentName(run)}
        {@const initials = getInitials(name)}
        {@const color = avatarColor(name)}
        {@const issueId = getIssueIdentifier(run)}
        {@const issueTitle = getIssueTitle(run)}
        {@const stdout = getStdout(run)}
        {@const errorText = getErrorText(run)}
        {@const result = getResult(run)}

        <div
          class="agent-card flex min-w-[350px] max-w-[450px] flex-shrink-0 flex-col rounded-xl border transition-all"
          style="
            background-color: var(--clawdev-bg-surface, rgba(255,255,255,0.03));
            border-color: {active ? 'rgba(16,185,129,0.35)' : 'var(--clawdev-bg-surface-border, rgba(200,200,200,0.2))'};
            {active ? 'box-shadow: 0 0 20px rgba(16,185,129,0.06);' : ''}
          "
        >
          <!-- Card header: clickable to navigate -->
          <a
            href="/{prefix}/runs/{run.id}"
            class="block px-4 pt-3.5 pb-0 no-underline"
          >
            <!-- Row 1: Avatar + Name + Copy -->
            <div class="flex items-center gap-2.5">
              <!-- Avatar circle with initials -->
              <div
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style="background-color: {color};"
              >
                {initials}
              </div>

              <div class="min-w-0 flex-1">
                <span class="truncate text-sm font-medium text-[--dash-text]">{name}</span>
              </div>

              <!-- Open run detail -->
              <span class="shrink-0 rounded p-1 text-[--dash-muted]" title="View run details">
                <ExternalLink size={12} />
              </span>
            </div>

            <!-- Row 2: Status line -->
            <div class="mt-1.5 flex items-center gap-2 text-[11px]">
              {#if active}
                <span class="relative flex h-2 w-2 shrink-0">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span class="text-emerald-400 font-medium">Live now</span>
              {:else}
                <span class="inline-flex h-2 w-2 shrink-0 rounded-full" style="background-color: {failed ? '#ef4444' : 'var(--clawdev-text-muted, #888)'}"></span>
                <span style="color: {failed ? '#ef4444' : 'var(--clawdev-text-muted, #888)'};">
                  {failed ? 'Failed' : 'Finished'} {formatTimeAgo(run.finishedAt ?? run.completedAt ?? run.updatedAt)}
                </span>
              {/if}
            </div>

            <!-- Row 3: Issue card -->
            {#if hasIssue(run)}
              <div
                class="mt-2.5 flex items-center gap-1.5 rounded-md px-2.5 py-1.5"
                style="background-color: {active ? 'rgba(59,130,246,0.15)' : 'var(--clawdev-bg-surface, rgba(0,0,0,0.03))'};"
              >
                {#if issueId}
                  <span class="shrink-0 font-mono text-[10px]" style="color: {active ? '#3b82f6' : 'var(--clawdev-text-muted, #888)'};">
                    {issueId}
                  </span>
                {/if}
                {#if issueTitle}
                  <span class="truncate text-xs" style="color: {active ? '#2563eb' : 'var(--clawdev-text-primary, #333)'};">
                    {issueTitle}
                  </span>
                {/if}
              </div>
            {/if}
          </a>

          <!-- Expandable sections -->
          <div class="px-4 pb-3 pt-2 space-y-1">
            <!-- STDOUT section -->
            {#if stdout}
              <button
                class="expandable-toggle flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                style="background: none; border: none; cursor: pointer; color: var(--clawdev-text-muted, #888); padding: 2px 0;"
                onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); toggleSection(run.id, 'stdout'); }}
              >
                <ChevronRight
                  size={10}
                  class="shrink-0 transition-transform {isSectionOpen(run.id, 'stdout') ? 'rotate-90' : ''}"
                />
                STDOUT
              </button>
              {#if isSectionOpen(run.id, 'stdout')}
                <div
                  class="rounded-md px-2.5 py-2 font-mono text-[11px] leading-relaxed max-h-[120px] overflow-y-auto"
                  style="background-color: var(--clawdev-bg-surface, rgba(0,0,0,0.05)); color: var(--clawdev-text-secondary, #555);"
                >
                  <pre class="whitespace-pre-wrap m-0">{typeof stdout === 'string' ? stdout : JSON.stringify(stdout, null, 2)}</pre>
                </div>
              {/if}
            {/if}

            <!-- Result section (non-error) -->
            {#if result && !errorText}
              <button
                class="expandable-toggle flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                style="background: none; border: none; cursor: pointer; color: var(--clawdev-text-muted, #888); padding: 2px 0;"
                onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); toggleSection(run.id, 'result'); }}
              >
                <ChevronRight
                  size={10}
                  class="shrink-0 transition-transform {isSectionOpen(run.id, 'result') ? 'rotate-90' : ''}"
                />
                RESULT
              </button>
              {#if isSectionOpen(run.id, 'result')}
                <div
                  class="rounded-md px-2.5 py-2 font-mono text-[11px] leading-relaxed max-h-[120px] overflow-y-auto"
                  style="background-color: var(--clawdev-bg-surface, rgba(0,0,0,0.05)); color: var(--clawdev-text-secondary, #555);"
                >
                  <pre class="whitespace-pre-wrap m-0">{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
                </div>
              {/if}
            {/if}

            <!-- Error section -->
            {#if errorText}
              <button
                class="expandable-toggle flex w-full items-center gap-1 text-[10px] font-semibold uppercase tracking-wider"
                style="background: none; border: none; cursor: pointer; color: #f87171; padding: 2px 0;"
                onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); toggleSection(run.id, 'error'); }}
              >
                <ChevronRight
                  size={10}
                  class="shrink-0 transition-transform {isSectionOpen(run.id, 'error') ? 'rotate-90' : ''}"
                />
                ERROR
              </button>
              {#if isSectionOpen(run.id, 'error')}
                <div
                  class="rounded-md px-2.5 py-2 font-mono text-[11px] leading-relaxed max-h-[120px] overflow-y-auto"
                  style="background-color: rgba(239,68,68,0.1); color: #fca5a5;"
                >
                  <pre class="whitespace-pre-wrap m-0">{typeof errorText === 'string' ? errorText : JSON.stringify(errorText, null, 2)}</pre>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
{:else if !loading && allRuns.length === 0}
  <div class="space-y-3">
    <h3 class="text-sm font-semibold uppercase tracking-wide text-[--dash-muted]">
      Agents
    </h3>
    <div class="rounded-xl border px-4 py-4" style="border-color: rgba(255,255,255,0.08);">
      <p class="text-sm text-[--dash-muted]">No recent agent runs.</p>
    </div>
  </div>
{/if}

<style>
  .agent-card {
    /* Scrollbar for expandable content */
  }
  .agent-card:hover {
    border-color: rgba(255,255,255,0.15) !important;
  }
  .expandable-toggle:hover {
    color: rgba(255,255,255,0.65) !important;
  }
  /* Chevron rotation */
  :global(.rotate-90) {
    transform: rotate(90deg);
  }
  /* Hide scrollbar in horizontal scroll */
  .flex.gap-3.overflow-x-auto::-webkit-scrollbar {
    height: 4px;
  }
  .flex.gap-3.overflow-x-auto::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
  }
  .flex.gap-3.overflow-x-auto::-webkit-scrollbar-track {
    background: transparent;
  }
</style>
