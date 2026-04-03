<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { ShieldCheck, Check, X, Clock, User, ChevronRight } from 'lucide-svelte';

  let prefix = $derived($page.params.companyPrefix);

  onMount(() => breadcrumbStore.set([{ label: 'Approvals' }]));

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
  let activeTab = $state<'pending' | 'all'>('pending');
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
  let pendingCount = $derived(pendingApprovals.length);
  let displayedApprovals = $derived(activeTab === 'pending' ? pendingApprovals : approvals);

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

  function statusBadge(status: string): string {
    switch (status) {
      case 'approved': return 'bg-emerald-500/10 text-emerald-400';
      case 'rejected': return 'bg-red-500/10 text-red-400';
      case 'pending': return 'bg-amber-500/10 text-amber-400';
      default: return 'bg-zinc-500/10 text-zinc-400';
    }
  }
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-foreground">Approvals</h1>
    <p class="mt-1 text-sm text-muted-foreground">Review and approve pending requests</p>
  </div>

  <!-- Tabs -->
  <div class="flex items-center gap-1 border-b border-border">
    <button
      onclick={() => (activeTab = 'pending')}
      class="relative px-4 py-2.5 text-sm font-medium transition-colors
        {activeTab === 'pending' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
    >
      Pending
      {#if pendingCount > 0}
        <span class="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
          {pendingCount}
        </span>
      {/if}
      {#if activeTab === 'pending'}
        <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
      {/if}
    </button>
    <button
      onclick={() => (activeTab = 'all')}
      class="relative px-4 py-2.5 text-sm font-medium transition-colors
        {activeTab === 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
    >
      All
      {#if activeTab === 'all'}
        <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
      {/if}
    </button>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <div class="h-24 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>
  {:else if displayedApprovals.length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <ShieldCheck class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">
        {activeTab === 'pending' ? 'No pending approvals' : 'No approvals yet'}
      </h3>
      <p class="mt-1 text-sm text-muted-foreground">
        {activeTab === 'pending' ? 'You\'re all caught up' : 'Approval requests will appear here'}
      </p>
    </div>
  {:else}
    <!-- Approval cards -->
    <div class="space-y-3">
      {#each displayedApprovals as approval (approval.id)}
        <a href="/{prefix}/approvals/{approval.id}" class="block rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40 group">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-3 mb-2">
                <h3 class="text-sm font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">
                  {approvalLabel(approval.type ?? approval.kind, approval.payload)}
                </h3>
                <span class="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium {statusBadge(approval.status)}">
                  {approval.status}
                </span>
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
                <p class="mt-2 text-xs text-muted-foreground line-clamp-2">{approval.details ?? approval.reason}</p>
              {/if}
            </div>

            <!-- Action buttons (only for pending) -->
            {#if approval.status === 'pending'}
              <div class="flex shrink-0 items-center gap-2">
                <button
                  onclick={() => handleAction(approval.id, 'approve')}
                  disabled={actionLoading === approval.id}
                  class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check class="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  onclick={() => handleAction(approval.id, 'reject')}
                  disabled={actionLoading === approval.id}
                  class="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  <X class="h-3.5 w-3.5" />
                  Reject
                </button>
              </div>
            {:else}
              <ChevronRight class="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
