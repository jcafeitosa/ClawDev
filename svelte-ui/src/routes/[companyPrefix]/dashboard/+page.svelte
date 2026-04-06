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
    ISSUE_STATUS_ORDER,
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
  let costRuns = $state<any[]>([]);

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
  let monthSpend = $derived(
    costSummary?.monthSpendCents ?? costSummary?.spendCents ?? costSummary?.totalCost ?? costSummary?.total ?? 0
  );
  let monthBudgetCents = $derived(
    costSummary?.monthBudgetCents ?? costSummary?.budgetCents ?? costSummary?.budget ?? costSummary?.limit ?? 0
  );
  let monthUtilizationPercent = $derived(
    monthBudgetCents > 0 ? Math.min(Math.round((monthSpend / monthBudgetCents) * 100), 100) : 0,
  );

  // Cost trend: build daily data from heartbeat runs (API doesn't provide daily breakdown)
  let costDailyData = $derived.by(() => {
    // First check if costSummary has daily data
    const daily = costSummary?.daily ?? costSummary?.dailyCosts ?? [];
    if (Array.isArray(daily) && daily.length > 0) {
      return daily.map((d: any) => ({
        label: new Date(d.date ?? d.day).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        value: Number(d.cost ?? d.total ?? d.amount ?? 0),
      }));
    }
    // Build from heartbeat runs usageJson
    const dayMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayMap.set(d.toISOString().slice(0, 10), 0);
    }
    if (Array.isArray(costRuns)) {
      for (const run of costRuns) {
        const usage = run.usageJson;
        if (!usage?.costUsd) continue;
        const dateKey = (run.finishedAt ?? run.startedAt ?? run.createdAt ?? '').slice(0, 10);
        if (dayMap.has(dateKey)) {
          dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + Math.round(Number(usage.costUsd) * 100));
        }
      }
    }
    return Array.from(dayMap.entries()).map(([date, cents]) => ({
      label: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      value: cents,
    }));
  });
  let dashStatusCounts = $derived.by(() => {
    const m: Record<string, number> = {};
    for (const i of issues) {
      const s = normalizeIssueStatus(i.status);
      m[s] = (m[s] ?? 0) + 1;
    }
    return m;
  });
  let dashStatusMax = $derived(Math.max(...Object.values(dashStatusCounts), 1));

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

    // Fetch recent runs for cost trend chart
    safeFetch<any>(`/api/companies/${companyId}/heartbeat-runs?limit=50`, null).then((data) => {
      costRuns = Array.isArray(data) ? data : data?.runs ?? [];
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

  // ── Sparkline data from runs (7 days) ──────────────────────────────
  function buildDailyBuckets(items: any[], dateField: string, countMode: 'count' | 'sum' = 'count', sumField = ''): number[] {
    const buckets = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const item of items) {
      const dateStr = (item[dateField] ?? '').slice(0, 10);
      if (buckets.has(dateStr)) {
        if (countMode === 'sum' && sumField) {
          const val = Number(item.usageJson?.[sumField] ?? item[sumField] ?? 0);
          buckets.set(dateStr, (buckets.get(dateStr) ?? 0) + val);
        } else {
          buckets.set(dateStr, (buckets.get(dateStr) ?? 0) + 1);
        }
      }
    }
    return Array.from(buckets.values());
  }

  let sparkRuns = $derived(buildDailyBuckets(costRuns, 'finishedAt'));
  let sparkCost = $derived(buildDailyBuckets(costRuns, 'finishedAt', 'sum', 'costUsd'));

  // ── Metric cards for glassmorphism grid ────────────────────────────
  let metricCards = $derived([
    {
      href: `/${prefix}/agents`,
      value: enabledAgents,
      label: 'Agents Enabled',
      sub: `${runningAgents} running, ${pausedAgents} paused, ${errorAgents} errors`,
      icon: Bot,
      spark: sparkRuns,
      sparkColor: '#3b82f6',
    },
    {
      href: `/${prefix}/issues`,
      value: tasksInProgress,
      label: 'Tasks In Progress',
      sub: `${openIssues} open, ${blockedIssues} blocked`,
      icon: CircleDot,
      spark: sparkRuns.map((v, i) => Math.max(0, v - (i > 0 ? sparkRuns[i - 1] : 0))),
      sparkColor: '#f97316',
    },
    {
      href: `/${prefix}/costs`,
      value: formatCents(monthSpend),
      label: 'Month Spend',
      sub: monthBudgetCents > 0 ? `${monthUtilizationPercent}% of ${formatCents(monthBudgetCents)} budget` : 'Unlimited budget',
      icon: DollarSign,
      spark: costDailyData.map(d => d.value),
      sparkColor: '#10b981',
    },
    {
      href: `/${prefix}/approvals`,
      value: pendingApprovals + budgetPendingApprovals,
      label: 'Pending Approvals',
      sub: budgetPendingApprovals > 0 ? `${budgetPendingApprovals} budget overrides awaiting review` : 'Awaiting board review',
      icon: ShieldCheck,
      spark: [0, 0, 0, 0, 0, 0, pendingApprovals + budgetPendingApprovals],
      sparkColor: '#8b5cf6',
    },
  ]);

</script>

<!-- Fonts loaded globally via app.css (Space Grotesk + DM Sans + Fira Code) -->

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
        {@const sparkMax = Math.max(...(card.spark ?? [1]), 1)}
        {@const sparkPoints = (card.spark ?? []).map((v, i, arr) => {
          const x = (i / Math.max(arr.length - 1, 1)) * 100;
          const y = 100 - (v / sparkMax) * 80 - 10;
          return `${x},${y}`;
        }).join(' ')}
        {@const sparkFill = sparkPoints ? `${sparkPoints} 100,100 0,100` : ''}
        <a href={card.href} class="group block no-underline text-inherit">
          <div class="glass-card font-card relative h-full overflow-hidden p-5">
            <!-- Sparkline background -->
            {#if card.spark && card.spark.some(v => v > 0)}
              <svg class="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon points={sparkFill} fill={card.sparkColor} />
              </svg>
              <svg class="pointer-events-none absolute bottom-0 left-0 h-[50%] w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline points={sparkPoints} fill="none" stroke={card.sparkColor} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
              </svg>
            {/if}
            <!-- Content -->
            <div class="relative flex items-start justify-between">
              <div>
                <p class="text-3xl font-bold tabular-nums" style="font-family: 'Inter', system-ui, sans-serif;">{card.value}</p>
                <p class="mt-1.5 text-sm font-medium text-muted-foreground">{card.label}</p>
                <p class="mt-1 hidden text-[11px] text-muted-foreground/50 sm:block">{card.sub}</p>
              </div>
              <div class="icon-gradient flex h-9 w-9 items-center justify-center">
                <CardIcon class="h-4 w-4 text-blue-400" />
              </div>
            </div>
          </div>
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
    <div class="glass-card font-card p-6">
      <h3 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Activity Overview</h3>
      <p class="mt-1 text-xs text-muted-foreground/60">Recent events across the workspace.</p>
      <div class="mt-4">
        <ActivityCharts {companyId} />
      </div>
    </div>
  {/if}

  {#if !loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="glass-card font-card p-5">
        <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Budget Usage</h4>
        <p class="mt-0.5 text-[11px] text-muted-foreground/50">Current spend against the monthly budget.</p>
        <div class="mt-3">
          {#if monthBudgetCents > 0}
            <GaugeChart value={monthSpend} max={monthBudgetCents} label="of budget" height="180px" colorMode="ascending" />
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/40">No budget set</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="glass-card font-card p-5">
        <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agent Status</h4>
        <p class="mt-0.5 text-[11px] text-muted-foreground/50">Running, idle, and error distribution.</p>
        <div class="mt-3">
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
              <p class="text-sm italic text-muted-foreground/40">No agents</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="glass-card font-card p-5">
        <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cost Trend</h4>
        <p class="mt-0.5 text-[11px] text-muted-foreground/50">Seven-day spend trend.</p>
        <div class="mt-3">
          {#if costDailyData.length > 0}
            <LineChart
              labels={costDailyData.map(d => d.label)}
              series={[{ name: 'Daily Spend', data: costDailyData.map(d => d.value), color: CHART_SERIES_COLORS[0], area: true }]}
              height="180px"
              yAxisLabel="$"
            />
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/40">No cost data yet</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Tasks by Status (ClickUp-style horizontal bars) -->
      <div class="glass-card font-card p-5">
        <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasks by Status</h4>
        <p class="mt-0.5 text-[11px] text-muted-foreground/50">Issue status distribution.</p>
        <div class="mt-3">
          {#if issues.length > 0}
            <div class="space-y-2">
              {#each ISSUE_STATUS_ORDER.filter(s => dashStatusCounts[s]) as status}
                {@const count = dashStatusCounts[status] ?? 0}
                {@const pct = Math.round((count / dashStatusMax) * 100)}
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {ISSUE_STATUS_VISUALS[status]?.hex ?? '#64748b'}"></span>
                  <span class="text-[11px] w-20 shrink-0 truncate">{ISSUE_STATUS_VISUALS[status]?.label ?? status}</span>
                  <div class="flex-1 h-3 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      style="width: {pct}%; background-color: {ISSUE_STATUS_VISUALS[status]?.hex ?? '#64748b'}"
                    ></div>
                  </div>
                  <span class="text-[11px] text-muted-foreground tabular-nums w-6 text-right">{count}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/40">No tasks</p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Tasks by Assignee (ClickUp-style) -->
      <div class="glass-card font-card p-5">
        <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasks by Assignee</h4>
        <p class="mt-0.5 text-[11px] text-muted-foreground/50">Distribution across agents.</p>
        <div class="mt-3">
          {#if agents.length > 0 || issues.length > 0}
            {@const assigneeCounts = agents.map((a) => ({
              name: a.name ?? 'Unassigned',
              value: issues.filter((i) => i.assigneeAgentId === a.id).length,
            })).filter(d => d.value > 0)}
            {@const unassigned = issues.filter((i) => !i.assigneeAgentId).length}
            {@const chartData = [...assigneeCounts, ...(unassigned > 0 ? [{ name: 'Unassigned', value: unassigned }] : [])]}
            {#if chartData.length > 0}
            <PieChart
              data={chartData.map((d, i) => ({ ...d, color: CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length] }))}
              height="180px"
            />
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/40">No tasks</p>
            </div>
          {/if}
          {:else}
            <div class="flex h-[180px] items-center justify-center">
              <p class="text-sm italic text-muted-foreground/40">No data</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-2">
    {#if recentActivity.length > 0 || recentActivityLoading}
      <div class="glass-card overflow-hidden p-6">
        <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h4>
        <p class="mt-0.5 mb-4 text-[11px] text-muted-foreground/50">Latest board and agent actions.</p>
        <div>
          {#if recentActivityLoading}
            <div class="relative">
              {#each Array(5) as _, i}
                <div class="flex">
                  <div class="flex w-6 shrink-0 flex-col items-center">
                    <Skeleton class="h-6 w-6 rounded-full" />
                    {#if i < 4}<div class="w-0.5 flex-1 rounded-full bg-border/30"></div>{/if}
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
                      <div class="w-0.5 flex-1 rounded-full bg-gradient-to-b from-border/60 to-border/20"></div>
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
        </div>
      </div>
    {/if}

    <div class="glass-card overflow-hidden p-6">
      <h4 class="font-card text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tasks</h4>
      <p class="mt-0.5 mb-4 text-[11px] text-muted-foreground/50">Grouped by status.</p>
      <div>
        {#if loading}
          <div class="space-y-2">
            {#each Array(5) as _}
              <Skeleton class="h-8 w-full" />
            {/each}
          </div>
        {:else if recentIssues.length === 0}
          <div class="py-4">
            <p class="text-sm text-muted-foreground">No tasks yet.</p>
          </div>
        {:else}
          <!-- ClickUp-style status groups -->
          {@const STATUS_ORDER = ['in_progress', 'todo', 'in_review', 'blocked', 'backlog', 'done', 'cancelled']}
          {@const STATUS_LABELS = { in_progress: 'IN PROGRESS', todo: 'TO DO', in_review: 'IN REVIEW', blocked: 'BLOCKED', backlog: 'BACKLOG', done: 'COMPLETE', cancelled: 'CANCELLED' } as Record<string, string>}
          {@const STATUS_COLORS = { in_progress: '#f97316', todo: '#3b82f6', in_review: '#8b5cf6', blocked: '#ef4444', backlog: '#64748b', done: '#10b981', cancelled: '#6b7280' } as Record<string, string>}
          {@const grouped = STATUS_ORDER.map(s => ({
            status: s,
            label: STATUS_LABELS[s] ?? s.toUpperCase(),
            color: STATUS_COLORS[s] ?? '#64748b',
            issues: recentIssues.filter(i => normalizeIssueStatus(i.status) === s),
          })).filter(g => g.issues.length > 0)}

          <div class="space-y-3">
            {#each grouped as group}
              <!-- Status group header -->
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style="background-color: {group.color};"
                >
                  <span class="inline-flex h-2 w-2 rounded-full bg-white/30"></span>
                  {group.label}
                </span>
                <span class="text-[11px] text-muted-foreground/60">{group.issues.length}</span>
              </div>

              <!-- Task rows in this group -->
              <div class="ml-1 border-l-2 pl-3" style="border-color: {group.color}20;">
                {#each group.issues as issue}
                  {@const identifier = issue.identifier ?? issue.slug ?? ''}
                  {@const assignedAgent = findAgentById(issue.assigneeAgentId)}
                  {@const agentName = assignedAgent?.name ?? ''}
                  <a
                    href={`/${prefix}/issues/${issue.identifier ?? issue.id}`}
                    class="flex items-center gap-3 rounded-md px-2 py-2 text-sm no-underline text-inherit transition-all duration-150 hover:bg-accent/50"
                  >
                    <span
                      class="inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2"
                      style="border-color: {group.color};{group.status === 'done' ? ` background-color: ${group.color};` : ''}"
                    ></span>
                    <span class="min-w-0 flex-1 truncate">{issue.title ?? 'Untitled'}</span>
                    {#if identifier}
                      <span class="font-mono text-[11px] text-muted-foreground/60 shrink-0">{identifier}</span>
                    {/if}
                    {#if agentName}
                      <span class="hidden items-center gap-1 text-[11px] text-muted-foreground/60 sm:inline-flex shrink-0">
                        <span class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[7px] font-bold">{getInitials(agentName)}</span>
                        {agentName}
                      </span>
                    {/if}
                    <span class="shrink-0 text-[11px] text-muted-foreground/40">
                      <TimeAgo date={issue.updatedAt ?? issue.createdAt} />
                    </span>
                  </a>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</PageLayout>

<style>
  :global(.dashboard-typography) {
    font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 14px;
  }

  :global(.dashboard-typography code),
  :global(.dashboard-typography .font-mono),
  :global(.dashboard-typography .tabular-nums) {
    font-family: 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
</style>
