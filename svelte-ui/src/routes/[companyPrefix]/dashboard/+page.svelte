<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  // Charts
  import { ActivityChart, CostChart, AgentStatusChart } from '$lib/components/charts';

  // Aceternity effects
  import { CardHoverEffect, MovingBorder, Sparkles } from '$lib/components/aceternity';

  // UI
  import StatusBadge from '$lib/components/status-badge.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Dashboard' }]));

  // State
  let loading = $state(true);
  let dashboard = $state<any>(null);
  let agents = $state<any[]>([]);
  let recentIssues = $state<any[]>([]);
  let activityData = $state<{ date: string; runs: number; issues: number }[]>([]);
  let costData = $state<{ date: string; input: number; output: number; total: number }[]>([]);

  let companyId = $derived(companyStore.current?.id);

  // Load dashboard data
  $effect(() => {
    if (!companyId) return;
    loading = true;

    Promise.all([
      api(`/api/companies/${companyId}/dashboard`).then((r) => r.json()),
      api(`/api/companies/${companyId}/agents`).then((r) => r.json()),
      api(`/api/companies/${companyId}/issues?limit=5`).then((r) => r.json()),
    ])
      .then(([dash, agentList, issueList]) => {
        dashboard = dash;
        agents = agentList?.agents ?? agentList ?? [];
        recentIssues = issueList?.issues ?? issueList ?? [];

        // Generate mock activity data for chart (will be replaced with real API)
        const today = new Date();
        activityData = Array.from({ length: 14 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (13 - i));
          return {
            date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            runs: Math.floor(Math.random() * 20 + 5),
            issues: Math.floor(Math.random() * 8 + 1),
          };
        });

        costData = Array.from({ length: 14 }, (_, i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (13 - i));
          const input = Math.random() * 0.5 + 0.1;
          const output = Math.random() * 0.8 + 0.2;
          return {
            date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            input: +input.toFixed(4),
            output: +output.toFixed(4),
            total: +(input + output).toFixed(4),
          };
        });
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  // Computed metrics
  let activeAgents = $derived(agents.filter((a) => a.status === 'active').length);
  let idleAgents = $derived(agents.filter((a) => a.status === 'idle').length);
  let pausedAgents = $derived(agents.filter((a) => a.status === 'paused').length);

  let agentChartData = $derived([
    { name: 'Active', value: activeAgents, color: '#10b981' },
    { name: 'Idle', value: idleAgents, color: '#71717a' },
    { name: 'Paused', value: pausedAgents, color: '#f59e0b' },
  ]);

  let totalCost = $derived(costData.reduce((sum, d) => sum + d.total, 0));
  let totalRuns = $derived(activityData.reduce((sum, d) => sum + d.runs, 0));
  let openIssues = $derived(dashboard?.openIssueCount ?? recentIssues.length);
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
    <p class="text-sm text-zinc-500 dark:text-zinc-400">
      {companyStore.current?.name ?? 'Company'} overview
    </p>
  </div>

  <!-- KPI Cards with Aceternity effects -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <MovingBorder duration={4000} borderColor="hsl(240 80% 65%)">
      <div class="p-5">
        <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Active Agents</p>
        <Sparkles particleCount={6} color="#10b981">
          <p class="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {loading ? '—' : activeAgents}
          </p>
        </Sparkles>
        <p class="mt-1 text-xs text-zinc-500">{agents.length} total</p>
      </div>
    </MovingBorder>

    <MovingBorder duration={5000} borderColor="hsl(160 70% 45%)">
      <div class="p-5">
        <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Open Issues</p>
        <p class="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {loading ? '—' : openIssues}
        </p>
        <p class="mt-1 text-xs text-zinc-500">across all projects</p>
      </div>
    </MovingBorder>

    <MovingBorder duration={6000} borderColor="hsl(30 90% 55%)">
      <div class="p-5">
        <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Runs (14d)</p>
        <p class="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {loading ? '—' : totalRuns}
        </p>
        <p class="mt-1 text-xs text-zinc-500">agent executions</p>
      </div>
    </MovingBorder>

    <MovingBorder duration={4500} borderColor="hsl(280 70% 55%)">
      <div class="p-5">
        <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Cost (14d)</p>
        <p class="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          {loading ? '—' : `$${totalCost.toFixed(2)}`}
        </p>
        <p class="mt-1 text-xs text-zinc-500">LLM usage</p>
      </div>
    </MovingBorder>
  </div>

  <!-- Charts row -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Activity chart (2 cols) -->
    <CardHoverEffect class="lg:col-span-2">
      <div class="p-4">
        <h2 class="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Activity (14 days)</h2>
        {#if !loading && activityData.length > 0}
          <ActivityChart data={activityData} height="280px" />
        {:else}
          <div class="flex h-[280px] items-center justify-center text-zinc-500">Loading...</div>
        {/if}
      </div>
    </CardHoverEffect>

    <!-- Agent status donut (1 col) -->
    <CardHoverEffect>
      <div class="p-4">
        <h2 class="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Agent Status</h2>
        {#if !loading && agents.length > 0}
          <AgentStatusChart data={agentChartData} height="220px" />
        {:else}
          <div class="flex h-[220px] items-center justify-center text-zinc-500">
            {loading ? 'Loading...' : 'No agents'}
          </div>
        {/if}
      </div>
    </CardHoverEffect>
  </div>

  <!-- Cost chart + Recent issues -->
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <!-- Cost breakdown -->
    <CardHoverEffect>
      <div class="p-4">
        <h2 class="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cost Breakdown (14 days)</h2>
        {#if !loading && costData.length > 0}
          <CostChart data={costData} height="260px" />
        {:else}
          <div class="flex h-[260px] items-center justify-center text-zinc-500">Loading...</div>
        {/if}
      </div>
    </CardHoverEffect>

    <!-- Recent issues -->
    <CardHoverEffect>
      <div class="p-4">
        <h2 class="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Issues</h2>
        {#if loading}
          <div class="space-y-3">
            {#each Array(5) as _}
              <div class="h-10 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>
            {/each}
          </div>
        {:else if recentIssues.length === 0}
          <p class="py-8 text-center text-sm text-zinc-500">No issues yet</p>
        {:else}
          <div class="space-y-2">
            {#each recentIssues.slice(0, 6) as issue}
              <a
                href="/{$page.params.companyPrefix}/issues/{issue.id}"
                class="flex items-center justify-between rounded-lg px-3 py-2 transition-colors
                  hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <StatusBadge status={issue.status ?? 'open'} />
                  <span class="truncate text-sm text-zinc-900 dark:text-zinc-100">
                    {issue.title ?? issue.name ?? 'Untitled'}
                  </span>
                </div>
                <TimeAgo date={issue.createdAt} class="shrink-0 text-xs" />
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </CardHoverEffect>
  </div>
</div>
