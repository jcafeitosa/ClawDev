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
    Wallet,
    ShieldCheck,

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

  let companyId = $derived(companyStore.selectedCompanyId ?? companyStore.selectedCompany?.id);
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
    issues.filter((i) => {
      const status = normalizeIssueStatus(i.status);
      return status === 'todo' || status === 'backlog' || status === 'in_progress' || status === 'in_review';
    }).length,
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
    { key: 'todo', label: 'To Do', color: '#2563eb' },
    { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { key: 'in_review', label: 'In Review', color: '#8b5cf6' },
    { key: 'done', label: 'Done', color: '#10b981' },
    { key: 'blocked', label: 'Blocked', color: '#ef4444' },
  ];

  let statusCounts = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_CONFIG) counts[s.key] = 0;
    for (const issue of issues) {
      const st = normalizeIssueStatus(issue.status);
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
      const columnIssues = issues.filter((i) => normalizeIssueStatus(i.status) === s.key);
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

    // Always fetch agents directly (dashboard endpoint doesn't return them)
    const agentsPromise = safeFetch(`/api/companies/${companyId}/agents`, []);

    // Fetch dashboard summary + individual endpoints in parallel
    Promise.all([
      api(`/api/companies/${companyId}/dashboard`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null),
      safeFetch(`/api/companies/${companyId}/issues?limit=10`, []),
      safeFetch(`/api/companies/${companyId}/activity?limit=15`, []),
      safeFetch(`/api/companies/${companyId}/heartbeat-runs?limit=50`, []),
      safeFetch(`/api/companies/${companyId}/costs/summary`, null),
      agentsPromise,
    ]).then(([dashData, issueData, activityData, heartbeatData, costData, agentData]) => {
      applyNormalized({
        agents: agentData,
        issues: (dashData?.issues?.length ? dashData.issues : issueData),
        activity: activityData,
        heartbeatRuns: heartbeatData,
        costs: dashData?.costs ?? dashData?.costSummary ?? costData,
      });
      dashboardApprovals = dashData?.pendingApprovals ?? 0;
    }).finally(() => (loading = false));

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

  /** Parse "issue.created" → human-readable verb */
  function parseActionVerb(action: string): string {
    if (!action) return 'performed an action';
    const verbMap: Record<string, string> = {
      'issue.created': 'created',
      'issue.updated': 'updated',
      'issue.comment_added': 'commented on',
      'issue.status_changed': 'changed status on',
      'issue.checked_out': 'checked out',
      'issue.document_created': 'created document',
      'issue.document_updated': 'updated document',
      'issue.approval_linked': 'linked approval to',
      'agent.created': 'created agent',
      'agent.hire_created': 'requested hire for',
      'agent.key_created': 'created API key for',
      'approval.created': 'requested approval',
      'company.created': 'created company',
    };
    if (verbMap[action]) return verbMap[action];
    // Fallback: split on dot and humanize
    const parts = action.split('.');
    if (parts.length >= 2) {
      return parts.slice(1).join(' ').replace(/_/g, ' ');
    }
    return action.replace(/_/g, ' ');
  }

  /** Determine a human-readable actor name from an activity item */
  function getActorDisplay(item: any): string {
    // If there's an explicit actor name that isn't a UUID, use it
    const actor = item.actor ?? item.agentName ?? item.userName ?? item.user;
    if (actor && !isUUID(actor)) return actor;
    // For actorType "user" or local_implicit source, show "Board"
    if (item.actorType === 'user' || item.actorType === 'system' || item.source === 'local_implicit') return 'Board';
    // Try to find agent by actorId
    if (item.actorId && agents.length > 0) {
      const agent = agents.find((a: any) => a.id === item.actorId);
      if (agent) return agent.name ?? agent.slug ?? 'Agent';
    }
    return 'Board';
  }

  /** Build a link href for an activity item based on its entity type */
  function getActivityHref(item: any): string {
    const details = item.details ?? {};
    const identifier = details.identifier ?? item.entityIdentifier ?? '';
    const entityId = item.entityId ?? '';
    const entityType = item.entityType ?? item.type ?? '';
    const action = item.action ?? '';

    // Approval activities → approvals page
    if (entityType === 'approval' || action.startsWith('approval.')) {
      return `/${prefix}/approvals/${entityId}`;
    }
    // Issue activities → issue page (prefer identifier over UUID)
    if (entityType === 'issue' || action.startsWith('issue.')) {
      if (identifier) return `/${prefix}/issues/${identifier}`;
      if (entityId) return `/${prefix}/issues/${entityId}`;
    }
    // Agent activities → agent page
    if (entityType === 'agent' || action.startsWith('agent.')) {
      return `/${prefix}/agents/${entityId}`;
    }
    // Company activities
    if (entityType === 'company' || action.startsWith('company.')) {
      return `/${prefix}/settings`;
    }
    // Fallback: if we have an identifier, link to issues
    if (identifier) return `/${prefix}/issues/${identifier}`;
    return '';
  }

  /** Get entity display: prefer details.identifier/name/title over raw entityId */
  function getEntityDisplay(item: any): { label: string; subtitle: string } {
    const details = item.details ?? {};
    const identifier = details.identifier ?? item.entityIdentifier ?? '';
    const title = details.title ?? details.name ?? item.entityName ?? '';
    // If entityName is set and isn't a UUID, use it
    if (item.entityName && !isUUID(item.entityName)) {
      return { label: identifier || '', subtitle: item.entityName };
    }
    if (identifier || title) {
      return { label: identifier, subtitle: title };
    }
    // Fallback: if entityId is a UUID, hide it; otherwise show it
    if (item.entityId && !isUUID(item.entityId)) {
      return { label: '', subtitle: item.entityId };
    }
    return { label: '', subtitle: '' };
  }

  function isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  /** Get agent initials from name */
  function getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  /** Lookup agent by ID from loaded agents array */
  function findAgentById(agentId: string | undefined): any | null {
    if (!agentId || agents.length === 0) return null;
    return agents.find((a: any) => a.id === agentId) ?? null;
  }

  // Color palette for agent initials badges
  const AGENT_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'];
  function agentColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
  }

  const prefix = $derived($page.params.companyPrefix);
