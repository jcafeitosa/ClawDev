<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { dashboardRefreshStore } from '$stores/dashboard-refresh.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';

  import TimeAgo from '$lib/components/time-ago.svelte';
  import ActivityCharts from '$lib/components/charts/activity-charts.svelte';
  import GaugeChart from '$lib/components/charts/gauge-chart.svelte';
  import PieChart from '$lib/components/charts/pie-chart.svelte';
  import LineChart from '$lib/components/charts/line-chart.svelte';
  import ActiveAgentsPanel from '$lib/components/active-agents-panel.svelte';
  import {
    Skeleton,
    Card, CardContent, CardHeader, CardTitle,
    Alert, AlertTitle, AlertDescription,
    Progress,
  } from '$lib/components/ui/index.js';

  import {
    Bot,
    ListTodo,
    DollarSign,
    CircleDot,
    ShieldCheck,
    PauseCircle,
    Building2,
    FolderKanban,
    Target,
    ArrowRight,
    MessageSquare,
    Plus,
    Pencil,
    Play,
    Pause,
    XCircle,
    Key,
    FileText,
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

  let prefix = $derived($page.params.companyPrefix);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix(prefix));
  let companyId = $derived(routeCompanyId);
  let currentCompany = $derived(companyStore.companies.find((company) => company.id === companyId) ?? null);
  let companyName = $derived(currentCompany?.name ?? 'Company');

  function normalizeIssueStatus(raw: string | null | undefined): string {
    if (!raw) return 'todo';
    if (raw === 'open') return 'todo';
    return raw;
  }

  // ── Computed metrics ───────────────────────────────────────────────
  let enabledAgents = $derived(
    agents.filter((a) => a.status !== 'terminated' && a.status !== 'pending_approval').length,
  );
  let runningAgents = $derived(
    agents.filter((a) => a.status === 'active' || a.status === 'running').length,
  );
  let pausedAgents = $derived(
    agents.filter((a) => a.status === 'paused' || a.status === 'disabled' || a.status === 'idle' || a.status === 'enabled').length,
  );
  let errorAgents = $derived(
    agents.filter((a) => a.status === 'error' || a.status === 'failed').length,
  );
  let tasksInProgress = $derived(
    issues.filter((i) => i.status === 'in_progress').length,
  );
  let openIssues = $derived(
    issues.filter((i) => {
      const status = normalizeIssueStatus(i.status);
      return status === 'todo' || status === 'backlog' || status === 'in_progress' || status === 'in_review';
    }).length,
  );
  let blockedIssues = $derived(
    issues.filter((i) => i.status === 'blocked').length,
  );
  let monthSpend = $derived(costSummary?.totalCost ?? costSummary?.total ?? 0);
  let monthBudgetCents = $derived(costSummary?.budget ?? costSummary?.limit ?? 0);
  let monthUtilizationPercent = $derived(
    monthBudgetCents > 0 ? Math.min(Math.round((monthSpend / monthBudgetCents) * 100), 100) : 0,
  );

  // Cost trend: extract daily data from costSummary if available, else generate from runs
  let costDailyData = $derived.by(() => {
    const daily = costSummary?.daily ?? costSummary?.dailyCosts ?? [];
    if (Array.isArray(daily) && daily.length > 0) {
      return daily.map((d: any) => ({
        label: new Date(d.date ?? d.day).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        value: Number(d.cost ?? d.total ?? d.amount ?? 0),
      }));
    }
    // Fallback: generate last 7 days with 0
    const result: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      result.push({ label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), value: 0 });
    }
    return result;
  });
  let pendingApprovals = $derived(
    dashboardApprovals > 0
      ? dashboardApprovals
      : issues.filter((i) => i.status === 'pending' || i.status === 'in_review').length,
  );
  let budgetPendingApprovals = $derived(
    budgetIncidents.filter((inc) => inc.status === 'pending').length,
  );
  let pendingIncidents = $derived(
    budgetIncidents.filter((inc) => inc.status === 'pending'),
  );

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

  async function refreshDashboard() {
    if (!companyId) return;
    loading = true;

    try {
      const agentsPromise = safeFetch(`/api/companies/${companyId}/agents`, []);

      const [dashData, issueData, activityData, heartbeatData, costData, agentData] = await Promise.all([
        api(`/api/companies/${companyId}/dashboard`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
        safeFetch(`/api/companies/${companyId}/issues?limit=10`, []),
        safeFetch(`/api/companies/${companyId}/activity?limit=15`, []),
        safeFetch(`/api/companies/${companyId}/heartbeat-runs?limit=50`, []),
        safeFetch(`/api/companies/${companyId}/costs/summary`, null),
        agentsPromise,
      ]);

      applyNormalized({
        agents: agentData,
        issues: (dashData?.issues?.length ? dashData.issues : issueData),
        activity: activityData,
        heartbeatRuns: heartbeatData,
        costs: dashData?.costs ?? dashData?.costSummary ?? costData,
      });
      dashboardApprovals = dashData?.pendingApprovals ?? 0;
    } finally {
      loading = false;
    }

    safeFetch<any>(`/api/companies/${companyId}/budgets/overview`, null).then((data) => {
      budgetIncidents = data?.incidents ?? data?.budgetIncidents ?? [];
    });

    recentActivityLoading = true;
    safeFetch<any>(`/api/companies/${companyId}/activity?limit=10`, []).then((data) => {
      const items = Array.isArray(data) ? data : data?.activities ?? data?.data ?? [];
      recentActivity = items.slice(0, 10);
      recentActivityLoading = false;
    });

    safeFetch<any>(`/api/companies/${companyId}/issues?limit=10&sort=createdAt&order=desc`, []).then((data) => {
      const items = Array.isArray(data) ? data : data?.issues ?? data?.data ?? [];
      recentIssues = items.slice(0, 10);
    });
  }

  function applyNormalized(data: { agents?: any; issues?: any; activity?: any; heartbeatRuns?: any; costs?: any }) {
    agents = Array.isArray(data.agents) ? data.agents : (data.agents as any)?.agents ?? (data.agents as any)?.data ?? [];
    issues = Array.isArray(data.issues) ? data.issues : (data.issues as any)?.issues ?? (data.issues as any)?.data ?? [];
    activityFeed = Array.isArray(data.activity) ? data.activity : (data.activity as any)?.activities ?? (data.activity as any)?.data ?? [];
    heartbeatRuns = Array.isArray(data.heartbeatRuns) ? data.heartbeatRuns : (data.heartbeatRuns as any)?.runs ?? (data.heartbeatRuns as any)?.data ?? [];
    costSummary = data.costs;
  }

  onDestroy(() => {
    dashboardRefreshStore.disconnect();
  });

  $effect(() => {
    if (!companyId) {
      loading = false;
      recentActivityLoading = false;
      dashboardRefreshStore.disconnect();
      return;
    }

    dashboardRefreshStore.init(companyId, refreshDashboard);

    return () => {
      dashboardRefreshStore.disconnect();
    };
  });

  // ── Helpers ────────────────────────────────────────────────────────
  function formatCents(value: number): string {
    if (value >= 100000) return `$${(value / 100).toFixed(0)}`;
    if (value >= 100) return `$${(value / 100).toFixed(2)}`;
    return `$${value.toFixed(2)}`;
  }

  const ACTION_VERBS: Record<string, string> = {
    'issue.created': 'created',
    'issue.updated': 'updated',
    'issue.checked_out': 'checked out',
    'issue.released': 'released',
    'issue.comment_added': 'commented on',
    'issue.status_changed': 'changed status on',
    'issue.document_created': 'created document for',
    'issue.document_updated': 'updated document on',
    'agent.created': 'created',
    'agent.updated': 'updated',
    'agent.paused': 'paused',
    'agent.resumed': 'resumed',
    'agent.terminated': 'terminated',
    'agent.key_created': 'created API key for',
    'agent.hire_created': 'requested hire for',
    'approval.created': 'requested approval',
    'approval.approved': 'approved',
    'approval.rejected': 'rejected',
    'project.created': 'created',
    'goal.created': 'created',
    'cost.reported': 'reported cost for',
    'company.created': 'created company',
    'company.updated': 'updated company',
  };

  function parseActionVerb(action: string): string {
    if (!action) return 'performed an action';
    if (ACTION_VERBS[action]) return ACTION_VERBS[action];
    const parts = action.split('.');
    if (parts.length >= 2) return parts.slice(1).join(' ').replace(/_/g, ' ');
    return action.replace(/_/g, ' ');
  }

  function getActorDisplay(item: any): string {
    const actor = item.actor ?? item.agentName ?? item.userName ?? item.user;
    if (actor && !isUUID(actor)) return actor;
    if (item.actorType === 'user' || item.actorType === 'system' || item.source === 'local_implicit') return 'Board';
    if (item.actorId && agents.length > 0) {
      const agent = agents.find((a: any) => a.id === item.actorId);
      if (agent) return agent.name ?? agent.slug ?? 'Agent';
    }
    return 'Board';
  }

  function getEntityDisplay(item: any): { label: string; subtitle: string } {
    const details = item.details ?? {};
    const identifier = details.identifier ?? item.entityIdentifier ?? '';
    const title = details.title ?? details.name ?? item.entityName ?? '';
    if (item.entityName && !isUUID(item.entityName)) {
      return { label: identifier || '', subtitle: item.entityName };
    }
    if (identifier || title) return { label: identifier, subtitle: title };
    if (item.entityId && !isUUID(item.entityId)) return { label: '', subtitle: item.entityId };
    return { label: '', subtitle: '' };
  }

  function getActivityHref(item: any): string {
    const details = item.details ?? {};
    const identifier = details.identifier ?? item.entityIdentifier ?? '';
    const entityId = item.entityId ?? '';
    const entityType = item.entityType ?? item.type ?? '';
    const action = item.action ?? '';
    if (entityType === 'approval' || action.startsWith('approval.')) return `/${prefix}/approvals/${entityId}`;
    if (entityType === 'issue' || action.startsWith('issue.')) {
      if (identifier) return `/${prefix}/issues/${identifier}`;
      if (entityId) return `/${prefix}/issues/${entityId}`;
    }
    if (entityType === 'agent' || action.startsWith('agent.')) return `/${prefix}/agents/${entityId}`;
    if (entityType === 'company' || action.startsWith('company.')) return `/${prefix}/settings`;
    if (identifier) return `/${prefix}/issues/${identifier}`;
    return '';
  }

  function isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  type IconComponent = typeof CircleDot;

  function getActivityIcon(item: any): { icon: IconComponent; color: string } {
    const action: string = item.action ?? '';
    const entityType: string = item.entityType ?? '';

    if (action.includes('created') || action.includes('hire_created'))
      return { icon: Plus, color: 'text-emerald-500' };
    if (action.includes('approved'))
      return { icon: ShieldCheck, color: 'text-emerald-500' };
    if (action.includes('rejected') || action.includes('terminated'))
      return { icon: XCircle, color: 'text-red-500' };
    if (action.includes('paused'))
      return { icon: Pause, color: 'text-amber-500' };
    if (action.includes('resumed'))
      return { icon: Play, color: 'text-emerald-500' };
    if (action.includes('status_changed'))
      return { icon: ArrowRight, color: 'text-blue-500' };
    if (action.includes('comment'))
      return { icon: MessageSquare, color: 'text-violet-500' };
    if (action.includes('key_created'))
      return { icon: Key, color: 'text-amber-500' };
    if (action.includes('document'))
      return { icon: FileText, color: 'text-blue-500' };
    if (action.includes('updated'))
      return { icon: Pencil, color: 'text-blue-500' };

    if (entityType === 'issue') return { icon: CircleDot, color: 'text-blue-500' };
    if (entityType === 'agent') return { icon: Bot, color: 'text-cyan-500' };
    if (entityType === 'company') return { icon: Building2, color: 'text-violet-500' };
    if (entityType === 'approval') return { icon: ShieldCheck, color: 'text-amber-500' };
    if (entityType === 'project') return { icon: FolderKanban, color: 'text-indigo-500' };
    if (entityType === 'goal') return { icon: Target, color: 'text-pink-500' };
    if (entityType === 'cost') return { icon: DollarSign, color: 'text-emerald-500' };

    return { icon: CircleDot, color: 'text-muted-foreground' };
  }

  function getDotRing(item: any): string {
    const action: string = item.action ?? '';
    if (action.includes('created') || action.includes('approved') || action.includes('resumed'))
      return 'ring-emerald-500/20 bg-emerald-500/10';
    if (action.includes('rejected') || action.includes('terminated'))
      return 'ring-red-500/20 bg-red-500/10';
    if (action.includes('paused') || action.includes('key_created'))
      return 'ring-amber-500/20 bg-amber-500/10';
    if (action.includes('status_changed') || action.includes('updated') || action.includes('document'))
      return 'ring-blue-500/20 bg-blue-500/10';
    if (action.includes('comment'))
      return 'ring-violet-500/20 bg-violet-500/10';
    return 'ring-border bg-background';
  }

  function getStatusChangeDetail(item: any): string | null {
    const action: string = item.action ?? '';
    if (action !== 'issue.status_changed') return null;
    const details = item.details ?? {};
    const from = details.oldStatus ?? details.from ?? '';
    const to = details.newStatus ?? details.to ?? details.status ?? '';
    if (from && to) return `${from} → ${to}`;
    if (to) return `→ ${to}`;
    return null;
  }

  function getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  function findAgentById(agentId: string | undefined): any | null {
    if (!agentId || agents.length === 0) return null;
    return agents.find((a: any) => a.id === agentId) ?? null;
  }

  // Issue status icon colors
  const STATUS_COLORS: Record<string, string> = {
    backlog: '#64748b',
    todo: '#2563eb',
    in_progress: '#f59e0b',
    in_review: '#8b5cf6',
    done: '#10b981',
    blocked: '#ef4444',
    cancelled: '#6b7280',
  };

  function statusColor(status: string): string {
    return STATUS_COLORS[normalizeIssueStatus(status)] ?? '#64748b';
  }

  // ── Metric cards for glassmorphism grid ────────────────────────────
  let metricCards = $derived([
    {
      href: `/${prefix}/agents`,
      value: enabledAgents,
      label: 'Agents Enabled',
      sub: `${runningAgents} running, ${pausedAgents} paused, ${errorAgents} errors`,
      icon: Bot,
    },
    {
      href: `/${prefix}/issues`,
      value: tasksInProgress,
      label: 'Tasks In Progress',
      sub: `${openIssues} open, ${blockedIssues} blocked`,
      icon: CircleDot,
    },
    {
      href: `/${prefix}/costs`,
      value: formatCents(monthSpend),
      label: 'Month Spend',
      sub: monthBudgetCents > 0 ? `${monthUtilizationPercent}% of ${formatCents(monthBudgetCents)} budget` : 'Unlimited budget',
      icon: DollarSign,
    },
    {
      href: `/${prefix}/approvals`,
      value: pendingApprovals + budgetPendingApprovals,
      label: 'Pending Approvals',
      sub: budgetPendingApprovals > 0 ? `${budgetPendingApprovals} budget overrides awaiting review` : 'Awaiting board review',
      icon: ShieldCheck,
    },
  ]);

</script>

<div class="flex flex-col gap-8 pb-10 w-full">
  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="flex items-end justify-between">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p class="text-sm text-muted-foreground/70 mt-0.5">Overview of your AI workforce</p>
    </div>
    <div class="flex items-center gap-2 text-xs text-muted-foreground/50">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
      System online
    </div>
  </div>

  <!-- ── Company not ready ───────────────────────────────────────────── -->
  {#if !companyId}
    <div class="glass-card p-5">
      <div class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <div class="font-medium">Company context is not ready yet.</div>
        <div class="mt-1 text-amber-100/80">
          The dashboard is waiting for the active company to load. If this persists, go back to the companies page and re-enter the dashboard.
        </div>
        <div class="mt-3">
          <a href="/companies" class="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-400/25 transition-all duration-200 cursor-pointer">
            Open Companies
          </a>
        </div>
      </div>
    </div>
  {/if}

  <!-- ── No agents warning ──────────────────────────────────────────── -->
  {#if !loading && agents.length === 0}
    <Alert variant="warning">
      <Bot class="h-4 w-4" />
      <AlertTitle>No agents configured</AlertTitle>
      <AlertDescription>
        <p>You have no agents. <a href="/{prefix}/agents/new" class="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer transition-all duration-200">Create one here</a></p>
      </AlertDescription>
    </Alert>
  {/if}

  <!-- ── Active Agents Panel ─────────────────────────────────────────── -->
  {#if companyId}
    <ActiveAgentsPanel companyId={companyId ?? ''} prefix={prefix ?? ''} />
  {/if}

  <!-- ── Budget Incident Alert ──────────────────────────────────────── -->
  {#if pendingIncidents.length > 0}
    <Alert variant="destructive">
      <PauseCircle class="h-4 w-4" />
      <AlertTitle>{pendingIncidents.length} active budget incident{pendingIncidents.length === 1 ? '' : 's'}</AlertTitle>
      <AlertDescription>
        <p>{pendingIncidents.length} agents paused — monthly budget exceeded. <a href="/{prefix}/costs" class="font-medium underline underline-offset-2 cursor-pointer transition-all duration-200">Open budgets</a></p>
      </AlertDescription>
    </Alert>
  {/if}

  <!-- ── Metric Cards (glassmorphism) ────────────────────────────────── -->
  {#if !loading}
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {#each metricCards as card}
        <a href={card.href} class="group no-underline text-inherit">
          <div class="glass-card p-5 cursor-pointer">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-3xl font-bold tabular-nums">{card.value}</p>
                <p class="text-sm font-medium text-muted-foreground mt-1">{card.label}</p>
                <p class="text-[11px] text-muted-foreground/50 mt-1 hidden sm:block">{card.sub}</p>
              </div>
              <div class="h-9 w-9 rounded-xl bg-background/50 backdrop-blur-sm border border-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                <svelte:component this={card.icon} class="h-4 w-4 text-muted-foreground/60" />
              </div>
            </div>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <!-- Loading skeleton for metric cards -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <div class="glass-card p-5">
          <Skeleton class="h-8 w-16" />
          <Skeleton class="h-4 w-24 mt-2" />
          <Skeleton class="h-3 w-32 mt-2" />
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Activity Charts ─────────────────────────────────────────────── -->
  {#if companyId}
    <div class="glass-card p-6">
      <h2 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Activity Overview</h2>
      <ActivityCharts {companyId} />
    </div>
  {/if}

  <!-- ── ECharts: Budget + Agent Status + Cost Trend ─────────────────── -->
  {#if !loading}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- Budget Gauge -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Budget Usage</h3>
        {#if monthBudgetCents > 0}
          <GaugeChart value={monthSpend} max={monthBudgetCents} label="of budget" height="180px" colorMode="ascending" />
        {:else}
          <div class="flex h-[180px] items-center justify-center">
            <p class="text-sm text-muted-foreground/60 italic">No budget set</p>
          </div>
        {/if}
      </div>

      <!-- Agent Status Pie -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Agent Status</h3>
        {#if agents.length > 0}
          <PieChart
            data={[
              { name: 'Running', value: runningAgents, color: '#3b82f6' },
              { name: 'Idle', value: pausedAgents, color: '#22c55e' },
              { name: 'Error', value: errorAgents, color: '#ef4444' },
            ].filter(d => d.value > 0)}
            height="180px"
          />
        {:else}
          <div class="flex h-[180px] items-center justify-center">
            <p class="text-sm text-muted-foreground/60 italic">No agents</p>
          </div>
        {/if}
      </div>

      <!-- Cost Trend Line -->
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Cost Trend</h3>
        {#if costDailyData.length > 0}
          <LineChart
            labels={costDailyData.map(d => d.label)}
            series={[{ name: 'Daily Spend', data: costDailyData.map(d => d.value), color: '#3b82f6', area: true }]}
            height="180px"
            yAxisLabel="$"
          />
        {:else}
          <div class="flex h-[180px] items-center justify-center">
            <p class="text-sm text-muted-foreground/60 italic">No cost data yet</p>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ── Recent Activity & Recent Tasks ───────────────────────────── -->
  <div class="grid md:grid-cols-2 gap-4">
    <!-- Recent Activity (Timeline) -->
    {#if recentActivity.length > 0 || recentActivityLoading}
      <div class="glass-card p-6">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Recent Activity
        </h3>
        {#if recentActivityLoading}
          <!-- Skeleton timeline -->
          <div class="relative">
            {#each Array(5) as _, i}
              <div class="flex">
                <div class="flex flex-col items-center shrink-0 w-6">
                  <Skeleton class="h-6 w-6 rounded-full" />
                  {#if i < 4}<div class="w-px flex-1 bg-border/30"></div>{/if}
                </div>
                <div class="flex-1 ml-3 px-3 py-1.5 mb-1">
                  <Skeleton class="h-3 w-3/4 mb-1.5" />
                  <Skeleton class="h-2.5 w-1/2" />
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="relative">
            {#each recentActivity as item, idx}
              {@const actorDisplay = getActorDisplay(item)}
              {@const verb = parseActionVerb(item.action ?? item.description ?? item.message ?? '')}
              {@const entity = getEntityDisplay(item)}
              {@const activityHref = getActivityHref(item)}
              {@const activityIcon = getActivityIcon(item)}
              {@const dotRing = getDotRing(item)}
              {@const statusDetail = getStatusChangeDetail(item)}
              {@const isLast = idx === recentActivity.length - 1}
              {@const actorInitials = getInitials(actorDisplay)}

              <a
                href={activityHref || `/${prefix}/activity`}
                class="group relative flex no-underline text-inherit cursor-pointer"
              >
                <!-- Left column: dot + connector line -->
                <div class="flex flex-col items-center shrink-0 w-6">
                  <div class="z-10 flex h-6 w-6 items-center justify-center rounded-full ring-2 {dotRing} shadow-sm transition-transform duration-200 group-hover:scale-110">
                    <svelte:component this={activityIcon.icon} size={12} class={activityIcon.color} />
                  </div>
                  {#if !isLast}
                    <div class="w-px flex-1 bg-border/50"></div>
                  {/if}
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0 ml-3 rounded-lg px-3 pt-0.5 pb-2 mb-1 transition-all duration-200 group-hover:bg-accent/50">
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0 flex-1">
                      <p class="text-[13px] leading-6">
                        <span class="inline-flex items-center gap-1">
                          <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground shrink-0">
                            {actorInitials}
                          </span>
                          <span class="font-medium">{actorDisplay}</span>
                        </span>
                        <span class="text-muted-foreground ml-0.5">{verb}</span>
                        {#if entity.label}
                          <span class="font-semibold ml-0.5 text-foreground/90">{entity.label}</span>
                        {/if}
                      </p>
                      {#if entity.subtitle}
                        <p class="mt-0.5 text-[12px] text-muted-foreground truncate">{entity.subtitle}</p>
                      {/if}
                      {#if statusDetail}
                        <p class="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/[0.06] px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                          <ArrowRight size={10} />
                          {statusDetail}
                        </p>
                      {/if}
                    </div>
                    <span class="shrink-0 text-[11px] text-muted-foreground/60 pt-0.5">
                      <TimeAgo date={item.createdAt ?? item.timestamp ?? item.date} />
                    </span>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Recent Tasks -->
    <div class="glass-card p-6 overflow-hidden">
      <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
        Recent Tasks
      </h3>
      {#if loading}
        <div class="divide-y divide-white/[0.06]">
          {#each Array(5) as _}
            <div class="px-2 py-3 flex items-center gap-3">
              <Skeleton class="h-4 w-4 rounded-full shrink-0" />
              <Skeleton class="h-3 w-16" />
              <Skeleton class="h-3 w-3/4" />
            </div>
          {/each}
        </div>
      {:else if recentIssues.length === 0}
        <div class="py-4">
          <p class="text-sm text-muted-foreground">No tasks yet.</p>
        </div>
      {:else}
        <div class="divide-y divide-white/[0.06]">
          {#each recentIssues.slice(0, 10) as issue}
            {@const normalizedStatus = normalizeIssueStatus(issue.status)}
            {@const color = statusColor(issue.status)}
            {@const identifier = issue.identifier ?? issue.slug ?? (issue.number ? `#${issue.number}` : '')}
            {@const assignedAgent = findAgentById(issue.assigneeAgentId)}
            {@const agentName = assignedAgent?.name ?? issue.assigneeName ?? issue.agentName ?? ''}
            <a
              href="/{prefix}/issues/{issue.identifier ?? issue.id}"
              class="px-2 py-3 text-sm cursor-pointer hover:bg-white/[0.04] transition-all duration-200 no-underline text-inherit block rounded-lg"
            >
              <div class="flex items-start gap-2 sm:items-center sm:gap-3">
                <!-- Status icon -->
                <span
                  class="shrink-0 inline-flex h-4 w-4 rounded-full border-2"
                  style="border-color: {color};{normalizedStatus === 'done' ? ` background-color: ${color};` : ''}"
                ></span>

                <span class="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                  <span class="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                    {issue.title ?? issue.name ?? 'Untitled'}
                  </span>
                  <span class="flex items-center gap-2 sm:order-1 sm:shrink-0">
                    {#if identifier}
                      <span class="text-xs font-mono text-muted-foreground">
                        {identifier}
                      </span>
                    {/if}
                    {#if agentName}
                      <span class="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          class="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                          style="background-color: {color};"
                        >
                          {getInitials(agentName)}
                        </span>
                        {agentName}
                      </span>
                    {/if}
                    <span class="text-xs text-muted-foreground shrink-0 sm:order-last">
                      <TimeAgo date={issue.updatedAt ?? issue.createdAt} />
                    </span>
                  </span>
                </span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>
