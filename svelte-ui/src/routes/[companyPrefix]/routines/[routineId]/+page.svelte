<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  let routineId = $derived($page.params.routineId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let routine = $state<any>(null);
  let runs = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let toggling = $state(false);

  $effect(() => {
    if (!routineId) return;
    loading = true;
    error = null;

    api.api.routines({ id: routineId }).get()
      .then((res) => {
        routine = res.data;
        runs = (routine as any)?.runs ?? (routine as any)?.recentRuns ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load routine";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Routines", href: `/${companyPrefix}/routines` },
      { label: routine?.name ?? "Routine" },
    ]);
  });

  async function toggleEnabled() {
    if (toggling || !routine) return;
    toggling = true;
    try {
      await api.api.routines({ id: routineId }).patch({
        enabled: !routine.enabled,
      });
      routine = { ...routine, enabled: !routine.enabled };
    } catch {
      // silent
    } finally {
      toggling = false;
    }
  }

  async function triggerNow() {
    if (toggling) return;
    toggling = true;
    try {
      await api.api.routines({ id: routineId }).trigger.post();
    } catch {
      // silent
    } finally {
      toggling = false;
    }
  }
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-56 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-80 rounded bg-muted animate-pulse"></div>
    <div class="h-32 rounded-lg bg-muted animate-pulse mt-4"></div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if routine}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold text-foreground">{routine.name}</h1>
        {#if routine.description}
          <p class="text-sm text-muted-foreground">{routine.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
            {routine.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}"
        >
          {routine.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>
    </div>

    <!-- Properties -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Schedule</dt>
        <dd class="mt-1 text-sm font-mono text-foreground">{routine.cron ?? routine.schedule ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent</dt>
        <dd class="mt-1 text-sm text-foreground">{routine.agentName ?? routine.agentId ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Run</dt>
        <dd class="mt-1 text-sm text-foreground">
          {routine.lastRunAt ? new Date(routine.lastRunAt).toLocaleString() : "Never"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next Run</dt>
        <dd class="mt-1 text-sm text-foreground">
          {routine.nextRunAt ? new Date(routine.nextRunAt).toLocaleString() : "—"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trigger</dt>
        <dd class="mt-1 text-sm text-foreground">{routine.triggerType ?? "cron"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</dt>
        <dd class="mt-1 text-sm text-foreground">
          {routine.createdAt ? new Date(routine.createdAt).toLocaleDateString() : "—"}
        </dd>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button
        onclick={toggleEnabled}
        disabled={toggling}
        class="inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
      >
        {routine.enabled ? "Disable" : "Enable"}
      </button>
      <button
        onclick={triggerNow}
        disabled={toggling || !routine.enabled}
        class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        Trigger Now
      </button>
    </div>

    <!-- Recent Runs -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium text-foreground">Recent Runs</h2>
      {#if runs.length === 0}
        <p class="text-sm text-muted-foreground">No runs recorded yet.</p>
      {:else}
        <div class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each runs as run}
            <div class="flex items-center justify-between p-3">
              <div class="space-y-0.5">
                <p class="text-sm text-foreground">{run.id}</p>
                <p class="text-xs text-muted-foreground">
                  {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                  {#if run.durationMs}
                    <span class="ml-1">({(run.durationMs / 1000).toFixed(1)}s)</span>
                  {/if}
                </p>
              </div>
              <span
                class="text-xs rounded-full px-2 py-0.5
                  {run.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                   run.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                   'bg-muted text-muted-foreground'}"
              >
                {run.status ?? "unknown"}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
