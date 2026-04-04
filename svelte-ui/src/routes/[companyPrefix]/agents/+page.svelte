<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Plus, Bot, List, GitBranch, SlidersHorizontal } from 'lucide-svelte';
  import { Card, Badge, Skeleton, Avatar, AvatarFallback, Alert, AlertDescription, Button } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

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

  type FilterTab = 'all' | 'active' | 'paused' | 'error';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let liveRuns = $state<any[]>([]);
  let activeFilter = $state<FilterTab>('all');
  let showTerminated = $state(false);
  let filtersOpen = $state(false);

  let viewMode = $state<'list' | 'tree'>(
    browser ? (localStorage.getItem('agents-view-mode') as 'list' | 'tree') ?? 'list' : 'list'
  );

  $effect(() => {
    if (browser) localStorage.setItem('agents-view-mode', viewMode);
  });

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);

  // ---------------------------------------------------------------------------
  // Live run map: agentId -> { runId, liveCount }
  // ---------------------------------------------------------------------------
  let liveRunByAgent = $derived.by(() => {
    const map = new Map<string, { runId: string; liveCount: number }>();
    for (const r of liveRuns) {
      if (r.status !== 'running' && r.status !== 'queued') continue;
      const agentId = r.agentId ?? r.agent?.id;
      if (!agentId) continue;
      const existing = map.get(agentId);
      if (existing) { existing.liveCount += 1; continue; }
      map.set(agentId, { runId: r.id, liveCount: 1 });
    }
    return map;
  });

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------
  function matchesTab(status: string, tab: FilterTab): boolean {
    if (status === 'terminated') return showTerminated;
    if (tab === 'all') return true;
    if (tab === 'active') return status === 'active' || status === 'running' || status === 'idle';
    if (tab === 'paused') return status === 'paused';
    if (tab === 'error') return status === 'error';
    return true;
  }

  let filteredAgents = $derived.by(() => {
    return agents
      .filter(a => matchesTab(a.status, activeFilter))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  function countByTab(tab: FilterTab): number {
    const base = showTerminated ? agents : agents.filter(a => a.status !== 'terminated');
    if (tab === 'all') return base.length;
    if (tab === 'active') return base.filter(a => a.status === 'active' || a.status === 'running' || a.status === 'idle').length;
    return base.filter(a => a.status === tab).length;
  }

  // ---------------------------------------------------------------------------
  // Org tree builder
  // ---------------------------------------------------------------------------
  let agentTree = $derived.by(() => {
    const filteredIds = new Set(filteredAgents.map(a => a.id));
    const childrenMap = new Map<string | null, Agent[]>();
    for (const a of filteredAgents) {
      const parentId = a.reportsTo && filteredIds.has(a.reportsTo) ? a.reportsTo : null;
      const list = childrenMap.get(parentId) ?? [];
      list.push(a);
      childrenMap.set(parentId, list);
    }
    function buildNodes(parentId: string | null): TreeNode[] {
      return (childrenMap.get(parentId) ?? []).map(agent => ({
        agent,
        children: buildNodes(agent.id),
      }));
    }
    return buildNodes(null);
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  let liveRunsInterval: ReturnType<typeof setInterval> | undefined;

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

  async function fetchLiveRuns() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/live-runs?minCount=0`);
      if (res.ok) {
        const data = await res.json();
        liveRuns = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
      }
    } catch { /* ignore */ }
  }

  onMount(() => {
    fetchLiveRuns();
    liveRunsInterval = setInterval(fetchLiveRuns, 15_000);
  });

  onDestroy(() => {
    if (liveRunsInterval) clearInterval(liveRunsInterval);
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const STATUS_COLORS: Record<string, string> = {
    idle:             'bg-emerald-500',
    active:           'bg-emerald-500',
    running:          'bg-blue-500',
    paused:           'bg-yellow-500',
    error:            'bg-red-500',
    terminated:       'bg-zinc-500',
    pending_approval: 'bg-amber-400',
  };

  function statusDotClass(status: string): string {
    return STATUS_COLORS[status] ?? 'bg-zinc-500';
  }

  const STATUS_BADGE: Record<string, string> = {
    idle:             'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    active:           'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    running:          'text-blue-400 bg-blue-500/10 border-blue-500/20',
    paused:           'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    error:            'text-red-400 bg-red-500/10 border-red-500/20',
    terminated:       'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
    pending_approval: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  };

  function statusBadgeClass(status: string): string {
    return STATUS_BADGE[status] ?? 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
  }

  function statusDisplayText(status: string): string {
    const labels: Record<string, string> = {
      idle: 'Idle', active: 'Active', running: 'Running',
      paused: 'Paused', error: 'Error', terminated: 'Terminated',
      pending_approval: 'Pending',
    };
    return labels[status] ?? status;
  }

  function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const ADAPTER_LABELS: Record<string, string> = {
    claude_local: 'Claude', codex_local: 'Codex', cursor: 'Cursor',
    gemini_local: 'Gemini', pi_local: 'Pi', openclaw_gateway: 'OpenClaw',
    opencode_local: 'OpenCode', process: 'Process', http: 'HTTP',
  };

  const ROLE_LABELS: Record<string, string> = {
    ceo: 'CEO', manager: 'Manager', general: 'General', lead: 'Lead',
  };

  function roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? role;
  }

  const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
    { value: 'all',    label: 'All'    },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'error',  label: 'Error'  },
  ];

  function agentInitials(name: string): string {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  const STATUS_AVATAR_BG: Record<string, string> = {
    idle:             'bg-emerald-500/15',
    active:           'bg-emerald-500/15',
    running:          'bg-cyan-500/15',
    paused:           'bg-amber-500/15',
    error:            'bg-red-500/15',
    terminated:       'bg-zinc-500/15',
    pending_approval: 'bg-amber-500/15',
  };

  // Close filters dropdown on outside click
  function handleWindowClick(e: MouseEvent) {
    if (filtersOpen && !(e.target as HTMLElement).closest('[data-filters-dropdown]')) {
      filtersOpen = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<!-- -------------------------------------------------------------------------
  Snippets
  ------------------------------------------------------------------------- -->

{#snippet agentRowContent(agent: Agent)}
  {@const liveInfo = liveRunByAgent.get(agent.id)}
  {@const subtitle = `${roleLabel(agent.role)}${agent.title ? ` - ${agent.title}` : ''}`}
  {@const agentHref = `/{$page.params.companyPrefix}/agents/{agent.urlKey ?? agent.id}`}
  <div
    role="link"
    tabindex="0"
    onclick={() => goto(agentHref)}
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goto(agentHref);
      }
    }}
    class="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition-colors duration-200 w-full text-left no-underline text-inherit cursor-pointer"
  >
    <!-- Avatar with initials -->
    <Avatar size="sm" class={STATUS_AVATAR_BG[agent.status] ?? 'bg-zinc-500/15'}>
      <AvatarFallback class="text-[10px] font-semibold">{agentInitials(agent.name)}</AvatarFallback>
    </Avatar>

    <!-- Name + subtitle -->
    <div class="flex-1 min-w-0">
      <span class="text-sm font-medium text-foreground">{agent.name}</span>
      <span class="text-xs text-muted-foreground ml-2">{subtitle}</span>
    </div>

    <!-- Trailing -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Mobile: live indicator or status badge only -->
      <span class="sm:hidden">
        {#if liveInfo}
          <a
            href="/{$page.params.companyPrefix}/runs/{liveInfo.runId}"
            onclick={(e) => e.stopPropagation()}
            class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
          >
            <span class="relative flex h-2 w-2">
              <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span class="text-[11px] font-medium text-blue-400">Live{liveInfo.liveCount > 1 ? ` (${liveInfo.liveCount})` : ''}</span>
          </a>
        {:else}
          <Badge variant="ghost" class="text-[11px] {statusBadgeClass(agent.status)}">
            {statusDisplayText(agent.status)}
          </Badge>
        {/if}
      </span>

      <!-- Desktop: live indicator + adapter + heartbeat + status -->
      <div class="hidden sm:flex items-center gap-3">
        {#if liveInfo}
          <a
            href="/{$page.params.companyPrefix}/runs/{liveInfo.runId}"
            onclick={(e) => e.stopPropagation()}
            class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors duration-200"
          >
            <span class="relative flex h-2 w-2">
              <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span class="text-[11px] font-medium text-blue-400">Live{liveInfo.liveCount > 1 ? ` (${liveInfo.liveCount})` : ''}</span>
          </a>
        {/if}
        <span class="text-xs text-muted-foreground font-mono w-14 text-right">
          {ADAPTER_LABELS[agent.adapterType] ?? agent.adapterType}
        </span>
        <span class="text-xs text-muted-foreground w-16 text-right">
          {timeAgo(agent.lastHeartbeatAt)}
        </span>
        <span class="w-20 flex justify-end">
          <Badge variant="ghost" class="text-[11px] {statusBadgeClass(agent.status)}">
            {statusDisplayText(agent.status)}
          </Badge>
        </span>
      </div>
    </div>
  </div>
{/snippet}

{#snippet treeNodes(nodes: TreeNode[], depth: number)}
  {#each nodes as node (node.agent.id)}
    <div style="padding-left: {depth * 24}px">
      {@render agentRowContent(node.agent)}
      {#if node.children.length > 0}
        <div class="border-l border-border/50 ml-4">
          {@render treeNodes(node.children, depth + 1)}
        </div>
      {/if}
    </div>
  {/each}
{/snippet}

<!-- -------------------------------------------------------------------------
  Page
  ------------------------------------------------------------------------- -->

<PageLayout title="Agents" description="Your AI workforce">
  {#snippet actions()}
    <!-- Filters dropdown -->
    <div class="relative" data-filters-dropdown>
      <button
        onclick={() => { filtersOpen = !filtersOpen; }}
        class="flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors border border-border
          {filtersOpen || showTerminated ? 'text-foreground bg-accent' : 'text-muted-foreground hover:bg-accent/50'}"
      >
        <SlidersHorizontal class="h-3 w-3" />
        Filters
        {#if showTerminated}
          <span class="ml-0.5 px-1 bg-foreground/10 rounded text-[10px]">1</span>
        {/if}
      </button>
      {#if filtersOpen}
        <div class="absolute right-0 top-full mt-1 z-50 w-48 border border-border bg-popover shadow-md p-1">
          <button
            class="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors"
            onclick={() => { showTerminated = !showTerminated; }}
          >
            <span
              class="flex items-center justify-center h-3.5 w-3.5 border border-border rounded-sm
                {showTerminated ? 'bg-foreground' : ''}"
            >
              {#if showTerminated}
                <span class="text-background text-[10px] leading-none">✓</span>
              {/if}
            </span>
            Show terminated
          </button>
        </div>
      {/if}
    </div>

    <!-- View toggle -->
    <div class="flex items-center border border-border">
      <button
        onclick={() => { viewMode = 'list'; }}
        class="p-1.5 transition-colors {viewMode === 'list' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}"
        title="List view"
      >
        <List class="h-3.5 w-3.5" />
      </button>
      <button
        onclick={() => { viewMode = 'tree'; }}
        class="p-1.5 transition-colors {viewMode === 'tree' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/50'}"
        title="Org tree view"
      >
        <GitBranch class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- New Agent -->
    <Button variant="outline" href="/{$page.params.companyPrefix}/agents/new" class="gap-1.5 cursor-pointer">
      <Plus class="h-3.5 w-3.5" />
      New Agent
    </Button>
  {/snippet}

  <!-- Filter tabs -->
  <div class="flex items-center gap-1.5 flex-wrap">
    {#each FILTER_TABS as tab}
      <button
        onclick={() => { activeFilter = tab.value; }}
        class="rounded-lg px-3 py-1.5 text-sm font-medium transition
          {activeFilter === tab.value
            ? 'bg-[#2563EB] text-white'
            : 'bg-accent/60 text-muted-foreground hover:bg-accent hover:text-foreground'}"
      >
        {tab.label}
        <span class="ml-1 text-xs opacity-70">({countByTab(tab.value)})</span>
      </button>
    {/each}
  </div>

  <!-- Agent count -->
  {#if !loading && !error && filteredAgents.length > 0}
    <p class="text-xs text-muted-foreground">
      {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''}
    </p>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="glass-card p-0">
      {#each Array(6) as _, i}
        <div class="flex items-center gap-3 px-3 py-2.5">
          <Skeleton class="h-6 w-6 rounded-full" />
          <Skeleton class="h-4 w-32" />
          <div class="flex-1"></div>
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
        {#if i < 5}<div class="border-t border-border/40"></div>{/if}
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>

  <!-- No agents at all -->
  {:else if agents.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <Bot class="w-8 h-8 text-muted-foreground" />
      </div>
      <p class="text-sm text-muted-foreground">Create your first agent to get started.</p>
      <a
        href="/{$page.params.companyPrefix}/agents/new"
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        New Agent
      </a>
    </div>

  <!-- List view -->
  {:else if viewMode === 'list'}
    {#if filteredAgents.length > 0}
      <Card class="border-border/60 backdrop-blur-sm p-0 gap-0 divide-y divide-border/40">
        {#each filteredAgents as agent (agent.id)}
          {@render agentRowContent(agent)}
        {/each}
      </Card>
    {:else}
      <p class="text-sm text-muted-foreground text-center py-8">No agents match the selected filter.</p>
    {/if}

  <!-- Org tree view -->
  {:else}
    {#if agentTree.length > 0}
      <Card class="border-border/60 backdrop-blur-sm p-0 gap-0 py-1">
        {@render treeNodes(agentTree, 0)}
      </Card>
    {:else}
      <p class="text-sm text-muted-foreground text-center py-8">No organizational hierarchy defined.</p>
    {/if}
  {/if}
</PageLayout>
