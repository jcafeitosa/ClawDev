<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus, ListTodo, Search, ChevronDown, LayoutGrid, List } from 'lucide-svelte';
  import KanbanBoard from '$lib/components/board/kanban-board.svelte';
  import { cn } from '$utils/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Issues' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Issue {
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    priority?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    assigneeName?: string | null;
    agentName?: string | null;
    createdAt?: string;
    updatedAt?: string;
    projectId?: string | null;
    labels?: Array<{ id: string; name: string; color?: string | null }>;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let issues = $state<Issue[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let statusFilter = $state<string>('');
  let priorityFilter = $state<string>('');
  let searchQuery = $state('');
  let statusDropdownOpen = $state(false);
  let priorityDropdownOpen = $state(false);
  let viewMode = $state<'list' | 'board'>('list');

  let companyId = $derived(companyStore.selectedCompany?.id ?? companyStore.selectedCompanyId);
  let currentPrefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const ALL_STATUSES = [
    { value: '', label: 'All Statuses' },
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'in_review', label: 'In Review' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'done', label: 'Done' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const ALL_PRIORITIES = [
    { value: '', label: 'All Priorities' },
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  // ---------------------------------------------------------------------------
  // Filtered issues (client-side filtering for priority + search)
  // ---------------------------------------------------------------------------
  let filteredIssues = $derived.by(() => {
    let list = issues;
    if (priorityFilter) {
      list = list.filter(i => i.priority === priorityFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.identifier ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  function buildUrl(): string {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    const qs = params.toString();
    return `/api/companies/${companyId}/issues${qs ? `?${qs}` : ''}`;
  }

  let fetchTimeout: ReturnType<typeof setTimeout> | undefined;

  function loadIssues() {
    if (!companyId) return;
    loading = true;
    error = null;
    api(buildUrl())
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { issues = (Array.isArray(d) ? d : d.issues ?? []) as Issue[]; })
      .catch(e => { error = e.message ?? 'Failed to load issues'; })
      .finally(() => { loading = false; });
  }

  // Reload when companyId or status filter changes
  $effect(() => {
    if (!companyId) return;
    // Touch reactive deps
    void statusFilter;
    loadIssues();
  });

  // Debounced search
  $effect(() => {
    void searchQuery;
    clearTimeout(fetchTimeout);
    fetchTimeout = setTimeout(() => {
      if (companyId && searchQuery.trim()) loadIssues();
    }, 300);
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const STATUS_COLORS: Record<string, string> = {
    backlog: 'bg-zinc-500',
    todo: 'bg-[#2563EB]',
    in_progress: 'bg-[#F97316]',
    in_review: 'bg-purple-500',
    blocked: 'bg-[#EF4444]',
    done: 'bg-[#10A37F]',
    cancelled: 'bg-zinc-600',
  };

  const PRIORITY_COLORS: Record<string, string> = {
    critical: 'text-[#EF4444] bg-red-500/15 border-red-500/30',
    high: 'text-[#F97316] bg-orange-500/15 border-orange-500/30',
    medium: 'text-[#F59E0B] bg-yellow-500/15 border-yellow-500/30',
    low: 'text-[#94A3B8] bg-zinc-500/15 border-zinc-500/30',
  };

  const PRIORITY_LABELS: Record<string, string> = {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
    low: 'P3',
  };

  function statusDotClass(status: string): string {
    return STATUS_COLORS[status] ?? 'bg-zinc-500';
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

  function assigneeLabel(issue: Issue): string {
    if (issue.assigneeName) return issue.assigneeName;
    if (issue.agentName) return issue.agentName;
    if (issue.assigneeAgentId) return 'Agent';
    if (issue.assigneeUserId) return 'User';
    return '';
  }

  function selectedStatusLabel(): string {
    return ALL_STATUSES.find(s => s.value === statusFilter)?.label ?? 'All Statuses';
  }

  function selectedPriorityLabel(): string {
    return ALL_PRIORITIES.find(p => p.value === priorityFilter)?.label ?? 'All Priorities';
  }

  async function handleStatusChange(issueId: string, newStatus: string): Promise<void> {
    try {
      const res = await api(`/api/issues/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Optimistic update: mutate local state
      const idx = issues.findIndex((i) => i.id === issueId);
      if (idx !== -1) {
        issues[idx] = { ...issues[idx], status: newStatus };
        issues = [...issues]; // trigger reactivity
      }
    } catch (e: any) {
      console.error('Failed to update issue status:', e);
      // Reload to restore correct state
      loadIssues();
    }
  }

  function closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('[data-dropdown]')) {
      statusDropdownOpen = false;
      priorityDropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={closeDropdowns} />

<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-[#F8FAFC]">Issues</h1>
    <a
      href="/{$page.params.companyPrefix}/issues/new"
      class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98]"
    >
      <Plus class="w-4 h-4" />
      New Issue
    </a>
  </div>

  <!-- Filter bar + View toggle -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
    <!-- Status dropdown -->
    <div class="relative" data-dropdown>
      <button
        onclick={() => { statusDropdownOpen = !statusDropdownOpen; priorityDropdownOpen = false; }}
        class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm text-[#F8FAFC] transition hover:bg-white/[0.05]"
      >
        {selectedStatusLabel()}
        <ChevronDown class="w-3.5 h-3.5 text-[#94A3B8]" />
      </button>
      {#if statusDropdownOpen}
        <div class="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-white/[0.08] bg-[#121218] py-1 shadow-xl">
          {#each ALL_STATUSES as s}
            <button
              onclick={() => { statusFilter = s.value; statusDropdownOpen = false; }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition
                {statusFilter === s.value ? 'text-white bg-white/[0.08]' : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.03]'}"
            >
              {#if s.value}
                <span class="w-2 h-2 rounded-full shrink-0 {statusDotClass(s.value)}"></span>
              {/if}
              {s.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Priority dropdown -->
    <div class="relative" data-dropdown>
      <button
        onclick={() => { priorityDropdownOpen = !priorityDropdownOpen; statusDropdownOpen = false; }}
        class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm text-[#F8FAFC] transition hover:bg-white/[0.05]"
      >
        {selectedPriorityLabel()}
        <ChevronDown class="w-3.5 h-3.5 text-[#94A3B8]" />
      </button>
      {#if priorityDropdownOpen}
        <div class="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-white/[0.08] bg-[#121218] py-1 shadow-xl">
          {#each ALL_PRIORITIES as p}
            <button
              onclick={() => { priorityFilter = p.value; priorityDropdownOpen = false; }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition
                {priorityFilter === p.value ? 'text-white bg-white/[0.08]' : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-white/[0.03]'}"
            >
              {#if p.value}
                <span class="inline-flex items-center rounded border px-1 py-0 text-[10px] font-bold leading-relaxed {PRIORITY_COLORS[p.value] ?? ''}">
                  {PRIORITY_LABELS[p.value] ?? ''}
                </span>
              {/if}
              {p.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Search -->
    <div class="relative flex-1 sm:max-w-xs">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
      <input
        type="text"
        placeholder="Search issues..."
        bind:value={searchQuery}
        class="w-full rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
      />
    </div>

    <!-- View toggle -->
    <div class="flex items-center rounded-lg border border-white/[0.08] bg-[#121218] p-0.5 shrink-0">
      <button
        onclick={() => viewMode = 'list'}
        class={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          viewMode === 'list'
            ? "bg-[rgba(255,255,255,0.1)] text-[#F8FAFC]"
            : "text-[#94A3B8] hover:text-[#F8FAFC]",
        )}
        aria-label="List view"
      >
        <List class="w-3.5 h-3.5" />
        List
      </button>
      <button
        onclick={() => viewMode = 'board'}
        class={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          viewMode === 'board'
            ? "bg-[rgba(255,255,255,0.1)] text-[#F8FAFC]"
            : "text-[#94A3B8] hover:text-[#F8FAFC]",
        )}
        aria-label="Board view"
      >
        <LayoutGrid class="w-3.5 h-3.5" />
        Board
      </button>
    </div>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    {#if viewMode === 'board'}
      <div class="flex gap-3 overflow-x-auto pb-4">
        {#each Array(5) as _}
          <div class="w-72 shrink-0 rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.02)] p-3 space-y-2">
            <div class="h-4 w-24 animate-pulse rounded bg-white/[0.06]"></div>
            {#each Array(3) as __}
              <div class="h-24 animate-pulse rounded-lg bg-white/[0.04]"></div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-3">
        {#each Array(8) as _}
          <div class="h-[60px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08]"></div>
        {/each}
      </div>
    {/if}

  <!-- Error -->
  {:else if error}
    <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p class="text-sm text-red-400">{error}</p>
      <button
        onclick={() => loadIssues()}
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        Retry
      </button>
    </div>

  <!-- Empty -->
  {:else if filteredIssues.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-white/[0.05] p-4 mb-4">
        <ListTodo class="w-8 h-8 text-[#94A3B8]" />
      </div>
      {#if issues.length === 0 && !statusFilter && !searchQuery.trim()}
        <p class="text-[#94A3B8] text-sm">No issues yet.</p>
        <p class="text-xs text-[#94A3B8]/60 mt-1">Create an issue to get started.</p>
      {:else}
        <p class="text-[#94A3B8] text-sm">No issues match the current filters.</p>
      {/if}
    </div>

  <!-- Board view -->
  {:else if viewMode === 'board'}
    <KanbanBoard issues={filteredIssues} prefix={currentPrefix} onStatusChange={handleStatusChange} />

  <!-- List view -->
  {:else}
    <div class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
      {#each filteredIssues as issue, i (issue.id)}
        <a
          href="/{$page.params.companyPrefix}/issues/{issue.id}"
          class="flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]
            {i < filteredIssues.length - 1 ? 'border-b border-white/[0.05]' : ''}"
        >
          <!-- Status dot -->
          <span class="w-2 h-2 rounded-full shrink-0 {statusDotClass(issue.status)}"></span>

          <!-- Identifier -->
          {#if issue.identifier}
            <span class="text-xs font-mono text-[#94A3B8] shrink-0 w-20 truncate">
              {issue.identifier}
            </span>
          {/if}

          <!-- Title -->
          <span class="text-sm text-[#F8FAFC] truncate flex-1 min-w-0">
            {issue.title}
          </span>

          <!-- Priority badge -->
          {#if issue.priority && PRIORITY_LABELS[issue.priority]}
            <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 {PRIORITY_COLORS[issue.priority] ?? 'text-[#94A3B8] bg-zinc-500/15 border-zinc-500/30'}">
              {PRIORITY_LABELS[issue.priority]}
            </span>
          {/if}

          <!-- Labels -->
          {#if issue.labels?.length}
            <div class="hidden md:flex items-center gap-1 shrink-0">
              {#each issue.labels.slice(0, 2) as label}
                <span
                  class="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style="background-color: {label.color ?? '#3b82f6'}20; color: {label.color ?? '#3b82f6'}; border: 1px solid {label.color ?? '#3b82f6'}40;"
                >
                  {label.name}
                </span>
              {/each}
              {#if issue.labels.length > 2}
                <span class="text-[10px] text-[#94A3B8]">+{issue.labels.length - 2}</span>
              {/if}
            </div>
          {/if}

          <!-- Assignee -->
          {#if assigneeLabel(issue)}
            <span class="hidden sm:inline-block text-xs text-[#94A3B8] shrink-0 max-w-[100px] truncate">
              {assigneeLabel(issue)}
            </span>
          {/if}

          <!-- Created time -->
          <span class="text-xs text-[#94A3B8] shrink-0 tabular-nums w-16 text-right">
            {timeAgo(issue.createdAt)}
          </span>
        </a>
      {/each}
    </div>

    <!-- Count -->
    <p class="text-xs text-[#94A3B8] text-right">
      {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
    </p>
  {/if}
</div>
