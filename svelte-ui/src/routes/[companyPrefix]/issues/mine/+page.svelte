<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { authClient } from "$lib/auth-client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);
  let issues = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let statusFilter = $state<string>("all");

  const session = authClient.useSession();

  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

  let filteredIssues = $derived(
    statusFilter === "all"
      ? issues
      : issues.filter((i) => i.status === statusFilter),
  );

  let sortedIssues = $derived(
    [...filteredIssues].sort((a, b) => {
      const pa = priorityOrder[a.priority ?? "none"] ?? 4;
      const pb = priorityOrder[b.priority ?? "none"] ?? 4;
      return pa - pb;
    }),
  );

  $effect(() => {
    const userId = ($session as any)?.data?.user?.id;
    if (!userId) return;
    loading = true;
    error = null;

    api.api.issues.get({
      query: {
        companyId: companyStore.selectedCompanyId ?? undefined,
        assigneeId: userId,
      },
    })
      .then((res) => {
        issues = (res.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load issues";
      })
      .finally(() => {
        loading = false;
      });
  });

  onMount(() => {
    breadcrumbStore.set([
      { label: "Issues", href: `/${companyPrefix}/issues` },
      { label: "My Issues" },
    ]);
  });
</script>

<div class="p-6 space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">My Issues</h1>
    <select
      bind:value={statusFilter}
      class="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <option value="all">All statuses</option>
      <option value="open">Open</option>
      <option value="in_progress">In Progress</option>
      <option value="in_review">In Review</option>
      <option value="done">Done</option>
      <option value="blocked">Blocked</option>
    </select>
  </div>

  {#if loading}
    <div class="space-y-2">
      {#each Array(5) as _}
        <div class="h-14 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  {:else if sortedIssues.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <p class="text-sm text-muted-foreground">No issues assigned to you.</p>
    </div>
  {:else}
    <div class="divide-y divide-border rounded-lg border border-border bg-card">
      {#each sortedIssues as issue}
        <a
          href="/{companyPrefix}/issues/{issue.id}"
          class="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div class="space-y-0.5 min-w-0 flex-1">
            <p class="text-sm text-foreground truncate">{issue.title}</p>
            <div class="flex items-center gap-2">
              {#if issue.projectName}
                <span class="text-xs text-muted-foreground">{issue.projectName}</span>
              {/if}
              {#if issue.priority}
                <span class="text-xs text-muted-foreground capitalize">{issue.priority}</span>
              {/if}
            </div>
          </div>
          <span
            class="text-xs rounded-full px-2 py-0.5 shrink-0 ml-2
              {issue.status === 'done' ? 'bg-green-500/10 text-green-500' :
               issue.status === 'in_progress' ? 'bg-yellow-500/10 text-yellow-500' :
               issue.status === 'in_review' ? 'bg-purple-500/10 text-purple-500' :
               issue.status === 'blocked' ? 'bg-red-500/10 text-red-500' :
               'bg-muted text-muted-foreground'}"
          >
            {issue.status ?? "open"}
          </span>
        </a>
      {/each}
    </div>
    <p class="text-xs text-muted-foreground">{sortedIssues.length} issue{sortedIssues.length === 1 ? "" : "s"}</p>
  {/if}
</div>
