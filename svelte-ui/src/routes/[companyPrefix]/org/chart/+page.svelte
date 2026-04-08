<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { PageLayout } from '$components/layout/index.js';
  import { Card, CardContent, CardHeader, CardTitle, Badge, Skeleton } from '$lib/components/ui/index.js';
  import { Download, Upload, Network, ZoomIn, ZoomOut, Maximize, GitBranch, Circle } from 'lucide-svelte';
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    isLevelCAgentRole,
    HIERARCHY_LEVELS,
    type HierarchyPreset,
    type HierarchyLevel,
  } from '@clawdev/shared';

  // ── Layout mode ────────────────────────────────────────────────
  type LayoutMode = 'tree' | 'circular';
  let layoutMode = $state<LayoutMode>('circular');

  // ── Constants (tree) ───────────────────────────────────────────
  const CARD_W = 200;
  const CARD_H = 100;
  const GAP_X = 32;
  const GAP_Y = 80;
  const PADDING = 60;
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 2.0;

  // ── Constants (circular) ──────────────────────────────────────
  const CIRC_NODE_RADIUS = 36;
  const CIRC_RING_GAP = 160;
  const CIRC_CENTER_RADIUS = 50;
  const CIRC_MIN_ARC_GAP = 24; // min gap between nodes on same ring

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
  let error = $state<string | null>(null);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);
  let selectedHierarchyPreset = $derived<HierarchyPreset | null>(
    (companyStore.selectedCompany?.hierarchyPreset as HierarchyPreset | undefined) ?? null,
  );
  let hierarchyPresetDefinition = $derived(
    selectedHierarchyPreset ? getHierarchyPresetDefinition(selectedHierarchyPreset) : null,
  );
  let hierarchyPresetDepartments = $derived(
    selectedHierarchyPreset ? getHierarchyPresetDepartments(selectedHierarchyPreset) : [],
  );

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
    error = null;
    api(`/api/companies/${companyId}/agents`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        agents = Array.isArray(d) ? d : d.agents ?? [];
      })
      .catch((e) => {
        error = e.message ?? 'Failed to load agents';
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

  // ── Circular layout (sector/wedge model) ────────────────────────

  /** C-level roles that may not be in the shared LEVEL_C_AGENT_ROLES array yet */
  const EXTENDED_C_ROLES = new Set(['ceo', 'coo', 'cto', 'cfo', 'cmo', 'hr', 'clo', 'ciso', 'cpo', 'cro', 'cdo']);

  function agentLevel(agent: any): HierarchyLevel {
    if (isLevelCAgentRole(agent.role) || EXTENDED_C_ROLES.has(agent.role)) return 'c';
    if (['pm'].includes(agent.role)) return 'b';
    if (['engineer', 'designer', 'devops', 'qa', 'researcher'].includes(agent.role)) return 'a';
    return 'specialist';
  }

  // ── Sector layout types ──
  interface SectorData {
    cLevel: any;              // the C-level agent owning this sector
    reports: any[];           // agents that report to this C-level (or are in outer ring)
    startAngle: number;       // radians
    endAngle: number;         // radians
    midAngle: number;         // center of sector
  }

  interface CircularLayoutResult {
    ceo: any | null;
    sectors: SectorData[];
    unassigned: any[];        // non-CEO, non-C-level agents without a C-level manager
    size: number;
    centerRadius: number;
    midRadius: number;
    outerRadius: number;
  }

  function buildCircularLayout(agentList: any[]): CircularLayoutResult {
    const empty: CircularLayoutResult = {
      ceo: null, sectors: [], unassigned: [], size: 600,
      centerRadius: 70, midRadius: 160, outerRadius: 260,
    };
    if (agentList.length === 0) return empty;

    // Find CEO
    const ceo = agentList.find(a => a.role === 'ceo') ?? null;

    // Find C-level executives (excluding CEO)
    const cLevels = agentList.filter(a =>
      a.role !== 'ceo' && (isLevelCAgentRole(a.role) || EXTENDED_C_ROLES.has(a.role))
    );

    // Find non-C-level agents
    const others = agentList.filter(a =>
      a.role !== 'ceo' && !isLevelCAgentRole(a.role) && !EXTENDED_C_ROLES.has(a.role)
    );

    // Map each non-C-level agent to their C-level manager
    const cLevelIds = new Set(cLevels.map(a => a.id));
    const reportsByCLevel = new Map<string, any[]>();
    const unassigned: any[] = [];

    for (const a of others) {
      if (a.reportsTo && cLevelIds.has(a.reportsTo)) {
        if (!reportsByCLevel.has(a.reportsTo)) reportsByCLevel.set(a.reportsTo, []);
        reportsByCLevel.get(a.reportsTo)!.push(a);
      } else {
        unassigned.push(a);
      }
    }

    // Build sectors — one per C-level
    const sectorCount = Math.max(cLevels.length, 1);
    const sectorAngle = (2 * Math.PI) / sectorCount;
    const startOffset = -Math.PI / 2; // start from top
    const GAP_ANGLE = 0.04; // small gap between sectors

    const sectors: SectorData[] = cLevels.map((cLevel, i) => {
      const startAngle = startOffset + i * sectorAngle + GAP_ANGLE / 2;
      const endAngle = startOffset + (i + 1) * sectorAngle - GAP_ANGLE / 2;
      return {
        cLevel,
        reports: reportsByCLevel.get(cLevel.id) ?? [],
        startAngle,
        endAngle,
        midAngle: (startAngle + endAngle) / 2,
      };
    });

    // Distribute unassigned agents evenly across sectors
    if (unassigned.length > 0 && sectors.length > 0) {
      for (let i = 0; i < unassigned.length; i++) {
        sectors[i % sectors.length].reports.push(unassigned[i]);
      }
    }

    // Calculate radii
    const centerRadius = 70;
    const midRadius = 170;
    const outerRadius = 280;
    const size = (outerRadius + 80) * 2;

    return { ceo, sectors, unassigned: sectors.length === 0 ? unassigned : [], size, centerRadius, midRadius, outerRadius };
  }

  // SVG arc path helper: draws an arc segment between two angles at given radius
  function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // SVG wedge path: filled sector between inner and outer radius
  function wedgePath(cx: number, cy: number, rInner: number, rOuter: number, startAngle: number, endAngle: number): string {
    const ix1 = cx + rInner * Math.cos(startAngle);
    const iy1 = cy + rInner * Math.sin(startAngle);
    const ox1 = cx + rOuter * Math.cos(startAngle);
    const oy1 = cy + rOuter * Math.sin(startAngle);
    const ox2 = cx + rOuter * Math.cos(endAngle);
    const oy2 = cy + rOuter * Math.sin(endAngle);
    const ix2 = cx + rInner * Math.cos(endAngle);
    const iy2 = cy + rInner * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${ix1} ${iy1} L ${ox1} ${oy1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${rInner} ${rInner} 0 ${largeArc} 0 ${ix1} ${iy1} Z`;
  }

  // Sector color palette (alternating shades)
  const SECTOR_COLORS = [
    { mid: 'hsl(252, 60%, 48%)', outer: 'hsl(252, 55%, 35%)', text: 'hsl(252, 80%, 90%)' },
    { mid: 'hsl(252, 55%, 52%)', outer: 'hsl(252, 50%, 38%)', text: 'hsl(252, 80%, 92%)' },
    { mid: 'hsl(252, 60%, 45%)', outer: 'hsl(252, 55%, 32%)', text: 'hsl(252, 80%, 88%)' },
    { mid: 'hsl(252, 50%, 55%)', outer: 'hsl(252, 45%, 40%)', text: 'hsl(252, 80%, 93%)' },
    { mid: 'hsl(252, 58%, 50%)', outer: 'hsl(252, 52%, 36%)', text: 'hsl(252, 80%, 91%)' },
    { mid: 'hsl(252, 52%, 53%)', outer: 'hsl(252, 48%, 39%)', text: 'hsl(252, 80%, 90%)' },
    { mid: 'hsl(252, 62%, 46%)', outer: 'hsl(252, 56%, 33%)', text: 'hsl(252, 80%, 89%)' },
    { mid: 'hsl(252, 48%, 56%)', outer: 'hsl(252, 44%, 41%)', text: 'hsl(252, 80%, 92%)' },
  ];
  const CEO_COLOR = 'hsl(168, 60%, 68%)';

  // ── Derived layouts ────────────────────────────────────────────

  // Tree layout
  let tree = $derived.by(() => {
    const t = buildTree(agents);
    layoutForest(t);
    return t;
  });

  let layoutNodes = $derived(flattenLayout(tree));
  let edges = $derived(collectEdges(tree));

  // Circular layout (sector model)
  let circularLayout = $derived(buildCircularLayout(agents));
  let circCx = $derived(circularLayout.size / 2);
  let circCy = $derived(circularLayout.size / 2);

  // ── SVG canvas size ────────────────────────────────────────────
  let canvasWidth = $derived.by(() => {
    if (layoutMode === 'circular') return circularLayout.size;
    if (layoutNodes.length === 0) return 800;
    return Math.max(...layoutNodes.map((n) => n.x + CARD_W)) + PADDING;
  });
  let canvasHeight = $derived.by(() => {
    if (layoutMode === 'circular') return circularLayout.size;
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

  // ── Auto-fit on first load or layout switch ────────────────────
  let hasFitted = $state(false);
  let lastLayoutMode = $state<LayoutMode>('circular');
  $effect(() => {
    const hasNodes = layoutMode === 'circular' ? (circularLayout.sectors.length > 0 || circularLayout.ceo !== null) : layoutNodes.length > 0;
    // Reset fit when layout mode changes
    if (layoutMode !== lastLayoutMode) {
      lastLayoutMode = layoutMode;
      hasFitted = false;
    }
    if (hasNodes && containerEl && !hasFitted) {
      hasFitted = true;
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

  function agentTierLabel(agent: any): string {
    return (isLevelCAgentRole(agent?.role) || EXTENDED_C_ROLES.has(agent?.role)) ? 'Level C' : 'Execution';
  }
</script>

<PageLayout title="Organization Chart" fullWidth>
  {#snippet actions()}
    <div class="flex items-center gap-2">
      <!-- Layout mode toggle -->
      <div class="inline-flex rounded-lg border border-border bg-card p-0.5">
        <button
          onclick={() => layoutMode = 'circular'}
          class="cursor-pointer inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 {layoutMode === 'circular' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
        >
          <Circle class="h-3.5 w-3.5" />
          Circular
        </button>
        <button
          onclick={() => layoutMode = 'tree'}
          class="cursor-pointer inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 {layoutMode === 'tree' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}"
        >
          <GitBranch class="h-3.5 w-3.5" />
          Tree
        </button>
      </div>
      <a
        href="/{prefix}/import"
        class="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
      >
        <Upload class="h-4 w-4" />
        Import company
      </a>
      <a
        href="/{prefix}/export"
        class="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted"
      >
        <Download class="h-4 w-4" />
        Export company
      </a>
    </div>
  {/snippet}

  {#if hierarchyPresetDefinition}
    <Card class="border-border/60">
      <CardHeader class="pb-4">
        <CardTitle class="text-base">Hierarchy preset</CardTitle>
        <p class="text-sm text-muted-foreground">
          {hierarchyPresetDefinition.label} shapes how the org tree is intended to operate.
          Use the structure below to keep leadership, execution, and cross-functional collaboration clear.
        </p>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-3 lg:grid-cols-3">
          <div class="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Root model</p>
            <p class="mt-1 text-sm font-medium text-foreground">{hierarchyPresetDefinition.rootTitle}</p>
            <p class="mt-1 text-xs text-muted-foreground">{hierarchyPresetDefinition.rootSubtitle}</p>
          </div>
          <div class="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Leadership</p>
            <p class="mt-1 text-sm font-medium text-foreground">{agents.filter((agent) => isLevelCAgentRole(agent.role)).length} level C agents</p>
            <p class="mt-1 text-xs text-muted-foreground">These leaders should orchestrate, not absorb IC execution.</p>
          </div>
          <div class="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Operating rule</p>
            <p class="mt-1 text-sm font-medium text-foreground">{hierarchyPresetDefinition.operatingRules[0]?.title ?? 'SDD first'}</p>
            <p class="mt-1 text-xs text-muted-foreground">{hierarchyPresetDefinition.operatingRules[0]?.description ?? 'Specification before implementation.'}</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Departments</span>
          {#each hierarchyPresetDepartments as department}
            <Badge variant="outline" class="text-[11px]">
              {department.label}
              <span class="ml-1 text-muted-foreground">({department.level.toUpperCase().replace('_', ' ')})</span>
            </Badge>
          {/each}
        </div>
      </CardContent>
    </Card>
  {/if}

  <div class="flex flex-col" style="height: calc(100vh - 220px);">
  <!-- Chart container -->
  {#if loading}
    <div class="flex-1 flex items-center justify-center">
      <div class="space-y-4 w-64">
        {#each Array(5) as _}
          <Skeleton class="h-12 rounded-lg" />
        {/each}
        <p class="text-sm text-muted-foreground text-center">Loading org chart...</p>
      </div>
    </div>
  {:else if error}
    <div class="flex-1 flex flex-col items-center justify-center gap-4">
      <div class="rounded-full bg-red-500/10 p-4">
        <Network class="h-8 w-8 text-red-400" />
      </div>
      <h3 class="text-lg font-medium text-foreground">Failed to load org chart</h3>
      <p class="text-sm text-muted-foreground">{error}</p>
      <button
        onclick={() => {
          loading = true;
          error = null;
          api(`/api/companies/${companyId}/agents`)
            .then((r) => r.json())
            .then((d) => { agents = Array.isArray(d) ? d : d.agents ?? []; })
            .catch((e) => { error = e.message; })
            .finally(() => { loading = false; });
        }}
        class="cursor-pointer text-sm text-primary hover:underline transition-colors duration-150"
      >
        Retry
      </button>
    </div>
  {:else if agents.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center gap-4">
      <div class="rounded-full bg-accent/60 p-4">
        <Network class="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">No agents yet</h3>
      <p class="text-sm text-muted-foreground">Add agents to see the organization chart.</p>
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
        {#if layoutMode === 'tree'}
          <!-- ─── TREE MODE ──────────────────────────── -->
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
            {@const tierLabel = agentTierLabel(agent)}
            {@const isLeadership = isLevelCAgentRole(agent.role)}
            {@const cardClass = isLeadership
              ? 'absolute bg-amber-500/5 border border-amber-400/30 rounded-lg shadow-sm hover:shadow-md hover:border-amber-400/60 transition-[box-shadow,border-color] cursor-pointer select-none'
              : 'absolute bg-card border border-border rounded-lg shadow-sm hover:shadow-md hover:border-foreground/20 transition-[box-shadow,border-color] cursor-pointer select-none'}
            <div
              class={cardClass}
              style="left: {node.x}px; top: {node.y}px; width: 200px; min-height: 100px;"
              onmousedown={(e) => e.stopPropagation()}
              onclick={() => handleCardClick(agent)}
              role="button"
              tabindex="0"
              onkeydown={(e) => { if (e.key === 'Enter') handleCardClick(agent); }}
            >
              <div class="flex items-start px-4 py-3 gap-3">
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
                  <div class="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" class="text-[10px] px-1.5 py-0 leading-none">
                      {tierLabel}
                    </Badge>
                    {#if agent.role}
                      <Badge variant="ghost" class="text-[10px] px-1.5 py-0 leading-none">
                        {agent.role}
                      </Badge>
                    {/if}
                  </div>
                  {#if label}
                    <span class="text-[10px] text-muted-foreground/60 font-mono leading-tight mt-1 truncate">
                      {label}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}

        {:else}
          <!-- ─── CIRCULAR MODE (sector/wedge) ───────── -->
          <svg
            class="absolute inset-0"
            width={circularLayout.size}
            height={circularLayout.size}
            style="overflow: visible;"
          >
            <!-- Outer ring sectors (departments) -->
            {#each circularLayout.sectors as sector, i}
              {@const colors = SECTOR_COLORS[i % SECTOR_COLORS.length]}
              {@const labelR = (circularLayout.centerRadius + circularLayout.midRadius) / 2}
              {@const lx = circCx + labelR * Math.cos(sector.midAngle)}
              {@const ly = circCy + labelR * Math.sin(sector.midAngle)}
              {@const divX1 = circCx + circularLayout.centerRadius * Math.cos(sector.startAngle)}
              {@const divY1 = circCy + circularLayout.centerRadius * Math.sin(sector.startAngle)}
              {@const divX2 = circCx + circularLayout.outerRadius * Math.cos(sector.startAngle)}
              {@const divY2 = circCy + circularLayout.outerRadius * Math.sin(sector.startAngle)}
              <g>
                <!-- Outer wedge (department area) -->
                <path
                  d={wedgePath(circCx, circCy, circularLayout.midRadius + 2, circularLayout.outerRadius, sector.startAngle, sector.endAngle)}
                  fill={colors.outer}
                  stroke="rgba(255,255,255,0.15)"
                  stroke-width="1"
                  class="transition-opacity duration-150 hover:opacity-90"
                />

                <!-- Middle wedge (C-level area) -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <path
                  d={wedgePath(circCx, circCy, circularLayout.centerRadius + 2, circularLayout.midRadius, sector.startAngle, sector.endAngle)}
                  fill={colors.mid}
                  stroke="rgba(255,255,255,0.2)"
                  stroke-width="1"
                  class="cursor-pointer transition-opacity duration-150 hover:opacity-85"
                  onclick={() => handleCardClick(sector.cLevel)}
                  role="button"
                  tabindex="0"
                />

                <!-- C-level label (middle ring) -->
                <g class="pointer-events-none">
                  <text x={lx} y={ly - 6} text-anchor="middle" dominant-baseline="middle" fill={colors.text} font-size="12" font-weight="700">
                    {sector.cLevel.name?.split(' ')[0] ?? ''}
                  </text>
                  <text x={lx} y={ly + 8} text-anchor="middle" dominant-baseline="middle" fill={colors.text} font-size="9" opacity="0.8">
                    {sector.cLevel.title ?? sector.cLevel.role?.toUpperCase() ?? ''}
                  </text>
                </g>

                <!-- Department agents (outer ring) -->
                {#each sector.reports as report, j}
                  {@const reportCount = sector.reports.length}
                  {@const sectorSpan = sector.endAngle - sector.startAngle}
                  {@const reportAngle = sector.startAngle + sectorSpan * (j + 0.5) / reportCount}
                  {@const reportR = (circularLayout.midRadius + circularLayout.outerRadius) / 2}
                  {@const rx = circCx + reportR * Math.cos(reportAngle)}
                  {@const ry = circCy + reportR * Math.sin(reportAngle)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <g class="cursor-pointer" onclick={() => handleCardClick(report)} role="button" tabindex="0">
                    <text x={rx} y={ry - 4} text-anchor="middle" dominant-baseline="middle" fill={colors.text} font-size="11" font-weight="600">
                      {report.name?.split(' ')[0] ?? ''}
                    </text>
                    <text x={rx} y={ry + 8} text-anchor="middle" dominant-baseline="middle" fill={colors.text} font-size="8" opacity="0.7">
                      {report.title ?? report.role ?? ''}
                    </text>
                  </g>
                {/each}

                <!-- Radial divider line -->
                <line x1={divX1} y1={divY1} x2={divX2} y2={divY2} stroke="rgba(255,255,255,0.2)" stroke-width="1.5" />
              </g>
            {/each}

            <!-- CEO center circle -->
            {#if circularLayout.ceo}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <g class="cursor-pointer" onclick={() => handleCardClick(circularLayout.ceo)} role="button" tabindex="0">
                <circle cx={circCx} cy={circCy} r={circularLayout.centerRadius} fill={CEO_COLOR} stroke="rgba(255,255,255,0.3)" stroke-width="2" class="transition-all duration-200 hover:brightness-110" />
                <text x={circCx} y={circCy - 2} text-anchor="middle" dominant-baseline="middle" fill="hsl(252, 60%, 20%)" font-size="20" font-weight="800">CEO</text>
                <text x={circCx} y={circCy + 16} text-anchor="middle" dominant-baseline="middle" fill="hsl(252, 40%, 30%)" font-size="10" font-weight="500">{circularLayout.ceo.name ?? ''}</text>
              </g>
              {@const ceoStatusColor = dotColor(circularLayout.ceo.status)}
              <circle cx={circCx + circularLayout.centerRadius * 0.6} cy={circCy - circularLayout.centerRadius * 0.6} r="6" fill={ceoStatusColor} stroke="white" stroke-width="2" />
            {/if}
          </svg>
        {/if}
      </div>

      <!-- Zoom controls (top-right) -->
      <div class="absolute top-4 right-4 flex flex-col gap-1 z-10">
        <button
          onclick={zoomIn}
          class="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted transition-colors duration-150"
          title="Zoom in"
        >
          <ZoomIn class="h-4 w-4" />
        </button>
        <button
          onclick={zoomOut}
          class="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted transition-colors duration-150"
          title="Zoom out"
        >
          <ZoomOut class="h-4 w-4" />
        </button>
        <button
          onclick={fitToView}
          class="cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted transition-colors duration-150"
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
</PageLayout>
