<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { dashboardRefreshStore } from '$stores/dashboard-refresh.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';

  import TimeAgo from '$lib/components/time-ago.svelte';
  import ActivityCharts from '$lib/components/charts/activity-charts.svelte';
  import ActiveAgentsPanel from '$lib/components/active-agents-panel.svelte';
  import { Skeleton } from '$lib/components/ui/index.js';

  import {
    Bot,
    ListTodo,
    DollarSign,
    CircleDot,
    ShieldCheck,
    PauseCircle,
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
  let routeCompanyId = $derived.by(() => {
    const requestedPrefix = prefix?.trim().toUpperCase();
    if (!requestedPrefix) return null;
    return companyStore.companies.find((company) => String(company.issuePrefix ?? "").toUpperCase() === requestedPrefix)?.id ?? null;
  });
  let companyId = $derived(routeCompanyId ?? companyStore.selectedCompanyId ?? companyStore.selectedCompany?.id);
  let companyName = $derived(companyStore.selectedCompany?.name ?? 'Company');

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

  // Issue status icon colors (matching Paperclip)
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

</script>

<div class="space-y-6">
  {#if !companyId}
    <div class="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
      <div class="font-medium">Company context is not ready yet.</div>
      <div class="mt-1 text-amber-100/80">
        The dashboard is waiting for the active company to load. If this persists, go back to the companies page and re-enter the dashboard.
      </div>
      <div class="mt-3">
        <a href="/companies" class="inline-flex items-center rounded-md border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-50 hover:bg-amber-400/25 transition-colors">
          Open Companies
        </a>
      </div>
    </div>
  {/if}

  <!-- ── No agents warning ──────────────────────────────────────────── -->
  {#if !loading && agents.length === 0}
    <div class="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
      <div class="flex items-center gap-2.5">
        <Bot class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <p class="text-sm text-amber-900 dark:text-amber-100">You have no agents.</p>
      </div>
      <a
        href="/{prefix}/agents/new"
        class="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
      >
        Create one here
      </a>
    </div>
  {/if}

  <!-- ── Active Agents Panel ─────────────────────────────────────────── -->
  {#if companyId}
    <ActiveAgentsPanel companyId={companyId ?? ''} prefix={prefix ?? ''} />
  {/if}

  <!-- ── Budget Incident Alert ──────────────────────────────────────── -->
  {#if pendingIncidents.length > 0}
    <div class="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
      <div class="flex items-start gap-2.5">
        <PauseCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
        <div>
          <p class="text-sm font-medium text-red-50">
            {pendingIncidents.length} active budget incident{pendingIncidents.length === 1 ? '' : 's'}
          </p>
          <p class="text-xs text-red-100/70">
            {pendingIncidents.length} agents paused — monthly budget exceeded.
          </p>
        </div>
      </div>
      <a href="/{prefix}/costs" class="text-sm underline underline-offset-2 text-red-100">
        Open budgets
      </a>
    </div>
  {/if}

  <!-- ── Metric Cards (Paperclip style: simple, no glassmorphism) ──── -->
  {#if !loading}
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
      <!-- Agents Enabled -->
      <a href="/{prefix}/agents" class="no-underline text-inherit block h-full">
        <div class="h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                {enabledAgents}
              </p>
              <p class="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                Agents Enabled
              </p>
              <div class="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">
                {runningAgents} running, {pausedAgents} paused, {errorAgents} errors
              </div>
            </div>
            <Bot class="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          </div>
        </div>
      </a>

      <!-- Tasks In Progress -->
      <a href="/{prefix}/issues" class="no-underline text-inherit block h-full">
        <div class="h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                {tasksInProgress}
              </p>
              <p class="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                Tasks In Progress
              </p>
              <div class="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">
                {openIssues} open, {blockedIssues} blocked
              </div>
            </div>
            <CircleDot class="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          </div>
        </div>
      </a>

      <!-- Month Spend -->
      <a href="/{prefix}/costs" class="no-underline text-inherit block h-full">
        <div class="h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                {formatCents(monthSpend)}
              </p>
              <p class="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                Month Spend
              </p>
              <div class="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">
                {#if monthBudgetCents > 0}
                  {monthUtilizationPercent}% of {formatCents(monthBudgetCents)} budget
                {:else}
                  Unlimited budget
                {/if}
              </div>
            </div>
            <DollarSign class="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          </div>
        </div>
      </a>

      <!-- Pending Approvals -->
      <a href="/{prefix}/approvals" class="no-underline text-inherit block h-full">
        <div class="h-full px-4 py-4 sm:px-5 sm:py-5 rounded-lg transition-colors hover:bg-accent/50 cursor-pointer">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums">
                {pendingApprovals + budgetPendingApprovals}
              </p>
              <p class="text-xs sm:text-sm font-medium text-muted-foreground mt-1">
                Pending Approvals
              </p>
              <div class="text-xs text-muted-foreground/70 mt-1.5 hidden sm:block">
                {#if budgetPendingApprovals > 0}
                  {budgetPendingApprovals} budget overrides awaiting board review
                {:else}
                  Awaiting board review
                {/if}
              </div>
            </div>
            <ShieldCheck class="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1.5" />
          </div>
        </div>
      </a>
    </div>
  {:else}
    <!-- Loading skeleton for metric cards -->
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
      {#each Array(4) as _}
        <div class="px-4 py-4 sm:px-5 sm:py-5 rounded-lg">
          <Skeleton class="h-8 w-16" />
          <Skeleton class="h-4 w-24 mt-2" />
          <Skeleton class="h-3 w-32 mt-2" />
        </div>
      {/each}
    </div>
  {/if}

  <!-- ── Activity Charts ────────────────────────────────────────────── -->
  {#if companyId}
    <ActivityCharts {companyId} />
  {/if}

  <!-- ── Recent Activity & Recent Tasks (Paperclip style) ──────────── -->
  <div class="grid md:grid-cols-2 gap-4">
    <!-- Recent Activity -->
    {#if recentActivity.length > 0 || recentActivityLoading}
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Recent Activity
        </h3>
        {#if recentActivityLoading}
          <div class="border border-border divide-y divide-border overflow-hidden">
            {#each Array(5) as _}
              <div class="px-4 py-2 flex items-center gap-3">
                <Skeleton class="h-5 w-5 rounded-full shrink-0" />
                <Skeleton class="h-3 w-3/4" />
              </div>
            {/each}
          </div>
        {:else}
          <div class="border border-border divide-y divide-border overflow-hidden">
            {#each recentActivity as item}
              {@const actorDisplay = getActorDisplay(item)}
              {@const verb = parseActionVerb(item.action ?? item.description ?? item.message ?? '')}
              {@const entity = getEntityDisplay(item)}
              {@const activityHref = getActivityHref(item)}
              <a
                href={activityHref || `/${prefix}/activity`}
                class="px-4 py-2 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
              >
                <div class="flex gap-3">
                  <p class="flex-1 min-w-0 truncate">
                    <span class="text-sm font-medium">{actorDisplay}</span>
                    <span class="text-muted-foreground ml-1">{verb}</span>
                    {#if entity.label}
                      <span class="font-medium ml-1">{entity.label}</span>
                    {/if}
                    {#if entity.subtitle}
                      <span class="text-muted-foreground ml-1">— {entity.subtitle}</span>
                    {/if}
                  </p>
                  <span class="text-xs text-muted-foreground shrink-0 pt-0.5">
                    <TimeAgo date={item.createdAt ?? item.timestamp ?? item.date} />
                  </span>
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Recent Tasks -->
    <div class="min-w-0">
      <h3 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Recent Tasks
      </h3>
      {#if loading}
        <div class="border border-border divide-y divide-border overflow-hidden">
          {#each Array(5) as _}
            <div class="px-4 py-3 flex items-center gap-3">
              <Skeleton class="h-4 w-4 rounded-full shrink-0" />
              <Skeleton class="h-3 w-16" />
              <Skeleton class="h-3 w-3/4" />
            </div>
          {/each}
        </div>
      {:else if recentIssues.length === 0}
        <div class="border border-border p-4">
          <p class="text-sm text-muted-foreground">No tasks yet.</p>
        </div>
      {:else}
        <div class="border border-border divide-y divide-border overflow-hidden">
          {#each recentIssues.slice(0, 10) as issue}
            {@const normalizedStatus = normalizeIssueStatus(issue.status)}
            {@const color = statusColor(issue.status)}
            {@const identifier = issue.identifier ?? issue.slug ?? (issue.number ? `#${issue.number}` : '')}
            {@const assignedAgent = findAgentById(issue.assigneeAgentId)}
            {@const agentName = assignedAgent?.name ?? issue.assigneeName ?? issue.agentName ?? ''}
            <a
              href="/{prefix}/issues/{issue.identifier ?? issue.id}"
              class="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
            >
              <div class="flex items-start gap-2 sm:items-center sm:gap-3">
                <!-- Status icon (Paperclip style: circle with border) -->
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
