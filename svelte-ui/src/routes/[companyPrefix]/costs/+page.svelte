<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from '$lib/components/ui/index.js';
  import {
    DollarSign,
    TrendingUp,
    PieChart,
    Server,
    Wallet,
    Bot,
    FolderKanban,
    Receipt,
    LayoutDashboard,
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

  let activeTab = $state('overview');

  let companyId = $derived(companyStore.selectedCompany?.id);

  // ── Load overview data ─────────────────────────────────────────────
  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/costs/summary`)
      .then((r) => r.json())
      .then((d) => {
        summary = d.summary ?? d;
        entries = d.entries ?? d.costs ?? d.items ?? [];
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  // ── Lazy-load tab data on tab change ───────────────────────────────
  $effect(() => {
    if (!companyId) return;

    if (activeTab === 'by-agent' && !byAgentLoaded) {
      byAgentLoading = true;
      api(`/api/companies/${companyId}/costs/by-agent`)
        .then((r) => r.json())
        .then((d) => {
          byAgentData = Array.isArray(d) ? d : d.data ?? d.items ?? d.agents ?? [];
          byAgentLoaded = true;
        })
        .catch(console.error)
        .finally(() => (byAgentLoading = false));
    }

    if (activeTab === 'by-provider' && !byProviderLoaded) {
      byProviderLoading = true;
      api(`/api/companies/${companyId}/costs/by-provider`)
        .then((r) => r.json())
        .then((d) => {
          byProviderData = Array.isArray(d) ? d : d.data ?? d.items ?? d.providers ?? [];
          byProviderLoaded = true;
        })
        .catch(console.error)
        .finally(() => (byProviderLoading = false));
    }

    if (activeTab === 'by-project' && !byProjectLoaded) {
      byProjectLoading = true;
      api(`/api/companies/${companyId}/costs/by-project`)
        .then((r) => r.json())
        .then((d) => {
          byProjectData = Array.isArray(d) ? d : d.data ?? d.items ?? d.projects ?? [];
          byProjectLoaded = true;
        })
        .catch(console.error)
        .finally(() => (byProjectLoading = false));
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

  // Tab definition
  const TABS = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    { value: 'by-agent', label: 'By Agent', icon: Bot },
    { value: 'by-provider', label: 'By Provider', icon: Server },
    { value: 'by-project', label: 'By Project', icon: FolderKanban },
    { value: 'finance', label: 'Finance', icon: Receipt },
  ] as const;
</script>

<div class="costs-root space-y-6 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-[#F8FAFC]">Costs & Budgets</h1>
    <p class="mt-1 text-sm text-[#94A3B8]">Track spending across agents and providers</p>
  </div>

  <!-- Summary cards (visible across all tabs) -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {#each Array(3) as _}
        <div class="h-28 animate-pulse rounded-xl border border-white/[0.08] bg-[#121218]"></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <!-- Total Spend -->
      <div class="rounded-xl border border-white/[0.08] bg-[#121218] p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="rounded-lg bg-blue-500/10 p-2">
            <DollarSign class="h-5 w-5 text-blue-400" />
          </div>
          <span class="text-sm font-medium text-[#94A3B8]">Total Spend</span>
        </div>
        <p class="text-2xl font-bold text-[#F8FAFC]">
          {formatCurrency(summary?.totalSpend ?? summary?.total)}
        </p>
        {#if summary?.period}
          <p class="mt-1 text-xs text-[#94A3B8]">{summary.period}</p>
        {/if}
      </div>

      <!-- Budget Used -->
      <div class="rounded-xl border border-white/[0.08] bg-[#121218] p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="rounded-lg bg-emerald-500/10 p-2">
            <Wallet class="h-5 w-5 text-emerald-400" />
          </div>
          <span class="text-sm font-medium text-[#94A3B8]">Budget Used</span>
        </div>
        <p class="text-2xl font-bold text-[#F8FAFC]">
          {summary?.budgetUsedPct !== undefined ? `${summary.budgetUsedPct}%` : formatCurrency(summary?.budgetUsed)}
        </p>
        {#if summary?.budgetTotal}
          <div class="mt-2">
            <div class="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                class="h-full rounded-full transition-all {(summary?.budgetUsedPct ?? 0) > 90 ? 'bg-red-500' : (summary?.budgetUsedPct ?? 0) > 70 ? 'bg-amber-500' : 'bg-emerald-500'}"
                style="width: {Math.min(100, summary?.budgetUsedPct ?? 0)}%"
              ></div>
            </div>
            <p class="mt-1 text-xs text-[#94A3B8]">of {formatCurrency(summary.budgetTotal)} budget</p>
          </div>
        {/if}
      </div>

      <!-- Top Provider -->
      <div class="rounded-xl border border-white/[0.08] bg-[#121218] p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="rounded-lg bg-orange-500/10 p-2">
            <Server class="h-5 w-5 text-orange-400" />
          </div>
          <span class="text-sm font-medium text-[#94A3B8]">Top Provider</span>
        </div>
        <p class="text-2xl font-bold text-[#F8FAFC]">
          {summary?.topProvider ?? summary?.topModel ?? '---'}
        </p>
        {#if summary?.topProviderCost}
          <p class="mt-1 text-xs text-[#94A3B8]">{formatCurrency(summary.topProviderCost)} spent</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Tabbed Breakdown Section -->
  <div class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
    <Tabs value={activeTab} onValueChange={(v) => { if (v) activeTab = v; }} class="w-full">
      <div class="border-b border-white/[0.05] px-5 pt-4 pb-0 overflow-x-auto">
        <TabsList class="bg-transparent p-0 h-auto gap-0">
          {#each TABS as tab}
            <TabsTrigger
              value={tab.value}
              class="rounded-none border-b-2 border-transparent px-4 pb-3 pt-1 text-sm font-medium text-[#94A3B8] data-[state=active]:border-blue-500 data-[state=active]:text-[#F8FAFC] data-[state=active]:bg-transparent hover:text-[#F8FAFC] transition-colors"
            >
              <tab.icon size={14} class="mr-1.5" />
              {tab.label}
            </TabsTrigger>
          {/each}
        </TabsList>
      </div>

      <!-- ─── Overview Tab ──────────────────────────────────────────── -->
      <TabsContent value="overview">
        {#if loading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-white/[0.05]"></div>
            {/each}
          </div>
        {:else if entries.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="rounded-full bg-white/[0.05] p-3 mb-3">
              <PieChart class="h-8 w-8 text-[#94A3B8]" />
            </div>
            <p class="text-sm text-[#94A3B8]">No cost data available</p>
          </div>
        {:else}
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#94A3B8] border-b border-white/[0.05]">
            <div class="col-span-4">Agent / Provider</div>
            <div class="col-span-2 text-right">Input Cost</div>
            <div class="col-span-2 text-right">Output Cost</div>
            <div class="col-span-2 text-right">Total</div>
            <div class="col-span-2 text-right">Requests</div>
          </div>

          {#each entries as entry, i (entry.id ?? i)}
            <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
              <div class="col-span-4 flex items-center gap-3 min-w-0">
                <div class="shrink-0 rounded-lg bg-white/[0.05] p-1.5">
                  <TrendingUp class="h-3.5 w-3.5 text-[#94A3B8]" />
                </div>
                <div class="min-w-0">
                  <p class="text-[#F8FAFC] truncate font-medium">{entry.agentName ?? entry.agent ?? entry.name ?? '---'}</p>
                  {#if entry.provider ?? entry.model}
                    <p class="text-xs text-[#94A3B8] truncate">{entry.provider ?? entry.model}</p>
                  {/if}
                </div>
              </div>
              <div class="col-span-2 text-right text-[#94A3B8]">{formatSmallCurrency(entry.inputCost)}</div>
              <div class="col-span-2 text-right text-[#94A3B8]">{formatSmallCurrency(entry.outputCost)}</div>
              <div class="col-span-2 text-right font-medium text-[#F8FAFC]">{formatSmallCurrency(entry.totalCost ?? entry.total ?? entry.cost)}</div>
              <div class="col-span-2 text-right text-[#94A3B8]">{entry.requestCount ?? entry.requests ?? '---'}</div>
            </div>
          {/each}
        {/if}
      </TabsContent>

      <!-- ─── By Agent Tab ──────────────────────────────────────────── -->
      <TabsContent value="by-agent">
        {#if byAgentLoading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-white/[0.05]"></div>
            {/each}
          </div>
        {:else if byAgentData.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="rounded-full bg-white/[0.05] p-3 mb-3">
              <Bot class="h-8 w-8 text-[#94A3B8]" />
            </div>
            <p class="text-sm text-[#94A3B8]">No agent cost data available</p>
          </div>
        {:else}
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#94A3B8] border-b border-white/[0.05]">
            <div class="col-span-4">Agent Name</div>
            <div class="col-span-2 text-right">Input Cost</div>
            <div class="col-span-2 text-right">Output Cost</div>
            <div class="col-span-2 text-right">Total</div>
            <div class="col-span-2 text-right">Requests</div>
          </div>

          {#each byAgentData as row, i (row.id ?? row.agentId ?? i)}
            <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
              <div class="col-span-4 flex items-center gap-3 min-w-0">
                <div class="shrink-0 rounded-lg bg-blue-500/10 p-1.5">
                  <Bot class="h-3.5 w-3.5 text-blue-400" />
                </div>
                <p class="text-[#F8FAFC] truncate font-medium">{row.agentName ?? row.name ?? row.agent ?? '---'}</p>
              </div>
              <div class="col-span-2 text-right text-[#94A3B8]">{formatSmallCurrency(row.inputCost)}</div>
              <div class="col-span-2 text-right text-[#94A3B8]">{formatSmallCurrency(row.outputCost)}</div>
              <div class="col-span-2 text-right font-medium text-[#F8FAFC]">{formatSmallCurrency(row.totalCost ?? row.total ?? row.cost)}</div>
              <div class="col-span-2 text-right text-[#94A3B8]">{row.requestCount ?? row.requests ?? '---'}</div>
            </div>
          {/each}
        {/if}
      </TabsContent>

      <!-- ─── By Provider Tab ───────────────────────────────────────── -->
      <TabsContent value="by-provider">
        {#if byProviderLoading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-white/[0.05]"></div>
            {/each}
          </div>
        {:else if byProviderData.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="rounded-full bg-white/[0.05] p-3 mb-3">
              <Server class="h-8 w-8 text-[#94A3B8]" />
            </div>
            <p class="text-sm text-[#94A3B8]">No provider cost data available</p>
          </div>
        {:else}
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#94A3B8] border-b border-white/[0.05]">
            <div class="col-span-4">Provider</div>
            <div class="col-span-2 text-right">Input Cost</div>
            <div class="col-span-2 text-right">Output Cost</div>
            <div class="col-span-2 text-right">Total</div>
            <div class="col-span-2 text-right">Requests</div>
          </div>

          {#each byProviderData as row, i (row.id ?? row.provider ?? i)}
            <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
              <div class="col-span-4 flex items-center gap-3 min-w-0">
                <div class="shrink-0 rounded-lg bg-orange-500/10 p-1.5">
                  <Server class="h-3.5 w-3.5 text-orange-400" />
                </div>
                <p class="text-[#F8FAFC] truncate font-medium">{row.provider ?? row.name ?? '---'}</p>
              </div>
              <div class="col-span-2 text-right text-[#94A3B8]">{formatSmallCurrency(row.inputCost)}</div>
              <div class="col-span-2 text-right text-[#94A3B8]">{formatSmallCurrency(row.outputCost)}</div>
              <div class="col-span-2 text-right font-medium text-[#F8FAFC]">{formatSmallCurrency(row.totalCost ?? row.total ?? row.cost)}</div>
              <div class="col-span-2 text-right text-[#94A3B8]">{row.requestCount ?? row.requests ?? '---'}</div>
            </div>
          {/each}
        {/if}
      </TabsContent>

      <!-- ─── By Project Tab ────────────────────────────────────────── -->
      <TabsContent value="by-project">
        {#if byProjectLoading}
          <div class="p-5 space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-white/[0.05]"></div>
            {/each}
          </div>
        {:else if byProjectData.length === 0}
          <div class="flex flex-col items-center justify-center py-12">
            <div class="rounded-full bg-white/[0.05] p-3 mb-3">
              <FolderKanban class="h-8 w-8 text-[#94A3B8]" />
            </div>
            <p class="text-sm text-[#94A3B8]">No project cost data available</p>
          </div>
        {:else}
          <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#94A3B8] border-b border-white/[0.05]">
            <div class="col-span-6">Project Name</div>
            <div class="col-span-3 text-right">Total Cost</div>
            <div class="col-span-3 text-right">Requests</div>
          </div>

          {#each byProjectData as row, i (row.id ?? row.projectId ?? i)}
            <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
              <div class="col-span-6 flex items-center gap-3 min-w-0">
                <div class="shrink-0 rounded-lg bg-violet-500/10 p-1.5">
                  <FolderKanban class="h-3.5 w-3.5 text-violet-400" />
                </div>
                <p class="text-[#F8FAFC] truncate font-medium">{row.projectName ?? row.name ?? row.project ?? '---'}</p>
              </div>
              <div class="col-span-3 text-right font-medium text-[#F8FAFC]">{formatCurrency(row.totalCost ?? row.total ?? row.cost)}</div>
              <div class="col-span-3 text-right text-[#94A3B8]">{row.requestCount ?? row.requests ?? '---'}</div>
            </div>
          {/each}
        {/if}
      </TabsContent>

      <!-- ─── Finance Tab ───────────────────────────────────────────── -->
      <TabsContent value="finance">
        {#if financeLoading}
          <div class="p-5 space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {#each Array(2) as _}
                <div class="h-24 animate-pulse rounded-lg bg-white/[0.05]"></div>
              {/each}
            </div>
            <div class="space-y-3">
              {#each Array(5) as _}
                <div class="h-10 animate-pulse rounded bg-white/[0.05]"></div>
              {/each}
            </div>
          </div>
        {:else}
          <!-- Revenue vs Expense summary cards -->
          <div class="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <div class="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="rounded-md bg-emerald-500/10 p-1.5">
                  <TrendingUp class="h-4 w-4 text-emerald-400" />
                </div>
                <span class="text-sm font-medium text-[#94A3B8]">Revenue</span>
              </div>
              <p class="text-2xl font-bold text-emerald-400">
                {formatCurrency(financeSummary?.revenue ?? financeSummary?.totalRevenue ?? 0)}
              </p>
            </div>
            <div class="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div class="flex items-center gap-2 mb-2">
                <div class="rounded-md bg-red-500/10 p-1.5">
                  <DollarSign class="h-4 w-4 text-red-400" />
                </div>
                <span class="text-sm font-medium text-[#94A3B8]">Expenses</span>
              </div>
              <p class="text-2xl font-bold text-red-400">
                {formatCurrency(financeSummary?.expense ?? financeSummary?.totalExpense ?? 0)}
              </p>
            </div>
          </div>

          <!-- Finance events table -->
          {#if financeEvents.length === 0}
            <div class="flex flex-col items-center justify-center py-12">
              <div class="rounded-full bg-white/[0.05] p-3 mb-3">
                <Receipt class="h-8 w-8 text-[#94A3B8]" />
              </div>
              <p class="text-sm text-[#94A3B8]">No finance events recorded</p>
            </div>
          {:else}
            <div class="border-t border-white/[0.05]">
              <div class="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#94A3B8] border-b border-white/[0.05]">
                <div class="col-span-2">Date</div>
                <div class="col-span-2">Kind</div>
                <div class="col-span-2 text-right">Amount</div>
                <div class="col-span-3">Biller</div>
                <div class="col-span-3">Description</div>
              </div>

              {#each financeEvents as event, i (event.id ?? i)}
                {@const isRevenue = (event.kind ?? event.type ?? '').toLowerCase() === 'revenue'}
                <div class="grid grid-cols-12 gap-4 px-5 py-3 text-sm border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors">
                  <div class="col-span-2 text-[#94A3B8]">{formatDate(event.date ?? event.createdAt)}</div>
                  <div class="col-span-2">
                    <span
                      class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium {isRevenue
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'}"
                    >
                      {event.kind ?? event.type ?? '---'}
                    </span>
                  </div>
                  <div class="col-span-2 text-right font-medium {isRevenue ? 'text-emerald-400' : 'text-red-400'}">
                    {isRevenue ? '+' : '-'}{formatCurrency(event.amount ?? event.value ?? 0)}
                  </div>
                  <div class="col-span-3 text-[#F8FAFC] truncate">{event.biller ?? event.vendor ?? event.source ?? '---'}</div>
                  <div class="col-span-3 text-[#94A3B8] truncate">{event.description ?? event.note ?? '---'}</div>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      </TabsContent>
    </Tabs>
  </div>
</div>
