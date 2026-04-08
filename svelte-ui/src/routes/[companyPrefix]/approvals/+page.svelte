<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import {
    Card, CardContent, CardHeader, CardTitle, CardDescription, Badge, Button, Skeleton,
  } from '$lib/components/ui/index.js';
  import { ShieldCheck, Check, X, Clock, User, ChevronRight, Zap, Timer } from 'lucide-svelte';
  import { PageLayout } from '$components/layout/index.js';

  let prefix = $derived($page.params.companyPrefix);

  // ── Auto-approve countdown timer ──────────────────────────────────────────
  const AUTO_APPROVE_SECONDS = 60;
  let now = $state(Date.now());
  let tickInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    breadcrumbStore.set([{ label: 'Approvals' }]);
    tickInterval = setInterval(() => { now = Date.now(); }, 1000);
  });
  onDestroy(() => { if (tickInterval) clearInterval(tickInterval); });

  function autoApproveTimeLeft(createdAt: string | undefined): number {
    if (!createdAt) return 0;
    return Math.max(0, AUTO_APPROVE_SECONDS - Math.floor((now - new Date(createdAt).getTime()) / 1000));
  }

  function isAutoApproved(approval: any): boolean {
    return approval.status === 'approved' &&
      (approval.decidedByUserId?.startsWith('ceo:') || approval.decidedByUserId?.startsWith('system:auto'));
  }

  // ── Approval label helpers (mirrors original ApprovalPayload.tsx) ──────────
  const TYPE_LABEL: Record<string, string> = {
    hire_agent: 'Hire Agent',
    approve_ceo_strategy: 'CEO Strategy',
    budget_override_required: 'Budget Override',
  };

  function approvalLabel(kind: string, payload?: Record<string, unknown> | null): string {
    const base = TYPE_LABEL[kind] ?? kind ?? 'Approval Request';
    if (kind === 'hire_agent' && payload?.name) return `${base}: ${String(payload.name)}`;
    return base;
  }

  let loading = $state(true);
  let approvals = $state<any[]>([]);
  let activeTab = $state<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  let actionLoading = $state<string | null>(null);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/approvals`)
      .then((r) => r.json())
      .then((d) => {
        approvals = Array.isArray(d) ? d : d.approvals ?? [];
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  let pendingApprovals = $derived(
    approvals.filter((a) => a.status === 'pending' || a.status === 'revision_requested'),
  );
  let approvedApprovals = $derived(
    approvals.filter((a) => a.status === 'approved'),
  );
  let rejectedApprovals = $derived(
    approvals.filter((a) => a.status === 'rejected'),
  );
  let pendingCount = $derived(pendingApprovals.length);
  let approvedCount = $derived(approvedApprovals.length);
  let rejectedCount = $derived(rejectedApprovals.length);
  let displayedApprovals = $derived(
    activeTab === 'pending' ? pendingApprovals
    : activeTab === 'approved' ? approvedApprovals
    : activeTab === 'rejected' ? rejectedApprovals
    : approvals
  );

  async function handleAction(approvalId: string, action: 'approve' | 'reject') {
    actionLoading = approvalId;
    try {
      await api(`/api/approvals/${approvalId}/${action}`, { method: 'POST' });
      approvals = approvals.map((a) =>
        a.id === approvalId ? { ...a, status: action === 'approve' ? 'approved' : 'rejected' } : a
      );
    } catch (e) {
      console.error(e);
    } finally {
      actionLoading = null;
    }
  }

  function timeAgo(date: string | undefined): string {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function statusVariant(status: string): string {
    switch (status) {
      case 'approved': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'rejected': return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'pending': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default: return '';
    }
  }
</script>

<PageLayout title="Approvals" description="Review and approve pending requests">
  <!-- Auto-approve info banner -->
  <div class="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 mb-4 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
    <Zap class="h-4 w-4 shrink-0" />
    <span>Hire approvals are auto-approved by the CEO after 1 minute if no action is taken.</span>
  </div>

  <!-- Tabs -->
  <div class="flex items-center border-b border-border">
    <button
      onclick={() => (activeTab = 'pending')}
      class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
        {activeTab === 'pending'
          ? 'border-b-2 border-blue-500 text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
    >
      Pending
      {#if pendingCount > 0}
        <Badge class="ml-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5">
          {pendingCount}
        </Badge>
      {/if}
    </button>
    <button
      onclick={() => (activeTab = 'approved')}
      class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
        {activeTab === 'approved'
          ? 'border-b-2 border-blue-500 text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
    >
      Approved
      {#if approvedCount > 0}
        <span class="ml-1 text-xs text-muted-foreground">({approvedCount})</span>
      {/if}
    </button>
    <button
      onclick={() => (activeTab = 'rejected')}
      class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
        {activeTab === 'rejected'
          ? 'border-b-2 border-blue-500 text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
    >
      Rejected
      {#if rejectedCount > 0}
        <span class="ml-1 text-xs text-muted-foreground">({rejectedCount})</span>
      {/if}
    </button>
    <button
      onclick={() => (activeTab = 'all')}
      class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
        {activeTab === 'all'
          ? 'border-b-2 border-blue-500 text-foreground'
          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
    >
      All
    </button>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <Skeleton class="h-24 rounded-xl" />
      {/each}
    </div>
  {:else if displayedApprovals.length === 0}
    <!-- Empty state -->
    <Card class="border-border/60">
      <CardHeader class="pb-3">
        <CardTitle class="text-sm">
          {activeTab === 'pending' ? 'No pending approvals'
          : activeTab === 'approved' ? 'No approved approvals'
          : activeTab === 'rejected' ? 'No rejected approvals'
          : 'No approvals yet'}
        </CardTitle>
        <CardDescription>
          {activeTab === 'pending' ? 'You\'re all caught up.' : 'Approval requests will appear here.'}
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col items-center gap-3 pb-12 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
          <ShieldCheck class="h-5 w-5 text-muted-foreground/40" />
        </div>
      </CardContent>
    </Card>
  {:else}
    <!-- Approval cards -->
    <Card class="border-border/60 overflow-hidden">
      <CardContent class="p-0">
        <div class="flex items-center border-b border-border px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span class="min-w-0 flex-1">Request</span>
            <span class="w-44 shrink-0 text-right">Actions</span>
          </div>
          <div class="divide-y divide-border/50">
          {#each displayedApprovals as approval (approval.id)}
            <a href={`/${prefix}/approvals/${approval.id}`} class="group block cursor-pointer transition-colors duration-150">
              <div class="px-5 py-5 transition-colors hover:bg-accent/40">
                <div class="flex items-start justify-between gap-4">
                  <div class="min-w-0 flex-1">
                    <div class="mb-2 flex items-center gap-3">
                      <h3 class="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                        {approvalLabel(approval.type ?? approval.kind, approval.payload)}
                      </h3>
                      <Badge class={statusVariant(approval.status)}>
                        {approval.status}
                      </Badge>
                      {#if approval.status === 'pending' && (approval.type === 'hire_agent' || approval.kind === 'hire_agent')}
                        {@const timeLeft = autoApproveTimeLeft(approval.createdAt)}
                        {#if timeLeft > 0}
                          <Badge class="bg-amber-500/15 text-amber-500 border-amber-500/30">
                            <Timer class="h-3 w-3 mr-1" />
                            Auto-approves in {timeLeft}s
                          </Badge>
                        {:else}
                          <Badge class="bg-blue-500/15 text-blue-500 border-blue-500/30">
                            <Zap class="h-3 w-3 mr-1" />
                            CEO auto-approving...
                          </Badge>
                        {/if}
                      {:else if isAutoApproved(approval)}
                        <Badge class="bg-blue-500/15 text-blue-500 border-blue-500/30">
                          <Zap class="h-3 w-3 mr-1" />
                          Auto-approved
                        </Badge>
                      {/if}
                    </div>

                    <div class="flex items-center gap-4 text-xs text-muted-foreground">
                      {#if approval.requesterName || approval.requester}
                        <span class="inline-flex items-center gap-1">
                          <User class="h-3.5 w-3.5" />
                          {approval.requesterName ?? approval.requester}
                        </span>
                      {/if}
                      {#if approval.createdAt}
                        <span class="inline-flex items-center gap-1">
                          <Clock class="h-3.5 w-3.5" />
                          {timeAgo(approval.createdAt)}
                        </span>
                      {/if}
                    </div>

                    {#if approval.details || approval.reason}
                      <p class="mt-2 line-clamp-2 text-xs text-muted-foreground">{approval.details ?? approval.reason}</p>
                    {/if}
                  </div>

                  {#if approval.status === 'pending'}
                    <div class="flex shrink-0 items-center gap-2">
                      <Button
                        size="xs"
                        onclick={(e: MouseEvent) => { e.preventDefault(); handleAction(approval.id, 'approve'); }}
                        disabled={actionLoading === approval.id}
                        class="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check class="h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="xs"
                        onclick={(e: MouseEvent) => { e.preventDefault(); handleAction(approval.id, 'reject'); }}
                        disabled={actionLoading === approval.id}
                      >
                        <X class="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  {:else}
                    <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                  {/if}
                </div>
              </div>
            </a>
          {/each}
        </div>
      </CardContent>
    </Card>
  {/if}
</PageLayout>
