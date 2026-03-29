<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus, RefreshCw, ChevronRight, Search, Clock, Play, Pause, Archive, MoreHorizontal, Trash2 } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Routines' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Routine {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    schedule?: string | null;
    cronExpression?: string | null;
    assigneeAgentId?: string | null;
    agentName?: string | null;
    lastRunAt?: string | null;
    nextRunAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let routines = $state<Routine[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeFilter = $state<string>('all');
  let searchQuery = $state('');
  let showCreate = $state(false);
  let newTitle = $state('');
  let newDescription = $state('');
  let newAssigneeAgentId = $state('');
  let newProjectId = $state('');
  let creating = $state(false);
  let togglingId = $state<string | null>(null);
  let runningId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let openDropdownId = $state<string | null>(null);

  // Agents for assignee dropdown
  interface Agent {
    id: string;
    name: string;
    [key: string]: unknown;
  }
  let agents = $state<Agent[]>([]);
  let agentsLoading = $state(false);

  // Projects for project dropdown
  interface Project {
    id: string;
    name: string;
    [key: string]: unknown;
  }
  let projects = $state<Project[]>([]);
  let projectsLoading = $state(false);

  let companyId = $derived(companyStore.selectedCompany?.id ?? companyStore.selectedCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  const STATUS_FILTERS = ['all', 'active', 'paused', 'archived'] as const;

  function filterLabel(f: string): string {
    const labels: Record<string, string> = { all: 'All', active: 'Active', paused: 'Paused', archived: 'Archived' };
    return labels[f] ?? f;
  }

  function countByFilter(filter: string): number {
    if (filter === 'all') return routines.length;
    return routines.filter(r => r.status === filter).length;
  }

  let filteredRoutines = $derived.by(() => {
    let list = routines;
    if (activeFilter !== 'all') {
      list = list.filter(r => r.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  function loadRoutines() {
    if (!companyId) return;
    loading = true;
    error = null;
    api(`/api/companies/${companyId}/routines`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { routines = (Array.isArray(d) ? d : d.routines ?? []) as Routine[]; })
      .catch(e => { error = e.message ?? 'Failed to load routines'; })
      .finally(() => { loading = false; });
  }

  function loadAgents() {
    if (!companyId) return;
    agentsLoading = true;
    api(`/api/companies/${companyId}/agents`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { agents = (Array.isArray(d) ? d : d.agents ?? []) as Agent[]; })
      .catch(() => { agents = []; })
      .finally(() => { agentsLoading = false; });
  }

  function loadProjects() {
    if (!companyId) return;
    projectsLoading = true;
    api(`/api/companies/${companyId}/projects`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { projects = (Array.isArray(d) ? d : d.projects ?? []) as Project[]; })
      .catch(() => { projects = []; })
      .finally(() => { projectsLoading = false; });
  }

  $effect(() => {
    if (!companyId) return;
    loadRoutines();
    loadAgents();
    loadProjects();
  });

  // ---------------------------------------------------------------------------
  // Create routine
  // ---------------------------------------------------------------------------
  async function createRoutine() {
    if (!newTitle.trim() || !companyId) return;
    creating = true;
    try {
      const body: Record<string, string> = { title: newTitle.trim() };
      if (newDescription.trim()) body.description = newDescription.trim();
      if (newAssigneeAgentId) body.assigneeAgentId = newAssigneeAgentId;
      if (newProjectId) body.projectId = newProjectId;
      const res = await api(`/api/companies/${companyId}/routines`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      routines = [...routines, created];
      newTitle = '';
      newDescription = '';
      newAssigneeAgentId = '';
      newProjectId = '';
      showCreate = false;
    } catch (e: any) {
      console.error('Failed to create routine:', e);
    } finally {
      creating = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Row actions
  // ---------------------------------------------------------------------------
  async function toggleRoutineStatus(routine: Routine) {
    if (!companyId) return;
    togglingId = routine.id;
    const newStatus = routine.status === 'active' ? 'paused' : 'active';
    try {
      const res = await api(`/api/routines/${routine.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      routines = routines.map(r => r.id === routine.id ? { ...r, status: newStatus } : r);
    } catch (e: any) {
      console.error('Failed to toggle routine status:', e);
    } finally {
      togglingId = null;
    }
  }

  async function runRoutineNow(routine: Routine) {
    if (!companyId) return;
    runningId = routine.id;
    openDropdownId = null;
    try {
      const res = await api(`/api/routines/${routine.id}/run`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadRoutines();
    } catch (e: any) {
      console.error('Failed to run routine:', e);
    } finally {
      runningId = null;
    }
  }

  async function deleteRoutine(routine: Routine) {
    if (!confirm(`Delete routine "${routine.title}"? This action cannot be undone.`)) return;
    deletingId = routine.id;
    openDropdownId = null;
    try {
      const res = await api(`/api/routines/${routine.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      routines = routines.filter(r => r.id !== routine.id);
    } catch (e: any) {
      console.error('Failed to delete routine:', e);
    } finally {
      deletingId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-emerald-500',
    paused: 'bg-yellow-500',
    archived: 'bg-zinc-500',
    running: 'bg-blue-500 animate-pulse',
  };

  const STATUS_BADGE_COLORS: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    archived: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };

  function statusDotClass(status: string): string {
    return STATUS_COLORS[status] ?? 'bg-zinc-500';
  }

  function statusBadgeClass(status: string): string {
    return STATUS_BADGE_COLORS[status] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }

  function filterIcon(f: string): typeof Play {
    switch (f) {
      case 'active': return Play;
      case 'paused': return Pause;
      case 'archived': return Archive;
      default: return RefreshCw;
    }
  }

  function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return 'never';
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

  function truncateId(id: string | null | undefined): string {
    if (!id) return '';
    return id.length > 12 ? id.slice(0, 12) + '...' : id;
  }

  function scheduleDisplay(routine: Routine): string {
    return routine.cronExpression ?? routine.schedule ?? '';
  }
</script>

<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Routines</h1>
      <p class="mt-1 text-sm text-muted-foreground">Scheduled recurring tasks and automations</p>
    </div>
    <button
      onclick={() => (showCreate = !showCreate)}
      class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98]"
    >
      <Plus class="w-4 h-4" />
      New Routine
    </button>
  </div>

  <!-- Create form -->
  {#if showCreate}
    <form
      onsubmit={(e) => { e.preventDefault(); createRoutine(); }}
      class="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <div>
        <label for="routine-title" class="block text-sm font-medium text-foreground mb-1">Title</label>
        <input
          id="routine-title"
          bind:value={newTitle}
          placeholder="e.g. Nightly code review sweep"
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label for="routine-desc" class="block text-sm font-medium text-foreground mb-1">
          Description <span class="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id="routine-desc"
          bind:value={newDescription}
          rows={3}
          placeholder="What does this routine do?"
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        ></textarea>
      </div>
      <div>
        <label for="routine-agent" class="block text-sm font-medium text-foreground mb-1">
          Assignee Agent <span class="text-muted-foreground font-normal">(optional)</span>
        </label>
        <select
          id="routine-agent"
          bind:value={newAssigneeAgentId}
          disabled={agentsLoading}
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">No agent assigned</option>
          {#each agents as agent}
            <option value={agent.id}>{agent.name}</option>
          {/each}
        </select>
        {#if agentsLoading}
          <p class="text-xs text-muted-foreground mt-1">Loading agents...</p>
        {/if}
      </div>
      <div>
        <label for="routine-project" class="block text-sm font-medium text-foreground mb-1">
          Project <span class="text-muted-foreground font-normal">(optional)</span>
        </label>
        <select
          id="routine-project"
          bind:value={newProjectId}
          disabled={projectsLoading}
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">No project</option>
          {#each projects as project}
            <option value={project.id}>{project.name}</option>
          {/each}
        </select>
        {#if projectsLoading}
          <p class="text-xs text-muted-foreground mt-1">Loading projects...</p>
        {/if}
      </div>
      <div class="flex items-center gap-3">
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Routine'}
        </button>
        <button
          type="button"
          onclick={() => { showCreate = false; newTitle = ''; newDescription = ''; newAssigneeAgentId = ''; newProjectId = ''; }}
          class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
        >
          Cancel
        </button>
      </div>
    </form>
  {/if}

  <!-- Filter pills + Search -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-1.5 flex-wrap">
      {#each STATUS_FILTERS as filter}
        <button
          onclick={() => { activeFilter = filter; }}
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition
            {activeFilter === filter
              ? 'bg-[#2563EB] text-white'
              : 'bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground'}"
        >
          {filterLabel(filter)}
          <span class="ml-1 text-xs opacity-70">({countByFilter(filter)})</span>
        </button>
      {/each}
    </div>

    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search routines..."
        bind:value={searchQuery}
        class="w-full sm:w-64 rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2563EB] transition"
      />
    </div>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-20 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p class="text-sm text-red-400">{error}</p>
      <button
        onclick={() => loadRoutines()}
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        Retry
      </button>
    </div>

  <!-- Empty -->
  {:else if filteredRoutines.length === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <RefreshCw class="h-10 w-10 text-muted-foreground" />
      </div>
      {#if routines.length === 0}
        <h3 class="text-lg font-medium text-foreground">No routines defined</h3>
        <p class="mt-1 text-sm text-muted-foreground">Create a routine to automate recurring tasks</p>
        <button
          onclick={() => (showCreate = true)}
          class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus class="h-4 w-4" />
          New Routine
        </button>
      {:else}
        <p class="text-muted-foreground text-sm">No routines match the current filters.</p>
      {/if}
    </div>

  <!-- Routines list -->
  {:else}
    <div class="rounded-xl border border-border bg-card overflow-hidden">
      {#each filteredRoutines as routine, i (routine.id)}
        <div
          class="group flex items-center gap-4 px-5 py-4 transition hover:bg-accent/40
            {i < filteredRoutines.length - 1 ? 'border-b border-border/50' : ''}
            {deletingId === routine.id ? 'opacity-50 pointer-events-none' : ''}"
        >
          <!-- Enable/disable toggle -->
          <button
            onclick={(e) => { e.stopPropagation(); toggleRoutineStatus(routine); }}
            disabled={togglingId === routine.id || routine.status === 'archived'}
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-card disabled:opacity-40
              {routine.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-600'}"
            title={routine.status === 'active' ? 'Pause routine' : 'Enable routine'}
          >
            <span
              class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm
                {routine.status === 'active' ? 'translate-x-[18px]' : 'translate-x-[3px]'}"
            ></span>
            {#if togglingId === routine.id}
              <span class="absolute inset-0 flex items-center justify-center">
                <RefreshCw class="w-3 h-3 text-white animate-spin" />
              </span>
            {/if}
          </button>

          <!-- Clickable row area -->
          <a
            href="/{prefix}/routines/{routine.id}"
            class="min-w-0 flex-1 flex items-center gap-4"
          >
            <!-- Status dot -->
            <span class="w-2 h-2 rounded-full shrink-0 {statusDotClass(routine.status)}"></span>

            <!-- Content -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3 mb-0.5">
                <h3 class="text-sm font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">
                  {routine.title}
                </h3>
                <span class="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {statusBadgeClass(routine.status)}">
                  {routine.status}
                </span>
              </div>

              <div class="flex items-center gap-3 mt-1">
                {#if routine.assigneeAgentId || routine.agentName}
                  <span class="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                    {routine.agentName ?? truncateId(routine.assigneeAgentId)}
                  </span>
                {/if}

                {#if scheduleDisplay(routine)}
                  <span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock class="w-3 h-3 shrink-0" />
                    <span class="font-mono">{scheduleDisplay(routine)}</span>
                  </span>
                {/if}
              </div>
            </div>

            <!-- Last run -->
            <span class="text-xs text-muted-foreground shrink-0 tabular-nums w-20 text-right">
              {timeAgo(routine.lastRunAt)}
            </span>

            <!-- Arrow -->
            <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </a>

          <!-- Actions dropdown -->
          <div class="relative shrink-0">
            <button
              onclick={(e) => { e.stopPropagation(); openDropdownId = openDropdownId === routine.id ? null : routine.id; }}
              class="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Actions"
            >
              <MoreHorizontal class="w-4 h-4" />
            </button>

            {#if openDropdownId === routine.id}
              <!-- Backdrop to close dropdown -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="fixed inset-0 z-40" onclick={() => { openDropdownId = null; }} onkeydown={() => {}}></div>
              <div class="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-card shadow-lg py-1">
                <button
                  onclick={(e) => { e.stopPropagation(); runRoutineNow(routine); }}
                  disabled={runningId === routine.id}
                  class="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50"
                >
                  <Play class="w-3.5 h-3.5" />
                  {runningId === routine.id ? 'Running...' : 'Run Now'}
                </button>
                <button
                  onclick={(e) => { e.stopPropagation(); openDropdownId = null; toggleRoutineStatus(routine); }}
                  disabled={togglingId === routine.id || routine.status === 'archived'}
                  class="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent/60 transition-colors disabled:opacity-50"
                >
                  {#if routine.status === 'active'}
                    <Pause class="w-3.5 h-3.5" />
                    Pause
                  {:else}
                    <Play class="w-3.5 h-3.5" />
                    Enable
                  {/if}
                </button>
                <div class="my-1 border-t border-border/50"></div>
                <button
                  onclick={(e) => { e.stopPropagation(); deleteRoutine(routine); }}
                  disabled={deletingId === routine.id}
                  class="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  {deletingId === routine.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Count -->
    <p class="text-xs text-muted-foreground text-right">
      {filteredRoutines.length} routine{filteredRoutines.length !== 1 ? 's' : ''}
    </p>
  {/if}
</div>
