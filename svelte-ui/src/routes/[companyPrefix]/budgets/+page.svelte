<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    DollarSign,
    Wallet,
    TrendingDown,
    Plus,
    Shield,
    ShieldAlert,
    AlertTriangle,
    CheckCircle,
    Clock,
    X,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Budget Policies' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface BudgetPolicy {
    id: string;
    scopeType: 'agent' | 'project' | 'company';
    scopeId?: string | null;
    scopeLabel?: string | null;
    amount: number; // cents
    windowKind: 'monthly' | 'annual' | 'lifetime';
    warnPercent: number;
    hardStopEnabled: boolean;
    currentSpend?: number;
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface BudgetIncident {
    id: string;
    policyId: string;
    type: string;
    message?: string;
    status: 'pending' | 'resolved';
    createdAt?: string;
    [key: string]: unknown;
  }

  interface BudgetOverview {
    policies: BudgetPolicy[];
    incidents: BudgetIncident[];
    currentSpend: number; // cents
    totalBudget: number; // cents
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let loading = $state(true);
  let policies = $state<BudgetPolicy[]>([]);
  let incidents = $state<BudgetIncident[]>([]);
  let currentSpend = $state(0);
  let totalBudget = $state(0);

  let showCreate = $state(false);
  let creating = $state(false);
  let resolvingId = $state<string | null>(null);

  // Form fields
  let formScopeType = $state<'agent' | 'project' | 'company'>('company');
  let formScopeId = $state('');
  let formAmount = $state('');
  let formWindowKind = $state<'monthly' | 'annual' | 'lifetime'>('monthly');
  let formWarnPercent = $state(80);
  let formHardStop = $state(false);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  let remaining = $derived(Math.max(0, totalBudget - currentSpend));
  let spendPercent = $derived(totalBudget > 0 ? Math.round((currentSpend / totalBudget) * 100) : 0);

  let pendingIncidents = $derived(incidents.filter((i) => i.status === 'pending'));

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/budgets/overview`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: BudgetOverview) => {
        policies = d.policies ?? [];
        incidents = d.incidents ?? [];
        currentSpend = d.currentSpend ?? 0;
        totalBudget = d.totalBudget ?? 0;
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function formatCentsCompact(cents: number): string {
    if (cents >= 100_000_00) return `$${(cents / 100_00).toFixed(0)}k`;
    return formatCents(cents);
  }

  function windowLabel(kind: string): string {
    const labels: Record<string, string> = {
      monthly: 'Monthly',
      annual: 'Annual',
      lifetime: 'Lifetime',
    };
    return labels[kind] ?? kind;
  }

  function windowBadgeColor(kind: string): string {
    const colors: Record<string, string> = {
      monthly: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      annual: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      lifetime: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    };
    return colors[kind] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }

  function scopeIcon(type: string): string {
    const icons: Record<string, string> = {
      agent: 'Agent',
      project: 'Project',
      company: 'Company',
    };
    return icons[type] ?? type;
  }

  function scopeBadgeColor(type: string): string {
    const colors: Record<string, string> = {
      agent: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      project: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      company: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };
    return colors[type] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
  }

  function spendBarColor(pct: number): string {
    if (pct > 90) return 'bg-red-500';
    if (pct > 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  function policySpendPct(policy: BudgetPolicy): number {
    if (!policy.amount || policy.amount === 0) return 0;
    return Math.round(((policy.currentSpend ?? 0) / policy.amount) * 100);
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function resetForm() {
    formScopeType = 'company';
    formScopeId = '';
    formAmount = '';
    formWindowKind = 'monthly';
    formWarnPercent = 80;
    formHardStop = false;
  }

  async function createPolicy() {
    if (!companyId || !formAmount) return;
    const amountCents = Math.round(parseFloat(formAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;

    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/budgets/policies`, {
        method: 'POST',
        body: JSON.stringify({
          scopeType: formScopeType,
          scopeId: formScopeId.trim() || undefined,
          amount: amountCents,
          windowKind: formWindowKind,
          warnPercent: formWarnPercent,
          hardStopEnabled: formHardStop,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      policies = [...policies, created];
      totalBudget += amountCents;
      resetForm();
      showCreate = false;
    } catch (e) {
      console.error(e);
    } finally {
      creating = false;
    }
  }

  async function resolveIncident(incidentId: string) {
    if (!companyId) return;
    resolvingId = incidentId;
    try {
      const res = await api(`/api/companies/${companyId}/budget-incidents/${incidentId}/resolve`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      incidents = incidents.map((i) =>
        i.id === incidentId ? { ...i, status: 'resolved' as const } : i
      );
    } catch (e) {
      console.error(e);
    } finally {
      resolvingId = null;
    }
  }
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Budget Policies</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage spending limits across agents, projects, and company</p>
    </div>
    <button
      onclick={() => (showCreate = !showCreate)}
      class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      <Plus class="h-4 w-4" />
      Add Policy
    </button>
  </div>

  <!-- Overview metric cards -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {#each Array(3) as _}
        <div class="h-28 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <!-- Total Budget -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="rounded-lg bg-blue-500/10 p-2">
            <Wallet class="h-5 w-5 text-blue-400" />
          </div>
          <span class="text-sm font-medium text-muted-foreground">Total Budget</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{formatCents(totalBudget)}</p>
        <p class="mt-1 text-xs text-muted-foreground">{policies.length} active {policies.length === 1 ? 'policy' : 'policies'}</p>
      </div>

      <!-- Current Spend -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="rounded-lg bg-emerald-500/10 p-2">
            <DollarSign class="h-5 w-5 text-emerald-400" />
          </div>
          <span class="text-sm font-medium text-muted-foreground">Current Spend</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{formatCents(currentSpend)}</p>
        {#if totalBudget > 0}
          <div class="mt-2">
            <div class="h-1.5 rounded-full bg-accent overflow-hidden">
              <div
                class="h-full rounded-full transition-all {spendBarColor(spendPercent)}"
                style="width: {Math.min(100, spendPercent)}%"
              ></div>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{spendPercent}% of total budget</p>
          </div>
        {/if}
      </div>

      <!-- Remaining -->
      <div class="rounded-xl border border-border bg-card p-5">
        <div class="flex items-center gap-3 mb-3">
          <div class="rounded-lg bg-orange-500/10 p-2">
            <TrendingDown class="h-5 w-5 text-orange-400" />
          </div>
          <span class="text-sm font-medium text-muted-foreground">Remaining</span>
        </div>
        <p class="text-2xl font-bold text-foreground">{formatCents(remaining)}</p>
        {#if pendingIncidents.length > 0}
          <p class="mt-1 text-xs text-amber-400">
            {pendingIncidents.length} pending {pendingIncidents.length === 1 ? 'incident' : 'incidents'}
          </p>
        {:else}
          <p class="mt-1 text-xs text-emerald-400">No incidents</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Create policy form -->
  {#if showCreate}
    <form
      onsubmit={(e) => { e.preventDefault(); createPolicy(); }}
      class="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <h2 class="text-sm font-semibold text-foreground">New Budget Policy</h2>
        <button
          type="button"
          onclick={() => { showCreate = false; resetForm(); }}
          class="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <!-- Scope Type -->
          <div>
            <label for="scope-type" class="block text-sm font-medium text-foreground mb-1">Scope</label>
            <select
              id="scope-type"
              bind:value={formScopeType}
              class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="company">Company-wide</option>
              <option value="agent">Agent</option>
              <option value="project">Project</option>
            </select>
          </div>

          <!-- Scope ID (shown only for agent/project) -->
          {#if formScopeType !== 'company'}
            <div>
              <label for="scope-id" class="block text-sm font-medium text-foreground mb-1">
                {formScopeType === 'agent' ? 'Agent ID' : 'Project ID'}
              </label>
              <input
                id="scope-id"
                bind:value={formScopeId}
                placeholder="Enter {formScopeType} identifier"
                class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          {/if}

          <!-- Amount -->
          <div>
            <label for="amount" class="block text-sm font-medium text-foreground mb-1">Amount (USD)</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                bind:value={formAmount}
                placeholder="0.00"
                class="w-full rounded-lg border border-border bg-accent/60 pl-7 pr-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              {formAmount ? `${Math.round(parseFloat(formAmount || '0') * 100)} cents` : 'Enter dollar amount'}
            </p>
          </div>

          <!-- Window -->
          <div>
            <label for="window-kind" class="block text-sm font-medium text-foreground mb-1">Window</label>
            <select
              id="window-kind"
              bind:value={formWindowKind}
              class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          <!-- Warn Percent -->
          <div>
            <label for="warn-pct" class="block text-sm font-medium text-foreground mb-1">Warn Threshold (%)</label>
            <input
              id="warn-pct"
              type="number"
              min="1"
              max="100"
              bind:value={formWarnPercent}
              class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p class="mt-1 text-xs text-muted-foreground">Alert when spend reaches this % of budget</p>
          </div>

          <!-- Hard Stop -->
          <div class="flex items-center gap-3 pt-6">
            <button
              type="button"
              role="switch"
              aria-checked={formHardStop}
              aria-label="Hard stop enabled"
              onclick={() => (formHardStop = !formHardStop)}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
                {formHardStop ? 'bg-blue-600' : 'bg-accent'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transition-transform
                  {formHardStop ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
            <div>
              <p class="text-sm font-medium text-foreground">Hard Stop</p>
              <p class="text-xs text-muted-foreground">Block operations when budget is exceeded</p>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2 border-t border-border/50">
          <button
            type="submit"
            disabled={creating || !formAmount}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Policy'}
          </button>
          <button
            type="button"
            onclick={() => { showCreate = false; resetForm(); }}
            class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  {/if}

  <!-- Pending Incidents -->
  {#if !loading && pendingIncidents.length > 0}
    <div class="rounded-xl border border-amber-500/20 bg-card overflow-hidden">
      <div class="flex items-center gap-3 px-5 py-4 border-b border-amber-500/10">
        <div class="rounded-lg bg-amber-500/10 p-2">
          <AlertTriangle class="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-amber-400">Budget Incidents</h2>
          <p class="text-xs text-muted-foreground">{pendingIncidents.length} pending {pendingIncidents.length === 1 ? 'incident' : 'incidents'} requiring attention</p>
        </div>
      </div>

      <div class="divide-y divide-white/[0.05]">
        {#each pendingIncidents as incident (incident.id)}
          <div class="flex items-center justify-between gap-4 px-5 py-4">
            <div class="flex items-center gap-3 min-w-0">
              <ShieldAlert class="h-4 w-4 shrink-0 text-amber-400" />
              <div class="min-w-0">
                <p class="text-sm text-foreground truncate">
                  {incident.message ?? `${incident.type} incident on policy ${incident.policyId}`}
                </p>
                {#if incident.createdAt}
                  <p class="text-xs text-muted-foreground mt-0.5">
                    <Clock class="inline h-3 w-3 -mt-0.5" />
                    {new Date(incident.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                {/if}
              </div>
            </div>
            <button
              onclick={() => resolveIncident(incident.id)}
              disabled={resolvingId === incident.id}
              class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
            >
              <CheckCircle class="h-3.5 w-3.5" />
              {resolvingId === incident.id ? 'Resolving...' : 'Resolve'}
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Policies list -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <div class="h-24 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>
  {:else if policies.length === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <Shield class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">No budget policies</h3>
      <p class="mt-1 text-sm text-muted-foreground">Create policies to control and monitor spending</p>
      <button
        onclick={() => (showCreate = true)}
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus class="h-4 w-4" />
        Add Policy
      </button>
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-card overflow-hidden">
      <div class="px-5 py-4 border-b border-border/50">
        <h2 class="text-sm font-semibold text-foreground">Active Policies</h2>
      </div>

      <div class="divide-y divide-white/[0.05]">
        {#each policies as policy (policy.id)}
          {@const pct = policySpendPct(policy)}
          <div class="px-5 py-4 hover:bg-accent/40 transition-colors">
            <div class="flex items-start justify-between gap-4">
              <!-- Left side: scope + details -->
              <div class="min-w-0 flex-1 space-y-2">
                <div class="flex items-center gap-2 flex-wrap">
                  <!-- Scope badge -->
                  <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium {scopeBadgeColor(policy.scopeType)}">
                    {scopeIcon(policy.scopeType)}
                  </span>
                  {#if policy.scopeLabel}
                    <span class="text-sm font-medium text-foreground truncate">{policy.scopeLabel}</span>
                  {:else if policy.scopeId}
                    <span class="text-sm font-mono text-muted-foreground truncate">{policy.scopeId}</span>
                  {/if}
                  <!-- Window badge -->
                  <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium {windowBadgeColor(policy.windowKind)}">
                    {windowLabel(policy.windowKind)}
                  </span>
                </div>

                <!-- Spend progress -->
                <div class="flex items-center gap-3">
                  <div class="h-1.5 flex-1 max-w-xs rounded-full bg-accent overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all {spendBarColor(pct)}"
                      style="width: {Math.min(100, pct)}%"
                    ></div>
                  </div>
                  <span class="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
                    {formatCents(policy.currentSpend ?? 0)} / {formatCents(policy.amount)}
                  </span>
                </div>

                <!-- Meta row -->
                <div class="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Warn at {policy.warnPercent}%</span>
                  <span class="flex items-center gap-1">
                    {#if policy.hardStopEnabled}
                      <ShieldAlert class="h-3 w-3 text-red-400" />
                      <span class="text-red-400">Hard stop enabled</span>
                    {:else}
                      <Shield class="h-3 w-3" />
                      <span>Warn only</span>
                    {/if}
                  </span>
                  {#if policy.status}
                    <span class="inline-flex items-center gap-1">
                      <span
                        class="h-1.5 w-1.5 rounded-full
                          {policy.status === 'active' ? 'bg-emerald-500' : policy.status === 'exceeded' ? 'bg-red-500' : 'bg-zinc-500'}"
                      ></span>
                      {policy.status}
                    </span>
                  {/if}
                </div>
              </div>

              <!-- Right side: amount -->
              <div class="text-right shrink-0">
                <p class="text-lg font-bold text-foreground tabular-nums">{formatCents(policy.amount)}</p>
                <p class="text-xs text-muted-foreground">per {policy.windowKind === 'lifetime' ? 'lifetime' : policy.windowKind.replace('ly', '')}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
