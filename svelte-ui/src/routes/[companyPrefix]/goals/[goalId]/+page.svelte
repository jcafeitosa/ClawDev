<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  let goalId = $derived($page.params.goalId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let goal = $state<any>(null);
  let linkedIssues = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!goalId) return;
    loading = true;
    error = null;

    api.api.goals({ id: goalId }).get()
      .then((res) => {
        goal = res.data;
        linkedIssues = (goal as any)?.issues ?? (goal as any)?.linkedIssues ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load goal";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Goals", href: `/${companyPrefix}/goals` },
      { label: goal?.title ?? "Goal" },
    ]);
  });

  let progressPercent = $derived(() => {
    if (!linkedIssues.length) return 0;
    const done = linkedIssues.filter((i: any) => i.status === "done" || i.status === "closed").length;
    return Math.round((done / linkedIssues.length) * 100);
  });
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-56 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-80 rounded bg-muted animate-pulse"></div>
    <div class="h-24 rounded-lg bg-muted animate-pulse mt-4"></div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if goal}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="space-y-1">
      <h1 class="text-xl font-semibold text-foreground">{goal.title}</h1>
      {#if goal.description}
        <p class="text-sm text-muted-foreground">{goal.description}</p>
      {/if}
    </div>

    <!-- Properties -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</dt>
        <dd class="mt-1">
          <span
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
              {goal.status === 'achieved' ? 'bg-green-500/10 text-green-500' :
               goal.status === 'active' ? 'bg-blue-500/10 text-blue-500' :
               goal.status === 'at_risk' ? 'bg-red-500/10 text-red-500' :
               'bg-muted text-muted-foreground'}"
          >
            {goal.status ?? "active"}
          </span>
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</dt>
        <dd class="mt-1">
          <div class="flex items-center gap-2">
            <div class="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                class="h-full rounded-full bg-primary transition-all"
                style="width: {progressPercent()}%"
              ></div>
            </div>
            <span class="text-xs font-medium text-foreground">{progressPercent()}%</span>
          </div>
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Linked Issues</dt>
        <dd class="mt-1 text-lg font-semibold text-foreground">{linkedIssues.length}</dd>
      </div>
    </div>

    <!-- Target date -->
    {#if goal.targetDate}
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Date</dt>
        <dd class="mt-1 text-sm text-foreground">{new Date(goal.targetDate).toLocaleDateString()}</dd>
      </div>
    {/if}

    <!-- Linked Issues -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium text-foreground">Linked Issues</h2>
      {#if linkedIssues.length === 0}
        <p class="text-sm text-muted-foreground">No issues linked to this goal.</p>
      {:else}
        <div class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each linkedIssues as issue}
            <a
              href="/{companyPrefix}/issues/{issue.id}"
              class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <span class="text-sm text-foreground">{issue.title}</span>
              <span
                class="text-xs rounded-full px-2 py-0.5
                  {issue.status === 'done' ? 'bg-green-500/10 text-green-500' :
                   issue.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-500' :
                   'bg-muted text-muted-foreground'}"
              >
                {issue.status ?? "open"}
              </span>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
