<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    Inbox as InboxIcon, AlertTriangle, XCircle, X, RotateCcw,
    UserPlus, ChevronRight, Loader2, CheckCheck, Radio
  } from 'lucide-svelte';
  import SwipeToArchive from '$lib/components/swipe-to-archive.svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';

  // ---------------------------------------------------------------------------
  // Constants (ported from React inbox.ts)
  // ---------------------------------------------------------------------------
  const RECENT_ISSUES_LIMIT = 100;
  const FAILED_RUN_STATUSES = new Set(['failed', 'timed_out']);
  const ACTIONABLE_APPROVAL_STATUSES = new Set(['pending', 'revision_requested']);
  const DISMISSED_KEY = 'clawdev:inbox:dismissed';
  const READ_ITEMS_KEY = 'clawdev:inbox:read-items';
  const INBOX_LAST_TAB_KEY = 'clawdev:inbox:last-tab';
  const INBOX_ISSUE_STATUSES = 'backlog,todo,in_progress,in_review,blocked,done';

  type InboxTab = 'mine' | 'recent' | 'unread' | 'all';
  type InboxApprovalFilter = 'all' | 'actionable' | 'resolved';
  type InboxCategoryFilter =
    | 'everything'
    | 'issues_i_touched'
    | 'join_requests'
    | 'approvals'
    | 'failed_runs'
    | 'alerts';

  interface InboxWorkItem {
    kind: 'issue' | 'approval' | 'failed_run' | 'join_request';
    timestamp: number;
    issue?: any;
    approval?: any;
    run?: any;
    joinRequest?: any;
  }

  // ---------------------------------------------------------------------------
  // Breadcrumb
  // ---------------------------------------------------------------------------
  onMount(() => breadcrumbStore.set([{ label: 'Inbox' }]));

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let prefix = $derived($page.params.companyPrefix);
  let companyId = $derived(companyStore.selectedCompany?.id);

  let activeTab = $state<InboxTab>(loadLastInboxTab());
  let allCategoryFilter = $state<InboxCategoryFilter>('everything');
  let allApprovalFilter = $state<InboxApprovalFilter>('all');

  // Loading states
  let loadingIssuesMine = $state(true);
  let loadingIssuesTouched = $state(true);
  let loadingIssuesAll = $state(true);
  let loadingApprovals = $state(true);
  let loadingHeartbeats = $state(true);
  let loadingDashboard = $state(true);
  let loadingAgents = $state(true);
  let loadingJoinRequests = $state(true);

  let allLoaded = $derived(
    !loadingIssuesMine &&
    !loadingIssuesTouched &&
    !loadingApprovals &&
    !loadingHeartbeats &&
    !loadingDashboard &&
    !loadingAgents &&
    !loadingJoinRequests
  );

  // Data
  let mineIssuesRaw = $state<any[]>([]);
  let touchedIssuesRaw = $state<any[]>([]);
  let allIssuesRaw = $state<any[]>([]);
  let approvals = $state<any[]>([]);
  let heartbeatRuns = $state<any[]>([]);
  let dashboard = $state<any>(null);
  let agents = $state<any[]>([]);
  let joinRequests = $state<any[]>([]);

  // Action states
  let retryingRunIds = $state<Set<string>>(new Set());
  let fadingOutIssues = $state<Set<string>>(new Set());
  let archivingIssueIds = $state<Set<string>>(new Set());
  let fadingNonIssueItems = $state<Set<string>>(new Set());
  let archivingNonIssueIds = $state<Set<string>>(new Set());
  let actionError = $state<string | null>(null);
  let approvePending = $state(false);
  let rejectPending = $state(false);
  let markAllReadPending = $state(false);
  let approveJoinPending = $state(false);
  let rejectJoinPending = $state(false);

  // localStorage-backed dismissed + read
  let dismissed = $state<Set<string>>(loadDismissedItems());
  let readItems = $state<Set<string>>(loadReadItems());

  // ---------------------------------------------------------------------------
  // localStorage helpers (ported from inbox.ts)
  // ---------------------------------------------------------------------------
  function loadDismissedItems(): Set<string> {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }

  function saveDismissedItems(ids: Set<string>) {
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids])); }
    catch { /* ignore */ }
  }

  function loadReadItems(): Set<string> {
    try {
      const raw = localStorage.getItem(READ_ITEMS_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  }

  function saveReadItems(ids: Set<string>) {
    try { localStorage.setItem(READ_ITEMS_KEY, JSON.stringify([...ids])); }
    catch { /* ignore */ }
  }

  function loadLastInboxTab(): InboxTab {
    try {
      const raw = localStorage.getItem(INBOX_LAST_TAB_KEY);
      if (raw === 'all' || raw === 'unread' || raw === 'recent' || raw === 'mine') return raw;
      return 'mine';
    } catch { return 'mine'; }
  }

  function saveLastInboxTab(tab: InboxTab) {
    try { localStorage.setItem(INBOX_LAST_TAB_KEY, tab); }
    catch { /* ignore */ }
  }

  function dismiss(key: string) {
    const next = new Set(dismissed);
    next.add(key);
    dismissed = next;
    saveDismissedItems(next);
  }

  function markItemRead(key: string) {
    const next = new Set(readItems);
    next.add(key);
    readItems = next;
    saveReadItems(next);
  }

  // ---------------------------------------------------------------------------
  // Inbox logic helpers (ported from inbox.ts)
  // ---------------------------------------------------------------------------
  function normalizeTimestamp(value: string | Date | null | undefined): number {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function issueLastActivityTimestamp(issue: any): number {
    const lastComment = normalizeTimestamp(issue.lastExternalCommentAt);
    if (lastComment > 0) return lastComment;
    const updated = normalizeTimestamp(issue.updatedAt);
    const myTouch = normalizeTimestamp(issue.myLastTouchAt);
    if (myTouch > 0 && updated <= myTouch) return 0;
    return updated;
  }

  function sortIssuesByMostRecentActivity(a: any, b: any): number {
    const diff = issueLastActivityTimestamp(b) - issueLastActivityTimestamp(a);
    if (diff !== 0) return diff;
    return normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt);
  }

  function getRecentTouchedIssues(issues: any[]): any[] {
    return [...issues].sort(sortIssuesByMostRecentActivity).slice(0, RECENT_ISSUES_LIMIT);
  }

  function getLatestFailedRunsByAgent(runs: any[]): any[] {
    const sorted = [...runs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    const latestByAgent = new Map<string, any>();
    for (const run of sorted) {
      if (!latestByAgent.has(run.agentId)) {
        latestByAgent.set(run.agentId, run);
      }
    }
    return Array.from(latestByAgent.values()).filter((run) => FAILED_RUN_STATUSES.has(run.status));
  }

  function approvalActivityTimestamp(approval: any): number {
    const updated = normalizeTimestamp(approval.updatedAt);
    if (updated > 0) return updated;
    return normalizeTimestamp(approval.createdAt);
  }

  function getApprovalsForTab(approvalsList: any[], tab: InboxTab, filter: InboxApprovalFilter): any[] {
    const sorted = [...approvalsList].sort(
      (a, b) => normalizeTimestamp(b.updatedAt) - normalizeTimestamp(a.updatedAt),
    );
    if (tab === 'mine' || tab === 'recent') return sorted;
    if (tab === 'unread') return sorted.filter((a) => ACTIONABLE_APPROVAL_STATUSES.has(a.status));
    if (filter === 'all') return sorted;
    return sorted.filter((a) => {
      const isActionable = ACTIONABLE_APPROVAL_STATUSES.has(a.status);
      return filter === 'actionable' ? isActionable : !isActionable;
    });
  }

  function getInboxWorkItems(params: {
    issues: any[];
    approvals: any[];
    failedRuns?: any[];
    joinRequests?: any[];
  }): InboxWorkItem[] {
    const { issues, approvals: apprs, failedRuns = [], joinRequests: jrs = [] } = params;
    const items: InboxWorkItem[] = [
      ...issues.map((issue: any) => ({ kind: 'issue' as const, timestamp: issueLastActivityTimestamp(issue), issue })),
      ...apprs.map((approval: any) => ({ kind: 'approval' as const, timestamp: approvalActivityTimestamp(approval), approval })),
      ...failedRuns.map((run: any) => ({ kind: 'failed_run' as const, timestamp: normalizeTimestamp(run.createdAt), run })),
      ...jrs.map((jr: any) => ({ kind: 'join_request' as const, timestamp: normalizeTimestamp(jr.createdAt), joinRequest: jr })),
    ];
    return items.sort((a, b) => {
      const diff = b.timestamp - a.timestamp;
      if (diff !== 0) return diff;
      if (a.kind === 'issue' && b.kind === 'issue') return sortIssuesByMostRecentActivity(a.issue, b.issue);
      if (a.kind === 'approval' && b.kind === 'approval') return approvalActivityTimestamp(b.approval) - approvalActivityTimestamp(a.approval);
      return a.kind === 'approval' ? -1 : 1;
    });
  }

  function firstNonEmptyLine(value: string | null | undefined): string | null {
    if (!value) return null;
    const line = value.split('\n').map((c: string) => c.trim()).find(Boolean);
    return line ?? null;
  }

  function runFailureMessage(run: any): string {
    return firstNonEmptyLine(run.error) ?? firstNonEmptyLine(run.stderrExcerpt) ?? 'Run exited with an error.';
  }

  function readIssueIdFromRun(run: any): string | null {
    const context = run.contextSnapshot;
    if (!context) return null;
    if (typeof context.issueId === 'string' && context.issueId) return context.issueId;
    if (typeof context.taskId === 'string' && context.taskId) return context.taskId;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Time formatting
  // ---------------------------------------------------------------------------
  function timeAgo(date: string | undefined | null): string {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  // ---------------------------------------------------------------------------
  // Derived data (ported from React useMemo)
  // ---------------------------------------------------------------------------
  let mineIssues = $derived(getRecentTouchedIssues(mineIssuesRaw));
  let touchedIssues = $derived(getRecentTouchedIssues(touchedIssuesRaw));
  let unreadTouchedIssues = $derived(touchedIssues.filter((issue: any) => issue.isUnreadForMe));

  let issuesToRender = $derived.by(() => {
    if (activeTab === 'mine') return mineIssues;
    if (activeTab === 'unread') return unreadTouchedIssues;
    return touchedIssues;
  });

  let agentById = $derived.by(() => {
    const map = new Map<string, string>();
    for (const agent of agents) map.set(agent.id, agent.name);
    return map;
  });

  let issueById = $derived.by(() => {
    const map = new Map<string, any>();
    for (const issue of allIssuesRaw) map.set(issue.id, issue);
    return map;
  });

  let failedRuns = $derived(
    getLatestFailedRunsByAgent(heartbeatRuns).filter((r: any) => !dismissed.has(`run:${r.id}`))
  );

  let liveIssueIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const run of heartbeatRuns) {
      if (run.status !== 'running' && run.status !== 'queued') continue;
      const issueId = readIssueIdFromRun(run);
      if (issueId) ids.add(issueId);
    }
    return ids;
  });

  let approvalsToRender = $derived.by(() => {
    let filtered = getApprovalsForTab(approvals, activeTab, allApprovalFilter);
    if (activeTab === 'mine') {
      filtered = filtered.filter((a: any) => !dismissed.has(`approval:${a.id}`));
    }
    return filtered;
  });

  let showJoinRequestsCategory = $derived(allCategoryFilter === 'everything' || allCategoryFilter === 'join_requests');
  let showTouchedCategory = $derived(allCategoryFilter === 'everything' || allCategoryFilter === 'issues_i_touched');
  let showApprovalsCategory = $derived(allCategoryFilter === 'everything' || allCategoryFilter === 'approvals');
  let showFailedRunsCategory = $derived(allCategoryFilter === 'everything' || allCategoryFilter === 'failed_runs');
  let showAlertsCategory = $derived(allCategoryFilter === 'everything' || allCategoryFilter === 'alerts');

  let failedRunsForTab = $derived.by(() => {
    if (activeTab === 'all' && !showFailedRunsCategory) return [];
    return failedRuns;
  });

  let joinRequestsForTab = $derived.by(() => {
    if (activeTab === 'all' && !showJoinRequestsCategory) return [];
    if (activeTab === 'mine') return joinRequests.filter((jr: any) => !dismissed.has(`join:${jr.id}`));
    return joinRequests;
  });

  let workItemsToRender = $derived(
    getInboxWorkItems({
      issues: activeTab === 'all' && !showTouchedCategory ? [] : issuesToRender,
      approvals: activeTab === 'all' && !showApprovalsCategory ? [] : approvalsToRender,
      failedRuns: failedRunsForTab,
      joinRequests: joinRequestsForTab,
    })
  );

  // Alert state
  let hasRunFailures = $derived(failedRuns.length > 0);
  let showAggregateAgentError = $derived(
    !!dashboard && dashboard.agents?.error > 0 && !hasRunFailures && !dismissed.has('alert:agent-errors')
  );
  let showBudgetAlert = $derived(
    !!dashboard &&
    dashboard.costs?.monthBudgetCents > 0 &&
    dashboard.costs?.monthUtilizationPercent >= 80 &&
    !dismissed.has('alert:budget')
  );
  let hasAlerts = $derived(showAggregateAgentError || showBudgetAlert);
  let showWorkItemsSection = $derived(workItemsToRender.length > 0);
  let showAlertsSection = $derived.by(() => {
    if (!hasAlerts) return false;
    if (activeTab === 'all') return showAlertsCategory && hasAlerts;
    return hasAlerts;
  });

  // Mark all read
  let markAllReadIssues = $derived.by(() => {
    const source = activeTab === 'mine' ? mineIssues : unreadTouchedIssues;
    return source.filter((issue: any) =>
      issue.isUnreadForMe && !fadingOutIssues.has(issue.id) && !archivingIssueIds.has(issue.id)
    );
  });
  let canMarkAllRead = $derived(markAllReadIssues.length > 0);

  let hasAnySections = $derived(showWorkItemsSection || showAlertsSection);

  // ---------------------------------------------------------------------------
  // Tab management
  // ---------------------------------------------------------------------------
  const tabs: { key: InboxTab; label: string }[] = [
    { key: 'mine', label: 'Mine' },
    { key: 'recent', label: 'Recent' },
    { key: 'unread', label: 'Unread' },
    { key: 'all', label: 'All' },
  ];

  function switchTab(tab: InboxTab) {
    activeTab = tab;
    saveLastInboxTab(tab);
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    const cid = companyId;
    if (!cid) return;

    // Fetch mine issues (touchedByUserId=me + inboxArchivedByUserId=me)
    loadingIssuesMine = true;
    api(`/api/companies/${cid}/issues?touchedByUserId=me&inboxArchivedByUserId=me&status=${INBOX_ISSUE_STATUSES}`)
      .then(async (r) => { if (r.ok) mineIssuesRaw = await r.json(); })
      .catch(() => { mineIssuesRaw = []; })
      .finally(() => { loadingIssuesMine = false; });

    // Fetch touched issues (touchedByUserId=me)
    loadingIssuesTouched = true;
    api(`/api/companies/${cid}/issues?touchedByUserId=me&status=${INBOX_ISSUE_STATUSES}`)
      .then(async (r) => { if (r.ok) touchedIssuesRaw = await r.json(); })
      .catch(() => { touchedIssuesRaw = []; })
      .finally(() => { loadingIssuesTouched = false; });

    // Fetch all issues (for issueById map used by failed runs)
    loadingIssuesAll = true;
    api(`/api/companies/${cid}/issues`)
      .then(async (r) => { if (r.ok) allIssuesRaw = await r.json(); })
      .catch(() => { allIssuesRaw = []; })
      .finally(() => { loadingIssuesAll = false; });

    // Fetch approvals
    loadingApprovals = true;
    api(`/api/companies/${cid}/approvals`)
      .then(async (r) => { if (r.ok) approvals = await r.json(); })
      .catch(() => { approvals = []; })
      .finally(() => { loadingApprovals = false; });

    // Fetch heartbeat runs
    loadingHeartbeats = true;
    api(`/api/companies/${cid}/heartbeat-runs`)
      .then(async (r) => { if (r.ok) heartbeatRuns = await r.json(); })
      .catch(() => { heartbeatRuns = []; })
      .finally(() => { loadingHeartbeats = false; });

    // Fetch dashboard
    loadingDashboard = true;
    api(`/api/companies/${cid}/dashboard`)
      .then(async (r) => { if (r.ok) dashboard = await r.json(); })
      .catch(() => { dashboard = null; })
      .finally(() => { loadingDashboard = false; });

    // Fetch agents
    loadingAgents = true;
    api(`/api/companies/${cid}/agents`)
      .then(async (r) => { if (r.ok) agents = await r.json(); })
      .catch(() => { agents = []; })
      .finally(() => { loadingAgents = false; });

    // Fetch join requests
    loadingJoinRequests = true;
    api(`/api/companies/${cid}/join-requests?status=pending_approval`)
      .then(async (r) => {
        if (r.ok) joinRequests = await r.json();
        else if (r.status === 403 || r.status === 401) joinRequests = [];
      })
      .catch(() => { joinRequests = []; })
      .finally(() => { loadingJoinRequests = false; });
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function getAgentName(id: string | null): string | null {
    if (!id) return null;
    return agentById.get(id) ?? null;
  }

  function approvalLabel(approval: any): string {
    const type = approval.type ?? '';
    const payload = approval.payload as Record<string, unknown> | null;
    if (type === 'hire_agent') {
      const name = payload?.agentName ?? payload?.name ?? 'Agent';
      return `Hire Agent: ${name}`;
    }
    if (type === 'budget_override_required') return 'Budget Override Required';
    if (type === 'skill_install') return `Install Skill: ${payload?.skillName ?? 'unknown'}`;
    return approval.title ?? (type.replace(/_/g, ' ') || 'Approval');
  }

  async function handleApproveApproval(approvalId: string) {
    approvePending = true;
    actionError = null;
    try {
      const res = await api(`/api/approvals/${approvalId}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      goto(`/${prefix}/approvals/${approvalId}?resolved=approved`);
    } catch (err: any) {
      actionError = err.message ?? 'Failed to approve';
    } finally {
      approvePending = false;
    }
  }

  async function handleRejectApproval(approvalId: string) {
    rejectPending = true;
    actionError = null;
    try {
      const res = await api(`/api/approvals/${approvalId}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh approvals
      if (companyId) {
        const r = await api(`/api/companies/${companyId}/approvals`);
        if (r.ok) approvals = await r.json();
      }
    } catch (err: any) {
      actionError = err.message ?? 'Failed to reject';
    } finally {
      rejectPending = false;
    }
  }

  async function handleApproveJoin(jr: any) {
    approveJoinPending = true;
    actionError = null;
    try {
      const res = await api(`/api/companies/${jr.companyId ?? companyId}/join-requests/${jr.id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh join requests
      if (companyId) {
        const r = await api(`/api/companies/${companyId}/join-requests?status=pending_approval`);
        if (r.ok) joinRequests = await r.json();
      }
      toastStore.push({ title: 'Join request approved', tone: 'success' });
    } catch (err: any) {
      actionError = err.message ?? 'Failed to approve join request';
    } finally {
      approveJoinPending = false;
    }
  }

  async function handleRejectJoin(jr: any) {
    rejectJoinPending = true;
    actionError = null;
    try {
      const res = await api(`/api/companies/${jr.companyId ?? companyId}/join-requests/${jr.id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (companyId) {
        const r = await api(`/api/companies/${companyId}/join-requests?status=pending_approval`);
        if (r.ok) joinRequests = await r.json();
      }
      toastStore.push({ title: 'Join request rejected', tone: 'success' });
    } catch (err: any) {
      actionError = err.message ?? 'Failed to reject join request';
    } finally {
      rejectJoinPending = false;
    }
  }

  async function handleRetryRun(run: any) {
    const next = new Set(retryingRunIds);
    next.add(run.id);
    retryingRunIds = next;
    try {
      const payload: Record<string, unknown> = { source: 'on_demand', triggerDetail: 'manual', reason: 'retry_failed_run' };
      const context = run.contextSnapshot as Record<string, unknown> | null;
      if (context) {
        const inner: Record<string, unknown> = {};
        if (typeof context.issueId === 'string' && context.issueId) inner.issueId = context.issueId;
        if (typeof context.taskId === 'string' && context.taskId) inner.taskId = context.taskId;
        if (typeof context.taskKey === 'string' && context.taskKey) inner.taskKey = context.taskKey;
        if (Object.keys(inner).length > 0) payload.payload = inner;
      }
      const res = await api(`/api/agents/${run.agentId}/wakeup`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result && result.id) {
        goto(`/${prefix}/agents/${run.agentId}/runs/${result.id}`);
      } else {
        toastStore.push({ title: 'Retry was skipped', tone: 'warn' });
      }
    } catch (err: any) {
      toastStore.push({ title: err.message ?? 'Failed to retry run', tone: 'error' });
    } finally {
      const cleanup = new Set(retryingRunIds);
      cleanup.delete(run.id);
      retryingRunIds = cleanup;
    }
  }

  async function handleMarkIssueRead(issueId: string) {
    const nextFading = new Set(fadingOutIssues);
    nextFading.add(issueId);
    fadingOutIssues = nextFading;
    try {
      await api(`/api/issues/${issueId}/read`, { method: 'POST' });
      // Refresh issues
      if (companyId) {
        const [r1, r2] = await Promise.all([
          api(`/api/companies/${companyId}/issues?touchedByUserId=me&inboxArchivedByUserId=me&status=${INBOX_ISSUE_STATUSES}`),
          api(`/api/companies/${companyId}/issues?touchedByUserId=me&status=${INBOX_ISSUE_STATUSES}`),
        ]);
        if (r1.ok) mineIssuesRaw = await r1.json();
        if (r2.ok) touchedIssuesRaw = await r2.json();
      }
    } catch { /* ignore */ }
    setTimeout(() => {
      const cleanup = new Set(fadingOutIssues);
      cleanup.delete(issueId);
      fadingOutIssues = cleanup;
    }, 300);
  }

  async function handleArchiveIssue(issueId: string) {
    const next = new Set(archivingIssueIds);
    next.add(issueId);
    archivingIssueIds = next;
    actionError = null;
    try {
      const res = await api(`/api/issues/${issueId}/inbox-archive`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh mine issues
      if (companyId) {
        const r = await api(`/api/companies/${companyId}/issues?touchedByUserId=me&inboxArchivedByUserId=me&status=${INBOX_ISSUE_STATUSES}`);
        if (r.ok) mineIssuesRaw = await r.json();
      }
    } catch (err: any) {
      actionError = err.message ?? 'Failed to archive issue';
    }
    setTimeout(() => {
      const cleanup = new Set(archivingIssueIds);
      cleanup.delete(issueId);
      archivingIssueIds = cleanup;
    }, 500);
  }

  async function handleMarkAllRead() {
    const issueIds = markAllReadIssues.map((i: any) => i.id);
    if (issueIds.length === 0) return;
    markAllReadPending = true;
    const nextFading = new Set(fadingOutIssues);
    for (const id of issueIds) nextFading.add(id);
    fadingOutIssues = nextFading;
    try {
      await Promise.all(issueIds.map((id: string) => api(`/api/issues/${id}/read`, { method: 'POST' })));
      if (companyId) {
        const [r1, r2] = await Promise.all([
          api(`/api/companies/${companyId}/issues?touchedByUserId=me&inboxArchivedByUserId=me&status=${INBOX_ISSUE_STATUSES}`),
          api(`/api/companies/${companyId}/issues?touchedByUserId=me&status=${INBOX_ISSUE_STATUSES}`),
        ]);
        if (r1.ok) mineIssuesRaw = await r1.json();
        if (r2.ok) touchedIssuesRaw = await r2.json();
      }
    } catch { /* ignore */ }
    setTimeout(() => {
      const cleanup = new Set(fadingOutIssues);
      for (const id of issueIds) cleanup.delete(id);
      fadingOutIssues = cleanup;
    }, 300);
    markAllReadPending = false;
  }

  function handleMarkNonIssueRead(key: string) {
    const next = new Set(fadingNonIssueItems);
    next.add(key);
    fadingNonIssueItems = next;
    markItemRead(key);
    setTimeout(() => {
      const cleanup = new Set(fadingNonIssueItems);
      cleanup.delete(key);
      fadingNonIssueItems = cleanup;
    }, 300);
  }

  function handleArchiveNonIssue(key: string) {
    const next = new Set(archivingNonIssueIds);
    next.add(key);
    archivingNonIssueIds = next;
    setTimeout(() => {
      dismiss(key);
      const cleanup = new Set(archivingNonIssueIds);
      cleanup.delete(key);
      archivingNonIssueIds = cleanup;
    }, 200);
  }

  function nonIssueUnreadState(key: string): 'visible' | 'fading' | 'hidden' | null {
    if (activeTab !== 'mine') return null;
    const isFading = fadingNonIssueItems.has(key);
    if (isFading) return 'fading';
    if (!readItems.has(key)) return 'visible';
    return 'hidden';
  }

  // ---------------------------------------------------------------------------
  // Issue status dot colors
  // ---------------------------------------------------------------------------
  const STATUS_DOT_COLORS: Record<string, string> = {
    backlog: 'bg-zinc-500',
    todo: 'bg-[#2563EB]',
    open: 'bg-[#2563EB]',
    in_progress: 'bg-[#F97316]',
    in_review: 'bg-purple-500',
    blocked: 'bg-[#EF4444]',
    done: 'bg-[#10A37F]',
    closed: 'bg-zinc-600',
    cancelled: 'bg-zinc-600',
  };

  function statusDotClass(status: string): string {
    return STATUS_DOT_COLORS[status] ?? 'bg-zinc-500';
  }

  // ---------------------------------------------------------------------------
  // Empty state messages
  // ---------------------------------------------------------------------------
  const emptyMessages: Record<string, { title: string; body: string }> = {
    mine: { title: 'Inbox zero.', body: 'Nothing assigned to you right now' },
    recent: { title: 'No recent inbox items.', body: 'Recent activity will show up here' },
    unread: { title: 'No new inbox items.', body: 'All caught up' },
    all: { title: 'No inbox items match these filters.', body: 'Try adjusting your filters' },
  };
</script>

<div class="space-y-6">
  <!-- Header with tabs and controls -->
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex flex-wrap items-center gap-2">
      <!-- Tab bar -->
      <div class="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
        {#each tabs as tab (tab.key)}
          <button
            onclick={() => switchTab(tab.key)}
            class="relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors
              {activeTab === tab.key
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}"
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Mark all read -->
      {#if canMarkAllRead}
        <button
          onclick={handleMarkAllRead}
          disabled={markAllReadPending}
          class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
        >
          {#if markAllReadPending}
            <Loader2 class="h-3.5 w-3.5 animate-spin" />
            Marking...
          {:else}
            <CheckCheck class="h-3.5 w-3.5" />
            Mark all as read
          {/if}
        </button>
      {/if}
    </div>

    <!-- Filters for "All" tab -->
    {#if activeTab === 'all'}
      <div class="flex flex-wrap items-center gap-2 sm:justify-end">
        <select
          bind:value={allCategoryFilter}
          class="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="everything">All categories</option>
          <option value="issues_i_touched">My recent issues</option>
          <option value="join_requests">Join requests</option>
          <option value="approvals">Approvals</option>
          <option value="failed_runs">Failed runs</option>
          <option value="alerts">Alerts</option>
        </select>

        {#if showApprovalsCategory}
          <select
            bind:value={allApprovalFilter}
            class="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">All approval statuses</option>
            <option value="actionable">Needs action</option>
            <option value="resolved">Resolved</option>
          </select>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Error banner -->
  {#if actionError}
    <p class="text-sm text-red-400">{actionError}</p>
  {/if}

  <!-- Loading skeleton -->
  {#if !allLoaded && !hasAnySections}
    <div class="space-y-1">
      {#each Array(8) as _}
        <div class="flex items-center gap-4 px-4 py-3">
          <div class="h-4 w-4 animate-pulse rounded-full bg-accent/60"></div>
          <div class="h-9 w-9 animate-pulse rounded-lg bg-accent/60"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-2/3 animate-pulse rounded bg-accent/60"></div>
            <div class="h-3 w-1/3 animate-pulse rounded bg-accent/60"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if allLoaded && !hasAnySections}
    <!-- Empty state -->
    {@const empty = emptyMessages[activeTab] ?? emptyMessages.all}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <InboxIcon class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">{empty.title}</h3>
      <p class="mt-1 text-sm text-muted-foreground">{empty.body}</p>
    </div>
  {:else}
    <!-- Work items section -->
    {#if showWorkItemsSection}
      <div class="overflow-hidden rounded-xl border border-border/50 bg-background">
        {#each workItemsToRender as item, i (`${item.kind}:${item.issue?.id ?? item.approval?.id ?? item.run?.id ?? item.joinRequest?.id ?? i}`)}
          {@const isMineTab = activeTab === 'mine'}

          <!-- ============================================================ -->
          <!-- ISSUE ROW                                                     -->
          <!-- ============================================================ -->
          {#if item.kind === 'issue'}
            {@const issue = item.issue}
            {@const isUnread = issue.isUnreadForMe && !fadingOutIssues.has(issue.id)}
            {@const isFading = fadingOutIssues.has(issue.id)}
            {@const isArchiving = archivingIssueIds.has(issue.id)}
            {@const archiveDisabled = isArchiving}
            {@const unreadState = isUnread ? 'visible' : isFading ? 'fading' : 'hidden'}

            {#if isMineTab}
              <SwipeToArchive onArchive={() => handleArchiveIssue(issue.id)}>
                <div
                  class="group flex w-full items-center gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:px-3
                    {isArchiving ? 'pointer-events-none -translate-x-4 scale-[0.98] opacity-0' : ''}"
                >
                  <!-- Unread dot / Archive button -->
                  <span class="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
                    {#if unreadState === 'visible' || unreadState === 'fading'}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleMarkIssueRead(issue.id); }}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-blue-500/20"
                        aria-label="Mark as read"
                      >
                        <span class="block h-2 w-2 rounded-full bg-blue-400 transition-opacity duration-300 {unreadState === 'fading' ? 'opacity-0' : 'opacity-100'}"></span>
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleArchiveIssue(issue.id); }}
                        disabled={archiveDisabled}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Dismiss from inbox"
                      >
                        <X class="h-3.5 w-3.5" />
                      </button>
                    {/if}
                  </span>

                  <a
                    href="/{prefix}/issues/{issue.id}"
                    class="flex min-w-0 flex-1 items-center gap-2 no-underline"
                  >
                    <!-- Status icon -->
                    <span class="hidden shrink-0 sm:inline-flex">
                      <span class="inline-flex h-3.5 w-3.5 items-center justify-center">
                        <span class="h-2.5 w-2.5 rounded-full {statusDotClass(issue.status ?? '')}"></span>
                      </span>
                    </span>
                    <!-- Identifier -->
                    <span class="shrink-0 font-mono text-xs text-muted-foreground">
                      {issue.identifier ?? issue.id?.slice(0, 8)}
                    </span>
                    <!-- Live badge -->
                    {#if liveIssueIds.has(issue.id)}
                      <span class="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5">
                        <span class="relative flex h-2 w-2">
                          <span class="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75"></span>
                          <span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                        </span>
                        <span class="hidden text-[11px] font-medium text-blue-400 sm:inline">Live</span>
                      </span>
                    {/if}
                    <!-- Title -->
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 text-sm text-foreground sm:truncate sm:line-clamp-none {isUnread ? 'font-semibold' : 'font-medium'}">
                        {issue.title ?? 'Issue'}
                      </span>
                    </span>
                    <!-- Time -->
                    <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {issue.lastExternalCommentAt ? `commented ${timeAgo(issue.lastExternalCommentAt)}` : `updated ${timeAgo(issue.updatedAt)}`}
                    </span>
                  </a>
                </div>
              </SwipeToArchive>
            {:else}
              <a
                href="/{prefix}/issues/{issue.id}"
                class="group flex w-full items-center gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:px-3 no-underline"
              >
                <span class="hidden h-4 w-4 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                <span class="hidden shrink-0 sm:inline-flex">
                  <span class="inline-flex h-3.5 w-3.5 items-center justify-center">
                    <span class="h-2.5 w-2.5 rounded-full {statusDotClass(issue.status ?? '')}"></span>
                  </span>
                </span>
                <span class="shrink-0 font-mono text-xs text-muted-foreground">
                  {issue.identifier ?? issue.id?.slice(0, 8)}
                </span>
                {#if liveIssueIds.has(issue.id)}
                  <span class="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5">
                    <span class="relative flex h-2 w-2">
                      <span class="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75"></span>
                      <span class="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
                    </span>
                    <span class="hidden text-[11px] font-medium text-blue-400 sm:inline">Live</span>
                  </span>
                {/if}
                <span class="min-w-0 flex-1">
                  <span class="line-clamp-2 text-sm text-foreground sm:truncate sm:line-clamp-none {issue.isUnreadForMe ? 'font-semibold' : 'font-medium'}">
                    {issue.title ?? 'Issue'}
                  </span>
                </span>
                <span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {issue.lastExternalCommentAt ? `commented ${timeAgo(issue.lastExternalCommentAt)}` : `updated ${timeAgo(issue.updatedAt)}`}
                </span>
              </a>
            {/if}

          <!-- ============================================================ -->
          <!-- APPROVAL ROW                                                  -->
          <!-- ============================================================ -->
          {:else if item.kind === 'approval'}
            {@const approval = item.approval}
            {@const approvalKey = `approval:${approval.id}`}
            {@const isArchiving = archivingNonIssueIds.has(approvalKey)}
            {@const uState = nonIssueUnreadState(approvalKey)}
            {@const showUnreadDot = uState === 'visible' || uState === 'fading'}
            {@const showResolution = approval.type !== 'budget_override_required' && ACTIONABLE_APPROVAL_STATUSES.has(approval.status)}

            {#if isMineTab}
              <SwipeToArchive onArchive={() => handleArchiveNonIssue(approvalKey)}>
                <div
                  class="group flex w-full items-start gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:items-center sm:px-3
                    {isArchiving ? 'pointer-events-none -translate-x-4 scale-[0.98] opacity-0' : ''}"
                >
                  <!-- Unread dot -->
                  <span class="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
                    {#if showUnreadDot}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleMarkNonIssueRead(approvalKey); }}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-blue-500/20"
                        aria-label="Mark as read"
                      >
                        <span class="block h-2 w-2 rounded-full bg-blue-400 transition-opacity duration-300 {uState === 'fading' ? 'opacity-0' : 'opacity-100'}"></span>
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleArchiveNonIssue(approvalKey); }}
                        disabled={isArchiving}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Dismiss from inbox"
                      >
                        <X class="h-3.5 w-3.5" />
                      </button>
                    {/if}
                  </span>

                  <a
                    href="/{prefix}/approvals/{approval.id}"
                    class="flex min-w-0 flex-1 items-start gap-2 no-underline sm:items-center"
                  >
                    <span class="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                    <span class="mt-0.5 shrink-0 rounded-md bg-accent/60 p-1.5 sm:mt-0">
                      <UserPlus class="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 text-sm font-medium text-foreground sm:truncate sm:line-clamp-none">
                        {approvalLabel(approval)}
                      </span>
                      <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span class="capitalize">{(approval.status ?? '').replace(/_/g, ' ')}</span>
                        {#if getAgentName(approval.requestedByAgentId)}
                          <span>requested by {getAgentName(approval.requestedByAgentId)}</span>
                        {/if}
                        <span>updated {timeAgo(approval.updatedAt)}</span>
                      </span>
                    </span>
                  </a>

                  {#if showResolution}
                    <div class="hidden shrink-0 items-center gap-2 sm:flex">
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); handleApproveApproval(approval.id); }}
                        disabled={approvePending || rejectPending}
                        class="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); handleRejectApproval(approval.id); }}
                        disabled={approvePending || rejectPending}
                        class="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  {/if}
                </div>
              </SwipeToArchive>
            {:else}
              <a
                href="/{prefix}/approvals/{approval.id}"
                class="group flex w-full items-start gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:items-center sm:px-3 no-underline"
              >
                <span class="hidden h-4 w-4 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                <span class="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                <span class="mt-0.5 shrink-0 rounded-md bg-accent/60 p-1.5 sm:mt-0">
                  <UserPlus class="h-4 w-4 text-muted-foreground" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="line-clamp-2 text-sm font-medium text-foreground sm:truncate sm:line-clamp-none">
                    {approvalLabel(approval)}
                  </span>
                  <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span class="capitalize">{(approval.status ?? '').replace(/_/g, ' ')}</span>
                    {#if getAgentName(approval.requestedByAgentId)}
                      <span>requested by {getAgentName(approval.requestedByAgentId)}</span>
                    {/if}
                    <span>updated {timeAgo(approval.updatedAt)}</span>
                  </span>
                </span>
                {#if approval.type !== 'budget_override_required' && ACTIONABLE_APPROVAL_STATUSES.has(approval.status)}
                  <div class="hidden shrink-0 items-center gap-2 sm:flex">
                    <button
                      type="button"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); handleApproveApproval(approval.id); }}
                      disabled={approvePending || rejectPending}
                      class="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); handleRejectApproval(approval.id); }}
                      disabled={approvePending || rejectPending}
                      class="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                {/if}
              </a>
            {/if}

          <!-- ============================================================ -->
          <!-- FAILED RUN ROW                                                -->
          <!-- ============================================================ -->
          {:else if item.kind === 'failed_run'}
            {@const run = item.run}
            {@const runKey = `run:${run.id}`}
            {@const isArchiving = archivingNonIssueIds.has(runKey)}
            {@const uState = nonIssueUnreadState(runKey)}
            {@const showUnreadDot = uState === 'visible' || uState === 'fading'}
            {@const linkedIssueId = readIssueIdFromRun(run)}
            {@const linkedIssue = linkedIssueId ? issueById.get(linkedIssueId) ?? null : null}
            {@const linkedAgentName = getAgentName(run.agentId)}
            {@const displayError = runFailureMessage(run)}

            {#if isMineTab}
              <SwipeToArchive onArchive={() => handleArchiveNonIssue(runKey)}>
                <div
                  class="group flex w-full items-start gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:items-center sm:px-3
                    {isArchiving ? 'pointer-events-none -translate-x-4 scale-[0.98] opacity-0' : ''}"
                >
                  <!-- Unread dot -->
                  <span class="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
                    {#if showUnreadDot}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleMarkNonIssueRead(runKey); }}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-blue-500/20"
                        aria-label="Mark as read"
                      >
                        <span class="block h-2 w-2 rounded-full bg-blue-400 transition-opacity duration-300 {uState === 'fading' ? 'opacity-0' : 'opacity-100'}"></span>
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleArchiveNonIssue(runKey); }}
                        disabled={isArchiving}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Dismiss"
                      >
                        <X class="h-3.5 w-3.5" />
                      </button>
                    {/if}
                  </span>

                  <a
                    href="/{prefix}/agents/{run.agentId}/runs/{run.id}"
                    class="flex min-w-0 flex-1 items-start gap-2 no-underline sm:items-center"
                  >
                    <span class="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                    <span class="mt-0.5 shrink-0 rounded-md bg-red-500/20 p-1.5 sm:mt-0">
                      <XCircle class="h-4 w-4 text-red-400" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 text-sm font-medium text-foreground sm:truncate sm:line-clamp-none">
                        {#if linkedIssue}
                          <span class="font-mono text-muted-foreground mr-1.5">{linkedIssue.identifier ?? linkedIssue.id?.slice(0, 8)}</span>
                          {linkedIssue.title}
                        {:else}
                          Failed run{linkedAgentName ? ` \u2014 ${linkedAgentName}` : ''}
                        {/if}
                      </span>
                      <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <StatusBadge status={run.status} />
                        {#if linkedAgentName && linkedIssue}
                          <span>{linkedAgentName}</span>
                        {/if}
                        <span class="truncate max-w-[300px]">{displayError}</span>
                        <span>{timeAgo(run.createdAt)}</span>
                      </span>
                    </span>
                  </a>

                  <div class="hidden shrink-0 items-center gap-2 sm:flex">
                    <button
                      type="button"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); handleRetryRun(run); }}
                      disabled={retryingRunIds.has(run.id)}
                      class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
                    >
                      {#if retryingRunIds.has(run.id)}
                        <Loader2 class="h-3.5 w-3.5 animate-spin" />
                        Retrying...
                      {:else}
                        <RotateCcw class="h-3.5 w-3.5" />
                        Retry
                      {/if}
                    </button>
                  </div>

                  <!-- Mobile retry -->
                  <div class="flex gap-2 sm:hidden mt-2">
                    <button
                      type="button"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); handleRetryRun(run); }}
                      disabled={retryingRunIds.has(run.id)}
                      class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
                    >
                      {#if retryingRunIds.has(run.id)}
                        <Loader2 class="h-3.5 w-3.5 animate-spin" />
                      {:else}
                        <RotateCcw class="h-3.5 w-3.5" />
                      {/if}
                      Retry
                    </button>
                  </div>
                </div>
              </SwipeToArchive>
            {:else}
              <div
                class="group flex w-full items-start gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:items-center sm:px-3"
              >
                <span class="hidden h-4 w-4 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                <a
                  href="/{prefix}/agents/{run.agentId}/runs/{run.id}"
                  class="flex min-w-0 flex-1 items-start gap-2 no-underline sm:items-center"
                >
                  <span class="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                  <span class="mt-0.5 shrink-0 rounded-md bg-red-500/20 p-1.5 sm:mt-0">
                    <XCircle class="h-4 w-4 text-red-400" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="line-clamp-2 text-sm font-medium text-foreground sm:truncate sm:line-clamp-none">
                      {#if linkedIssue}
                        <span class="font-mono text-muted-foreground mr-1.5">{linkedIssue.identifier ?? linkedIssue.id?.slice(0, 8)}</span>
                        {linkedIssue.title}
                      {:else}
                        Failed run{linkedAgentName ? ` \u2014 ${linkedAgentName}` : ''}
                      {/if}
                    </span>
                    <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <StatusBadge status={run.status} />
                      {#if linkedAgentName && linkedIssue}
                        <span>{linkedAgentName}</span>
                      {/if}
                      <span class="truncate max-w-[300px]">{displayError}</span>
                      <span>{timeAgo(run.createdAt)}</span>
                    </span>
                  </span>
                </a>
                <div class="hidden shrink-0 items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onclick={(e: MouseEvent) => { e.stopPropagation(); handleRetryRun(run); }}
                    disabled={retryingRunIds.has(run.id)}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
                  >
                    {#if retryingRunIds.has(run.id)}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                      Retrying...
                    {:else}
                      <RotateCcw class="h-3.5 w-3.5" />
                      Retry
                    {/if}
                  </button>
                  <button
                    type="button"
                    onclick={() => dismiss(runKey)}
                    class="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover:opacity-100"
                    aria-label="Dismiss"
                  >
                    <X class="h-4 w-4" />
                  </button>
                </div>
              </div>
            {/if}

          <!-- ============================================================ -->
          <!-- JOIN REQUEST ROW                                              -->
          <!-- ============================================================ -->
          {:else if item.kind === 'join_request'}
            {@const jr = item.joinRequest}
            {@const joinKey = `join:${jr.id}`}
            {@const isArchiving = archivingNonIssueIds.has(joinKey)}
            {@const uState = nonIssueUnreadState(joinKey)}
            {@const showUnreadDot = uState === 'visible' || uState === 'fading'}
            {@const joinLabel = jr.requestType === 'human' ? 'Human join request' : `Agent join request${jr.agentName ? `: ${jr.agentName}` : ''}`}

            {#if isMineTab}
              <SwipeToArchive onArchive={() => handleArchiveNonIssue(joinKey)}>
                <div
                  class="group flex w-full items-start gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:items-center sm:px-3
                    {isArchiving ? 'pointer-events-none -translate-x-4 scale-[0.98] opacity-0' : ''}"
                >
                  <span class="hidden sm:inline-flex h-4 w-4 shrink-0 items-center justify-center self-center">
                    {#if showUnreadDot}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleMarkNonIssueRead(joinKey); }}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-blue-500/20"
                        aria-label="Mark as read"
                      >
                        <span class="block h-2 w-2 rounded-full bg-blue-400 transition-opacity duration-300 {uState === 'fading' ? 'opacity-0' : 'opacity-100'}"></span>
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={(e: MouseEvent) => { e.stopPropagation(); handleArchiveNonIssue(joinKey); }}
                        disabled={isArchiving}
                        class="inline-flex h-4 w-4 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-30"
                        aria-label="Dismiss from inbox"
                      >
                        <X class="h-3.5 w-3.5" />
                      </button>
                    {/if}
                  </span>

                  <div class="flex min-w-0 flex-1 items-start gap-2">
                    <span class="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                    <span class="mt-0.5 shrink-0 rounded-md bg-accent/60 p-1.5 sm:mt-0">
                      <UserPlus class="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="line-clamp-2 text-sm font-medium text-foreground sm:truncate sm:line-clamp-none">
                        {joinLabel}
                      </span>
                      <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>requested {timeAgo(jr.createdAt)} from IP {jr.requestIp ?? 'unknown'}</span>
                        {#if jr.adapterType}
                          <span>adapter: {jr.adapterType}</span>
                        {/if}
                      </span>
                    </span>
                  </div>

                  <div class="hidden shrink-0 items-center gap-2 sm:flex">
                    <button
                      type="button"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); handleApproveJoin(jr); }}
                      disabled={approveJoinPending || rejectJoinPending}
                      class="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onclick={(e: MouseEvent) => { e.stopPropagation(); handleRejectJoin(jr); }}
                      disabled={approveJoinPending || rejectJoinPending}
                      class="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>

                  <!-- Mobile buttons -->
                  <div class="mt-3 flex gap-2 sm:hidden">
                    <button
                      type="button"
                      onclick={() => handleApproveJoin(jr)}
                      disabled={approveJoinPending || rejectJoinPending}
                      class="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onclick={() => handleRejectJoin(jr)}
                      disabled={approveJoinPending || rejectJoinPending}
                      class="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </SwipeToArchive>
            {:else}
              <div
                class="group flex w-full items-start gap-2 border-b border-border/50 px-2 py-2.5 text-left transition-all hover:bg-accent/40 last:border-0 sm:items-center sm:px-3"
              >
                <span class="hidden h-4 w-4 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                <div class="flex min-w-0 flex-1 items-start gap-2">
                  <span class="hidden h-3.5 w-3.5 shrink-0 sm:inline-flex" aria-hidden="true"></span>
                  <span class="mt-0.5 shrink-0 rounded-md bg-accent/60 p-1.5 sm:mt-0">
                    <UserPlus class="h-4 w-4 text-muted-foreground" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="line-clamp-2 text-sm font-medium text-foreground sm:truncate sm:line-clamp-none">
                      {joinLabel}
                    </span>
                    <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>requested {timeAgo(jr.createdAt)} from IP {jr.requestIp ?? 'unknown'}</span>
                      {#if jr.adapterType}
                        <span>adapter: {jr.adapterType}</span>
                      {/if}
                    </span>
                  </span>
                </div>
                <div class="hidden shrink-0 items-center gap-2 sm:flex">
                  <button
                    type="button"
                    onclick={() => handleApproveJoin(jr)}
                    disabled={approveJoinPending || rejectJoinPending}
                    class="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onclick={() => handleRejectJoin(jr)}
                    disabled={approveJoinPending || rejectJoinPending}
                    class="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            {/if}
          {/if}
        {/each}
      </div>
    {/if}

    <!-- Alerts section -->
    {#if showAlertsSection}
      {#if showWorkItemsSection}
        <div class="border-t border-border/50"></div>
      {/if}
      <div>
        <h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Alerts
        </h3>
        <div class="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-border/50 bg-background">
          {#if showAggregateAgentError}
            <div class="group/alert relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
              <a
                href="/{prefix}/agents"
                class="flex flex-1 cursor-pointer items-center gap-3 no-underline"
              >
                <AlertTriangle class="h-4 w-4 shrink-0 text-red-400" />
                <span class="text-sm text-foreground">
                  <span class="font-medium">{dashboard?.agents?.error ?? 0}</span>
                  {(dashboard?.agents?.error ?? 0) === 1 ? ' agent has' : ' agents have'} errors
                </span>
              </a>
              <button
                type="button"
                onclick={() => dismiss('alert:agent-errors')}
                class="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover/alert:opacity-100"
                aria-label="Dismiss"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          {/if}
          {#if showBudgetAlert}
            <div class="group/alert relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40">
              <a
                href="/{prefix}/costs"
                class="flex flex-1 cursor-pointer items-center gap-3 no-underline"
              >
                <AlertTriangle class="h-4 w-4 shrink-0 text-yellow-400" />
                <span class="text-sm text-foreground">
                  Budget at
                  <span class="font-medium">{dashboard?.costs?.monthUtilizationPercent ?? 0}%</span>
                  utilization this month
                </span>
              </a>
              <button
                type="button"
                onclick={() => dismiss('alert:budget')}
                class="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent/60 hover:text-foreground group-hover/alert:opacity-100"
                aria-label="Dismiss"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
