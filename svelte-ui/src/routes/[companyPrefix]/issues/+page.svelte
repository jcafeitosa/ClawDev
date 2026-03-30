<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus, ListTodo, Search, ChevronDown, LayoutGrid, List, ArrowUpDown, Layers } from 'lucide-svelte';
  import KanbanBoard from '$lib/components/board/kanban-board.svelte';
  import { cn } from '$utils/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Issues' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface IssueActiveRun {
    id: string;
    status: string;
    agentId: string;
  }

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
    activeRun?: IssueActiveRun | null;
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
  let sortDropdownOpen = $state(false);
  let groupDropdownOpen = $state(false);
  let sortBy = $state<string>('newest');
  let groupBy = $state<string>('none');
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

  const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'priority', label: 'Priority' },
    { value: 'updated', label: 'Recently updated' },
  ];

  const GROUP_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'assignee', label: 'Assignee' },
  ];

  const PRIORITY_ORDER: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

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
        (i.title ?? '').toLowerCase().includes(q) ||
        (i.identifier ?? '').toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list];
    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
    } else if (sortBy === 'priority') {
      list.sort((a, b) => (PRIORITY_ORDER[a.priority ?? ''] ?? 99) - (PRIORITY_ORDER[b.priority ?? ''] ?? 99));
    } else if (sortBy === 'updated') {
      list.sort((a, b) => new Date(b.updatedAt ?? b.createdAt ?? 0).getTime() - new Date(a.updatedAt ?? a.createdAt ?? 0).getTime());
    }
    return list;
  });

  // Grouped issues for grouped view
  interface IssueGroup {
    key: string;
    label: string;
    issues: Issue[];
  }

  let groupedIssues = $derived.by((): IssueGroup[] => {
    if (groupBy === 'none') return [];
    const groups = new Map<string, Issue[]>();
    for (const issue of filteredIssues) {
      let key: string;
      if (groupBy === 'status') {
        key = issue.status ?? 'unknown';
      } else if (groupBy === 'priority') {
        key = issue.priority ?? 'none';
      } else if (groupBy === 'assignee') {
        key = assigneeLabel(issue) || 'Unassigned';
      } else {
        key = 'other';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(issue);
    }
    // Sort group keys
    const entries = [...groups.entries()];
    if (groupBy === 'status') {
      const order = ALL_STATUSES.map(s => s.value).filter(Boolean);
      entries.sort((a, b) => {
        const ai = order.indexOf(a[0]);
        const bi = order.indexOf(b[0]);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    } else if (groupBy === 'priority') {
      entries.sort((a, b) => (PRIORITY_ORDER[a[0]] ?? 99) - (PRIORITY_ORDER[b[0]] ?? 99));
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0]));
    }
    return entries.map(([key, issues]) => {
      let label = key;
      if (groupBy === 'status') {
        label = ALL_STATUSES.find(s => s.value === key)?.label ?? key.replace(/_/g, ' ');
      } else if (groupBy === 'priority') {
        label = ALL_PRIORITIES.find(p => p.value === key)?.label ?? (key === 'none' ? 'No Priority' : key);
      }
      return { key, label, issues };
    });
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
    low: 'text-muted-foreground bg-zinc-500/15 border-zinc-500/30',
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

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function assigneeLabel(issue: Issue): string {
    if (issue.assigneeName) return issue.assigneeName;
    if (issue.agentName) return issue.agentName;
    if (issue.assigneeAgentId) return 'Agent';
    if (issue.assigneeUserId) return 'User';
    return '';
  }

  function assigneeInitials(issue: Issue): string {
    const name = assigneeLabel(issue);
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function hasActiveRun(issue: Issue): boolean {
    return issue.activeRun != null && (issue.activeRun.status === 'queued' || issue.activeRun.status === 'running');
  }

  function selectedStatusLabel(): string {
    return ALL_STATUSES.find(s => s.value === statusFilter)?.label ?? 'All Statuses';
  }

  function selectedPriorityLabel(): string {
    return ALL_PRIORITIES.find(p => p.value === priorityFilter)?.label ?? 'All Priorities';
  }

  function selectedSortLabel(): string {
    return SORT_OPTIONS.find(s => s.value === sortBy)?.label ?? 'Sort';
  }

  function selectedGroupLabel(): string {
    const opt = GROUP_OPTIONS.find(g => g.value === groupBy);
    if (!opt || opt.value === 'none') return 'Group';
    return `Group: ${opt.label}`;
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
      sortDropdownOpen = false;
      groupDropdownOpen = false;
    }
  }

  function closeAllDropdownsExcept(...keep: string[]) {
    if (!keep.includes('status')) statusDropdownOpen = false;
    if (!keep.includes('priority')) priorityDropdownOpen = false;
    if (!keep.includes('sort')) sortDropdownOpen = false;
    if (!keep.includes('group')) groupDropdownOpen = false;
  }
</script>

{#snippet issueRow(issue: Issue, i: number, total: number)}
  <a
    href="/{$page.params.companyPrefix}/issues/{issue.id}"
    class="flex items-center gap-3 px-5 py-3 transition hover:bg-accent/40
      {i < total - 1 ? 'border-b border-border/50' : ''}"
  >
    <!-- Status dot -->
    <span class="w-2 h-2 rounded-full shrink-0 {statusDotClass(issue.status)}"></span>

    <!-- Identifier -->
    {#if issue.identifier}
      <span class="text-xs font-mono text-muted-foreground shrink-0 w-20 truncate">
        {issue.identifier}
      </span>
    {/if}

    <!-- Live badge -->
    {#if hasActiveRun(issue)}
      <span class="live-badge">
        <span class="live-dot"></span>
        Live
      </span>
    {/if}

    <!-- Title -->
    <span class="text-sm text-foreground truncate flex-1 min-w-0">
      {issue.title}
    </span>

    <!-- Priority badge -->
    {#if issue.priority && PRIORITY_LABELS[issue.priority]}
      <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 {PRIORITY_COLORS[issue.priority] ?? 'text-muted-foreground bg-zinc-500/15 border-zinc-500/30'}">
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
          <span class="text-[10px] text-muted-foreground">+{issue.labels.length - 2}</span>
        {/if}
      </div>
    {/if}

    <!-- Assignee initials badge -->
    {#if assigneeInitials(issue)}
      <span
        class="assignee-badge"
        title={assigneeLabel(issue)}
      >
        {assigneeInitials(issue)}
      </span>
    {/if}

    <!-- Formatted date -->
    <span class="text-xs text-muted-foreground shrink-0 tabular-nums text-right hidden sm:block" style="min-width: 6.5rem;">
      {formatDate(issue.updatedAt || issue.createdAt)}
    </span>
  </a>
{/snippet}

<svelte:window on:click={closeDropdowns} />

<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">Issues</h1>
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
        onclick={() => { closeAllDropdownsExcept('status'); statusDropdownOpen = !statusDropdownOpen; }}
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:bg-accent/60"
      >
        {selectedStatusLabel()}
        <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {#if statusDropdownOpen}
        <div class="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
          {#each ALL_STATUSES as s}
            <button
              onclick={() => { statusFilter = s.value; statusDropdownOpen = false; }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition
                {statusFilter === s.value ? 'text-white bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'}"
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
        onclick={() => { closeAllDropdownsExcept('priority'); priorityDropdownOpen = !priorityDropdownOpen; }}
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:bg-accent/60"
      >
        {selectedPriorityLabel()}
        <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {#if priorityDropdownOpen}
        <div class="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
          {#each ALL_PRIORITIES as p}
            <button
              onclick={() => { priorityFilter = p.value; priorityDropdownOpen = false; }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition
                {priorityFilter === p.value ? 'text-white bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'}"
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
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search issues..."
        bind:value={searchQuery}
        class="w-full rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2563EB] transition"
      />
    </div>

    <!-- Sort dropdown -->
    <div class="relative" data-dropdown>
      <button
        onclick={() => { closeAllDropdownsExcept('sort'); sortDropdownOpen = !sortDropdownOpen; }}
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:bg-accent/60"
      >
        <ArrowUpDown class="w-3.5 h-3.5 text-muted-foreground" />
        {selectedSortLabel()}
        <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {#if sortDropdownOpen}
        <div class="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
          {#each SORT_OPTIONS as s}
            <button
              onclick={() => { sortBy = s.value; sortDropdownOpen = false; }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition
                {sortBy === s.value ? 'text-white bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'}"
            >
              {s.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Group dropdown -->
    <div class="relative" data-dropdown>
      <button
        onclick={() => { closeAllDropdownsExcept('group'); groupDropdownOpen = !groupDropdownOpen; }}
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition hover:bg-accent/60"
      >
        <Layers class="w-3.5 h-3.5 text-muted-foreground" />
        {selectedGroupLabel()}
        <ChevronDown class="w-3.5 h-3.5 text-muted-foreground" />
      </button>
      {#if groupDropdownOpen}
        <div class="absolute top-full left-0 z-20 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-xl">
          {#each GROUP_OPTIONS as g}
            <button
              onclick={() => { groupBy = g.value; groupDropdownOpen = false; }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition
                {groupBy === g.value ? 'text-white bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'}"
            >
              {g.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- View toggle -->
    <div class="flex items-center rounded-lg border border-border bg-card p-0.5 shrink-0">
      <button
        onclick={() => viewMode = 'list'}
        class={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
          viewMode === 'list'
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground",
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
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:text-foreground",
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
          <div class="w-72 shrink-0 rounded-xl border border-border/50 bg-accent/25 p-3 space-y-2">
            <div class="h-4 w-24 animate-pulse rounded bg-accent/75"></div>
            {#each Array(3) as __}
              <div class="h-24 animate-pulse rounded-lg bg-accent/50"></div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-3">
        {#each Array(8) as _}
          <div class="h-[60px] animate-pulse rounded-xl bg-card border border-border"></div>
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
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <ListTodo class="w-8 h-8 text-muted-foreground" />
      </div>
      {#if issues.length === 0 && !statusFilter && !searchQuery.trim()}
        <p class="text-muted-foreground text-sm">No issues yet.</p>
        <p class="text-xs text-muted-foreground/60 mt-1">Create an issue to get started.</p>
      {:else}
        <p class="text-muted-foreground text-sm">No issues match the current filters.</p>
      {/if}
    </div>

  <!-- Board view -->
  {:else if viewMode === 'board'}
    <KanbanBoard issues={filteredIssues} prefix={currentPrefix} onStatusChange={handleStatusChange} />

  <!-- List view -->
  {:else}
    {#if groupBy !== 'none' && groupedIssues.length > 0}
      <!-- Grouped list view -->
      <div class="space-y-4">
        {#each groupedIssues as group (group.key)}
          <div>
            <div class="flex items-center gap-2 mb-2 px-1">
              {#if groupBy === 'status' && group.key}
                <span class="w-2 h-2 rounded-full shrink-0 {statusDotClass(group.key)}"></span>
              {/if}
              {#if groupBy === 'priority' && PRIORITY_LABELS[group.key]}
                <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none shrink-0 {PRIORITY_COLORS[group.key] ?? 'text-muted-foreground bg-zinc-500/15 border-zinc-500/30'}">
                  {PRIORITY_LABELS[group.key]}
                </span>
              {/if}
              <span class="text-sm font-medium text-foreground">{group.label}</span>
              <span class="text-xs text-muted-foreground">({group.issues.length})</span>
            </div>
            <div class="rounded-xl border border-border bg-card overflow-hidden">
              {#each group.issues as issue, i (issue.id)}
                {@render issueRow(issue, i, group.issues.length)}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <!-- Flat list view -->
      <div class="rounded-xl border border-border bg-card overflow-hidden">
        {#each filteredIssues as issue, i (issue.id)}
          {@render issueRow(issue, i, filteredIssues.length)}
        {/each}
      </div>
    {/if}

    <!-- Count -->
    <p class="text-xs text-muted-foreground text-right">
      {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
    </p>
  {/if}
</div>

<style>
  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    line-height: 1;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    animation: live-pulse 1.5s ease-in-out infinite;
  }

  @keyframes live-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.75); }
  }

  .assignee-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 0.625rem;
    font-weight: 600;
    flex-shrink: 0;
    letter-spacing: 0.02em;
    cursor: default;
  }
</style>
