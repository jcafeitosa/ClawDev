<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import { Users, Plus, Minus, Maximize, Download, Upload, Bot } from 'lucide-svelte';

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
  let companyId = $derived(companyStore.selectedCompany?.id);
  let prefix = $derived($page.params.companyPrefix);

  // Zoom/pan state
  let scale = $state(1);
  let translateX = $state(0);
  let translateY = $state(0);
  let isPanning = $state(false);
  let panStartX = $state(0);
  let panStartY = $state(0);

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

  // Zoom controls
  function zoomIn() { scale = Math.min(scale + 0.15, 2.5); }
  function zoomOut() { scale = Math.max(scale - 0.15, 0.3); }
  function fitView() { scale = 1; translateX = 0; translateY = 0; }

  // Pan handlers
  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isPanning = true;
    panStartX = e.clientX - translateX;
    panStartY = e.clientY - translateY;
  }
  function handleMouseMove(e: MouseEvent) {
    if (!isPanning) return;
    translateX = e.clientX - panStartX;
    translateY = e.clientY - panStartY;
  }
  function handleMouseUp() { isPanning = false; }
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    scale = Math.max(0.3, Math.min(2.5, scale + delta));
  }

  // Status colors
  const STATUS_DOT: Record<string, string> = {
    running: 'bg-blue-500',
    idle: 'bg-emerald-500',
    active: 'bg-emerald-500',
    paused: 'bg-amber-500',
    error: 'bg-red-500',
    terminated: 'bg-zinc-500',
  };

  const ADAPTER_NAMES: Record<string, string> = {
    claude_local: 'Claude', codex_local: 'Codex', cursor: 'Cursor',
    gemini_local: 'Gemini', pi_local: 'Pi', opencode_local: 'OpenCode',
    openclaw_gateway: 'OpenClaw', process: 'Process', http: 'HTTP',
  };

  // Role icon backgrounds
  const ROLE_BG: Record<string, string> = {
    ceo: '#92400E', cto: '#1E40AF', cfo: '#065F46', cmo: '#6B21A8',
    cpo: '#9A3412', engineer: '#164E63', designer: '#831843',
    general: '#3F3F46', marketer: '#7C2D12',
  };
</script>

<div class="flex h-full flex-col">
  <!-- Header bar -->
  <div class="flex items-center justify-between border-b border-border px-5 py-3">
    <div class="flex items-center gap-4">
      <h1 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Org Chart</h1>
      <a href="/{prefix}/import" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Upload class="h-3.5 w-3.5" /> Import company
      </a>
      <a href="/{prefix}/export" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
        <Download class="h-3.5 w-3.5" /> Export company
      </a>
    </div>
  </div>

  <!-- Canvas area -->
  <div
    class="relative flex-1 overflow-hidden bg-background"
    style="cursor: {isPanning ? 'grabbing' : 'grab'};"
    onmousedown={handleMouseDown}
    onmousemove={handleMouseMove}
    onmouseup={handleMouseUp}
    onmouseleave={handleMouseUp}
    onwheel={handleWheel}
    role="application"
    aria-label="Organization chart canvas"
  >
    <!-- Zoom controls -->
    <div class="absolute top-3 right-3 z-10 flex flex-col gap-1">
      <button onclick={zoomIn} class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label="Zoom in">
        <Plus class="h-4 w-4" />
      </button>
      <button onclick={zoomOut} class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label="Zoom out">
        <Minus class="h-4 w-4" />
      </button>
      <button onclick={fitView} class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-[10px] font-bold" aria-label="Fit view">
        Fit
      </button>
    </div>

    {#if loading}
      <div class="flex h-full items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <div class="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-blue-500"></div>
          <p class="text-sm text-muted-foreground">Loading org chart...</p>
        </div>
      </div>
    {:else if agents.length === 0}
      <div class="flex h-full items-center justify-center">
        <div class="flex flex-col items-center gap-4">
          <div class="rounded-full bg-accent/60 p-4">
            <Users class="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 class="text-lg font-medium text-foreground">No agents yet</h3>
          <a href="/{prefix}/agents/new" class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + New Agent
          </a>
        </div>
      </div>
    {:else}
      <!-- Pannable/zoomable container -->
      <div
        class="h-full w-full flex items-start justify-center pt-16"
        style="transform: translate({translateX}px, {translateY}px) scale({scale}); transform-origin: center top; transition: {isPanning ? 'none' : 'transform 0.15s ease'};"
      >
        <div class="flex flex-col items-center gap-0">
          {#each roots as root (root.id)}
            {@render orgCard(root)}
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

{#snippet orgCard(agent: Agent)}
  {@const kids = children(agent.id)}
  <div class="flex flex-col items-center">
    <!-- Vertical line from parent (if not root) -->
    {#if agent.reportsTo}
      <div class="w-px h-8 bg-border"></div>
    {/if}

    <!-- Agent card -->
    <a
      href="/{prefix}/agents/{agent.id}"
      class="group relative flex items-start gap-3 rounded-xl border border-border bg-card p-4 pr-6 shadow-sm transition-all hover:border-blue-500/50 hover:shadow-md"
      style="min-width: 200px; max-width: 260px;"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Role icon -->
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style="background-color: {ROLE_BG[agent.role?.toLowerCase() ?? ''] ?? ROLE_BG.general}"
      >
        <Bot class="h-4 w-4" />
      </div>

      <!-- Info -->
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-foreground group-hover:text-blue-400 transition-colors truncate">{agent.name}</p>
        {#if agent.title}
          <p class="text-xs text-muted-foreground truncate">{agent.title}</p>
        {:else if agent.role}
          <p class="text-xs text-muted-foreground truncate capitalize">{agent.role}</p>
        {/if}
        {#if agent.adapterType}
          <p class="mt-0.5 text-[11px] text-muted-foreground/70">{ADAPTER_NAMES[agent.adapterType] ?? agent.adapterType}</p>
        {/if}
      </div>

      <!-- Status dot -->
      <div class="absolute left-3 bottom-3 h-2.5 w-2.5 rounded-full {STATUS_DOT[agent.status ?? 'idle'] ?? 'bg-zinc-400'} {agent.status === 'running' ? 'animate-pulse' : ''}"></div>
    </a>

    <!-- Children connector -->
    {#if kids.length > 0}
      <!-- Vertical line down -->
      <div class="w-px h-8 bg-border"></div>

      <!-- Horizontal connector bar (if multiple children) -->
      {#if kids.length > 1}
        <div class="relative" style="width: {kids.length * 240}px; max-width: 90vw;">
          <div class="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-border" style="width: {(kids.length - 1) * 240}px;"></div>
        </div>
      {/if}

      <!-- Children row -->
      <div class="flex items-start gap-6">
        {#each kids as child (child.id)}
          {@render orgCard(child)}
        {/each}
      </div>
    {/if}
  </div>
{/snippet}
