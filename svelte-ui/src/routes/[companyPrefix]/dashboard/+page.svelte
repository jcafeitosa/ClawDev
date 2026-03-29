<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  import TimeAgo from '$lib/components/time-ago.svelte';
  import ActivityCharts from '$lib/components/charts/activity-charts.svelte';
  import ActiveAgentsPanel from '$lib/components/active-agents-panel.svelte';
  import { Skeleton } from '$lib/components/ui/index.js';

  import {
    Bot,
    ListTodo,
    DollarSign,
    Activity,
    CircleDot,
    AlertCircle,
    AlertTriangle,
    Clock,
    User,
    GitCommit,
    MessageSquare,
    Zap,
    TrendingUp,
    Wallet,
    ShieldCheck,

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
  let budgetIncidents = $state<any[]>([]);
  let dashboardApprovals = $state(0);
  let recentActivity = $state<any[]>([]);
  let recentActivityLoading = $state(true);
  let recentIssues = $state<any[]>([]);

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
    dashboardApprovals > 0
      ? dashboardApprovals
      : issues.filter((i) => i.status === 'pending' || i.status === 'in_review').length,
  );
  let runningAgents = $derived(
    agents.filter((a) => a.status === 'active' || a.status === 'running'),
  );
  let pausedAgents = $derived(
    agents.filter((a) => a.status === 'paused' || a.status === 'disabled' || a.status === 'idle' || a.status === 'enabled').length,
  );
  let errorAgents = $derived(
    agents.filter((a) => a.status === 'error' || a.status === 'failed').length,
  );
  let openIssues = $derived(
    issues.filter((i) => i.status === 'open' || i.status === 'backlog' || i.status === 'in_progress' || i.status === 'in_review').length,
  );
  let blockedIssues = $derived(
    issues.filter((i) => i.status === 'blocked').length,
  );
  let budgetStatusText = $derived.by(() => {
    if (!costSummary) return 'No budget data';
    const limit = costSummary.budget ?? costSummary.limit ?? 0;
    if (limit <= 0) return 'Unlimited budget';
    return `${formatCurrency(monthSpend)} of ${formatCurrency(limit)} used`;
  });
  let pendingIncidents = $derived(
    budgetIncidents.filter((inc) => inc.status === 'pending'),
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
        // Extract pending approvals count from dashboard summary
        dashboardApprovals = dashData.pendingApprovals ?? 0;
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

    // Budget incidents (non-blocking)
    safeFetch<any>(`/api/companies/${companyId}/budgets/overview`, null).then((data) => {
      budgetIncidents = data?.incidents ?? data?.budgetIncidents ?? [];
    });

    // Recent activity for the dedicated section (non-blocking)
    recentActivityLoading = true;
    safeFetch<any>(`/api/companies/${companyId}/activity?limit=10`, []).then((data) => {
      const items = Array.isArray(data) ? data : data?.activities ?? data?.data ?? [];
      recentActivity = items.slice(0, 10);
      recentActivityLoading = false;
    });

    // Recent issues for the dedicated section (non-blocking)
    safeFetch<any>(`/api/companies/${companyId}/issues?limit=10&sort=createdAt&order=desc`, []).then((data) => {
      const items = Array.isArray(data) ? data : data?.issues ?? data?.data ?? [];
      recentIssues = items.slice(0, 10);
    });
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
      <h1 class="text-xs font-semibold uppercase tracking-widest text-[--dash-muted]">Dashboard</h1>
      <p class="mt-1 text-lg font-bold text-[--dash-text]">{companyName}</p>
    </div>
  </div>

  <!-- ── Active Agents Panel (top) ─────────────────────────────────── -->
  {#if companyId}
    <ActiveAgentsPanel companyId={companyId ?? ''} {prefix} />
  {/if}

  <!-- ── Top Widget Cards (4-column) ────────────────────────────────── -->
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

    <!-- Widget 1: Issue Status -->
    <div class="dash-card group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[--dash-primary]/10">
            <ListTodo size={14} color="var(--dash-primary)" />
          </div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Tasks In Progress</h3>
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
          <p class="text-3xl font-bold text-[--dash-text]">{tasksInProgress}</p>
          <p class="text-xs text-[--dash-muted]">{openIssues} open, {blockedIssues} blocked</p>
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
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Agents Enabled</h3>
        </div>
        <a href="/{prefix}/agents" class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted] hover:text-[--dash-text]">
          View all
        </a>
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
          <p class="text-3xl font-bold text-[--dash-text]">{enabledAgents}</p>
          <span class="text-sm text-[--dash-muted]">/ {agents.length}</span>
        </div>
        <p class="text-xs text-[--dash-muted]">{runningAgents.length} running, {pausedAgents} paused, {errorAgents} errors</p>

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
          <p class="text-xs text-[--dash-muted]">{budgetStatusText}</p>
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

    <!-- Widget 4: Pending Approvals -->
    <div class="dash-card group">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
            <ShieldCheck size={14} color="#8b5cf6" />
          </div>
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Pending Approvals</h3>
        </div>
        <a href="/{prefix}/approvals" class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted] hover:text-[--dash-text]">
          View all
        </a>
      </div>

      {#if loading}
        <div class="mt-4 space-y-3">
          <Skeleton class="h-8 w-16 bg-white/5" />
          <Skeleton class="h-3 w-24 bg-white/5" />
        </div>
      {:else}
        <div class="mt-3">
          <p class="text-3xl font-bold text-[--dash-text]">{pendingApprovals}</p>
          <p class="text-xs text-[--dash-muted]">Awaiting board review</p>
        </div>

        <!-- Approval status indicator -->
        <div class="mt-4">
          {#if pendingApprovals > 0}
            <a
              href="/{prefix}/approvals"
              class="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/[0.08] px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/[0.15]"
            >
              <ShieldCheck size={12} />
              Review now
              <ArrowRight size={10} />
            </a>
          {:else}
            <div class="flex items-center gap-1.5 text-[11px] text-[--dash-muted]">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              All clear — no pending approvals
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- ── Budget Incident Alert ──────────────────────────────────────── -->
  {#if pendingIncidents.length > 0}
    <div class="relative overflow-hidden rounded-xl border border-red-500/30 bg-red-500/[0.08] px-5 py-4">
      <div class="flex items-start gap-4">
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/20">
          <AlertTriangle size={20} color="#ef4444" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-red-400">Budget Hard Stop Active</h3>
            {#if pendingIncidents.length > 1}
              <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {pendingIncidents.length}
              </span>
            {/if}
          </div>
          {#if pendingIncidents.length === 1}
            <p class="mt-0.5 text-sm text-red-300/80">
              Agent <span class="font-medium text-red-300">{pendingIncidents[0].agentName ?? pendingIncidents[0].agent?.name ?? 'Unknown'}</span> has been paused — monthly budget exceeded.
            </p>
          {:else}
            <p class="mt-0.5 text-sm text-red-300/80">
              {pendingIncidents.length} agents have been paused — monthly budgets exceeded.
            </p>
          {/if}
        </div>
        <a
          href="/{prefix}/budgets"
          class="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          Resolve
        </a>
      </div>
    </div>
  {/if}


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

  <!-- ── Recent Activity & Recent Tasks (2-column) ────────────────── -->
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">

    <!-- Recent Activity -->
    <div class="dash-card !p-0">
      <div class="flex items-center justify-between border-b px-5 py-4" style="border-color: rgba(255,255,255,0.08);">
        <div class="flex items-center gap-2">
          <Activity size={14} color="var(--dash-primary)" />
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Recent Activity</h3>
        </div>
        <a href="/{prefix}/activity" class="text-[11px] font-medium text-[--dash-primary] hover:underline">
          View all
        </a>
      </div>
      <div class="px-5 py-3">
        {#if recentActivityLoading}
          <div class="space-y-3 py-2">
            {#each Array(5) as _}
              <div class="flex items-center gap-3">
                <Skeleton class="h-7 w-7 shrink-0 rounded-full bg-white/5" />
                <div class="flex-1 space-y-1.5">
                  <Skeleton class="h-3 w-3/4 bg-white/5" />
                  <Skeleton class="h-2 w-1/4 bg-white/5" />
                </div>
              </div>
            {/each}
          </div>
        {:else if recentActivity.length === 0}
          <div class="flex flex-col items-center justify-center py-10">
            <Clock size={28} class="mb-2 opacity-30" color="var(--dash-muted)" />
            <p class="text-xs text-[--dash-muted]">No recent activity</p>
          </div>
        {:else}
          <div class="divide-y divide-white/[0.04]">
            {#each recentActivity as item}
              {@const IconComp = activityIcon(item.type ?? item.entityType ?? 'activity')}
              {@const agentName = item.actor ?? item.agentName ?? item.userName ?? item.user ?? 'System'}
              {@const actionText = item.action ?? item.description ?? item.message ?? 'performed an action'}
              {@const entityName = item.entityName ?? item.entityId ?? ''}
              <div class="flex items-start gap-3 py-2.5">
                <div
                  class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style="background-color: rgba(255,255,255,0.06);"
                >
                  {#if item.agentAvatar ?? item.actorAvatar}
                    <img
                      src={item.agentAvatar ?? item.actorAvatar}
                      alt={agentName}
                      class="h-7 w-7 rounded-full object-cover"
                    />
                  {:else}
                    <IconComp size={13} color="var(--dash-muted)" />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs leading-snug text-[--dash-text]">
                    <span class="font-semibold text-[--dash-primary]">{agentName}</span>
                    {' '}<span class="text-[--dash-muted]">{actionText}</span>
                    {#if entityName}
                      {' '}<span class="text-[--dash-muted]">on</span>{' '}
                      <span class="font-medium text-[--dash-text]">{entityName}</span>
                    {/if}
                  </p>
                  <TimeAgo date={item.createdAt ?? item.timestamp ?? item.date} class="text-[10px] text-[--dash-muted]" />
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Recent Tasks -->
    <div class="dash-card !p-0">
      <div class="flex items-center justify-between border-b px-5 py-4" style="border-color: rgba(255,255,255,0.08);">
        <div class="flex items-center gap-2">
          <ListTodo size={14} color="var(--dash-primary)" />
          <h3 class="text-xs font-semibold uppercase tracking-wider text-[--dash-muted]">Recent Tasks</h3>
        </div>
        <a href="/{prefix}/issues" class="text-[11px] font-medium text-[--dash-primary] hover:underline">
          View all
        </a>
      </div>
      <div class="px-5 py-3">
        {#if loading}
          <div class="space-y-3 py-2">
            {#each Array(5) as _}
              <div class="flex items-center gap-3">
                <Skeleton class="h-2.5 w-2.5 shrink-0 rounded-full bg-white/5" />
                <Skeleton class="h-3 w-16 bg-white/5" />
                <div class="flex-1">
                  <Skeleton class="h-3 w-3/4 bg-white/5" />
                </div>
              </div>
            {/each}
          </div>
        {:else if recentIssues.length === 0}
          <div class="flex flex-col items-center justify-center py-10">
            <CircleDot size={28} class="mb-2 opacity-30" color="var(--dash-muted)" />
            <p class="text-xs text-[--dash-muted]">No issues yet</p>
            <a href="/{prefix}/issues?new=true" class="mt-1.5 text-[11px] font-medium text-[--dash-primary] hover:underline">
              Create first issue
            </a>
          </div>
        {:else}
          <div class="divide-y divide-white/[0.04]">
            {#each recentIssues as issue}
              {@const statusColor = STATUS_CONFIG.find((s) => s.key === (issue.status ?? 'open'))?.color ?? '#64748b'}
              {@const identifier = issue.identifier ?? issue.slug ?? (issue.number ? `#${issue.number}` : '')}
              {@const agentName = issue.assigneeName ?? issue.agentName ?? issue.agent?.name ?? ''}
              <a
                href="/{prefix}/issues/{issue.id}"
                class="flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/25 -mx-2 px-2 rounded"
              >
                <!-- Status dot -->
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  style="background-color: {statusColor};"
                  title={issue.status ?? 'open'}
                ></span>

                <!-- Identifier -->
                {#if identifier}
                  <span class="shrink-0 font-mono text-[10px] font-semibold text-[--dash-muted]">
                    {identifier}
                  </span>
                {/if}

                <!-- Agent avatar / icon -->
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style="background-color: rgba(255,255,255,0.06);">
                  {#if issue.assigneeAvatar ?? issue.agentAvatar}
                    <img
                      src={issue.assigneeAvatar ?? issue.agentAvatar}
                      alt={agentName}
                      class="h-5 w-5 rounded-full object-cover"
                    />
                  {:else}
                    <Bot size={10} color="var(--dash-muted)" />
                  {/if}
                </div>

                <!-- Agent name (if any) -->
                {#if agentName}
                  <span class="shrink-0 text-[10px] font-medium text-[--dash-muted] max-w-[60px] truncate">
                    {agentName}
                  </span>
                {/if}

                <!-- Time ago -->
                <TimeAgo date={issue.createdAt ?? issue.updatedAt} class="shrink-0 !text-[10px] !text-[--dash-muted]" />

                <!-- Title -->
                <span class="min-w-0 flex-1 truncate text-xs text-[--dash-text]">
                  {issue.title ?? issue.name ?? 'Untitled'}
                </span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>
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

  :global(:root:not(.dark)) .dashboard-root {
    --dash-bg: #F9FAFB;
    --dash-card: #FFFFFF;
    --dash-border: #E5E7EB;
    --dash-primary: #2563EB;
    --dash-text: #111827;
    --dash-muted: #6B7280;
  }

  .dash-card {
    background-color: var(--dash-card);
    border: 1px solid var(--dash-border);
    border-radius: 0.75rem;
    padding: 1.25rem;
    transition: border-color 0.15s ease;
  }
  .dash-card:hover {
    border-color: rgba(0, 0, 0, 0.12);
  }
  :global(.dark) .dash-card:hover {
    border-color: rgba(255, 255, 255, 0.14);
  }
</style>
