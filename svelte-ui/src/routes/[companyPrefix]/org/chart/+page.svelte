<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Download, Upload, Network, ZoomIn, ZoomOut, Maximize } from 'lucide-svelte';

  // ── Constants ───────────────────────────────────────────────────
  const CARD_W = 200;
  const CARD_H = 100;
  const GAP_X = 32;
  const GAP_Y = 80;
  const PADDING = 60;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 2.0;

  // ── Status dot colors ──────────────────────────────────────────
  const STATUS_COLORS: Record<string, string> = {
    running: '#22d3ee',
    active: '#4ade80',
    paused: '#facc15',
    idle: '#facc15',
    error: '#f87171',
    terminated: '#a3a3a3',
  };
  function dotColor(status: string | undefined): string {
    return STATUS_COLORS[status ?? ''] ?? '#a3a3a3';
  }

  // ── Adapter labels ─────────────────────────────────────────────
  const ADAPTER_LABELS: Record<string, string> = {
    claude_local: 'Claude',
    codex_local: 'Codex',
    gemini_local: 'Gemini',
    opencode_local: 'OpenCode',
    cursor: 'Cursor',
    openclaw_gateway: 'OpenClaw Gateway',
    process: 'Process',
    http: 'HTTP',
  };
  function adapterLabel(type: string | undefined): string {
    return ADAPTER_LABELS[type ?? ''] ?? type ?? '';
  }

  // ── Types ──────────────────────────────────────────────────────
  interface TreeNode {
    agent: any;
    children: TreeNode[];
    x: number;
    y: number;
    width: number;
  }

  interface LayoutNode {
    agent: any;
    x: number;
    y: number;
  }

  interface Edge {
    parent: LayoutNode;
    child: LayoutNode;
  }

  // ── Breadcrumbs ────────────────────────────────────────────────
  onMount(() =>
    breadcrumbStore.set([
      { label: 'Org', href: `/${$page.params.companyPrefix}/org` },
      { label: 'Chart' },
    ]),
  );

  // ── State ──────────────────────────────────────────────────────
  let agents = $state<any[]>([]);
  let loading = $state(true);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // Pan/zoom state
  let panX = $state(0);
  let panY = $state(0);
  let zoom = $state(1);
  let dragging = $state(false);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let panStartX = $state(0);
  let panStartY = $state(0);

  let containerEl: HTMLDivElement | undefined = $state(undefined);

  // ── Fetch agents ───────────────────────────────────────────────
  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agents`)
      .then((r) => r.json())
      .then((d) => {
        agents = Array.isArray(d) ? d : d.agents ?? [];
      })
      .finally(() => {
        loading = false;
      });
  });

  // ── Build tree ─────────────────────────────────────────────────
  function buildTree(agentList: any[]): TreeNode[] {
    const map = new Map<string, TreeNode>();
    for (const a of agentList) {
      map.set(a.id, { agent: a, children: [], x: 0, y: 0, width: CARD_W });
    }
    const roots: TreeNode[] = [];
    for (const a of agentList) {
      const node = map.get(a.id)!;
      if (a.reportsTo && map.has(a.reportsTo)) {
        map.get(a.reportsTo)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  function subtreeWidth(node: TreeNode): number {
    if (node.children.length === 0) return CARD_W;
    const childWidths = node.children.map(subtreeWidth);
    const totalChildWidth =
      childWidths.reduce((a, b) => a + b, 0) + (node.children.length - 1) * GAP_X;
    return Math.max(CARD_W, totalChildWidth);
  }

  function layoutTree(node: TreeNode, x: number, y: number): void {
    const w = subtreeWidth(node);
    node.x = x + w / 2 - CARD_W / 2;
    node.y = y;
    node.width = w;

    if (node.children.length === 0) return;

    const childWidths = node.children.map(subtreeWidth);
    const totalChildWidth =
      childWidths.reduce((a, b) => a + b, 0) + (node.children.length - 1) * GAP_X;
    let cx = x + w / 2 - totalChildWidth / 2;

    for (let i = 0; i < node.children.length; i++) {
      layoutTree(node.children[i], cx, y + CARD_H + GAP_Y);
      cx += childWidths[i] + GAP_X;
    }
  }

  function layoutForest(roots: TreeNode[]): void {
    let x = PADDING;
    for (const root of roots) {
      const w = subtreeWidth(root);
      layoutTree(root, x, PADDING);
      x += w + GAP_X;
    }
  }

  function flattenLayout(nodes: TreeNode[]): LayoutNode[] {
    const result: LayoutNode[] = [];
    function walk(node: TreeNode) {
      result.push({ agent: node.agent, x: node.x, y: node.y });
      for (const c of node.children) walk(c);
    }
    for (const n of nodes) walk(n);
    return result;
  }

  function collectEdges(nodes: TreeNode[]): Edge[] {
    const edges: Edge[] = [];
    function walk(node: TreeNode) {
      for (const child of node.children) {
        edges.push({
          parent: { agent: node.agent, x: node.x, y: node.y },
          child: { agent: child.agent, x: child.x, y: child.y },
        });
        walk(child);
      }
    }
    for (const n of nodes) walk(n);
    return edges;
  }

  // ── Derived layout ─────────────────────────────────────────────
  let tree = $derived.by(() => {
    const t = buildTree(agents);
    layoutForest(t);
    return t;
  });

  let layoutNodes = $derived(flattenLayout(tree));
  let edges = $derived(collectEdges(tree));

  // ── SVG canvas size ────────────────────────────────────────────
  let canvasWidth = $derived.by(() => {
    if (layoutNodes.length === 0) return 800;
    return Math.max(...layoutNodes.map((n) => n.x + CARD_W)) + PADDING;
  });
  let canvasHeight = $derived.by(() => {
    if (layoutNodes.length === 0) return 600;
    return Math.max(...layoutNodes.map((n) => n.y + CARD_H)) + PADDING;
  });

  // ── Edge path ──────────────────────────────────────────────────
  function edgePath(edge: Edge): string {
    const x1 = edge.parent.x + CARD_W / 2;
    const y1 = edge.parent.y + CARD_H;
    const x2 = edge.child.x + CARD_W / 2;
    const y2 = edge.child.y;
    const midY = y1 + (y2 - y1) / 2;
    return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
  }

  // ── Pan/Zoom handlers ─────────────────────────────────────────
  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    panStartX = panX;
    panStartY = panY;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging) return;
    panX = panStartX + (e.clientX - dragStartX);
    panY = panStartY + (e.clientY - dragStartY);
  }

  function handleMouseUp() {
    dragging = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = containerEl?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    const scale = newZoom / zoom;

    panX = cursorX - scale * (cursorX - panX);
    panY = cursorY - scale * (cursorY - panY);
    zoom = newZoom;
  }

  function zoomIn() {
    zoom = Math.min(MAX_ZOOM, zoom + 0.2);
  }

  function zoomOut() {
    zoom = Math.max(MIN_ZOOM, zoom - 0.2);
  }

  function fitToView() {
    if (!containerEl || layoutNodes.length === 0) return;
    const rect = containerEl.getBoundingClientRect();
    const scaleX = rect.width / canvasWidth;
    const scaleY = rect.height / canvasHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY) * 0.9, MIN_ZOOM), MAX_ZOOM);
    zoom = newZoom;
    panX = (rect.width - canvasWidth * newZoom) / 2;
    panY = (rect.height - canvasHeight * newZoom) / 2;
  }

  // ── Auto-fit on first load ─────────────────────────────────────
  let hasFitted = $state(false);
  $effect(() => {
    if (layoutNodes.length > 0 && containerEl && !hasFitted) {
      hasFitted = true;
      // Use a microtask to ensure container is measured
      queueMicrotask(() => fitToView());
    }
  });

  // ── Wheel event (passive: false) ──────────────────────────────
  onMount(() => {
    if (!containerEl) return;
    const el = containerEl;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  });

  function handleCardClick(agent: any) {
    const key = agent.urlKey ?? agent.id;
    goto(`/${prefix}/agents/${key}`);
  }
</script>

<div class="flex flex-col" style="height: calc(100vh - 160px);">
  <!-- Header -->
  <div class="flex items-center justify-between px-6 py-4 border-b border-border">
    <div class="flex items-center gap-2">
      <Network class="h-5 w-5 text-muted-foreground" />
      <h1 class="text-xl font-semibold">Organization Chart</h1>
    </div>
    <div class="flex items-center gap-2">
      <a
        href="/{prefix}/import"
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Upload class="h-4 w-4" />
        Import company
      </a>
      <a
        href="/{prefix}/export"
        class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Download class="h-4 w-4" />
        Export company
      </a>
    </div>
  </div>

  <!-- Chart container -->
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <div class="space-y-4 w-64">
        {#each Array(5) as _}
          <div class="h-12 animate-pulse rounded-lg bg-muted"></div>
        {/each}
        <p class="text-sm text-muted-foreground text-center">Loading org chart...</p>
      </div>
    </div>
  {:else if agents.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center gap-4">
      <Network class="h-12 w-12 text-muted-foreground/40" />
      <p class="text-sm text-muted-foreground">No agents found. Add agents to see the organization chart.</p>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
    <div
      class="flex-1 w-full overflow-hidden relative"
      style="cursor: {dragging ? 'grabbing' : 'grab'};"
      bind:this={containerEl}
      onmousedown={handleMouseDown}
      onmousemove={handleMouseMove}
      onmouseup={handleMouseUp}
      onmouseleave={handleMouseUp}
      role="img"
      aria-label="Organization chart"
    >
      <!-- Transform layer -->
      <div
        class="absolute origin-top-left"
        style="transform: translate({panX}px, {panY}px) scale({zoom}); width: {canvasWidth}px; height: {canvasHeight}px;"
      >
        <!-- SVG edges -->
        <svg
          class="absolute inset-0 pointer-events-none"
          width={canvasWidth}
          height={canvasHeight}
          style="overflow: visible;"
        >
          {#each edges as edge}
            <path
              d={edgePath(edge)}
              fill="none"
              stroke="var(--border)"
              stroke-width="2"
            />
          {/each}
        </svg>

        <!-- Card nodes -->
        {#each layoutNodes as node (node.agent.id)}
          {@const agent = node.agent}
          {@const firstChar = (agent.name ?? '?')[0].toUpperCase()}
          {@const statusColor = dotColor(agent.status)}
          {@const label = adapterLabel(agent.adapterType)}
          <div
            class="absolute bg-card border border-border rounded-lg shadow-sm hover:shadow-md hover:border-foreground/20 transition-[box-shadow,border-color] cursor-pointer select-none"
            style="left: {node.x}px; top: {node.y}px; width: 200px; min-height: 100px;"
            onmousedown={(e) => e.stopPropagation()}
            onclick={() => handleCardClick(agent)}
            role="button"
            tabindex="0"
            onkeydown={(e) => { if (e.key === 'Enter') handleCardClick(agent); }}
          >
            <div class="flex items-center px-4 py-3 gap-3">
              <!-- Icon circle with status dot -->
              <div class="relative shrink-0">
                <div class="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {firstChar}
                </div>
                <span
                  class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card"
                  style="background: {statusColor};"
                ></span>
              </div>
              <div class="flex flex-col min-w-0 flex-1">
                <span class="text-sm font-semibold leading-tight truncate">{agent.name}</span>
                <span class="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                  {agent.title ?? agent.role ?? ''}
                </span>
                {#if label}
                  <span class="text-[10px] text-muted-foreground/60 font-mono leading-tight mt-1 truncate">
                    {label}
                  </span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Zoom controls (top-right) -->
      <div class="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onclick={zoomIn}
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted transition-colors"
          title="Zoom in"
        >
          <ZoomIn class="h-4 w-4" />
        </button>
        <button
          onclick={zoomOut}
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted transition-colors"
          title="Zoom out"
        >
          <ZoomOut class="h-4 w-4" />
        </button>
        <button
          onclick={fitToView}
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted transition-colors"
          title="Fit to view"
        >
          <Maximize class="h-4 w-4" />
        </button>
      </div>

      <!-- Zoom level indicator -->
      <div class="absolute bottom-4 right-4 text-xs text-muted-foreground bg-card/80 border border-border rounded px-2 py-1 z-10">
        {Math.round(zoom * 100)}%
      </div>
    </div>
  {/if}
</div>
