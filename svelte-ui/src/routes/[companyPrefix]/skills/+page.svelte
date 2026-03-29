<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);
  let skills = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let search = $state("");

  let filteredSkills = $derived(
    search.trim()
      ? skills.filter(
          (s) =>
            s.name?.toLowerCase().includes(search.toLowerCase()) ||
            s.description?.toLowerCase().includes(search.toLowerCase()),
        )
      : skills,
  );

  onMount(() => {
    breadcrumbStore.set([{ label: "Skills" }]);

    api.api["company-skills"].get({
      query: { companyId: companyStore.selectedCompanyId ?? undefined },
    })
      .then((res) => {
        skills = (res.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load skills";
      })
      .finally(() => {
        loading = false;
      });
  });
</script>

<div class="p-6 space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">Company Skills</h1>
  </div>

  <!-- Search -->
  <div>
    <input
      type="text"
      bind:value={search}
      placeholder="Search skills..."
      class="flex h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    />
  </div>

  {#if loading}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <div class="h-24 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  {:else if filteredSkills.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <p class="text-sm text-muted-foreground">
        {search.trim() ? "No skills match your search." : "No skills configured for this company."}
      </p>
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each filteredSkills as skill}
        <div class="rounded-lg border border-border bg-card p-4 space-y-2">
          <div class="flex items-start justify-between">
            <h3 class="text-sm font-medium text-foreground">{skill.name}</h3>
            {#if skill.enabled !== undefined}
              <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                  {skill.enabled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}"
              >
                {skill.enabled ? "Active" : "Disabled"}
              </span>
            {/if}
          </div>
          {#if skill.description}
            <p class="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
          {/if}
          {#if skill.agentNames?.length}
            <div class="flex flex-wrap gap-1">
              {#each skill.agentNames as agentName}
                <span class="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{agentName}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
