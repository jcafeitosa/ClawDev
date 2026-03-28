<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus, Bot, Activity, Search, List, Network, SlidersHorizontal } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Agents' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Agent {
    id: string;
    name: string;
    slug?: string;
    urlKey?: string;
    status: string;
    role: string;
    title?: string | null;
    adapterType: string;
    model?: string | null;
    lastHeartbeatAt?: string | null;
    reportsTo?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface TreeNode {
    agent: Agent;
    children: TreeNode[];
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeFilter = $state<string>('all');
  let searchQuery = $state('');
  let showFilters = $state(false);
  let showTerminated = $state(false);

  // View mode: list | tree — persisted in localStorage
  let viewMode = $state<'list' | 'tree'>(
    browser ? (localStorage.getItem('agents-view-mode') as 'list' | 'tree') ?? 'list' : 'list'
  );

  $effect(() => {
    if (browser) localStorage.setItem('agents-view-mode', viewMode);
  });

  let companyId = $derived(companyStore.selectedCompany?.id ?? companyStore.selectedCompanyId);

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  const BASE_STATUS_FILTERS = ['all', 'idle', 'running', 'paused', 'error'] as const;

  let STATUS_FILTERS = $derived(
    showTerminated
      ? [...BASE_STATUS_FILTERS, 'terminated' as const]
      : BASE_STATUS_FILTERS
  );

  function statusLabel(s: string): string {
    const labels: Record<string, string> = {
      all: 'All',
      idle: 'Active',
      running: 'Running',
      paused: 'Paused',
      error: 'Error',
      terminated: 'Terminated',
    };
    return labels[s] ?? s;
  }

  function countByStatus(status: string): number {
    if (status === 'all') return baseFilteredAgents.length;
    if (status === 'idle') return baseFilteredAgents.filter(a => a.status === 'idle' || a.status === 'pending_approval').length;
    return baseFilteredAgents.filter(a => a.status === status).length;
  }

  /** Agents after applying terminated filter but before status/search filters */
  let baseFilteredAgents = $derived.by(() => {
    if (showTerminated) return agents;
    return agents.filter(a => a.status !== 'terminated');
  });

  let filteredAgents = $derived.by(() => {
    let list = baseFilteredAgents;
    if (activeFilter === 'idle') {
      list = list.filter(a => a.status === 'idle' || a.status === 'pending_approval');
    } else if (activeFilter !== 'all') {
      list = list.filter(a => a.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.role ?? '').toLowerCase().includes(q) ||
        (a.adapterType ?? '').toLowerCase().includes(q) ||
        (a.title ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  // ---------------------------------------------------------------------------
  // Org tree builder
  // ---------------------------------------------------------------------------
  let agentTree = $derived.by(() => {
    const filteredIds = new Set(filteredAgents.map(a => a.id));
    const byId = new Map<string, Agent>();
    for (const a of filteredAgents) byId.set(a.id, a);

    // Build children map
    const childrenMap = new Map<string | null, Agent[]>();
    for (const a of filteredAgents) {
      const parentId = a.reportsTo && filteredIds.has(a.reportsTo) ? a.reportsTo : null;
      const list = childrenMap.get(parentId) ?? [];
      list.push(a);
      childrenMap.set(parentId, list);
    }

    function buildNodes(parentId: string | null): TreeNode[] {
      const kids = childrenMap.get(parentId) ?? [];
      return kids.map(agent => ({
        agent,
        children: buildNodes(agent.id),
      }));
    }

    return buildNodes(null);
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    loading = true;
    error = null;
    api(`/api/companies/${companyId}/agents`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { agents = (Array.isArray(d) ? d : d.agents ?? []) as Agent[]; })
      .catch(e => { error = e.message ?? 'Failed to load agents'; })
      .finally(() => { loading = false; });
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const STATUS_COLORS: Record<string, string> = {
    idle: 'bg-emerald-500',
    running: 'bg-blue-500 animate-pulse',
    paused: 'bg-yellow-500',
    error: 'bg-red-500',
    terminated: 'bg-zinc-500',
    pending_approval: 'bg-amber-400',
  };

  function statusDotClass(status: string): string {
    return STATUS_COLORS[status] ?? 'bg-zinc-500';
  }

  const STATUS_TEXT_COLORS: Record<string, string> = {
    idle: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    running: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    paused: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    error: 'text-red-400 bg-red-500/10 border-red-500/20',
    terminated: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
    pending_approval: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  function statusBadgeClass(status: string): string {
    return STATUS_TEXT_COLORS[status] ?? 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
  }

  function statusDisplayText(status: string): string {
    const labels: Record<string, string> = {
      idle: 'Idle',
      running: 'Running',
      paused: 'Paused',
      error: 'Error',
      terminated: 'Terminated',
      pending_approval: 'Pending',
    };
    return labels[status] ?? status;
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

  function adapterDisplayName(adapterType: string): string {
    const names: Record<string, string> = {
      claude_local: 'Claude',
      codex_local: 'Codex',
      cursor: 'Cursor',
      gemini_local: 'Gemini',
      pi_local: 'Pi',
      openclaw_gateway: 'OpenClaw',
      opencode_local: 'OpenCode',
      process: 'Process',
      http: 'HTTP',
    };
    return names[adapterType] ?? adapterType;
  }

  function roleBadgeColor(role: string): string {
    const colors: Record<string, string> = {
      ceo: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      general: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
      lead: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return colors[role] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
</script>

{#snippet agentRow(agent: Agent, options?: { indent?: number; isTree?: boolean; isLast?: boolean })}
  {@const indent = options?.indent ?? 0}
  {@const isTree = options?.isTree ?? false}
  <a
    href="/{$page.params.companyPrefix}/agents/{agent.urlKey ?? agent.id}"
    class="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-white/[0.03]"
    style={isTree ? `padding-left: ${20 + indent * 24}px` : ''}
  >
    <!-- Tree connector line -->
    {#if isTree && indent > 0}
      <div
        class="absolute left-0 top-0 bottom-0"
        style="width: {20 + (indent - 1) * 24 + 12}px"
      >
        <div class="absolute right-0 top-0 bottom-0 w-px bg-white/[0.06]"></div>
      </div>
    {/if}

    <!-- Status dot / Live indicator -->
    {#if agent.status === 'running'}
      <span class="relative flex items-center shrink-0">
        <span class="absolute inline-flex h-3 w-3 rounded-full bg-blue-500/40 animate-ping"></span>
        <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500"></span>
      </span>
    {:else}
      <span class="w-2.5 h-2.5 rounded-full shrink-0 {statusDotClass(agent.status)}"></span>
    {/if}

    <!-- Name, role, title -->
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-[#F8FAFC] truncate">{agent.name}</span>
        <span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {roleBadgeColor(agent.role)}">
          {agent.role}
        </span>
      </div>
      {#if agent.title}
        <p class="text-xs text-[#64748B] mt-0.5 truncate">{agent.title}</p>
      {/if}
    </div>

    <!-- Adapter type -->
    <span class="hidden sm:inline-flex items-center rounded-md bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[11px] text-[#94A3B8] font-mono shrink-0">
      {adapterDisplayName(agent.adapterType)}
    </span>

    <!-- Live badge OR status badge -->
    {#if agent.status === 'running'}
      <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shrink-0 text-blue-400 bg-blue-500/10 border-blue-500/20">
        <Activity class="w-3 h-3 animate-pulse" />
        Live
      </span>
    {:else}
      <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium shrink-0 {statusBadgeClass(agent.status)}">
        {statusDisplayText(agent.status)}
      </span>
    {/if}

    <!-- Heartbeat -->
    <span class="text-[11px] text-[#64748B] shrink-0 tabular-nums w-16 text-right">
      {timeAgo(agent.lastHeartbeatAt)}
    </span>
  </a>
{/snippet}

{#snippet treeNodes(nodes: TreeNode[], depth: number)}
  {#each nodes as node, i (node.agent.id)}
    <div class="relative {depth > 0 ? '' : ''}">
      {@render agentRow(node.agent, { indent: depth, isTree: true, isLast: i === nodes.length - 1 })}
      {#if depth > 0}
        <div
          class="absolute top-0 bottom-0 pointer-events-none"
          style="left: {20 + (depth - 1) * 24}px; width: 1px"
        >
          <div class="w-px h-full bg-white/[0.06]"></div>
        </div>
      {/if}
    </div>
    {#if node.children.length > 0}
      {@render treeNodes(node.children, depth + 1)}
    {/if}
  {/each}
{/snippet}

<div class="p-6 space-y-5">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-semibold text-[#F8FAFC]">Agents</h1>
    </div>
    <a
      href="/{$page.params.companyPrefix}/agents/new"
      class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 transition hover:bg-[#1d4ed8] active:scale-[0.98]"
    >
      <Plus class="w-4 h-4" />
      New Agent
    </a>
  </div>

  <!-- Search + Filter Tabs + View Toggle -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <!-- Filter pills -->
    <div class="flex items-center gap-1.5 flex-wrap">
      {#each STATUS_FILTERS as status}
        <button
          onclick={() => { activeFilter = status; }}
          class="rounded-lg px-3 py-1.5 text-sm font-medium transition
            {activeFilter === status
              ? 'bg-[#2563EB] text-white'
              : 'bg-white/[0.05] text-[#94A3B8] hover:bg-white/[0.08] hover:text-[#F8FAFC]'}"
        >
          {statusLabel(status)}
          <span class="ml-1 text-xs opacity-70">({countByStatus(status)})</span>
        </button>
      {/each}
    </div>

    <!-- Search + view toggle + filters button -->
    <div class="flex items-center gap-2">
      <!-- View toggle -->
      <div class="flex items-center rounded-lg border border-white/[0.08] bg-[#121218] overflow-hidden">
        <button
          onclick={() => { viewMode = 'list'; }}
          class="p-2 transition {viewMode === 'list' ? 'bg-white/[0.1] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'}"
          title="List view"
        >
          <List class="w-4 h-4" />
        </button>
        <button
          onclick={() => { viewMode = 'tree'; }}
          class="p-2 transition {viewMode === 'tree' ? 'bg-white/[0.1] text-[#F8FAFC]' : 'text-[#64748B] hover:text-[#94A3B8]'}"
          title="Org tree view"
        >
          <Network class="w-4 h-4" />
        </button>
      </div>

      <!-- Filters button -->
      <button
        onclick={() => { showFilters = !showFilters; }}
        class="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm transition
          {showFilters ? 'text-[#F8FAFC] border-[#2563EB]/50' : 'text-[#64748B] hover:text-[#94A3B8]'}"
      >
        <SlidersHorizontal class="w-3.5 h-3.5" />
        Filters
      </button>

      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
        <input
          type="text"
          placeholder="Search agents..."
          bind:value={searchQuery}
          class="w-full sm:w-56 rounded-lg border border-white/[0.08] bg-[#121218] pl-9 pr-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#2563EB] transition"
        />
      </div>
    </div>
  </div>

  <!-- Expanded filters panel -->
  {#if showFilters}
    <div class="flex items-center gap-4 rounded-lg border border-white/[0.08] bg-[#121218] px-4 py-3">
      <label class="flex items-center gap-2 text-sm text-[#94A3B8] cursor-pointer select-none">
        <input
          type="checkbox"
          bind:checked={showTerminated}
          class="w-4 h-4 rounded border-white/20 bg-white/[0.05] text-[#2563EB] focus:ring-[#2563EB] focus:ring-offset-0 cursor-pointer"
        />
        Show terminated agents
      </label>
    </div>
  {/if}

  <!-- Agent count -->
  {#if !loading && !error}
    <p class="text-xs text-[#64748B]">{filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}</p>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(6) as _}
        <div class="h-[64px] animate-pulse rounded-xl bg-[#121218] border border-white/[0.08]"></div>
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p class="text-sm text-red-400">{error}</p>
      <button
        onclick={() => { loading = true; error = null; api(`/api/companies/${companyId}/agents`).then(r => r.json()).then(d => { agents = (Array.isArray(d) ? d : d.agents ?? []) as Agent[]; }).catch(e => { error = e.message; }).finally(() => { loading = false; }); }}
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        Retry
      </button>
    </div>

  <!-- Empty -->
  {:else if filteredAgents.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-white/[0.05] p-4 mb-4">
        <Bot class="w-8 h-8 text-[#94A3B8]" />
      </div>
      {#if agents.length === 0}
        <p class="text-[#94A3B8] text-sm">No agents yet.</p>
        <a
          href="/{$page.params.companyPrefix}/agents/new"
          class="mt-3 text-sm text-[#2563EB] hover:underline"
        >
          Create your first agent
        </a>
      {:else}
        <p class="text-[#94A3B8] text-sm">No agents match the current filters.</p>
      {/if}
    </div>

  <!-- Agent list / tree -->
  {:else}
    <div class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden divide-y divide-white/[0.05]">
      {#if viewMode === 'tree'}
        <!-- Org Tree View -->
        {@render treeNodes(agentTree, 0)}
      {:else}
        <!-- Flat List View -->
        {#each filteredAgents as agent (agent.id)}
          {@render agentRow(agent)}
        {/each}
      {/if}
    </div>
  {/if}
</div>
