<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import { Bot, Users, ChevronDown, ChevronRight, Maximize2, Minimize2, Download } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Org', href: `/${$page.params.companyPrefix}/org` }, { label: 'Chart' }]));

  interface Agent {
    id: string;
    name: string;
    title?: string;
    role?: string;
    status?: string;
    icon?: string;
    adapterType?: string;
    reportsTo?: string | null;
    [key: string]: unknown;
  }

  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let expandedAll = $state(true);
  let collapsedNodes = $state<Set<string>>(new Set());
  let companyId = $derived(companyStore.selectedCompany?.id);
  let prefix = $derived($page.params.companyPrefix);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agents`)
      .then(r => r.json())
      .then(d => { agents = Array.isArray(d) ? d : d.agents ?? []; })
      .finally(() => { loading = false; });
  });

  let roots = $derived(agents.filter(a => !a.reportsTo));
  function children(parentId: string): Agent[] {
    return agents.filter(a => a.reportsTo === parentId);
  }

  function hasChildren(agentId: string): boolean {
    return agents.some(a => a.reportsTo === agentId);
  }

  function toggleNode(agentId: string) {
    const next = new Set(collapsedNodes);
    if (next.has(agentId)) next.delete(agentId);
    else next.add(agentId);
    collapsedNodes = next;
  }

  function expandAll() {
    collapsedNodes = new Set();
    expandedAll = true;
  }

  function collapseAll() {
    const ids = new Set(agents.filter(a => hasChildren(a.id)).map(a => a.id));
    collapsedNodes = ids;
    expandedAll = false;
  }

  function agentCount(agentId: string): number {
    const kids = children(agentId);
    return kids.length + kids.reduce((sum, k) => sum + agentCount(k.id), 0);
  }

  // Status colors
  const STATUS_COLORS: Record<string, string> = {
    running: 'bg-blue-500',
    idle: 'bg-emerald-500',
    active: 'bg-emerald-500',
    paused: 'bg-amber-500',
    error: 'bg-red-500',
    terminated: 'bg-zinc-500',
  };

  function statusDot(status: string): string {
    return STATUS_COLORS[status] ?? 'bg-zinc-400';
  }

  // Adapter friendly names
  const ADAPTER_NAMES: Record<string, string> = {
    claude_local: 'Claude',
    codex_local: 'Codex',
    cursor: 'Cursor',
    gemini_local: 'Gemini',
    pi_local: 'Pi',
    opencode_local: 'OpenCode',
    openclaw_gateway: 'OpenClaw',
    process: 'Process',
    http: 'HTTP',
  };

  function adapterName(type: string): string {
    return ADAPTER_NAMES[type] ?? type;
  }

  // Role colors
  const ROLE_COLORS: Record<string, string> = {
    ceo: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    cto: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    cfo: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    cmo: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    cpo: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    engineer: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    designer: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    general: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  };

  function roleClass(role: string): string {
    return ROLE_COLORS[role?.toLowerCase()] ?? ROLE_COLORS.general;
  }
</script>

<div class="p-6 space-y-5">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Organization Chart</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        {agents.length} {agents.length === 1 ? 'agent' : 'agents'} in the organization
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        onclick={expandedAll ? collapseAll : expandAll}
        class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
      >
        {#if expandedAll}
          <Minimize2 class="h-3.5 w-3.5" /> Collapse All
        {:else}
          <Maximize2 class="h-3.5 w-3.5" /> Expand All
        {/if}
      </button>
    </div>
  </div>

  <!-- Loading -->
  {#if loading}
    <div class="space-y-4">
      {#each Array(5) as _}
        <div class="flex items-center gap-3">
          <div class="h-12 w-12 animate-pulse rounded-full bg-accent"></div>
          <div class="space-y-2 flex-1">
            <div class="h-4 w-40 animate-pulse rounded bg-accent"></div>
            <div class="h-3 w-24 animate-pulse rounded bg-accent/60"></div>
          </div>
        </div>
      {/each}
    </div>

  <!-- Empty -->
  {:else if roots.length === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <Users class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">No agents in organization</h3>
      <p class="mt-1 text-sm text-muted-foreground">Create agents to see them in the org chart</p>
      <a
        href="/{prefix}/agents/new"
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        + New Agent
      </a>
    </div>

  <!-- Org Tree -->
  {:else}
    <div class="rounded-xl border border-border bg-card overflow-hidden">
      {#each roots as root, i (root.id)}
        {#if i > 0}
          <div class="border-t border-border/50"></div>
        {/if}
        {@render orgNode(root, 0)}
      {/each}
    </div>
  {/if}
</div>

{#snippet orgNode(agent: Agent, depth: number)}
  {@const kids = children(agent.id)}
  {@const isCollapsed = collapsedNodes.has(agent.id)}
  {@const hasKids = kids.length > 0}
  {@const descendantCount = agentCount(agent.id)}

  <div>
    <!-- Agent Row -->
    <div
      class="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/40"
      style="padding-left: {20 + depth * 28}px;"
    >
      <!-- Expand/Collapse toggle -->
      <button
        onclick={() => hasKids && toggleNode(agent.id)}
        class="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors
          {hasKids ? 'hover:bg-accent cursor-pointer text-muted-foreground' : 'text-transparent cursor-default'}"
        aria-label={hasKids ? (isCollapsed ? 'Expand' : 'Collapse') : undefined}
        tabindex={hasKids ? 0 : -1}
      >
        {#if hasKids}
          {#if isCollapsed}
            <ChevronRight class="h-3.5 w-3.5" />
          {:else}
            <ChevronDown class="h-3.5 w-3.5" />
          {/if}
        {/if}
      </button>

      <!-- Status dot -->
      <div class="relative shrink-0">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style="background-color: {agent.role === 'ceo' ? '#F59E0B' : agent.role === 'cto' ? '#3B82F6' : agent.role === 'cfo' ? '#10B981' : agent.role === 'cmo' ? '#8B5CF6' : '#6366F1'}"
        >
          {(agent.name ?? '?')[0].toUpperCase()}
        </div>
        <!-- Status indicator -->
        <div class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card {statusDot(agent.status ?? 'idle')}
          {agent.status === 'running' ? 'animate-pulse' : ''}"></div>
      </div>

      <!-- Info -->
      <a href="/{prefix}/agents/{agent.id}" class="min-w-0 flex-1 group/link">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-foreground group-hover/link:text-blue-400 transition-colors truncate">
            {agent.name}
          </span>
          {#if agent.role}
            <span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider {roleClass(agent.role)}">
              {agent.role}
            </span>
          {/if}
        </div>
        {#if agent.title}
          <p class="text-xs text-muted-foreground truncate">{agent.title}</p>
        {/if}
      </a>

      <!-- Adapter -->
      {#if agent.adapterType}
        <span class="hidden sm:inline-flex items-center rounded-md bg-accent/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {adapterName(agent.adapterType)}
        </span>
      {/if}

      <!-- Direct reports count -->
      {#if hasKids}
        <span class="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users class="h-3 w-3" />
          {descendantCount}
        </span>
      {/if}

      <!-- Status badge -->
      <StatusBadge status={agent.status ?? 'idle'} />
    </div>

    <!-- Children (collapsible) -->
    {#if hasKids && !isCollapsed}
      <div class="relative">
        <!-- Vertical connector line -->
        <div
          class="absolute top-0 bottom-0 border-l border-border/50"
          style="left: {32 + depth * 28}px;"
        ></div>
        {#each kids as child (child.id)}
          {@render orgNode(child, depth + 1)}
        {/each}
      </div>
    {:else if hasKids && isCollapsed}
      <!-- Collapsed summary -->
      <button
        onclick={() => toggleNode(agent.id)}
        class="flex items-center gap-2 px-5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        style="padding-left: {48 + depth * 28}px;"
      >
        <span class="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-[10px] font-medium">
          {descendantCount}
        </span>
        <span>{descendantCount} direct {descendantCount === 1 ? 'report' : 'reports'} — click to expand</span>
      </button>
    {/if}
  </div>
{/snippet}
