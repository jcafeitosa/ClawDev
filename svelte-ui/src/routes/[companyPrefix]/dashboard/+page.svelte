<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  import StatusBadge from '$lib/components/status-badge.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import ActivityCharts from '$lib/components/charts/activity-charts.svelte';
  import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from '$lib/components/ui/index.js';

  import {
    Bot,
    ListTodo,
    DollarSign,
    Activity,
    CircleDot,
    AlertCircle,
    Clock,
    User,
    GitCommit,
    MessageSquare,
    Zap,
    BarChart3,
    TrendingUp,
    Wallet,

    Maximize2,
    Plus,
    ArrowRight,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Dashboard' }]));

  // ── State ──────────────────────────────────────────────────────────
  let loading = $state(true);
  let agents = $state<any[]>([]);
  let issues = $state<any[]>([]);
  let activityFeed = $state<any[]>([]);
  let heartbeatRuns = $state<any[]>([]);
  let costSummary = $state<any>(null);

  let companyId = $derived(companyStore.selectedCompany?.id);
  let companyName = $derived(companyStore.selectedCompany?.name ?? 'Company');

  // ── Computed metrics ───────────────────────────────────────────────
  let enabledAgents = $derived(
    agents.filter((a) => a.status === 'active' || a.status === 'enabled').length,
  );
  let tasksInProgress = $derived(
    issues.filter((i) => i.status === 'in_progress').length,
  );
  let monthSpend = $derived(costSummary?.totalCost ?? costSummary?.total ?? 0);
  let pendingApprovals = $derived(
    issues.filter((i) => i.status === 'pending' || i.status === 'in_review').length,
  );
  let runningAgents = $derived(
    agents.filter((a) => a.status === 'active' || a.status === 'running'),
  );

  // ── Widget derived data ──────────────────────────────────────────
  const STATUS_CONFIG: { key: string; label: string; color: string }[] = [
    { key: 'backlog', label: 'Backlog', color: '#64748b' },
    { key: 'open', label: 'To Do', color: '#2563eb' },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { key: 'in_review', label: 'In Review', color: '#8b5cf6' },
    { key: 'done', label: 'Done', color: '#10b981' },
    { key: 'blocked', label: 'Blocked', color: '#ef4444' },
  ];

  let statusCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_CONFIG) counts[s.key] = 0;
    for (const issue of issues) {
      const st = issue.status ?? 'open';
      if (st in counts) counts[st]++;
      else if (!counts[st]) counts[st] = 1;
      else counts[st]++;
    }
    return counts;
  });

  let statusSegments = $derived.by(() => {
    const total = issues.length || 1;
    return STATUS_CONFIG.map((s) => ({
      ...s,
      count: statusCounts[s.key] ?? 0,
      pct: ((statusCounts[s.key] ?? 0) / total) * 100,
    })).filter((s) => s.count > 0);
  });

  let budgetLimit = $derived(costSummary?.budget ?? costSummary?.limit ?? 500);
  let budgetPct = $derived(budgetLimit > 0 ? Math.min((monthSpend / budgetLimit) * 100, 100) : 0);

  // Board columns for mini kanban
  let boardColumns = $derived.by(() => {
    return STATUS_CONFIG.map((s) => {
      const columnIssues = issues.filter((i) => (i.status ?? 'open') === s.key);
      return {
        ...s,
        count: columnIssues.length,
        items: columnIssues.slice(0, 3),
      };
    }).filter((col) => col.count > 0);
  });

  // ── Sidebar badge counts ────────────────────────────────────────────
  let badgeCounts = $state<Record<string, number>>({});

  // ── Data fetching ──────────────────────────────────────────────────
  async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
      const res = await api(url);
      if (!res.ok) return fallback;
      const json = await res.json();
      return json as T;
    } catch {
      return fallback;
    }
  }

  function applyNormalized(data: { agents?: any; issues?: any; activity?: any; heartbeatRuns?: any; costs?: any }) {
    const agentData = data.agents;
    const issueData = data.issues;
    const activityData = data.activity;
    const heartbeatData = data.heartbeatRuns;
    const costData = data.costs;

    agents = Array.isArray(agentData) ? agentData : (agentData as any)?.agents ?? (agentData as any)?.data ?? [];
    issues = Array.isArray(issueData) ? issueData : (issueData as any)?.issues ?? (issueData as any)?.data ?? [];
    activityFeed = Array.isArray(activityData) ? activityData : (activityData as any)?.activities ?? (activityData as any)?.data ?? [];
    heartbeatRuns = Array.isArray(heartbeatData) ? heartbeatData : (heartbeatData as any)?.runs ?? (heartbeatData as any)?.data ?? [];
    costSummary = costData;
  }

  $effect(() => {
    if (!companyId) return;
    loading = true;

    // Try dedicated dashboard endpoint first, fallback to individual calls
    api(`/api/companies/${companyId}/dashboard`)
      .then((res) => {
        if (!res.ok) throw new Error('dashboard endpoint unavailable');
        return res.json();
      })
      .then((dashData) => {
        applyNormalized({
          agents: dashData.agents ?? [],
          issues: dashData.issues ?? [],
          activity: dashData.activity ?? dashData.activities ?? [],
          heartbeatRuns: dashData.heartbeatRuns ?? dashData.runs ?? [],
          costs: dashData.costs ?? dashData.costSummary ?? null,
        });
      })
      .catch(() => {
        // Fallback: fetch individual endpoints
        return Promise.all([
          safeFetch(`/api/companies/${companyId}/agents`, []),
          safeFetch(`/api/companies/${companyId}/issues?limit=10`, []),
          safeFetch(`/api/companies/${companyId}/activity?limit=15`, []),
          safeFetch(`/api/companies/${companyId}/heartbeat-runs?status=running`, []),
          safeFetch(`/api/companies/${companyId}/costs/summary`, null),
        ]).then(([agentData, issueData, activityData, heartbeatData, costData]) => {
          applyNormalized({
            agents: agentData,
            issues: issueData,
            activity: activityData,
            heartbeatRuns: heartbeatData,
            costs: costData,
          });
        });
      })
      .finally(() => (loading = false));

    // Sidebar badges (non-blocking)
    safeFetch<Record<string, number>>(`/api/companies/${companyId}/sidebar-badges`, {}).then(
      (data) => {
        badgeCounts = data ?? {};
      },
    );
  });

  // ── Helpers ────────────────────────────────────────────────────────
  function formatCurrency(value: number): string {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(2)}`;
  }

  function activityIcon(type: string): typeof Activity {
    const map: Record<string, typeof Activity> = {
      issue: AlertCircle,
      agent: Bot,
      commit: GitCommit,
      comment: MessageSquare,
      run: Zap,
      user: User,
    };
    return map[type] ?? Activity;
  }

  const prefix = $derived($page.params.companyPrefix);
</script>

<div class="dashboard-root min-h-screen space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-bold text-[--dash-text]">Dashboard</h1>
      <p class="text-sm text-[--dash-muted]">{companyName} overview</p>
    </div>
  </div>

  <!-- ── Top Widget Cards (3-column) ────────────────────────────────── -->
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">

    <!-- Widget 1: Issue Status -->
    <div class="dash-card group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[--dash-primary]/10">
            <ListTodo size={14} color="var(--dash-primary)" />
          </div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Issue Status</h3>
        </div>
        <a href="/{prefix}/issues" class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted] hover:text-[--dash-text]">
          View all
        </a>
      </div>

      {#if loading}
        <div class="mt-4 space-y-3">
          <Skeleton class="h-8 w-16 bg-white/5" />
          <Skeleton class="h-3 w-full bg-white/5" />
          <div class="flex gap-4">
            <Skeleton class="h-3 w-20 bg-white/5" />
            <Skeleton class="h-3 w-20 bg-white/5" />
          </div>
        </div>
      {:else}
        <div class="mt-3">
          <p class="text-3xl font-bold text-[--dash-text]">{issues.length}</p>
          <p class="text-xs text-[--dash-muted]">total issues</p>
        </div>

        <!-- Stacked bar chart -->
        <div class="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          {#each statusSegments as seg}
            <div
              class="h-full transition-all duration-500"
              style="width: {seg.pct}%; background-color: {seg.color};"
              title="{seg.label}: {seg.count}"
            ></div>
          {/each}
        </div>

        <!-- Status legend -->
        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {#each statusSegments as seg}
            <div class="flex items-center gap-1.5">
              <span class="h-2 w-2 rounded-full" style="background-color: {seg.color};"></span>
              <span class="text-[11px] text-[--dash-muted]">{seg.label}</span>
              <span class="text-[11px] font-semibold text-[--dash-text]">{seg.count}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Widget 2: Active Agents -->
    <div class="dash-card group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Bot size={14} color="#10b981" />
          </div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Active Agents</h3>
        </div>
        <button class="opacity-0 transition-opacity group-hover:opacity-60">
          <Maximize2 size={12} color="var(--dash-muted)" />
        </button>
      </div>

      {#if loading}
        <div class="mt-4 space-y-3">
          <Skeleton class="h-8 w-16 bg-white/5" />
          <Skeleton class="h-3 w-24 bg-white/5" />
          <div class="flex gap-2">
            {#each Array(4) as _}
              <Skeleton class="h-3 w-3 rounded-full bg-white/5" />
            {/each}
          </div>
        </div>
      {:else}
        <div class="mt-3 flex items-baseline gap-2">
          <p class="text-3xl font-bold text-[--dash-text]">{runningAgents.length}</p>
          <span class="text-sm text-[--dash-muted]">/ {agents.length}</span>
        </div>
        <p class="text-xs text-[--dash-muted]">{runningAgents.length > 0 ? 'running now' : 'no agents running'}</p>

        <!-- Agent status dots -->
        <div class="mt-4 flex flex-wrap gap-2">
          {#each agents as agent}
            {@const isActive = agent.status === 'active' || agent.status === 'running'}
            <div class="relative" title="{agent.name ?? agent.slug ?? 'Agent'} — {agent.status ?? 'idle'}">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
                style="
                  background-color: {isActive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)'};
                  border-color: {isActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'};
                "
              >
                <Bot size={12} color={isActive ? '#10b981' : '#64748b'} />
              </div>
              {#if isActive}
                <span class="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
              {/if}
            </div>
          {/each}
          {#if agents.length === 0}
            <p class="text-xs text-[--dash-muted]">No agents registered</p>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Widget 3: Month Spend -->
    <div class="dash-card group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Wallet size={14} color="#f59e0b" />
          </div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Month Spend</h3>
        </div>
        <button class="opacity-0 transition-opacity group-hover:opacity-60">
          <TrendingUp size={12} color="var(--dash-muted)" />
        </button>
      </div>

      {#if loading}
        <div class="mt-4 space-y-3">
          <Skeleton class="h-8 w-24 bg-white/5" />
          <Skeleton class="h-2.5 w-full bg-white/5" />
          <Skeleton class="h-3 w-32 bg-white/5" />
        </div>
      {:else}
        <div class="mt-3">
          <p class="text-3xl font-bold text-[--dash-text]">{formatCurrency(monthSpend)}</p>
          <p class="text-xs text-[--dash-muted]">LLM usage costs</p>
        </div>

        <!-- Budget utilization bar -->
        <div class="mt-4">
          <div class="mb-1.5 flex items-center justify-between">
            <span class="text-[11px] text-[--dash-muted]">Budget utilization</span>
            <span class="text-[11px] font-semibold text-[--dash-text]">{budgetPct.toFixed(0)}%</span>
          </div>
          <div class="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              class="h-full rounded-full transition-all duration-700"
              style="width: {budgetPct}%; background: {budgetPct > 90 ? '#ef4444' : budgetPct > 70 ? '#f59e0b' : '#10b981'};"
            ></div>
          </div>
          <p class="mt-1.5 text-[11px] text-[--dash-muted]">
            {formatCurrency(monthSpend)} of {formatCurrency(budgetLimit)} budget
          </p>
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Quick Actions ─────────────────────────────────────────────── -->
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <a
      href="/{prefix}/issues?new=true"
      class="dash-card group/qa flex items-center gap-3 !py-3.5 transition-all hover:border-blue-500/30"
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[--dash-primary]/10">
        <Plus size={16} color="var(--dash-primary)" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-[--dash-text]">New Issue</p>
        <p class="text-xs text-[--dash-muted]">Create a task or bug report</p>
      </div>
      <ArrowRight size={14} class="text-[--dash-muted] opacity-0 transition-opacity group-hover/qa:opacity-100" />
    </a>

    <a
      href="/{prefix}/agents/new"
      class="dash-card group/qa flex items-center gap-3 !py-3.5 transition-all hover:border-emerald-500/30"
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
        <Bot size={16} color="#10b981" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-[--dash-text]">New Agent</p>
        <p class="text-xs text-[--dash-muted]">Register an AI agent</p>
      </div>
      <ArrowRight size={14} class="text-[--dash-muted] opacity-0 transition-opacity group-hover/qa:opacity-100" />
    </a>

    <a
      href="/{prefix}/activity"
      class="dash-card group/qa flex items-center gap-3 !py-3.5 transition-all hover:border-amber-500/30"
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
        <Activity size={16} color="#f59e0b" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-[--dash-text]">View Activity</p>
        <p class="text-xs text-[--dash-muted]">
          {#if badgeCounts.activity}
            {badgeCounts.activity} new events
          {:else}
            Recent team activity
          {/if}
        </p>
      </div>
      <ArrowRight size={14} class="text-[--dash-muted] opacity-0 transition-opacity group-hover/qa:opacity-100" />
    </a>
  </div>

  <!-- ── Activity Charts ────────────────────────────────────────────── -->
  {#if companyId}
    <ActivityCharts {companyId} />
  {/if}

  <!-- ── Tabbed Section ──────────────────────────────────────────────── -->
  <div class="dash-card !p-0">
    <Tabs value="board" class="w-full">
      <div class="flex items-center justify-between border-b px-5 pt-4 pb-0" style="border-color: rgba(255,255,255,0.08);">
        <TabsList class="bg-transparent p-0 h-auto gap-0">
          <TabsTrigger
            value="board"
            class="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-[--dash-muted] data-[state=active]:border-[--dash-primary] data-[state=active]:text-[--dash-text] data-[state=active]:bg-transparent hover:text-[--dash-text] transition-colors"
          >
            <BarChart3 size={14} class="mr-1.5" />
            Board
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            class="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-[--dash-muted] data-[state=active]:border-[--dash-primary] data-[state=active]:text-[--dash-text] data-[state=active]:bg-transparent hover:text-[--dash-text] transition-colors"
          >
            <Activity size={14} class="mr-1.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="agents"
            class="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-[--dash-muted] data-[state=active]:border-[--dash-primary] data-[state=active]:text-[--dash-text] data-[state=active]:bg-transparent hover:text-[--dash-text] transition-colors"
          >
            <Bot size={14} class="mr-1.5" />
            Agents
          </TabsTrigger>
        </TabsList>
      </div>

      <!-- Board Tab -->
      <TabsContent value="board" class="p-5">
        {#if loading}
          <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {#each Array(5) as _}
              <div class="space-y-2">
                <Skeleton class="h-4 w-20 bg-white/5" />
                <Skeleton class="h-20 w-full bg-white/5" />
              </div>
            {/each}
          </div>
        {:else if boardColumns.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <CircleDot size={32} class="mb-3 opacity-30" color="var(--dash-muted)" />
            <p class="text-sm text-[--dash-muted]">No issues to display</p>
            <a href="/{prefix}/issues" class="mt-2 text-xs font-medium text-[--dash-primary] hover:underline">
              Create your first issue
            </a>
          </div>
        {:else}
          <div class="grid auto-cols-fr grid-flow-col gap-3 overflow-x-auto" style="grid-template-columns: repeat({boardColumns.length}, minmax(160px, 1fr));">
            {#each boardColumns as col}
              <div class="min-w-0">
                <!-- Column header -->
                <div class="mb-2.5 flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full" style="background-color: {col.color};"></span>
                  <span class="text-xs font-semibold text-[--dash-text]">{col.label}</span>
                  <span class="ml-auto rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-bold text-[--dash-muted]">{col.count}</span>
                </div>
                <!-- Mini issue cards -->
                <div class="space-y-1.5">
                  {#each col.items as issue}
                    <a
                      href="/{prefix}/issues/{issue.id}"
                      class="block rounded-lg border px-3 py-2 transition-colors hover:border-white/[0.14]"
                      style="background-color: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06);"
                    >
                      {#if issue.identifier ?? issue.slug ?? issue.number}
                        <p class="mb-0.5 font-mono text-[10px] text-[--dash-muted]">
                          {issue.identifier ?? issue.slug ?? `#${issue.number}`}
                        </p>
                      {/if}
                      <p class="truncate text-xs text-[--dash-text]">{issue.title ?? issue.name ?? 'Untitled'}</p>
                    </a>
                  {/each}
                  {#if col.count > 3}
                    <a
                      href="/{prefix}/issues"
                      class="block py-1 text-center text-[10px] font-medium text-[--dash-primary] hover:underline"
                    >
                      +{col.count - 3} more
                    </a>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </TabsContent>

      <!-- Activity Tab -->
      <TabsContent value="activity" class="p-5">
        {#if loading}
          <div class="space-y-3">
            {#each Array(6) as _}
              <div class="flex items-start gap-3">
                <Skeleton class="mt-1 h-6 w-6 rounded-full bg-white/5" />
                <div class="flex-1 space-y-2">
                  <Skeleton class="h-3 w-3/4 bg-white/5" />
                  <Skeleton class="h-2 w-1/3 bg-white/5" />
                </div>
              </div>
            {/each}
          </div>
        {:else if activityFeed.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <Clock size={32} class="mb-3 opacity-30" color="var(--dash-muted)" />
            <p class="text-sm text-[--dash-muted]">No recent activity</p>
          </div>
        {:else}
          <div class="space-y-0.5">
            {#each activityFeed.slice(0, 15) as item, i}
              {@const IconComp = activityIcon(item.type ?? item.entityType ?? 'activity')}
              <div
                class="flex items-start gap-3 rounded-lg px-2 py-2.5"
                style={i < activityFeed.length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.04);' : ''}
              >
                <div
                  class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style="background-color: rgba(255,255,255,0.06);"
                >
                  <IconComp size={13} color="var(--dash-muted)" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm leading-snug text-[--dash-text]">
                    {#if item.actor ?? item.userName ?? item.user}
                      <span class="font-medium text-[--dash-primary]">
                        {item.actor ?? item.userName ?? item.user}
                      </span>
                      {' '}
                    {/if}
                    <span>{item.action ?? item.description ?? item.message ?? 'Activity recorded'}</span>
                  </p>
                  <TimeAgo date={item.createdAt ?? item.timestamp ?? item.date} class="text-xs text-[--dash-muted]" />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </TabsContent>

      <!-- Agents Tab -->
      <TabsContent value="agents" class="p-5">
        {#if loading}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each Array(3) as _}
              <div class="flex items-center gap-3 rounded-lg p-3" style="background-color: rgba(255,255,255,0.03);">
                <Skeleton class="h-9 w-9 rounded-full bg-white/5" />
                <div class="flex-1 space-y-2">
                  <Skeleton class="h-3 w-28 bg-white/5" />
                  <Skeleton class="h-2 w-20 bg-white/5" />
                </div>
              </div>
            {/each}
          </div>
        {:else if agents.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <Bot size={32} class="mb-3 opacity-30" color="var(--dash-muted)" />
            <p class="text-sm text-[--dash-muted]">No agents registered</p>
            <a href="/{prefix}/agents" class="mt-2 text-xs font-medium text-[--dash-primary] hover:underline">
              Set up your first agent
            </a>
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each agents as agent}
              {@const isActive = agent.status === 'active' || agent.status === 'running'}
              <a
                href="/{prefix}/agents/{agent.id}"
                class="group/agent flex items-center gap-3 rounded-lg border p-3.5 transition-all hover:border-white/[0.14]"
                style="background-color: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06);"
              >
                <div class="relative shrink-0">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-full"
                    style="background-color: {isActive ? 'rgba(37,99,235,0.12)' : 'rgba(255,255,255,0.04)'};"
                  >
                    <Bot size={16} color={isActive ? '#2563eb' : '#64748b'} />
                  </div>
                  {#if isActive}
                    <span class="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75"></span>
                      <span class="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
                    </span>
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-[--dash-text]">
                    {agent.name ?? agent.slug ?? 'Agent'}
                  </p>
                  <p class="truncate text-xs text-[--dash-muted]">
                    {agent.model ?? agent.type ?? 'Idle'}
                  </p>
                </div>
                <StatusBadge status={agent.status ?? 'idle'} />
              </a>
            {/each}
          </div>
        {/if}
      </TabsContent>
    </Tabs>
  </div>
</div>

<style>
  .dashboard-root {
    --dash-bg: #0B0B10;
    --dash-card: #121218;
    --dash-border: rgba(255, 255, 255, 0.08);
    --dash-primary: #2563EB;
    --dash-text: #F8FAFC;
    --dash-muted: #94A3B8;

    background-color: var(--dash-bg);
  }

  .dash-card {
    background-color: var(--dash-card);
    border: 1px solid var(--dash-border);
    border-radius: 0.75rem;
    padding: 1.25rem;
    transition: border-color 0.15s ease;
  }
  .dash-card:hover {
    border-color: rgba(255, 255, 255, 0.14);
  }
</style>
