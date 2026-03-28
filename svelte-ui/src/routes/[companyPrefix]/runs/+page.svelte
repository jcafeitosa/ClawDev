<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Play, Search, ChevronRight, Timer, Zap, UserCheck, XCircle, CheckCircle2, Loader2, CircleDot } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Runs' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Run {
    id: string;
    status: string;
    agentId?: string | null;
    agentName?: string | null;
    source?: string | null;
    trigger?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    duration?: number | null;
    durationMs?: number | null;
    error?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let runs = $state<Run[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let statusFilter = $state<string>('all');
  let searchQuery = $state('');

  let companyId = $derived(companyStore.selectedCompany?.id ?? companyStore.selectedCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  const STATUS_FILTERS = ['all', 'running', 'success', 'failed', 'cancelled'] as const;

  function filterLabel(f: string): string {
    const labels: Record<string, string> = { all: 'All', running: 'Running', success: 'Success', failed: 'Failed', cancelled: 'Cancelled' };
    return labels[f] ?? f;
  }

  function countByFilter(filter: string): number {
    if (filter === 'all') return runs.length;
    return runs.filter(r => normalizeStatus(r.status) === filter).length;
  }

  /** Normalize various status strings to our filter categories */
  function normalizeStatus(status: string): string {
    const s = status.toLowerCase();
    if (s === 'running' || s === 'in_progress' || s === 'started') return 'running';
    if (s === 'success' || s === 'completed' || s === 'done' || s === 'finished') return 'success';
    if (s === 'failed' || s === 'error' || s === 'errored') return 'failed';
    if (s === 'cancelled' || s === 'canceled' || s === 'aborted') return 'cancelled';
    return s;
  }

  let filteredRuns = $derived.by(() => {
    let list = runs;
    if (statusFilter !== 'all') {
      list = list.filter(r => normalizeStatus(r.status) === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r =>
        r.id.toLowerCase().includes(q) ||
        (r.agentName ?? '').toLowerCase().includes(q) ||
        (r.source ?? r.trigger ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  function buildUrl(): string {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('limit', '50');
    const qs = params.toString();
    return `/api/companies/${companyId}/heartbeat-runs${qs ? `?${qs}` : ''}`;
  }

  function loadRuns() {
    if (!companyId) return;
    loading = true;
    error = null;
    api(buildUrl())
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { runs = (Array.isArray(d) ? d : d.runs ?? []) as Run[]; })
      .catch(e => { error = e.message ?? 'Failed to load runs'; })
      .finally(() => { loading = false; });
  }

  $effect(() => {
    if (!companyId) return;
    void statusFilter;
    loadRuns();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const STATUS_DOT_COLORS: Record<string, string> = {
    running: 'bg-blue-500 animate-pulse',
    success: 'bg-emerald-500',
    failed: 'bg-red-500',
    cancelled: 'bg-zinc-500',
  };

  const STATUS_BADGE_COLORS: Record<string, string> = {
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    failed: 'bg-red-500/10 text-red-400 border-red-500/30',
    cancelled: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  };

  const SOURCE_BADGE_COLORS: Record<string, string> = {
    timer: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    on_demand: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    assignment: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    manual: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    cron: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    webhook: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  };

  function statusDotClass(status: string): string {
    return STATUS_DOT_COLORS[normalizeStatus(status)] ?? 'bg-zinc-500';
  }

  function statusBadgeClass(status: string): string {
    return STATUS_BADGE_COLORS[normalizeStatus(status)] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }

  function sourceBadgeClass(source: string): string {
    return SOURCE_BADGE_COLORS[source.toLowerCase()] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }

  function sourceLabel(run: Run): string {
    return run.source ?? run.trigger ?? '';
  }

  function formatDuration(run: Run): string {
    const ms = run.durationMs ?? run.duration;
    if (!ms && ms !== 0) {
      // Calculate from start/end
      if (run.startedAt && run.completedAt) {
        const d = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
        return formatMs(d);
      }
      if (run.startedAt && normalizeStatus(run.status) === 'running') {
        const d = Date.now() - new Date(run.startedAt).getTime();
        return formatMs(d) + '...';
      }
      return '';
    }
    return formatMs(ms);
  }

  function formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainSec = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remainSec}s`;
    const hours = Math.floor(minutes / 60);
    const remainMin = minutes % 60;
    return `${hours}h ${remainMin}m`;
  }

  function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function runTimestamp(run: Run): string {
    return timeAgo(run.completedAt ?? run.startedAt ?? run.createdAt);
  }
</script>

<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-[#F8FAFC]">Runs</h1>
      <p class="mt-1 text-sm text-[#94A3B8]">Agent execution history and active runs</p>
    </div>
  </div>

  <!-- Filter pills + Search -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-1.5 flex-wrap">
      {#each STATUS_FILTERS as filter}
        <button
          onclick={() => { statusFilter = filter; }}
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition
            {statusFilter === filter
              ? 'bg-[#2563EB] text-white'
              : 'bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC]'}"
        >
          {filterLabel(filter)}
          <span class="ml-1 text-xs opacity-70">({countByFilter(filter)})</span>
        </button>
      {/each}
    </div>

    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
      <input
        type="text"
        placeholder="Search runs..."
        bind:value={searchQuery}
        class="w-full sm:w-64 rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
      />
    </div>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(8) as _}
        <div class="h-[60px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08]"></div>
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p class="text-sm text-red-400">{error}</p>
      <button
        onclick={() => loadRuns()}
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        Retry
      </button>
    </div>

  <!-- Empty -->
  {:else if filteredRuns.length === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-white/[0.05] p-4 mb-4">
        <Play class="h-10 w-10 text-[#94A3B8]" />
      </div>
      {#if runs.length === 0}
        <h3 class="text-lg font-medium text-[#F8FAFC]">No runs yet</h3>
        <p class="mt-1 text-sm text-[#94A3B8]">Runs will appear here when agents execute tasks</p>
      {:else}
        <p class="text-[#94A3B8] text-sm">No runs match the current filters.</p>
      {/if}
    </div>

  <!-- Runs list -->
  {:else}
    <div class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
      {#each filteredRuns as run, i (run.id)}
        <a
          href="/{prefix}/runs/{run.id}"
          class="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]
            {i < filteredRuns.length - 1 ? 'border-b border-white/[0.05]' : ''}"
        >
          <!-- Status dot -->
          <span class="w-2 h-2 rounded-full shrink-0 {statusDotClass(run.status)}"></span>

          <!-- Status badge -->
          <span class="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {statusBadgeClass(run.status)}">
            {normalizeStatus(run.status)}
          </span>

          <!-- Run ID (first 8 chars, mono) -->
          <span class="text-xs font-mono text-[#94A3B8] shrink-0 w-20 truncate">
            {run.id.slice(0, 8)}
          </span>

          <!-- Agent name -->
          <span class="text-sm text-[#F8FAFC] truncate flex-1 min-w-0">
            {run.agentName ?? 'Unknown Agent'}
          </span>

          <!-- Source badge -->
          {#if sourceLabel(run)}
            <span class="hidden sm:inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {sourceBadgeClass(sourceLabel(run))}">
              {sourceLabel(run).replace(/_/g, ' ')}
            </span>
          {/if}

          <!-- Duration -->
          {#if formatDuration(run)}
            <span class="hidden md:inline-block text-xs text-[#94A3B8] font-mono shrink-0 tabular-nums w-16 text-right">
              {formatDuration(run)}
            </span>
          {/if}

          <!-- Time ago -->
          <span class="text-xs text-[#94A3B8] shrink-0 tabular-nums w-16 text-right">
            {runTimestamp(run)}
          </span>

          <!-- Arrow -->
          <ChevronRight class="h-4 w-4 shrink-0 text-[#94A3B8] opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      {/each}
    </div>

    <!-- Count -->
    <p class="text-xs text-[#94A3B8] text-right">
      {filteredRuns.length} run{filteredRuns.length !== 1 ? 's' : ''}
    </p>
  {/if}
</div>
