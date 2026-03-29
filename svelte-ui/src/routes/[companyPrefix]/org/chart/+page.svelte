<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Users, Plus, Minus, Download, Upload, Bot, Terminal, Briefcase, Globe, Shield, Code, Palette, TrendingUp, Megaphone } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Org', href: `/${$page.params.companyPrefix}/org` }, { label: 'Chart' }]));

  interface Agent {
    id: string;
    name: string;
    title?: string;
    role?: string;
    status?: string;
    adapterType?: string;
    reportsTo?: string | null;
    [key: string]: unknown;
  }

  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let companyId = $derived(companyStore.selectedCompany?.id);
  let prefix = $derived($page.params.companyPrefix);

  let scale = $state(1);
  let tx = $state(0);
  let ty = $state(0);
  let dragging = $state(false);
  let dragX = $state(0);
  let dragY = $state(0);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agents`)
      .then(r => r.json())
      .then(d => { agents = Array.isArray(d) ? d : d.agents ?? []; })
      .finally(() => { loading = false; });
  });

  let roots = $derived(agents.filter(a => !a.reportsTo));
  function getChildren(pid: string): Agent[] {
    return agents.filter(a => a.reportsTo === pid);
  }

  function zoomIn() { scale = Math.min(scale + 0.15, 3); }
  function zoomOut() { scale = Math.max(scale - 0.15, 0.2); }
  function fit() { scale = 1; tx = 0; ty = 0; }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    dragging = true;
    dragX = e.clientX - tx;
    dragY = e.clientY - ty;
  }
  function onMouseMove(e: MouseEvent) {
    if (!dragging) return;
    tx = e.clientX - dragX;
    ty = e.clientY - dragY;
  }
  function onMouseUp() { dragging = false; }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    scale = Math.max(0.2, Math.min(3, scale + (e.deltaY > 0 ? -0.08 : 0.08)));
  }

  const STATUS_DOT: Record<string, string> = {
    running: '#3B82F6', idle: '#10B981', active: '#10B981',
    paused: '#F59E0B', error: '#EF4444', terminated: '#71717A',
  };
  const ADAPTER: Record<string, string> = {
    claude_local: 'Claude', codex_local: 'Codex', cursor: 'Cursor',
    gemini_local: 'Gemini', pi_local: 'Pi', opencode_local: 'OpenCode',
    openclaw_gateway: 'OpenClaw', process: 'Process', http: 'HTTP',
  };
  const ROLE_ICONS: Record<string, typeof Bot> = {
    ceo: Briefcase, cto: Terminal, cfo: TrendingUp, cmo: Megaphone,
    cpo: Globe, engineer: Code, designer: Palette, general: Bot,
  };
  function roleIcon(role: string) { return ROLE_ICONS[role?.toLowerCase()] ?? Bot; }
</script>

<div class="flex h-full flex-col">
  <!-- Top bar -->
  <div class="flex items-center gap-6 border-b border-border px-5 py-3 shrink-0">
    <span class="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Org Chart</span>
    <a href="/{prefix}/import" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <Upload class="h-3.5 w-3.5" /> Import company
    </a>
    <a href="/{prefix}/export" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
      <Download class="h-3.5 w-3.5" /> Export company
    </a>
  </div>

  <!-- Canvas -->
  <div
    class="relative flex-1 overflow-hidden"
    style="cursor:{dragging?'grabbing':'grab'};background-color:var(--org-bg,#0C0C12);background-image:radial-gradient(var(--org-dot,#333340) 1px, transparent 1px);background-size:20px 20px"
    role="application"
    aria-label="Org chart"
    onmousedown={onMouseDown}
    onmousemove={onMouseMove}
    onmouseup={onMouseUp}
    onmouseleave={onMouseUp}
    onwheel={onWheel}
  >
    <!-- Zoom buttons -->
    <div class="absolute top-3 right-3 z-10 flex flex-col gap-1">
      <button onclick={zoomIn} class="oc-btn" aria-label="Zoom in"><Plus class="h-4 w-4" /></button>
      <button onclick={zoomOut} class="oc-btn" aria-label="Zoom out"><Minus class="h-4 w-4" /></button>
      <button onclick={fit} class="oc-btn text-[10px] font-bold" aria-label="Fit">Fit</button>
    </div>

    {#if loading}
      <div class="flex h-full items-center justify-center">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-blue-500"></div>
      </div>
    {:else if agents.length === 0}
      <div class="flex h-full items-center justify-center">
        <div class="text-center">
          <Users class="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p class="text-sm text-muted-foreground">No agents yet</p>
          <a href="/{prefix}/agents/new" class="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">+ New Agent</a>
        </div>
      </div>
    {:else}
      <div
        style="transform:translate({tx}px,{ty}px) scale({scale});transform-origin:50% 0;transition:{dragging?'none':'transform .15s ease'}"
        class="flex justify-center pt-16 pb-32"
      >
        <div class="inline-flex flex-col items-center">
          {#each roots as root (root.id)}
            {@render tree(root)}
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

{#snippet tree(agent: Agent)}
  {@const kids = getChildren(agent.id)}
  {@const RoleIcon = roleIcon(agent.role ?? '')}
  <div class="flex flex-col items-center">
    <!-- Card -->
    <a
      href="/{prefix}/agents/{agent.id}"
      class="oc-card group"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Icon -->
      <div class="oc-icon">
        <RoleIcon class="h-4 w-4 text-zinc-400" />
      </div>
      <!-- Text -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-bold text-zinc-100 group-hover:text-blue-400 transition-colors">{agent.name}</p>
        <p class="text-xs text-zinc-400 truncate">{agent.title ?? agent.role ?? ''}</p>
        <p class="text-[11px] text-zinc-500">{ADAPTER[agent.adapterType ?? ''] ?? agent.adapterType ?? ''}</p>
      </div>
      <!-- Status dot -->
      <div
        class="absolute bottom-3 left-3 h-2.5 w-2.5 rounded-full"
        style="background:{STATUS_DOT[agent.status ?? 'idle'] ?? '#71717A'}"
        class:animate-pulse={agent.status === 'running'}
      ></div>
    </a>

    <!-- Connector to children -->
    {#if kids.length > 0}
      <!-- Vertical line from card bottom to junction -->
      <div class="oc-vline" style="height:48px"></div>

      {#if kids.length === 1}
        <!-- Single child: straight down -->
        {@render tree(kids[0])}
      {:else}
        <!-- Multiple children: horizontal bar + branches -->
        <div class="relative flex items-start">
          <!-- Horizontal bar spanning all children -->
          <div class="absolute top-0 left-1/2 -translate-x-1/2 h-px bg-zinc-700" style="width:calc(100% - 200px)"></div>

          <div class="flex gap-12">
            {#each kids as child (child.id)}
              <div class="flex flex-col items-center">
                <div class="oc-vline" style="height:48px"></div>
                {@render tree(child)}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

<style>
  :root {
    --org-bg: #0C0C12;
    --org-dot: #333340;
  }
  :global(:root:not(.dark)) {
    --org-bg: #F3F4F6;
    --org-dot: #b0b0b0;
  }

  .oc-btn {
    display: flex;
    height: 32px;
    width: 32px;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.1);
    background: #1a1a24;
    color: #94A3B8;
    transition: all .15s;
  }
  .oc-btn:hover { color: #F8FAFC; background: #252530; }
  :global(:root:not(.dark)) .oc-btn {
    border-color: #D1D5DB;
    background: #FFFFFF;
    color: #6B7280;
  }
  :global(:root:not(.dark)) .oc-btn:hover { color: #111827; background: #F3F4F6; }

  .oc-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    min-width: 220px;
    max-width: 280px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    background: #1a1a24;
    transition: border-color .2s, box-shadow .2s;
  }
  .oc-card:hover {
    border-color: rgba(59,130,246,0.4);
    box-shadow: 0 0 20px rgba(59,130,246,0.08);
  }
  :global(:root:not(.dark)) .oc-card {
    background: #FFFFFF;
    border-color: #E5E7EB;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  :global(:root:not(.dark)) .oc-card:hover {
    border-color: #93C5FD;
    box-shadow: 0 2px 8px rgba(59,130,246,0.12);
  }
  :global(:root:not(.dark)) .oc-card p.text-zinc-100 { color: #111827 !important; }
  :global(:root:not(.dark)) .oc-card p.text-zinc-400 { color: #6B7280 !important; }
  :global(:root:not(.dark)) .oc-card p.text-zinc-500 { color: #9CA3AF !important; }

  .oc-icon {
    flex-shrink: 0;
    display: flex;
    height: 36px;
    width: 36px;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
  }
  :global(:root:not(.dark)) .oc-icon { background: #F3F4F6; }

  .oc-vline {
    width: 1px;
    background: #3F3F46;
    flex-shrink: 0;
  }
  :global(:root:not(.dark)) .oc-vline { background: #D1D5DB; }
</style>
