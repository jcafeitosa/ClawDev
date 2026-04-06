<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { ISSUE_STATUS_ORDER, ISSUE_STATUS_VISUALS, PRIORITY_ORDER, PRIORITY_VISUALS } from '$lib/constants/visual';
  import { onMount } from 'svelte';
  import { Plus, Search, List, LayoutGrid, Filter, ArrowUpDown, Layers, ChevronRight, X, Check, User } from 'lucide-svelte';
  import KanbanBoard from '$lib/components/board/kanban-board.svelte';
  import { Badge, Button, Input, Skeleton, Alert, AlertTitle, AlertDescription, Separator, Card } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Issues' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Agent { id: string; name: string; }
  interface IssueLabel { id: string; name: string; color?: string | null; }
  interface IssueActiveRun { id: string; status: string; agentId: string; }
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
    labels?: IssueLabel[];
    activeRun?: IssueActiveRun | null;
    [key: string]: unknown;
  }

  interface ViewState {
    statuses: string[];
    priorities: string[];
    assignees: string[];
    sortField: 'status' | 'priority' | 'title' | 'created' | 'updated';
    sortDir: 'asc' | 'desc';
    groupBy: 'status' | 'priority' | 'assignee' | 'none';
    viewMode: 'list' | 'board';
    collapsedGroups: string[];
  }

  interface IssueGroup { key: string; label: string; issues: Issue[]; }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const ALL_STATUSES = ISSUE_STATUS_ORDER.map((value) => ({
    value,
    label: ISSUE_STATUS_VISUALS[value]?.label ?? value,
  }));

  const ALL_PRIORITIES = PRIORITY_ORDER.map((value) => ({
    value,
    label: PRIORITY_VISUALS[value]?.label ?? value,
  }));

  const QUICK_PRESETS = [
    { label: 'All', statuses: [] as string[] },
    { label: 'Active', statuses: ['todo', 'in_progress', 'in_review', 'blocked'] },
    { label: 'Backlog', statuses: ['backlog'] },
    { label: 'Done', statuses: ['done', 'cancelled'] },
  ];

  const SORT_FIELDS = [
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'title', label: 'Title' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
  ] as const;

  const GROUP_OPTIONS = [
    { value: 'status', label: 'Status' },
    { value: 'priority', label: 'Priority' },
    { value: 'assignee', label: 'Assignee' },
    { value: 'none', label: 'None' },
  ] as const;

  const defaultViewState: ViewState = {
    statuses: [],
    priorities: [],
    assignees: [],
    sortField: 'updated',
    sortDir: 'desc',
    groupBy: 'none',
    viewMode: 'list',
    collapsedGroups: [],
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let issues = $state<Issue[]>([]);
  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let filterOpen = $state(false);
  let sortOpen = $state(false);
  let groupOpen = $state(false);
  let statusPickerIssueId = $state<string | null>(null);
  let assigneePickerIssueId = $state<string | null>(null);
  let viewState = $state<ViewState>({ ...defaultViewState });

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let currentPrefix = $derived($page.params.companyPrefix);
  let storageKey = $derived(companyId ? `clawdev:issues-view:${companyId}` : 'clawdev:issues-view');

  // Load view state from localStorage when storageKey changes
  $effect(() => {
    const key = storageKey;
    try {
      const raw = localStorage.getItem(key);
      if (raw) viewState = { ...defaultViewState, ...JSON.parse(raw) };
      else viewState = { ...defaultViewState };
    } catch {}
  });

  function updateView(patch: Partial<ViewState>) {
    viewState = { ...viewState, ...patch };
    try { localStorage.setItem(storageKey, JSON.stringify(viewState)); } catch {}
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let filteredIssues = $derived.by(() => {
    let list = issues;
    if (viewState.statuses.length > 0) list = list.filter(i => viewState.statuses.includes(i.status));
    if (viewState.priorities.length > 0) list = list.filter(i => viewState.priorities.includes(i.priority ?? ''));
    if (viewState.assignees.length > 0) {
      list = list.filter(issue => {
        for (const a of viewState.assignees) {
          if (a === '__unassigned' && !issue.assigneeAgentId && !issue.assigneeUserId) return true;
          if (issue.assigneeAgentId === a) return true;
        }
        return false;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(i => (i.title ?? '').toLowerCase().includes(q) || (i.identifier ?? '').toLowerCase().includes(q));
    }
    list = [...list];
    const dir = viewState.sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (viewState.sortField) {
        case 'status': return dir * (ISSUE_STATUS_ORDER.indexOf(a.status) - ISSUE_STATUS_ORDER.indexOf(b.status));
        case 'priority': return dir * (PRIORITY_ORDER.indexOf(a.priority ?? '') - PRIORITY_ORDER.indexOf(b.priority ?? ''));
        case 'title': return dir * (a.title ?? '').localeCompare(b.title ?? '');
        case 'created': return dir * (new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
        case 'updated': return dir * (new Date(a.updatedAt ?? a.createdAt ?? 0).getTime() - new Date(b.updatedAt ?? b.createdAt ?? 0).getTime());
        default: return 0;
      }
    });
    return list;
  });

  let groupedIssues = $derived.by((): IssueGroup[] => {
    if (viewState.groupBy === 'none') return [{ key: '__all', label: '', issues: filteredIssues }];
    const groups = new Map<string, Issue[]>();
    for (const issue of filteredIssues) {
      let key: string;
      if (viewState.groupBy === 'status') key = issue.status;
      else if (viewState.groupBy === 'priority') key = issue.priority ?? 'none';
      else key = issue.assigneeAgentId ?? (issue.assigneeUserId ? `__user:${issue.assigneeUserId}` : '__unassigned');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(issue);
    }
    const entries = [...groups.entries()];
    if (viewState.groupBy === 'status') {
        entries.sort((a, b) => ISSUE_STATUS_ORDER.indexOf(a[0]) - ISSUE_STATUS_ORDER.indexOf(b[0]));
    } else if (viewState.groupBy === 'priority') {
      entries.sort((a, b) => (PRIORITY_ORDER.indexOf(a[0]) ?? 99) - (PRIORITY_ORDER.indexOf(b[0]) ?? 99));
    }
    return entries.map(([key, issues]) => {
      let label = key;
      if (viewState.groupBy === 'status') label = ALL_STATUSES.find(s => s.value === key)?.label ?? key;
      else if (viewState.groupBy === 'priority') label = ALL_PRIORITIES.find(p => p.value === key)?.label ?? (key === 'none' ? 'No Priority' : key);
      else if (key === '__unassigned') label = 'Unassigned';
      else label = agents.find(a => a.id === key)?.name ?? key.slice(0, 8);
      return { key, label, issues };
    });
  });

  let activeFilterCount = $derived(
    (viewState.statuses.length > 0 ? 1 : 0) +
    (viewState.priorities.length > 0 ? 1 : 0) +
    (viewState.assignees.length > 0 ? 1 : 0)
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    void companyId;
    loadIssues();
    loadAgents();
  });

  async function loadIssues() {
    if (!companyId) return;
    loading = true;
    error = null;
    try {
      const r = await api(`/api/companies/${companyId}/issues`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      issues = Array.isArray(d) ? d : d.issues ?? [];
    } catch (e: any) {
      error = e.message ?? 'Failed to load issues';
    } finally {
      loading = false;
    }
  }

  async function loadAgents() {
    if (!companyId) return;
    try {
      const r = await api(`/api/companies/${companyId}/agents`);
      if (r.ok) {
        const d = await r.json();
        agents = Array.isArray(d) ? d : d.agents ?? [];
      }
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function statusDotClass(s: string) { return ISSUE_STATUS_VISUALS[s]?.dotClass ?? 'bg-zinc-500'; }

  function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  function assigneeLabel(issue: Issue): string {
    if (issue.assigneeName) return issue.assigneeName;
    if (issue.agentName) return issue.agentName;
    if (issue.assigneeAgentId) return agents.find(a => a.id === issue.assigneeAgentId)?.name ?? 'Agent';
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

  function toggleFilter(field: 'statuses' | 'priorities' | 'assignees', value: string) {
    const arr = viewState[field];
    updateView({ [field]: arr.includes(value) ? arr.filter((v: string) => v !== value) : [...arr, value] } as Partial<ViewState>);
  }

  function toggleGroup(key: string) {
    const c = viewState.collapsedGroups;
    updateView({ collapsedGroups: c.includes(key) ? c.filter(k => k !== key) : [...c, key] });
  }

  function arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort(), sb = [...b].sort();
    return sa.every((v, i) => v === sb[i]);
  }

  async function handleStatusChange(issueId: string, newStatus: string) {
    statusPickerIssueId = null;
    try {
      const res = await api(`/api/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) throw new Error();
      const idx = issues.findIndex(i => i.id === issueId);
      if (idx !== -1) { issues[idx] = { ...issues[idx], status: newStatus }; issues = [...issues]; }
    } catch { loadIssues(); }
  }

  async function handleAssigneeChange(issueId: string, agentId: string | null) {
    assigneePickerIssueId = null;
    try {
      const res = await api(`/api/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify({ assigneeAgentId: agentId, assigneeUserId: null }) });
      if (!res.ok) throw new Error();
      const idx = issues.findIndex(i => i.id === issueId);
      if (idx !== -1) {
        const agent = agentId ? agents.find(a => a.id === agentId) : null;
        issues[idx] = { ...issues[idx], assigneeAgentId: agentId, assigneeUserId: null, assigneeName: agent?.name ?? null, agentName: agent?.name ?? null };
        issues = [...issues];
      }
    } catch {}
  }

  function closePopovers(event: MouseEvent) {
    if (!(event.target as HTMLElement).closest('[data-popover]')) {
      filterOpen = false;
      sortOpen = false;
      groupOpen = false;
      statusPickerIssueId = null;
      assigneePickerIssueId = null;
    }
  }
</script>

{#snippet issueRow(issue: Issue, i: number, total: number)}
  <a
    href="/{currentPrefix}/issues/{issue.id}"
    class="group flex items-center gap-3 border-b border-border/50 px-4 py-2.5 text-sm no-underline text-inherit transition-colors hover:bg-accent/50 last:border-b-0"
  >
    <!-- Status dot (clickable picker) -->
    <div class="relative shrink-0" data-popover>
      <button
        type="button"
        onclick={(e) => { e.preventDefault(); e.stopPropagation(); statusPickerIssueId = statusPickerIssueId === issue.id ? null : issue.id; assigneePickerIssueId = null; }}
        class="h-3 w-3 rounded-full transition hover:ring-2 hover:ring-offset-1 hover:ring-border {statusDotClass(issue.status)}"
        title={issue.status}
      ></button>
      {#if statusPickerIssueId === issue.id}
        <div class="absolute left-0 top-full z-40 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-xl">
          {#each ALL_STATUSES as s}
            <button
              type="button"
              onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleStatusChange(issue.id, s.value); }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-accent/40 {issue.status === s.value ? 'text-foreground' : 'text-muted-foreground'}"
            >
              <span class="h-2 w-2 rounded-full {statusDotClass(s.value)}"></span>
              {s.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Identifier -->
    {#if issue.identifier}
      <span class="w-20 shrink-0 truncate font-mono text-xs text-muted-foreground">{issue.identifier}</span>
    {/if}

    <!-- Live badge -->
    {#if hasActiveRun(issue)}
      <Badge variant="ghost" class="shrink-0 gap-1 bg-blue-500/10 px-1.5 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
        </span>
        Live
      </Badge>
    {/if}

    <!-- Title -->
    <span class="min-w-0 flex-1 truncate text-sm text-foreground">{issue.title}</span>

    <!-- Trailing -->
    <span class="ml-auto hidden shrink-0 items-center gap-2 sm:flex sm:gap-3">
      <!-- Priority -->
      {#if issue.priority && PRIORITY_VISUALS[issue.priority]}
        <Badge variant="outline" class="text-[10px] font-bold leading-none rounded px-1.5 py-0.5 {PRIORITY_VISUALS[issue.priority].badgeClass}">
          {PRIORITY_VISUALS[issue.priority].label}
        </Badge>
      {/if}

      <!-- Labels (up to 3) -->
      {#if issue.labels?.length}
        <span class="hidden items-center gap-1 overflow-hidden md:flex md:max-w-[200px]">
          {#each issue.labels.slice(0, 3) as label}
            <Badge
              variant="outline"
              class="text-[10px] font-medium px-1.5 py-0.5"
              style="border-color: {label.color ?? '#3b82f6'}; color: {label.color ?? '#3b82f6'}; background-color: {label.color ?? '#3b82f6'}1f;"
            >
              {label.name}
            </Badge>
          {/each}
          {#if issue.labels.length > 3}
            <span class="text-[10px] text-muted-foreground">+{issue.labels.length - 3}</span>
          {/if}
        </span>
      {/if}

      <!-- Assignee (clickable picker) -->
      <div class="relative" data-popover>
        <button
          type="button"
          onclick={(e) => { e.preventDefault(); e.stopPropagation(); assigneePickerIssueId = assigneePickerIssueId === issue.id ? null : issue.id; statusPickerIssueId = null; }}
          class="flex w-[160px] shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-accent/50"
        >
          {#if assigneeInitials(issue)}
            <span class="assignee-badge">{assigneeInitials(issue)}</span>
            <span class="hidden truncate text-muted-foreground lg:block">{assigneeLabel(issue)}</span>
          {:else}
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/35 bg-muted/30">
              <User class="h-3 w-3 text-muted-foreground" />
            </span>
            <span class="hidden text-muted-foreground lg:block">Unassigned</span>
          {/if}
        </button>
        {#if assigneePickerIssueId === issue.id}
          <div class="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-xl">
            <button
              type="button"
              onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleAssigneeChange(issue.id, null); }}
              class="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-accent/40 hover:text-foreground {!issue.assigneeAgentId && !issue.assigneeUserId ? 'text-foreground' : ''}"
            >
              Unassigned
            </button>
            {#each agents as agent}
              <button
                type="button"
                onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleAssigneeChange(issue.id, agent.id); }}
                class="flex w-full items-center gap-2 px-3 py-1.5 text-sm transition hover:bg-accent/40 {issue.assigneeAgentId === agent.id ? 'text-foreground bg-accent/30' : 'text-muted-foreground hover:text-foreground'}"
              >
                {agent.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Time ago -->
      <span class="hidden min-w-[5rem] text-right text-xs tabular-nums text-muted-foreground sm:block">
        {timeAgo(issue.updatedAt || issue.createdAt)}
      </span>
    </span>
  </a>
{/snippet}

<svelte:window onclick={closePopovers} />

<PageLayout title="Issues" description="Track and manage tasks">
  {#snippet actions()}
    <Button variant="outline" size="sm" href="/{currentPrefix}/issues/new" class="cursor-pointer">
      <Plus class="h-4 w-4" />
      <span class="hidden sm:inline">New Issue</span>
    </Button>
  {/snippet}

  <!-- Toolbar -->
  <div class="flex items-center justify-between gap-2 sm:gap-3">
    <!-- Left: Search -->
    <div class="flex min-w-0 items-center gap-2 sm:gap-3">
      <div class="relative">
        <Search class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          type="text"
          placeholder="Search issues..."
          bind:value={searchQuery}
          class="w-48 pl-8 sm:w-64 md:w-80"
        />
      </div>
    </div>

    <!-- Right: View toggle + Filter + Sort + Group -->
    <div class="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <!-- View toggle -->
      <div class="mr-1 flex items-center overflow-hidden rounded-md border border-border">
        <button
          type="button"
          onclick={() => updateView({ viewMode: 'list' })}
          class="p-1.5 transition-colors {viewState.viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}"
          title="List view"
          aria-label="List view"
        ><List class="h-3.5 w-3.5" /></button>
        <button
          type="button"
          onclick={() => updateView({ viewMode: 'board' })}
          class="p-1.5 transition-colors {viewState.viewMode === 'board' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}"
          title="Board view"
          aria-label="Board view"
        ><LayoutGrid class="h-3.5 w-3.5" /></button>
      </div>

      <!-- Filter popover -->
      <div class="relative" data-popover>
        <button
          type="button"
          onclick={() => { filterOpen = !filterOpen; sortOpen = false; groupOpen = false; }}
          class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/50 {activeFilterCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}"
          aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Filter issues'}
        >
          <Filter class="h-3.5 w-3.5" />
          <span class="hidden sm:inline">{activeFilterCount > 0 ? `Filters: ${activeFilterCount}` : 'Filter'}</span>
        </button>
        {#if activeFilterCount > 0}
          <button
            type="button"
            class="ml-1 hidden sm:inline-flex items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            onclick={(e) => { e.stopPropagation(); updateView({ statuses: [], priorities: [], assignees: [] }); }}
            aria-label="Clear filters"
            title="Clear filters"
          ><X class="h-3 w-3" /></button>
        {/if}

        {#if filterOpen}
          <div class="absolute right-0 top-full z-30 mt-1 w-[min(480px,calc(100vw-2rem))] rounded-lg border border-border bg-card p-3 shadow-xl space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Filters</span>
              {#if activeFilterCount > 0}
                <button
                  type="button"
                  class="text-xs text-muted-foreground hover:text-foreground"
                  onclick={() => updateView({ statuses: [], priorities: [], assignees: [] })}
                >Clear</button>
              {/if}
            </div>

            <!-- Quick presets -->
            <div class="space-y-1.5">
              <span class="text-xs text-muted-foreground">Quick filters</span>
              <div class="flex flex-wrap gap-1.5">
                {#each QUICK_PRESETS as preset}
                  {@const isActive = arraysEqual(viewState.statuses, preset.statuses)}
                  <button
                    type="button"
                    onclick={() => updateView({ statuses: isActive ? [] : [...preset.statuses] })}
                    class="cursor-pointer"
                  >
                    <Badge variant={isActive ? 'default' : 'outline'} class="px-2.5 py-1 text-xs transition-colors duration-150 {isActive ? '' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground'} cursor-pointer">
                      {preset.label}
                    </Badge>
                  </button>
                {/each}
              </div>
            </div>

            <Separator />

            <!-- Status + Priority/Assignee -->
            <div class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <!-- Status -->
              <div class="space-y-1">
                <span class="text-xs text-muted-foreground">Status</span>
                <div class="space-y-0.5">
                  {#each ALL_STATUSES as s}
                    <label class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                      <input
                        type="checkbox"
                        checked={viewState.statuses.includes(s.value)}
                        onchange={() => toggleFilter('statuses', s.value)}
                        class="rounded"
                      />
                      <span class="h-2 w-2 shrink-0 rounded-full {statusDotClass(s.value)}"></span>
                      <span class="text-sm">{s.label}</span>
                    </label>
                  {/each}
                </div>
              </div>

              <!-- Priority + Assignee stacked -->
              <div class="space-y-3">
                <div class="space-y-1">
                  <span class="text-xs text-muted-foreground">Priority</span>
                  <div class="space-y-0.5">
                    {#each ALL_PRIORITIES as p}
                      <label class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                        <input
                          type="checkbox"
                          checked={viewState.priorities.includes(p.value)}
                          onchange={() => toggleFilter('priorities', p.value)}
                          class="rounded"
                        />
                        <span class="inline-flex items-center rounded border px-1 text-[10px] font-bold {PRIORITY_VISUALS[p.value]?.badgeClass ?? ''}">
                          {PRIORITY_VISUALS[p.value]?.label ?? p.value}
                        </span>
                        <span class="text-sm">{p.label}</span>
                      </label>
                    {/each}
                  </div>
                </div>

                {#if agents.length > 0}
                  <div class="space-y-1">
                    <span class="text-xs text-muted-foreground">Assignee</span>
                    <div class="max-h-32 space-y-0.5 overflow-y-auto">
                      <label class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                        <input
                          type="checkbox"
                          checked={viewState.assignees.includes('__unassigned')}
                          onchange={() => toggleFilter('assignees', '__unassigned')}
                          class="rounded"
                        />
                        <span class="text-sm">No assignee</span>
                      </label>
                      {#each agents as agent}
                        <label class="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-accent/50">
                          <input
                            type="checkbox"
                            checked={viewState.assignees.includes(agent.id)}
                            onchange={() => toggleFilter('assignees', agent.id)}
                            class="rounded"
                          />
                          <span class="text-sm">{agent.name}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Sort (list view only) -->
      {#if viewState.viewMode === 'list'}
        <div class="relative" data-popover>
          <button
            type="button"
            onclick={() => { sortOpen = !sortOpen; filterOpen = false; groupOpen = false; }}
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <ArrowUpDown class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Sort</span>
          </button>
          {#if sortOpen}
            <div class="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-border bg-card p-2 shadow-xl space-y-0.5">
              {#each SORT_FIELDS as field}
                <button
                  type="button"
                  onclick={() => {
                    if (viewState.sortField === field.value) updateView({ sortDir: viewState.sortDir === 'asc' ? 'desc' : 'asc' });
                    else updateView({ sortField: field.value, sortDir: 'asc' });
                  }}
                  class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm {viewState.sortField === field.value ? 'bg-accent/50 text-foreground' : 'text-muted-foreground hover:bg-accent/50'}"
                >
                  <span>{field.label}</span>
                  {#if viewState.sortField === field.value}
                    <span class="text-xs text-muted-foreground">{viewState.sortDir === 'asc' ? '↑' : '↓'}</span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Group (list view only) -->
        <div class="relative" data-popover>
          <button
            type="button"
            onclick={() => { groupOpen = !groupOpen; filterOpen = false; sortOpen = false; }}
            class="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <Layers class="h-3.5 w-3.5" />
            <span class="hidden sm:inline">Group</span>
          </button>
          {#if groupOpen}
            <div class="absolute right-0 top-full z-30 mt-1 w-44 rounded-lg border border-border bg-card p-2 shadow-xl space-y-0.5">
              {#each GROUP_OPTIONS as opt}
                <button
                  type="button"
                  onclick={() => { updateView({ groupBy: opt.value }); groupOpen = false; }}
                  class="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm {viewState.groupBy === opt.value ? 'bg-accent/50 text-foreground' : 'text-muted-foreground hover:bg-accent/50'}"
                >
                  <span>{opt.label}</span>
                  {#if viewState.groupBy === opt.value}<Check class="h-3.5 w-3.5" />{/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    {#if viewState.viewMode === 'board'}
      <div class="flex gap-3 overflow-x-auto pb-4">
        {#each Array(5) as _}
          <div class="w-72 shrink-0 space-y-2 rounded-xl border border-border/50 bg-accent/25 p-3">
            <Skeleton class="h-4 w-24" />
            {#each Array(3) as __}
              <Skeleton class="h-24 rounded-lg" />
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <div class="space-y-2">
        {#each Array(8) as _}
          <Skeleton class="h-[52px] rounded-xl" />
        {/each}
      </div>
    {/if}

  {:else if error}
    <Alert variant="destructive">
      <AlertTitle>Failed to load issues</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
      <Button variant="link" size="sm" class="mt-2 cursor-pointer" onclick={loadIssues}>Retry</Button>
    </Alert>

  {:else if viewState.viewMode === 'board'}
    <KanbanBoard issues={filteredIssues} prefix={currentPrefix ?? ''} onStatusChange={handleStatusChange} />

  {:else if filteredIssues.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="mb-4 rounded-full bg-accent/60 p-4">
        <Filter class="h-8 w-8 text-muted-foreground" />
      </div>
      {#if issues.length === 0}
        <p class="text-sm text-muted-foreground">No issues yet.</p>
        <p class="mt-1 text-xs text-muted-foreground/60">Create an issue to get started.</p>
      {:else}
        <p class="text-sm text-muted-foreground">No issues match the current filters or search.</p>
      {/if}
    </div>

  {:else}
    <div class="space-y-4">
      {#each groupedIssues as group (group.key)}
        {@const isCollapsed = viewState.collapsedGroups.includes(group.key)}
        {#if group.key === '__all'}
          <Card class="overflow-hidden rounded-xl py-0 gap-0">
            {#each group.issues as issue, i (issue.id)}
              {@render issueRow(issue, i, group.issues.length)}
            {/each}
          </Card>
        {:else}
          <div>
            <div class="flex items-center gap-1.5 py-1.5 pl-1 pr-3">
              <button
                type="button"
                onclick={() => toggleGroup(group.key)}
                class="flex items-center gap-1.5"
              >
                <ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform {isCollapsed ? '' : 'rotate-90'}" />
                {#if viewState.groupBy === 'status' && group.key}
                  <span class="h-2 w-2 rounded-full {statusDotClass(group.key)}"></span>
                {/if}
                {#if viewState.groupBy === 'priority' && PRIORITY_VISUALS[group.key]}
                  <span class="inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none {PRIORITY_VISUALS[group.key].badgeClass}">
                    {PRIORITY_VISUALS[group.key].label}
                  </span>
                {/if}
                <span class="text-sm font-semibold uppercase tracking-wide">{group.label}</span>
                <span class="text-xs text-muted-foreground">({group.issues.length})</span>
              </button>
              <a href="/{currentPrefix}/issues/new" class="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground">
                <Plus class="h-3.5 w-3.5" />
              </a>
            </div>
            {#if !isCollapsed}
              <Card class="overflow-hidden rounded-xl py-0 gap-0">
                {#each group.issues as issue, i (issue.id)}
                  {@render issueRow(issue, i, group.issues.length)}
                {/each}
              </Card>
            {/if}
          </div>
        {/if}
      {/each}
    </div>

    <p class="text-right text-xs text-muted-foreground">
      {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
    </p>
  {/if}
</PageLayout>

<style>
  .assignee-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 0.6rem;
    font-weight: 600;
    flex-shrink: 0;
    letter-spacing: 0.02em;
    cursor: default;
  }
</style>
