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
  import { openNewIssueDialog } from '$lib/components/new-issue-dialog.svelte';
  import {
    Badge,
    Skeleton,
    Button,
    Card, CardContent, CardHeader, CardTitle, CardDescription,
    Alert, AlertTitle, AlertDescription,
  } from '$lib/components/ui/index.js';
  import {
    CHART_SERIES_COLORS,
    ISSUE_STATUS_VISUALS,
  } from '$lib/constants/visual';
  import { PageLayout } from '$lib/components/layout/index.js';

  import {
    Bot,
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

      const [dashData, issueData, costData, agentData] = await Promise.all([
        api(`/api/companies/${companyId}/dashboard`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
        safeFetch(`/api/companies/${companyId}/issues?limit=10`, []),
        safeFetch(`/api/companies/${companyId}/costs/summary`, null),
        agentsPromise,
      ]);

      applyNormalized({
        agents: agentData,
        issues: (dashData?.issues?.length ? dashData.issues : issueData),
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

  function applyNormalized(data: { agents?: any; issues?: any; costs?: any }) {
    agents = Array.isArray(data.agents) ? data.agents : (data.agents as any)?.agents ?? (data.agents as any)?.data ?? [];
    issues = Array.isArray(data.issues) ? data.issues : (data.issues as any)?.issues ?? (data.issues as any)?.data ?? [];
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

  function statusColor(status: string): string {
    return ISSUE_STATUS_VISUALS[normalizeIssueStatus(status)]?.hex ?? '#64748b';
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

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<PageLayout title="Dashboard" description={`Overview of ${companyName}`} fullWidth class="dashboard-typography">
  {#snippet actions()}
    <Badge class="border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
      <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
      System online
    </Badge>
    <Button variant="outline" size="sm" onclick={() => openNewIssueDialog({ companyId: companyId ?? undefined })}>
      New issue
    </Button>
    <Button variant="outline" size="sm" onclick={() => void refreshDashboard()}>
      Refresh
    </Button>
    <Button variant="outline" size="sm" href={`/${prefix}/agents`}>
      Agents
    </Button>
    <Button variant="outline" size="sm" href={`/${prefix}/issues`}>
      Issues
    </Button>
    <Button variant="outline" size="sm" href={`/${prefix}/costs`}>
      Costs
    </Button>
    <Button variant="outline" size="sm" href={`/${prefix}/approvals`}>
      Approvals
    </Button>
  {/snippet}

  {#if !companyId}
    <Card class="border-amber-500/20">
      <CardHeader>
        <CardTitle class="text-sm">Company context is not ready yet.</CardTitle>
        <CardDescription>
          The dashboard is waiting for the active company to load. If this persists, go back to the companies page and re-enter the dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent class="pt-0">
        <Button variant="outline" href="/companies" class="border-amber-400/30 bg-amber-400/15 text-amber-50 hover:bg-amber-400/25">
          Open Companies
        </Button>
      </CardContent>
    </Card>
  {/if}

  {#if !loading && agents.length === 0}
    <Alert variant="warning">
      <Bot class="h-4 w-4" />
      <AlertTitle>No agents configured</AlertTitle>
      <AlertDescription>
        <p>
          You have no agents.
          <a href={`/${prefix}/agents/new`} class="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer transition-all duration-200">Create one here</a>
        </p>
      </AlertDescription>
    </Alert>
  {/if}

  {#if companyId}
    <ActiveAgentsPanel companyId={companyId ?? ''} prefix={prefix ?? ''} />
  {/if}

  {#if pendingIncidents.length > 0}
    <Alert variant="destructive">
      <PauseCircle class="h-4 w-4" />
      <AlertTitle>{pendingIncidents.length} active budget incident{pendingIncidents.length === 1 ? '' : 's'}</AlertTitle>
      <AlertDescription>
        <p>
          {pendingIncidents.length} agents paused — monthly budget exceeded.
          <a href={`/${prefix}/costs`} class="font-medium underline underline-offset-2 cursor-pointer transition-all duration-200">Open budgets</a>
        </p>
      </AlertDescription>
    </Alert>
  {/if}

  {#if !loading}
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {#each metricCards as card}
        {@const CardIcon = card.icon}
        <a href={card.href} class="group block no-underline text-inherit">
          <Card class="h-full gap-0 p-0">
            <CardContent class="p-5">
              <div class="flex items-start justify-between">
                <div>
                  <p class="text-3xl font-bold tabular-nums">{card.value}</p>
                  <p class="mt-1 text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p class="mt-1 hidden text-[11px] text-muted-foreground/50 sm:block">{card.sub}</p>
                </div>
                <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-background/50 backdrop-blur-sm transition-transform duration-200 group-hover:scale-110">
                  <CardIcon class="h-4 w-4 text-muted-foreground/60" />
                </div>
              </div>
            </CardContent>
          </Card>
        </a>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {#each Array(4) as _}
        <Card class="gap-0 p-0">
          <CardContent class="p-5">
            <Skeleton class="h-8 w-16" />
            <Skeleton class="mt-2 h-4 w-24" />
            <Skeleton class="mt-2 h-3 w-32" />
          </CardContent>
        </Card>
      {/each}
    </div>
  {/if}

  {#if companyId}
    <Card>
      <CardHeader>
        <CardTitle class="text-sm uppercase tracking-wide">Activity Overview</CardTitle>
        <CardDescription>Recent events across the workspace.</CardDescription>
      </CardHeader>
      <CardContent class="pt-0">
        <ActivityCharts {companyId} />
      </CardContent>
    </Card>
  {/if}

  {#if !loading}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle class="text-sm uppercase tracking-wide">Budget Usage</CardTitle>
          <CardDescription>Current spend against the monthly budget.</CardDescription>
        </CardHeader>
        <CardContent class="pt-0">
          {#if monthBudgetCents > 0}
            <GaugeChart value={monthSpend} max={monthBudgetCents} label="of budget" height="180px" colorMode="ascending" />
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/60">No budget set</p>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-sm uppercase tracking-wide">Agent Status</CardTitle>
          <CardDescription>Running, idle, and error distribution.</CardDescription>
        </CardHeader>
        <CardContent class="pt-0">
          {#if agents.length > 0}
            <PieChart
              data={[
                { name: 'Running', value: runningAgents, color: CHART_SERIES_COLORS[0] },
                { name: 'Idle', value: pausedAgents, color: CHART_SERIES_COLORS[1] },
                { name: 'Error', value: errorAgents, color: CHART_SERIES_COLORS[3] },
              ].filter(d => d.value > 0)}
              height="180px"
            />
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/60">No agents</p>
            </div>
          {/if}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-sm uppercase tracking-wide">Cost Trend</CardTitle>
          <CardDescription>Seven-day spend trend for the active company.</CardDescription>
        </CardHeader>
        <CardContent class="pt-0">
          {#if costDailyData.length > 0}
            <LineChart
              labels={costDailyData.map(d => d.label)}
              series={[{ name: 'Daily Spend', data: costDailyData.map(d => d.value), color: CHART_SERIES_COLORS[0], area: true }]}
              height="180px"
              yAxisLabel="$"
            />
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/60">No cost data yet</p>
            </div>
          {/if}
        </CardContent>
      </Card>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-2">
    {#if recentActivity.length > 0 || recentActivityLoading}
      <Card class="overflow-hidden">
        <CardHeader>
          <CardTitle class="text-sm uppercase tracking-wide">Recent Activity</CardTitle>
          <CardDescription>Latest board and agent actions.</CardDescription>
        </CardHeader>
        <CardContent class="pt-0">
          {#if recentActivityLoading}
            <div class="relative">
              {#each Array(5) as _, i}
                <div class="flex">
                  <div class="flex w-6 shrink-0 flex-col items-center">
                    <Skeleton class="h-6 w-6 rounded-full" />
                    {#if i < 4}<div class="w-px flex-1 bg-border/30"></div>{/if}
                  </div>
                  <div class="mb-1 ml-3 flex-1 px-3 py-1.5">
                    <Skeleton class="mb-1.5 h-3 w-3/4" />
                    <Skeleton class="h-2.5 w-1/2" />
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="relative">
              {#each recentActivity as item, idx}
                {@const activityIcon = getActivityIcon(item)}
                {@const ActivityIcon = activityIcon.icon}
                {@const actorDisplay = getActorDisplay(item)}
                {@const verb = parseActionVerb(item.action ?? item.description ?? item.message ?? '')}
                {@const entity = getEntityDisplay(item)}
                {@const activityHref = getActivityHref(item)}
                {@const dotRing = getDotRing(item)}
                {@const statusDetail = getStatusChangeDetail(item)}
                {@const isLast = idx === recentActivity.length - 1}
                {@const actorInitials = getInitials(actorDisplay)}

                <a href={activityHref || `/${prefix}/activity`} class="group relative flex cursor-pointer no-underline text-inherit">
                  <div class="flex w-6 shrink-0 flex-col items-center">
                    <div class="z-10 flex h-6 w-6 items-center justify-center rounded-full ring-2 {dotRing} shadow-sm transition-transform duration-200 group-hover:scale-110">
                      <ActivityIcon size={12} class={activityIcon.color} />
                    </div>
                    {#if !isLast}
                      <div class="w-px flex-1 bg-border/50"></div>
                    {/if}
                  </div>

                  <div class="mb-1 ml-3 flex-1 rounded-lg px-3 pb-2 pt-0.5 transition-all duration-200 group-hover:bg-accent/50">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <p class="text-[13px] leading-6">
                          <span class="inline-flex items-center gap-1">
                            <span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-[8px] font-bold text-muted-foreground">
                              {actorInitials}
                            </span>
                            <span class="font-medium">{actorDisplay}</span>
                          </span>
                          <span class="ml-0.5 text-muted-foreground">{verb}</span>
                          {#if entity.label}
                            <span class="ml-0.5 font-semibold text-foreground/90">{entity.label}</span>
                          {/if}
                        </p>
                        {#if entity.subtitle}
                          <p class="mt-0.5 truncate text-[12px] text-muted-foreground">{entity.subtitle}</p>
                        {/if}
                        {#if statusDetail}
                          <p class="mt-1 inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/[0.06] px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                            <ArrowRight size={10} />
                            {statusDetail}
                          </p>
                        {/if}
                      </div>
                      <span class="shrink-0 pt-0.5 text-[11px] text-muted-foreground/60">
                        <TimeAgo date={item.createdAt ?? item.timestamp ?? item.date} />
                      </span>
                    </div>
                  </div>
                </a>
              {/each}
            </div>
          {/if}
        </CardContent>
      </Card>
    {/if}

    <Card class="overflow-hidden">
      <CardHeader>
        <CardTitle class="text-sm uppercase tracking-wide">Recent Tasks</CardTitle>
        <CardDescription>The newest issues created in this company.</CardDescription>
      </CardHeader>
      <CardContent class="pt-0">
        {#if loading}
          <div class="divide-y divide-white/[0.06]">
            {#each Array(5) as _}
              <div class="flex items-center gap-3 px-2 py-3">
                <Skeleton class="h-4 w-4 shrink-0 rounded-full" />
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
                href={`/${prefix}/issues/${issue.identifier ?? issue.id}`}
                class="block cursor-pointer rounded-lg px-2 py-3 text-sm no-underline text-inherit transition-all duration-200 hover:bg-white/[0.04]"
              >
                <div class="flex items-start gap-2 sm:items-center sm:gap-3">
                  <span
                    class="inline-flex h-4 w-4 shrink-0 rounded-full border-2"
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
                        <span class="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
                          <span
                            class="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                            style="background-color: {color};"
                          >
                            {getInitials(agentName)}
                          </span>
                          {agentName}
                        </span>
                      {/if}
                      <span class="shrink-0 text-xs text-muted-foreground sm:order-last">
                        <TimeAgo date={issue.updatedAt ?? issue.createdAt} />
                      </span>
                    </span>
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </CardContent>
    </Card>
  </div>
</PageLayout>

<style>
  :global(.dashboard-typography) {
    font-family: 'Fira Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  }

  :global(.dashboard-typography code),
  :global(.dashboard-typography .font-mono),
  :global(.dashboard-typography .tabular-nums) {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
</style>
