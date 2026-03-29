<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { onMount } from "svelte";

  let agentId = $derived($page.params.agentId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let agent = $state<any>(null);
  let runs = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!agentId) return;
    loading = true;
    error = null;

    Promise.all([
      api.api.agents({ id: agentId }).get(),
      api.api.agents({ id: agentId }).runs.get(),
    ])
      .then(([agentRes, runsRes]) => {
        agent = agentRes.data;
        runs = (runsRes.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load agent";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Agents", href: `/${companyPrefix}/agents` },
      { label: agent?.name ?? "Agent" },
    ]);
  });
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-48 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-96 rounded bg-muted animate-pulse"></div>
    <div class="grid gap-4 md:grid-cols-2 mt-6">
      {#each Array(4) as _}
        <div class="h-24 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if agent}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold text-foreground">{agent.name}</h1>
        <p class="text-sm text-muted-foreground">{agent.role ?? "Agent"}</p>
      </div>
      <span
        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
          {agent.status === 'active' ? 'bg-green-500/10 text-green-500' :
           agent.status === 'idle' ? 'bg-yellow-500/10 text-yellow-500' :
           'bg-muted text-muted-foreground'}"
      >
        {agent.status ?? "unknown"}
      </span>
    </div>

    <!-- Properties grid -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Adapter</dt>
        <dd class="mt-1 text-sm text-foreground">{agent.adapterType ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</dt>
        <dd class="mt-1 text-sm text-foreground">{agent.model ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reports To</dt>
        <dd class="mt-1 text-sm text-foreground">{agent.reportsTo ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Max Concurrent</dt>
        <dd class="mt-1 text-sm text-foreground">{agent.maxConcurrent ?? 1}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</dt>
        <dd class="mt-1 text-sm text-foreground">
          {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "—"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monthly Spend</dt>
        <dd class="mt-1 text-sm text-foreground">
          {agent.spentMonthlyCents != null ? `$${(agent.spentMonthlyCents / 100).toFixed(2)}` : "—"}
        </dd>
      </div>
    </div>

    <!-- System prompt -->
    {#if agent.systemPrompt}
      <div class="rounded-lg border border-border bg-card p-4">
        <h2 class="text-sm font-medium text-foreground mb-2">System Prompt</h2>
        <pre class="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-3 max-h-48 overflow-y-auto">{agent.systemPrompt}</pre>
      </div>
    {/if}

    <!-- Recent Runs -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium text-foreground">Recent Runs</h2>
      {#if runs.length === 0}
        <p class="text-sm text-muted-foreground">No runs yet.</p>
      {:else}
        <div class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each runs.slice(0, 20) as run}
            <a
              href="/{companyPrefix}/runs/{run.id}"
              class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <div class="space-y-0.5">
                <p class="text-sm text-foreground">{run.issueTitle ?? run.id}</p>
                <p class="text-xs text-muted-foreground">
                  {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                </p>
              </div>
              <span
                class="text-xs rounded-full px-2 py-0.5
                  {run.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                   run.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                   run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                   'bg-muted text-muted-foreground'}"
              >
                {run.status ?? "unknown"}
              </span>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
