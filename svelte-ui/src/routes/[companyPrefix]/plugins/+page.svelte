<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);
  let plugins = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(() => {
    breadcrumbStore.set([{ label: "Plugins" }]);

    api.api.plugins.get({
      query: { companyId: companyStore.selectedCompanyId ?? undefined },
    })
      .then((res) => {
        plugins = (res.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load plugins";
      })
      .finally(() => {
        loading = false;
      });
  });
</script>

<div class="p-6 space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">Plugins</h1>
  </div>

  {#if loading}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(3) as _}
        <div class="h-28 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  {:else if plugins.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <p class="text-sm text-muted-foreground">No plugins installed.</p>
      <p class="text-xs text-muted-foreground mt-1">Install plugins to extend your workspace capabilities.</p>
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each plugins as plugin}
        <a
          href="/{companyPrefix}/plugins/{plugin.id}"
          class="rounded-lg border border-border bg-card p-4 space-y-2 hover:bg-muted/50 transition-colors"
        >
          <div class="flex items-start justify-between">
            <h3 class="text-sm font-medium text-foreground">{plugin.name}</h3>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                {plugin.status === 'active' ? 'bg-green-500/10 text-green-500' :
                 plugin.status === 'error' ? 'bg-destructive/10 text-destructive' :
                 'bg-muted text-muted-foreground'}"
            >
              {plugin.status ?? "installed"}
            </span>
          </div>
          {#if plugin.description}
            <p class="text-xs text-muted-foreground line-clamp-2">{plugin.description}</p>
          {/if}
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            {#if plugin.version}
              <span>v{plugin.version}</span>
            {/if}
            {#if plugin.author}
              <span>by {plugin.author}</span>
            {/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>
