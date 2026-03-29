<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  let projectId = $derived($page.params.projectId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let project = $state<any>(null);
  let issues = $state<any[]>([]);
  let goals = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  $effect(() => {
    if (!projectId) return;
    loading = true;
    error = null;

    Promise.all([
      api.api.projects({ id: projectId }).get(),
      api.api.projects({ id: projectId }).issues.get().catch(() => ({ data: [] })),
      api.api.projects({ id: projectId }).goals.get().catch(() => ({ data: [] })),
    ])
      .then(([projRes, issuesRes, goalsRes]) => {
        project = projRes.data;
        issues = (issuesRes.data as any[]) ?? [];
        goals = (goalsRes.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load project";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Projects", href: `/${companyPrefix}/projects` },
      { label: project?.name ?? "Project" },
    ]);
  });
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-56 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-80 rounded bg-muted animate-pulse"></div>
    <div class="grid gap-4 md:grid-cols-2 mt-6">
      {#each Array(4) as _}
        <div class="h-20 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if project}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold text-foreground">{project.name}</h1>
        {#if project.description}
          <p class="text-sm text-muted-foreground">{project.description}</p>
        {/if}
      </div>
      <span
        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
          {project.status === 'active' ? 'bg-green-500/10 text-green-500' :
           project.status === 'archived' ? 'bg-muted text-muted-foreground' :
           'bg-blue-500/10 text-blue-500'}"
      >
        {project.status ?? "active"}
      </span>
    </div>

    <!-- Properties -->
    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issues</dt>
        <dd class="mt-1 text-lg font-semibold text-foreground">{issues.length}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Goals</dt>
        <dd class="mt-1 text-lg font-semibold text-foreground">{goals.length}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</dt>
        <dd class="mt-1 text-sm text-foreground">
          {project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "—"}
        </dd>
      </div>
    </div>

    <!-- Goals -->
    {#if goals.length > 0}
      <div class="space-y-3">
        <h2 class="text-sm font-medium text-foreground">Goals</h2>
        <div class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each goals as goal}
            <a
              href="/{companyPrefix}/goals/{goal.id}"
              class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <span class="text-sm text-foreground">{goal.title ?? goal.name}</span>
              <span class="text-xs text-muted-foreground">{goal.status ?? ""}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Issues -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-foreground">Issues</h2>
        <a
          href="/{companyPrefix}/issues"
          class="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all
        </a>
      </div>
      {#if issues.length === 0}
        <p class="text-sm text-muted-foreground">No issues in this project.</p>
      {:else}
        <div class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each issues as issue}
            <a
              href="/{companyPrefix}/issues/{issue.id}"
              class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <div class="space-y-0.5 min-w-0 flex-1">
                <p class="text-sm text-foreground truncate">{issue.title}</p>
                <p class="text-xs text-muted-foreground">{issue.priority ?? ""}</p>
              </div>
              <span
                class="text-xs rounded-full px-2 py-0.5 shrink-0 ml-2
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