</script>

<div class="dashboard-root min-h-screen space-y-8 p-6">
  <!-- ── Active Agents Panel (top) ─────────────────────────────────── -->
  {#if companyId}
    <ActiveAgentsPanel companyId={companyId ?? ''} prefix={prefix ?? ''} />
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

  <!-- ── Top Widget Cards (4-column) ────────────────────────────────── -->
  <div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">

    <!-- Widget 1: Agents Enabled -->
    <a href="/{prefix}/agents" class="dash-card dash-card--emerald group no-underline block">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
            <Bot size={14} color="#10b981" />
          </div>
          <h3 class="dash-section-header !mb-0">Agents Enabled</h3>
        </div>
        <span class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted]">
          View all
        </span>
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
          <p class="text-3xl font-bold tabular-nums text-[--dash-text]">{enabledAgents}</p>
          <span class="text-sm text-[--dash-muted]">/ {agents.length}</span>
          <span class="ml-auto dash-trend dash-trend--up">
            <svg width="24" height="12" viewBox="0 0 24 12"><polyline points="0,8 6,6 12,4 18,5 24,2" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
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
    </a>

    <!-- Widget 2: Tasks In Progress -->
    <a href="/{prefix}/issues" class="dash-card dash-card--blue group no-underline block">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-[--dash-primary]/10">
            <ListTodo size={14} color="var(--dash-primary)" />
          </div>
          <h3 class="dash-section-header !mb-0">Tasks In Progress</h3>
        </div>
        <span class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted]">
          View all
        </span>
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
        <div class="mt-3 flex items-baseline gap-2">
          <p class="text-3xl font-bold tabular-nums text-[--dash-text]">{tasksInProgress}</p>
          <span class="ml-auto dash-trend">
            <svg width="24" height="12" viewBox="0 0 24 12"><polyline points="0,6 6,7 12,5 18,4 24,3" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
        <p class="text-xs text-[--dash-muted]">{openIssues} open, {blockedIssues} blocked</p>

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
    </a>

    <!-- Widget 3: Month Spend -->
    <a href="/{prefix}/costs" class="dash-card dash-card--amber group no-underline block">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Wallet size={14} color="#f59e0b" />
          </div>
          <h3 class="dash-section-header !mb-0">Month Spend</h3>
        </div>
        <span class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted]">
          View all
        </span>
      </div>

      {#if loading}
        <div class="mt-4 space-y-3">
          <Skeleton class="h-8 w-24 bg-white/5" />
          <Skeleton class="h-2.5 w-full bg-white/5" />
          <Skeleton class="h-3 w-32 bg-white/5" />
        </div>
      {:else}
        <div class="mt-3 flex items-baseline gap-2">
          <p class="text-3xl font-bold tabular-nums text-[--dash-text]">{formatCurrency(monthSpend)}</p>
          <span class="ml-auto dash-trend">
            <svg width="24" height="12" viewBox="0 0 24 12"><polyline points="0,9 6,7 12,6 18,5 24,4" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
        <p class="text-xs text-[--dash-muted]">{budgetStatusText}</p>

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
    </a>

    <!-- Widget 4: Pending Approvals -->
    <a href="/{prefix}/approvals" class="dash-card dash-card--purple group no-underline block">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
            <ShieldCheck size={14} color="#8b5cf6" />
          </div>
          <h3 class="dash-section-header !mb-0">Pending Approvals</h3>
        </div>
        <span class="opacity-0 transition-opacity group-hover:opacity-60 text-xs text-[--dash-muted]">
          View all
        </span>
      </div>

      {#if loading}
        <div class="mt-4 space-y-3">
          <Skeleton class="h-8 w-16 bg-white/5" />
          <Skeleton class="h-3 w-24 bg-white/5" />
        </div>
      {:else}
        <div class="mt-3">
          <p class="text-3xl font-bold tabular-nums text-[--dash-text]">{pendingApprovals}</p>
          <p class="text-xs text-[--dash-muted]">Awaiting board review</p>
        </div>

        <!-- Approval status indicator -->
        <div class="mt-4">
          {#if pendingApprovals > 0}
            <span
              class="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/20 bg-purple-500/[0.08] px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/[0.15]"
            >
              <ShieldCheck size={12} />
              Review now
              <ArrowRight size={10} />
            </span>
          {:else}
            <div class="flex items-center gap-1.5 text-[11px] text-[--dash-muted]">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              All clear — no pending approvals
            </div>
          {/if}
        </div>
      {/if}
    </a>
  </div>

  <!-- ── Activity Charts ────────────────────────────────────────────── -->
  {#if companyId}
    <ActivityCharts {companyId} />
  {/if}

  <!-- ── Recent Activity & Recent Tasks (2-column) ────────────────── -->
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">

    <!-- Recent Activity -->
    <div class="dash-card !p-0">
      <div class="flex items-center justify-between border-b px-5 py-4" style="border-color: var(--dash-border);">
        <div class="flex items-center gap-2">
          <Activity size={14} color="var(--dash-primary)" />
          <h3 class="dash-section-header !mb-0">Recent Activity</h3>
        </div>
        <a href="/{prefix}/activity" class="dash-view-all group/va">
          View all <span class="dash-view-all-arrow">&rarr;</span>
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
              {@const actorDisplay = getActorDisplay(item)}
              {@const verb = parseActionVerb(item.action ?? item.description ?? item.message ?? '')}
              {@const entity = getEntityDisplay(item)}
              {@const actionType = item.action ?? ''}
              {@const activityBorderColor = actionType.includes('created') ? '#10b981' : actionType.includes('updated') || actionType.includes('changed') ? '#2563eb' : actionType.includes('deleted') ? '#ef4444' : 'transparent'}
              {@const activityHref = getActivityHref(item)}
              <a
                href={activityHref || `/${prefix}/activity`}
                class="dash-activity-item flex items-start gap-3 py-2.5 no-underline"
                style="--activity-border-color: {activityBorderColor};"
              >
                <div
                  class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style="background-color: rgba(255,255,255,0.06);"
                >
                  {#if item.agentAvatar ?? item.actorAvatar}
                    <img
                      src={item.agentAvatar ?? item.actorAvatar}
                      alt={actorDisplay}
                      class="h-7 w-7 rounded-full object-cover"
                    />
                  {:else}
                    <IconComp size={13} color="var(--dash-muted)" />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs leading-snug text-[--dash-text]">
                    <span class="font-semibold text-[--dash-primary]">{actorDisplay}</span>
                    {' '}<span class="text-[--dash-muted]">{verb}</span>
                    {#if entity.label || entity.subtitle}
                      {' '}<strong class="font-semibold text-[--dash-text]">{entity.label}{#if entity.label && entity.subtitle} &mdash; {/if}{entity.subtitle}</strong>
                    {/if}
                  </p>
                  <TimeAgo date={item.createdAt ?? item.timestamp ?? item.date} class="text-[10px] text-[--dash-muted]" />
                </div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Recent Tasks -->
    <div class="dash-card !p-0">
      <div class="flex items-center justify-between border-b px-5 py-4" style="border-color: var(--dash-border);">
        <div class="flex items-center gap-2">
          <ListTodo size={14} color="var(--dash-primary)" />
          <h3 class="dash-section-header !mb-0">Recent Tasks</h3>
        </div>
        <a href="/{prefix}/issues" class="dash-view-all group/va">
          View all <span class="dash-view-all-arrow">&rarr;</span>
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
              {@const normalizedStatus = normalizeIssueStatus(issue.status)}
              {@const statusColor = STATUS_CONFIG.find((s) => s.key === normalizedStatus)?.color ?? '#64748b'}
              {@const identifier = issue.identifier ?? issue.slug ?? (issue.number ? `#${issue.number}` : '')}
              {@const assignedAgent = findAgentById(issue.assigneeAgentId) ?? (issue.agentName ? { name: issue.agentName } : null)}
              {@const agentName = assignedAgent?.name ?? issue.assigneeName ?? issue.agent?.name ?? ''}
              <a
                href="/{prefix}/issues/{issue.id}"
                class="flex items-center gap-2 py-2.5 transition-colors hover:bg-accent/25 -mx-2 px-2 rounded"
              >
                <!-- Status dot -->
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  style="background-color: {statusColor};"
                  title={normalizedStatus}
                ></span>

                <!-- Identifier -->
                {#if identifier}
                  <span class="shrink-0 font-mono text-[10px] font-semibold text-[--dash-muted]">
                    {identifier}
                  </span>
                {/if}

                <!-- Agent initials badge + name -->
                {#if agentName}
                  <div
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white/10"
                    style="background-color: {agentColor(agentName)};"
                    title={agentName}
                  >
                    {getInitials(agentName)}
                  </div>
                  <span class="shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-[--dash-muted] max-w-[70px] truncate">
                    {agentName}
                  </span>
                {:else if issue.assigneeAvatar ?? issue.agentAvatar}
                  <img
                    src={issue.assigneeAvatar ?? issue.agentAvatar}
                    alt="Agent"
                    class="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                {:else}
                  <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style="background-color: rgba(255,255,255,0.06);">
                    <Bot size={10} color="var(--dash-muted)" />
                  </div>
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
    --dash-card: rgba(18, 18, 24, 0.8);
    --dash-card-solid: #121218;
    --dash-border: rgba(255, 255, 255, 0.08);
    --dash-primary: #2563EB;
    --dash-text: #F8FAFC;
    --dash-muted: #94A3B8;

    background-color: var(--dash-bg);
  }

  :global(:root:not(.dark)) .dashboard-root {
    --dash-bg: #F9FAFB;
    --dash-card: rgba(255, 255, 255, 0.85);
    --dash-card-solid: #FFFFFF;
    --dash-border: rgba(0, 0, 0, 0.08);
    --dash-primary: #2563EB;
    --dash-text: #111827;
    --dash-muted: #6B7280;
  }

  /* ── Glassmorphism Card Base ─────────────────────────────────────── */
  .dash-card {
    background-color: var(--dash-card);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--dash-border);
    border-radius: 0.85rem;
    padding: 1.25rem;
    transition: all 0.2s ease;
    position: relative;
    overflow: hidden;
  }
  .dash-card:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    border-color: rgba(255, 255, 255, 0.14);
  }
  :global(:root:not(.dark)) .dash-card:hover {
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    border-color: rgba(0, 0, 0, 0.12);
  }

  /* ── Accent gradient top lines per card variant ──────────────────── */
  .dash-card--blue::before,
  .dash-card--emerald::before,
  .dash-card--amber::before,
  .dash-card--purple::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    border-radius: 0.85rem 0.85rem 0 0;
  }
  .dash-card--blue::before {
    background: linear-gradient(90deg, #2563eb, #3b82f6, transparent);
  }
  .dash-card--emerald::before {
    background: linear-gradient(90deg, #10b981, #34d399, transparent);
  }
  .dash-card--amber::before {
    background: linear-gradient(90deg, #f59e0b, #fbbf24, transparent);
  }
  .dash-card--purple::before {
    background: linear-gradient(90deg, #8b5cf6, #a78bfa, transparent);
  }

  /* Hover border glow per variant */
  .dash-card--blue:hover {
    border-color: rgba(37, 99, 235, 0.3);
    box-shadow: 0 4px 24px rgba(37, 99, 235, 0.08);
  }
  .dash-card--emerald:hover {
    border-color: rgba(16, 185, 129, 0.3);
    box-shadow: 0 4px 24px rgba(16, 185, 129, 0.08);
  }
  .dash-card--amber:hover {
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 4px 24px rgba(245, 158, 11, 0.08);
  }
  .dash-card--purple:hover {
    border-color: rgba(139, 92, 246, 0.3);
    box-shadow: 0 4px 24px rgba(139, 92, 246, 0.08);
  }

  /* ── Section Headers ─────────────────────────────────────────────── */
  .dash-section-header {
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--dash-muted);
    margin-bottom: 0;
  }

  /* ── Sparkline trend indicators ──────────────────────────────────── */
  .dash-trend {
    display: inline-flex;
    align-items: center;
    opacity: 0.7;
  }

  /* ── View All link with arrow animation ──────────────────────────── */
  .dash-view-all {
    font-size: 0.69rem;
    font-weight: 500;
    color: var(--dash-primary);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    transition: color 0.15s ease;
  }
  .dash-view-all:hover {
    text-decoration: underline;
  }
  .dash-view-all-arrow {
    display: inline-block;
    transition: transform 0.2s ease;
  }
  .dash-view-all:hover .dash-view-all-arrow {
    transform: translateX(3px);
  }

  /* ── Activity items left border ──────────────────────────────────── */
  .dash-activity-item {
    border-left: 2px solid var(--activity-border-color, transparent);
    padding-left: 0.5rem;
    margin-left: -0.5rem;
    border-radius: 0 0.25rem 0.25rem 0;
    transition: background-color 0.15s ease;
  }
  .dash-activity-item:hover {
    background-color: rgba(255, 255, 255, 0.02);
  }
  :global(:root:not(.dark)) .dash-activity-item:hover {
    background-color: rgba(0, 0, 0, 0.02);
  }
</style>
