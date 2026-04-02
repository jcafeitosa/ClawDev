<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from '$lib/components/ui/index.js';
  import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    PieChart,
    Server,
    Wallet,
    Bot,
    FolderKanban,
    Receipt,
    LayoutDashboard,
    Gauge,
    Shield,
    CreditCard,
    Zap,
    Hash,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    Calendar,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Costs' }]));

  // ── State ──────────────────────────────────────────────────────────
  let loading = $state(true);
  let summary = $state<any>(null);
  let entries = $state<any[]>([]);

  let byAgentLoading = $state(false);
  let byAgentData = $state<any[]>([]);
  let byAgentLoaded = $state(false);

  let byProviderLoading = $state(false);
  let byProviderData = $state<any[]>([]);
  let byProviderLoaded = $state(false);

  let byProjectLoading = $state(false);
  let byProjectData = $state<any[]>([]);
  let byProjectLoaded = $state(false);

  let financeLoading = $state(false);
  let financeSummary = $state<any>(null);
  let financeEvents = $state<any[]>([]);
  let financeLoaded = $state(false);

  let billersLoading = $state(false);
  let billersData = $state<any[]>([]);
  let billersLoaded = $state(false);

  let budgetsLoading = $state(false);
  let budgetsData = $state<any[]>([]);
  let budgetsLoaded = $state(false);

  let activeTab = $state('overview');

  // Date range presets matching original UI
  type DatePreset = 'mtd' | '7d' | '30d' | 'ytd' | 'all' | 'custom';
  let datePreset = $state<DatePreset>('mtd');
  let dateRange = $derived.by(() => {
    const now = new Date();
    if (datePreset === 'all' || datePreset === 'custom') return { from: '', to: '' };
    if (datePreset === 'mtd') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }
    if (datePreset === 'ytd') {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: from.toISOString().split('T')[0], to: now.toISOString().split('T')[0] };
    }
    const days = datePreset === '7d' ? 7 : 30;
    const from = new Date(now.getTime() - days * 86400000);
    return {
      from: from.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };
  });

  // Quota windows
  let quotaLoading = $state(false);
  let quotaWindows = $state<any[]>([]);
  let quotaLoaded = $state(false);

  let companyId = $derived(companyStore.selectedCompany?.id);

  // ── Computed summary values ────────────────────────────────────────
  let inferenceSpend = $derived(summary?.totalSpend ?? summary?.total ?? 0);
  let totalTokens = $derived(summary?.totalTokens ?? summary?.tokenCount ?? 0);
  let totalRequests = $derived(summary?.totalRequests ?? summary?.requestCount ?? 0);
  let budgetStatus = $derived(summary?.budgetStatus ?? (summary?.budgetTotal ? 'Active' : 'Open'));
  let budgetCapText = $derived(
    summary?.budgetTotal
      ? `${formatCurrency(summary.budgetTotal)} monthly cap`
      : 'No monthly cap configured',
  );
  let financeNet = $derived(
    (financeSummary?.revenue ?? financeSummary?.totalRevenue ?? 0) -
      (financeSummary?.expense ?? financeSummary?.totalExpense ?? 0),
  );
  let financeDebits = $derived(financeSummary?.expense ?? financeSummary?.totalExpense ?? 0);
  let financeCredits = $derived(financeSummary?.revenue ?? financeSummary?.totalRevenue ?? 0);
  let financeEventCount = $derived(
    (financeSummary?.revenueCount ?? financeSummary?.revenueEventCount ?? 0) +
      (financeSummary?.expenseCount ?? financeSummary?.expenseEventCount ?? 0),
  );
  let financeEstimated = $derived(financeSummary?.estimated ?? financeSummary?.estimatedTotal ?? 0);

  // ── Load overview data ─────────────────────────────────────────────
  $effect(() => {
    if (!companyId) return;
    loading = true;
    const params = new URLSearchParams();
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    Promise.all([
      api(`/api/companies/${companyId}/costs/summary${qs}`)
        .then((r) => r.json())
        .catch(() => null),
      api(`/api/companies/${companyId}/costs/finance-summary`)
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([summaryData, finData]) => {
        summary = summaryData?.summary ?? summaryData;
        entries = summaryData?.entries ?? summaryData?.costs ?? summaryData?.items ?? [];
        if (finData) {
          financeSummary = finData?.summary ?? finData;
        }
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  // ── Lazy-load tab data on tab change ───────────────────────────────
  $effect(() => {
    if (!companyId) return;

    if (activeTab === 'budgets' && !budgetsLoaded) {
      budgetsLoading = true;
      api(`/api/companies/${companyId}/budgets/overview`)
        .then((r) => r.json())
        .then((d) => {
          const policies = Array.isArray(d) ? d : d.policies ?? d.data ?? d.items ?? d.budgets ?? [];
          budgetsData = policies.map((policy: any) => ({
            ...policy,
            id: policy.id ?? policy.policyId,
            name: policy.name ?? policy.label ?? policy.scopeName ?? 'Budget',
            scope: policy.scope ?? policy.scopeType,
            type: policy.type ?? policy.scopeType,
            used: policy.used ?? policy.currentSpend ?? policy.observedAmount ?? 0,
            limit: policy.limit ?? policy.monthlyLimit ?? policy.total ?? policy.amount ?? 0,
            currentSpend: policy.currentSpend ?? policy.observedAmount ?? 0,
            monthlyLimit: policy.monthlyLimit ?? policy.amount ?? 0,
            total: policy.total ?? policy.amount ?? 0,
          }));
          budgetsLoaded = true;
        })
        .catch(() => {
          budgetsData = [];
          budgetsLoaded = true;
        })
        .finally(() => (budgetsLoading = false));
    }

    if (activeTab === 'providers' && !byProviderLoaded) {
      byProviderLoading = true;
      Promise.all([
        api(`/api/companies/${companyId}/costs/by-provider`)
          .then((r) => r.json())
          .catch(() => []),
        api(`/api/companies/${companyId}/costs/by-agent`)
          .then((r) => r.json())
          .catch(() => []),
      ])
        .then(([provData, agentData]) => {
          byProviderData = Array.isArray(provData)
            ? provData
            : provData?.data ?? provData?.items ?? provData?.providers ?? [];
          byAgentData = Array.isArray(agentData)
            ? agentData
            : agentData?.data ?? agentData?.items ?? agentData?.agents ?? [];
          byProviderLoaded = true;
          byAgentLoaded = true;
        })
        .catch(console.error)
        .finally(() => (byProviderLoading = false));
    }

    if (activeTab === 'billers' && !billersLoaded) {
      billersLoading = true;
      Promise.all([
        api(`/api/companies/${companyId}/costs/by-biller`)
          .then((r) => r.json())
          .catch(() => []),
        api(`/api/companies/${companyId}/costs/by-project`)
          .then((r) => r.json())
          .catch(() => []),
      ])
        .then(([billerData, projData]) => {
          billersData = Array.isArray(billerData)
            ? billerData
            : billerData?.data ?? billerData?.items ?? billerData?.billers ?? [];
          byProjectData = Array.isArray(projData)
            ? projData
            : projData?.data ?? projData?.items ?? projData?.projects ?? [];
          billersLoaded = true;
          byProjectLoaded = true;
        })
        .catch(() => {
          billersData = [];
          billersLoaded = true;
        })
        .finally(() => (billersLoading = false));
    }

    if (activeTab === 'finance' && !financeLoaded) {
      financeLoading = true;
      Promise.all([
        api(`/api/companies/${companyId}/costs/finance-summary`)
          .then((r) => r.json())
          .catch(() => null),
        api(`/api/companies/${companyId}/costs/finance-events`)
          .then((r) => r.json())
          .catch(() => []),
      ])
        .then(([summaryData, eventsData]) => {
          financeSummary = summaryData?.summary ?? summaryData;
          financeEvents = Array.isArray(eventsData)
            ? eventsData
            : eventsData?.data ?? eventsData?.events ?? eventsData?.items ?? [];
          financeLoaded = true;
        })
        .catch(console.error)
        .finally(() => (financeLoading = false));
    }

    if (activeTab === 'finance' && !quotaLoaded) {
      quotaLoading = true;
      api(`/api/companies/${companyId}/costs/quota-windows`)
        .then((r) => r.json())
        .then((d) => {
          quotaWindows = Array.isArray(d) ? d : d.data ?? d.windows ?? d.items ?? [];
          quotaLoaded = true;
        })
        .catch(() => {
          quotaWindows = [];
          quotaLoaded = true;
        })
        .finally(() => (quotaLoading = false));
    }
  });

  // ── Formatters ─────────────────────────────────────────────────────
  function formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0.00';
    return `$${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatSmallCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0.0000';
    return `$${value.toLocaleString('en', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  }

  function formatTokens(value: number | undefined): string {
    if (value === undefined || value === null || value === 0) return '0';
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toString();
  }

  function formatDate(value: string | undefined): string {
    if (!value) return '---';
    try {
      return new Date(value).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return value;
    }
  }

  function quotaBarColor(pct: number): string {
    if (pct > 90) return '#ef4444';
    if (pct > 70) return '#f59e0b';
    return '#10b981';
  }

  // Tab definition — matching original ClawDev UI
  const TABS = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'budgets', label: 'Budgets', icon: Shield },
    { value: 'providers', label: 'Providers', icon: Server },
    { value: 'billers', label: 'Billers', icon: CreditCard },
    { value: 'finance', label: 'Finance', icon: Receipt },
  ] as const;

  const DATE_PRESETS = [
    { key: 'mtd' as DatePreset, label: 'Month to Date' },
    { key: '7d' as DatePreset, label: 'Last 7 Days' },
    { key: '30d' as DatePreset, label: 'Last 30 Days' },
    { key: 'ytd' as DatePreset, label: 'Year to Date' },
    { key: 'all' as DatePreset, label: 'All Time' },
    { key: 'custom' as DatePreset, label: 'Custom' },
  ];
</script>

<div class="costs-root space-y-6 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-foreground">Costs & Budgets</h1>
    <p class="mt-1 text-sm text-muted-foreground">Track spending across agents and providers</p>
  </div>

  <!-- 4 Summary Cards (matching original: INFERENCE SPEND, BUDGET, FINANCE NET, FINANCE EVENTS) -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each Array(4) as _}
        <div class="h-28 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <!-- INFERENCE SPEND -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="rounded-lg bg-blue-500/10 p-2">
            <Zap class="h-4 w-4 text-blue-500" />
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inference Spend</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{formatCurrency(inferenceSpend)}</p>
        <p class="mt-1.5 text-xs text-muted-foreground">
          {formatTokens(totalTokens)} tokens across request-scoped events
        </p>
      </div>

      <!-- BUDGET -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="rounded-lg bg-emerald-500/10 p-2">
            <Shield class="h-4 w-4 text-emerald-500" />
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Budget</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{budgetStatus}</p>
        <p class="mt-1.5 text-xs text-muted-foreground">{budgetCapText}</p>
      </div>

      <!-- FINANCE NET -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="rounded-lg bg-violet-500/10 p-2">
            <Activity class="h-4 w-4 text-violet-500" />
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance Net</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{formatCurrency(financeNet)}</p>
        <p class="mt-1.5 text-xs text-muted-foreground">
          {formatCurrency(financeDebits)} debits &middot; {formatCurrency(financeCredits)} credits
        </p>
      </div>

      <!-- FINANCE EVENTS -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-2 mb-3">
          <div class="rounded-lg bg-orange-500/10 p-2">
            <Hash class="h-4 w-4 text-orange-500" />
          </div>
          <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Finance Events</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{financeEventCount}</p>
        <p class="mt-1.5 text-xs text-muted-foreground">
          {formatCurrency(financeEstimated)} estimated in range
        </p>
      </div>
    </div>
  {/if}

  <!-- Tabbed Breakdown Section -->
  <div class="rounded-xl border border-border bg-card overflow-hidden">
    <Tabs value={activeTab} onValueChange={(v) => { if (v) activeTab = v; }} class="w-full">
      <div class="border-b border-border px-5 pt-4 pb-0 overflow-x-auto">
        <TabsList class="bg-transparent p-0 h-auto gap-0">
          {#each TABS as tab}
            <TabsTrigger
              value={tab.value}
              class="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:border-blue-500 data-[state=active]:text-foreground data-[state=active]:bg-transparent hover:text-foreground transition-colors"
            >
              <tab.icon size={14} class="mr-1.5" />
              {tab.label}
            </TabsTrigger>
          {/each}
        </TabsList>
      </div>

      <!-- ─── Overview Tab ──────────────────────────────────────────── -->
      <TabsContent value="overview">
        <!-- Date range selector -->
        <div class="flex flex-wrap items-center gap-2 px-5 pt-4 pb-2">
          {#each DATE_PRESETS as preset}
            <button
              class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors {datePreset === preset.key
                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                : 'bg-secondary text-muted-foreground border border-border hover:bg-accent hover:text-foreground'}"
              onclick={() => { datePreset = preset.key; }}
            >
              {preset.label}
            </button>
          {/each}
        </div>

        <!-- Inference Ledger section -->
        <div class="px-5 pt-4 pb-2">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Inference Ledger</h3>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
            <!-- Spend card -->
            <div class="rounded-lg border border-border bg-secondary/50 p-4">
              <div class="flex items-center gap-2 mb-2">
                <DollarSign class="h-4 w-4 text-blue-500" />
                <span class="text-xs font-medium text-muted-foreground">Spend</span>
              </div>
              <p class="text-xl font-bold text-foreground">{formatCurrency(inferenceSpend)}</p>
              {#if summary?.period}
                <p class="mt-1 text-xs text-muted-foreground">{summary.period}</p>
              {/if}
            </div>
            <!-- Usage (tokens) card -->
            <div class="rounded-lg border border-border bg-secondary/50 p-4">
              <div class="flex items-center gap-2 mb-2">
                <Zap class="h-4 w-4 text-amber-500" />
                <span class="text-xs font-medium text-muted-foreground">Usage</span>
              </div>
              <p class="text-xl font-bold text-foreground">{formatTokens(totalTokens)}</p>
              <p class="mt-1 text-xs text-muted-foreground">
                {totalRequests.toLocaleString('en')} requests
              </p>
            </div>
          </div>
        </div>

        <!-- Inference entries table -->
        {#if loading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-secondary"></div>
            {/each}
          </div>
        {:else if entries.length === 0}
          <div class="flex flex-col items-center justify-center py-8">
            <div class="rounded-full bg-secondary p-3 mb-3">
              <PieChart class="h-8 w-8 text-muted-foreground" />
            </div>
            <p class="text-sm text-muted-foreground">No inference cost data in this period</p>
          </div>
        {:else}
          <div class="border-t border-border">
            <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
              <div class="col-span-4">Agent / Provider</div>
              <div class="col-span-2 text-right">Input Cost</div>
              <div class="col-span-2 text-right">Output Cost</div>
              <div class="col-span-2 text-right">Total</div>
              <div class="col-span-2 text-right">Requests</div>
            </div>

            {#each entries as entry, i (entry.id ?? i)}
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                <div class="col-span-4 flex items-center gap-3 min-w-0">
                  <div class="shrink-0 rounded-lg bg-secondary p-1.5">
                    <TrendingUp class="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div class="min-w-0">
                    <p class="text-foreground truncate font-medium">{entry.agentName ?? entry.agent ?? entry.name ?? '---'}</p>
                    {#if entry.provider ?? entry.model}
                      <p class="text-xs text-muted-foreground truncate">{entry.provider ?? entry.model}</p>
                    {/if}
                  </div>
                </div>
                <div class="col-span-2 text-right text-muted-foreground">{formatSmallCurrency(entry.inputCost)}</div>
                <div class="col-span-2 text-right text-muted-foreground">{formatSmallCurrency(entry.outputCost)}</div>
                <div class="col-span-2 text-right font-medium text-foreground">{formatSmallCurrency(entry.totalCost ?? entry.total ?? entry.cost)}</div>
                <div class="col-span-2 text-right text-muted-foreground">{entry.requestCount ?? entry.requests ?? '---'}</div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Finance Ledger section -->
        <div class="px-5 pt-6 pb-5 border-t border-border">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Finance Ledger</h3>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <!-- Debits -->
            <div class="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div class="flex items-center gap-1.5 mb-1.5">
                <ArrowDownRight class="h-3.5 w-3.5 text-red-500" />
                <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Debits</span>
              </div>
              <p class="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(financeDebits)}</p>
            </div>
            <!-- Credits -->
            <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div class="flex items-center gap-1.5 mb-1.5">
                <ArrowUpRight class="h-3.5 w-3.5 text-emerald-500" />
                <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Credits</span>
              </div>
              <p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(financeCredits)}</p>
            </div>
            <!-- Net -->
            <div class="rounded-lg border border-border bg-secondary/50 p-4">
              <div class="flex items-center gap-1.5 mb-1.5">
                <Activity class="h-3.5 w-3.5 text-violet-500" />
                <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Net</span>
              </div>
              <p class="text-lg font-bold text-foreground">{formatCurrency(financeNet)}</p>
            </div>
            <!-- Estimated -->
            <div class="rounded-lg border border-border bg-secondary/50 p-4">
              <div class="flex items-center gap-1.5 mb-1.5">
                <Calendar class="h-3.5 w-3.5 text-amber-500" />
                <span class="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Estimated</span>
              </div>
              <p class="text-lg font-bold text-foreground">{formatCurrency(financeEstimated)}</p>
            </div>
          </div>
        </div>
      </TabsContent>

      <!-- ─── Budgets Tab ───────────────────────────────────────────── -->
      <TabsContent value="budgets">
        {#if budgetsLoading}
          <div class="p-5 space-y-3">
            {#each Array(4) as _}
              <div class="h-20 animate-pulse rounded-lg bg-secondary"></div>
            {/each}
          </div>
        {:else if budgetsData.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="rounded-full bg-secondary p-3 mb-3">
              <Shield class="h-8 w-8 text-muted-foreground" />
            </div>
            <p class="text-sm text-muted-foreground">No budgets configured</p>
            <p class="mt-1 text-xs text-muted-foreground">Create a budget to set spending limits for agents and providers</p>
          </div>
        {:else}
          <div class="p-5 space-y-3">
            {#each budgetsData as budget, i (budget.id ?? i)}
              {@const used = budget.used ?? budget.currentSpend ?? 0}
              {@const limit = budget.limit ?? budget.monthlyLimit ?? budget.total ?? 0}
              {@const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0}
              <div class="rounded-lg border border-border bg-secondary/30 p-4">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <Shield size={14} class="text-muted-foreground" />
                    <span class="text-sm font-medium text-foreground">{budget.name ?? budget.label ?? 'Budget'}</span>
                    {#if budget.scope ?? budget.type}
                      <span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{budget.scope ?? budget.type}</span>
                    {/if}
                  </div>
                  <span class="text-xs font-semibold" style="color: {quotaBarColor(pct)};">{pct.toFixed(0)}%</span>
                </div>
                <div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    style="width: {pct}%; background-color: {quotaBarColor(pct)};"
                  ></div>
                </div>
                <div class="mt-1.5 flex items-center justify-between">
                  <span class="text-[11px] text-muted-foreground">{formatCurrency(used)} used</span>
                  <span class="text-[11px] text-muted-foreground">{limit > 0 ? `${formatCurrency(limit)} limit` : 'No cap'}</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </TabsContent>

      <!-- ─── Providers Tab (includes By Agent sub-view) ────────────── -->
      <TabsContent value="providers">
        {#if byProviderLoading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-secondary"></div>
            {/each}
          </div>
        {:else}
          <!-- Provider breakdown -->
          <div class="px-5 pt-4 pb-2">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Provider</h3>
          </div>
          {#if byProviderData.length === 0}
            <div class="flex flex-col items-center justify-center py-8">
              <div class="rounded-full bg-secondary p-3 mb-3">
                <Server class="h-8 w-8 text-muted-foreground" />
              </div>
              <p class="text-sm text-muted-foreground">No provider cost data available</p>
            </div>
          {:else}
            <div class="border-t border-border">
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                <div class="col-span-4">Provider</div>
                <div class="col-span-2 text-right">Input Cost</div>
                <div class="col-span-2 text-right">Output Cost</div>
                <div class="col-span-2 text-right">Total</div>
                <div class="col-span-2 text-right">Requests</div>
              </div>

              {#each byProviderData as row, i (row.id ?? row.provider ?? i)}
                <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                  <div class="col-span-4 flex items-center gap-3 min-w-0">
                    <div class="shrink-0 rounded-lg bg-orange-500/10 p-1.5">
                      <Server class="h-3.5 w-3.5 text-orange-500" />
                    </div>
                    <p class="text-foreground truncate font-medium">{row.provider ?? row.name ?? '---'}</p>
                  </div>
                  <div class="col-span-2 text-right text-muted-foreground">{formatSmallCurrency(row.inputCost)}</div>
                  <div class="col-span-2 text-right text-muted-foreground">{formatSmallCurrency(row.outputCost)}</div>
                  <div class="col-span-2 text-right font-medium text-foreground">{formatSmallCurrency(row.totalCost ?? row.total ?? row.cost)}</div>
                  <div class="col-span-2 text-right text-muted-foreground">{row.requestCount ?? row.requests ?? '---'}</div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- By Agent sub-view within Providers -->
          <div class="px-5 pt-6 pb-2 border-t border-border">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Agent</h3>
          </div>
          {#if byAgentData.length === 0}
            <div class="flex flex-col items-center justify-center py-8">
              <div class="rounded-full bg-secondary p-3 mb-3">
                <Bot class="h-8 w-8 text-muted-foreground" />
              </div>
              <p class="text-sm text-muted-foreground">No agent cost data available</p>
            </div>
          {:else}
            <div class="border-t border-border">
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                <div class="col-span-4">Agent Name</div>
                <div class="col-span-2 text-right">Input Cost</div>
                <div class="col-span-2 text-right">Output Cost</div>
                <div class="col-span-2 text-right">Total</div>
                <div class="col-span-2 text-right">Requests</div>
              </div>

              {#each byAgentData as row, i (row.id ?? row.agentId ?? i)}
                <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                  <div class="col-span-4 flex items-center gap-3 min-w-0">
                    <div class="shrink-0 rounded-lg bg-blue-500/10 p-1.5">
                      <Bot class="h-3.5 w-3.5 text-blue-500" />
                    </div>
                    <p class="text-foreground truncate font-medium">{row.agentName ?? row.name ?? row.agent ?? '---'}</p>
                  </div>
                  <div class="col-span-2 text-right text-muted-foreground">{formatSmallCurrency(row.inputCost)}</div>
                  <div class="col-span-2 text-right text-muted-foreground">{formatSmallCurrency(row.outputCost)}</div>
                  <div class="col-span-2 text-right font-medium text-foreground">{formatSmallCurrency(row.totalCost ?? row.total ?? row.cost)}</div>
                  <div class="col-span-2 text-right text-muted-foreground">{row.requestCount ?? row.requests ?? '---'}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </TabsContent>

      <!-- ─── Billers Tab (includes By Project sub-view) ────────────── -->
      <TabsContent value="billers">
        {#if billersLoading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-secondary"></div>
            {/each}
          </div>
        {:else}
          <!-- Billers breakdown -->
          <div class="px-5 pt-4 pb-2">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Billers</h3>
          </div>
          {#if billersData.length === 0}
            <div class="flex flex-col items-center justify-center py-8">
              <div class="rounded-full bg-secondary p-3 mb-3">
                <CreditCard class="h-8 w-8 text-muted-foreground" />
              </div>
              <p class="text-sm text-muted-foreground">No biller data available</p>
            </div>
          {:else}
            <div class="border-t border-border">
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                <div class="col-span-4">Biller</div>
                <div class="col-span-2">Status</div>
                <div class="col-span-3 text-right">Total Billed</div>
                <div class="col-span-3 text-right">Events</div>
              </div>

              {#each billersData as biller, i (biller.id ?? i)}
                <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                  <div class="col-span-4 flex items-center gap-3 min-w-0">
                    <div class="shrink-0 rounded-lg bg-violet-500/10 p-1.5">
                      <CreditCard class="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <p class="text-foreground truncate font-medium">{biller.name ?? biller.biller ?? '---'}</p>
                  </div>
                  <div class="col-span-2">
                    <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium
                      {(biller.status ?? 'active') === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-secondary text-muted-foreground'}">
                      {biller.status ?? 'active'}
                    </span>
                  </div>
                  <div class="col-span-3 text-right font-medium text-foreground">{formatCurrency(biller.totalBilled ?? biller.total ?? biller.amount ?? 0)}</div>
                  <div class="col-span-3 text-right text-muted-foreground">{biller.eventCount ?? biller.events ?? '---'}</div>
                </div>
              {/each}
            </div>
          {/if}

          <!-- By Project sub-view within Billers -->
          <div class="px-5 pt-6 pb-2 border-t border-border">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">By Project</h3>
          </div>
          {#if byProjectData.length === 0}
            <div class="flex flex-col items-center justify-center py-8">
              <div class="rounded-full bg-secondary p-3 mb-3">
                <FolderKanban class="h-8 w-8 text-muted-foreground" />
              </div>
              <p class="text-sm text-muted-foreground">No project cost data available</p>
            </div>
          {:else}
            <div class="border-t border-border">
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                <div class="col-span-6">Project Name</div>
                <div class="col-span-3 text-right">Total Cost</div>
                <div class="col-span-3 text-right">Requests</div>
              </div>

              {#each byProjectData as row, i (row.id ?? row.projectId ?? i)}
                <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                  <div class="col-span-6 flex items-center gap-3 min-w-0">
                    <div class="shrink-0 rounded-lg bg-violet-500/10 p-1.5">
                      <FolderKanban class="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <p class="text-foreground truncate font-medium">{row.projectName ?? row.name ?? row.project ?? '---'}</p>
                  </div>
                  <div class="col-span-3 text-right font-medium text-foreground">{formatCurrency(row.totalCost ?? row.total ?? row.cost)}</div>
                  <div class="col-span-3 text-right text-muted-foreground">{row.requestCount ?? row.requests ?? '---'}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </TabsContent>

      <!-- ─── Finance Tab ───────────────────────────────────────────── -->
      <TabsContent value="finance">
        {#if financeLoading}
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {#each Array(2) as _}
                <div class="h-24 animate-pulse rounded-lg bg-secondary"></div>
              {/each}
            </div>
            <div class="space-y-3">
              {#each Array(5) as _}
                <div class="h-10 animate-pulse rounded bg-secondary"></div>
              {/each}
            </div>
          </div>
        {:else}
          <!-- Revenue vs Expense summary cards -->
          <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-5">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="rounded-md bg-emerald-500/10 p-1.5">
                    <TrendingUp class="h-4 w-4 text-emerald-500" />
                  </div>
                  <span class="text-sm font-medium text-muted-foreground">Revenue</span>
                </div>
                {#if financeSummary?.revenueCount ?? financeSummary?.revenueEventCount}
                  <span class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    {financeSummary?.revenueCount ?? financeSummary?.revenueEventCount} events
                  </span>
                {/if}
              </div>
              <p class="text-3xl font-bold text-emerald-600 dark:text-emerald-400" title={`$${(financeSummary?.revenue ?? financeSummary?.totalRevenue ?? 0).toLocaleString('en', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}>
                {formatCurrency(financeSummary?.revenue ?? financeSummary?.totalRevenue ?? 0)}
              </p>
              {#if financeSummary?.revenueChange !== undefined}
                <p class="mt-1 text-xs text-emerald-600/70 dark:text-emerald-400/70">
                  {financeSummary.revenueChange > 0 ? '+' : ''}{financeSummary.revenueChange.toFixed(1)}% vs last period
                </p>
              {/if}
            </div>
            <div class="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="rounded-md bg-red-500/10 p-1.5">
                    <TrendingDown class="h-4 w-4 text-red-500" />
                  </div>
                  <span class="text-sm font-medium text-muted-foreground">Expenses</span>
                </div>
                {#if financeSummary?.expenseCount ?? financeSummary?.expenseEventCount}
                  <span class="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                    {financeSummary?.expenseCount ?? financeSummary?.expenseEventCount} events
                  </span>
                {/if}
              </div>
              <p class="text-3xl font-bold text-red-600 dark:text-red-400" title={`$${(financeSummary?.expense ?? financeSummary?.totalExpense ?? 0).toLocaleString('en', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}>
                {formatCurrency(financeSummary?.expense ?? financeSummary?.totalExpense ?? 0)}
              </p>
              {#if financeSummary?.expenseChange !== undefined}
                <p class="mt-1 text-xs text-red-600/70 dark:text-red-400/70">
                  {financeSummary.expenseChange > 0 ? '+' : ''}{financeSummary.expenseChange.toFixed(1)}% vs last period
                </p>
              {/if}
            </div>
          </div>

          <!-- Provider Quota Windows -->
          {#if quotaLoading}
            <div class="px-5 pb-4 space-y-3">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provider Quotas</h4>
              {#each Array(3) as _}
                <div class="h-16 animate-pulse rounded-lg bg-secondary"></div>
              {/each}
            </div>
          {:else if quotaWindows.length > 0}
            <div class="px-5 pb-5">
              <h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Provider Quotas</h4>
              <div class="space-y-3">
                {#each quotaWindows as window}
                  {@const used = window.used ?? window.currentUsage ?? 0}
                  {@const limit = window.limit ?? window.quotaLimit ?? window.total ?? 1}
                  {@const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0}
                  <div class="rounded-lg border border-border bg-secondary/30 p-4">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <Gauge size={14} class="text-muted-foreground" />
                        <span class="text-sm font-medium text-foreground">{window.provider ?? window.name ?? 'Provider'}</span>
                        {#if window.model}
                          <span class="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{window.model}</span>
                        {/if}
                      </div>
                      <span class="text-xs font-semibold" style="color: {quotaBarColor(pct)};">{pct.toFixed(0)}%</span>
                    </div>
                    <div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        class="h-full rounded-full transition-all duration-500"
                        style="width: {pct}%; background-color: {quotaBarColor(pct)};"
                      ></div>
                    </div>
                    <div class="mt-1.5 flex items-center justify-between">
                      <span class="text-[11px] text-muted-foreground" title={`$${used.toLocaleString('en', { minimumFractionDigits: 4 })}`}>
                        {formatCurrency(used)} used
                      </span>
                      <span class="text-[11px] text-muted-foreground" title={`$${limit.toLocaleString('en', { minimumFractionDigits: 4 })}`}>
                        {formatCurrency(limit)} limit
                      </span>
                    </div>
                    <!-- Model breakdown -->
                    {#if window.models && window.models.length > 0}
                      <div class="mt-2 space-y-1 border-t border-border pt-2">
                        {#each window.models as mdl}
                          {@const mdlUsed = mdl.used ?? mdl.currentUsage ?? 0}
                          {@const mdlLimit = mdl.limit ?? mdl.quotaLimit ?? limit}
                          {@const mdlPct = mdlLimit > 0 ? Math.min(100, (mdlUsed / mdlLimit) * 100) : 0}
                          <div class="flex items-center gap-3">
                            <span class="w-24 truncate text-[10px] font-mono text-muted-foreground">{mdl.model ?? mdl.name}</span>
                            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                              <div
                                class="h-full rounded-full"
                                style="width: {mdlPct}%; background-color: {quotaBarColor(mdlPct)};"
                              ></div>
                            </div>
                            <span class="text-[10px] text-muted-foreground w-16 text-right">{formatCurrency(mdlUsed)}</span>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Finance events table -->
          {#if financeEvents.length === 0}
            <div class="flex flex-col items-center justify-center py-12">
              <div class="rounded-full bg-secondary p-3 mb-3">
                <Receipt class="h-8 w-8 text-muted-foreground" />
              </div>
              <p class="text-sm text-muted-foreground">No finance events recorded</p>
            </div>
          {:else}
            <div class="border-t border-border">
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
                <div class="col-span-2">Date</div>
                <div class="col-span-2">Kind</div>
                <div class="col-span-2 text-right">Amount</div>
                <div class="col-span-3">Biller</div>
                <div class="col-span-3">Description</div>
              </div>

              {#each financeEvents as event, i (event.id ?? i)}
                {@const isRevenue = (event.kind ?? event.type ?? '').toLowerCase() === 'revenue'}
                <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-border last:border-0 hover:bg-accent/50 transition-colors">
                  <div class="col-span-2 text-muted-foreground">{formatDate(event.date ?? event.createdAt)}</div>
                  <div class="col-span-2">
                    <span
                      class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium {isRevenue
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400'}"
                    >
                      {event.kind ?? event.type ?? '---'}
                    </span>
                  </div>
                  <div class="col-span-2 text-right font-medium {isRevenue ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">
                    {isRevenue ? '+' : '-'}{formatCurrency(event.amount ?? event.value ?? 0)}
                  </div>
                  <div class="col-span-3 text-foreground truncate">{event.biller ?? event.vendor ?? event.source ?? '---'}</div>
                  <div class="col-span-3 text-muted-foreground truncate">{event.description ?? event.note ?? '---'}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </TabsContent>
    </Tabs>
  </div>
</div>
