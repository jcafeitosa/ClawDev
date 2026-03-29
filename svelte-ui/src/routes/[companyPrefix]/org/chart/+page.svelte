<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);
  let agents = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  interface TreeNode {
    agent: any;
    children: TreeNode[];
  }

  let tree = $derived(buildTree(agents));

  function buildTree(allAgents: any[]): TreeNode[] {
    const byParent = new Map<string | null, any[]>();

    for (const a of allAgents) {
      const parentId = a.reportsTo ?? null;
      if (!byParent.has(parentId)) byParent.set(parentId, []);
      byParent.get(parentId)!.push(a);
    }

    function buildNodes(parentId: string | null): TreeNode[] {
      const children = byParent.get(parentId) ?? [];
      return children.map((agent) => ({
        agent,
        children: buildNodes(agent.id),
      }));
    }

    return buildNodes(null);
  }

  onMount(() => {
    breadcrumbStore.set([
      { label: "Org", href: `/${companyPrefix}/org` },
      { label: "Chart" },
    ]);

    api.api.agents.get({ query: { companyId: companyStore.selectedCompanyId ?? undefined } })
      .then((res) => {
        agents = (res.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load agents";
      })
      .finally(() => {
        loading = false;
      });
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    idle: "bg-yellow-500",
    offline: "bg-muted-foreground",
  };
</script>

<div class="p-6 space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-foreground">Organization Chart</h1>
    <a
      href="/{companyPrefix}/agents/new"
      class="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
    >
      Add Agent
    </a>
  </div>

  {#if loading}
    <div class="flex justify-center py-16">
      <div class="space-y-4 w-full max-w-md">
        <div class="h-16 rounded-lg bg-muted animate-pulse mx-auto w-40"></div>
        <div class="flex justify-center gap-8">
          <div class="h-14 w-32 rounded-lg bg-muted animate-pulse"></div>
          <div class="h-14 w-32 rounded-lg bg-muted animate-pulse"></div>
        </div>
      </div>
    </div>
  {:else if error}
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  {:else if agents.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <p class="text-sm text-muted-foreground">No agents in this company yet.</p>
      <a
        href="/{companyPrefix}/agents/new"
        class="mt-3 inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
      >
        Create First Agent
      </a>
    </div>
  {:else}
    <!-- CSS-based org chart tree -->
    <div class="overflow-x-auto pb-8">
      <div class="inline-flex flex-col items-center min-w-full">
        {#each tree as node}
          {@render orgNode(node, 0)}
        {/each}
      </div>
    </div>
  {/if}
</div>

{#snippet orgNode(node: TreeNode, depth: number)}
  <div class="flex flex-col items-center">
    <!-- Agent card -->
    <a
      href="/{companyPrefix}/agents/{node.agent.id}"
      class="rounded-lg border border-border bg-card p-3 min-w-[10rem] text-center hover:bg-muted/50 transition-colors shadow-sm"
    >
      <div class="flex items-center justify-center gap-1.5 mb-1">
        <span class="size-2 rounded-full {statusColors[node.agent.status] ?? 'bg-muted-foreground'}"></span>
        <p class="text-sm font-medium text-foreground truncate">{node.agent.name}</p>
      </div>
      <p class="text-xs text-muted-foreground truncate">{node.agent.role ?? node.agent.adapterType ?? "Agent"}</p>
    </a>

    <!-- Children -->
    {#if node.children.length > 0}
      <!-- Vertical connector from parent -->
      <div class="w-px h-6 bg-border"></div>

      <!-- Horizontal connector bar -->
      {#if node.children.length > 1}
        <div class="flex items-start">
          <div class="flex">
            {#each node.children as child, i}
              <div class="flex flex-col items-center px-3">
                <!-- Horizontal line segments -->
                <div class="flex w-full">
                  <div class="h-px flex-1 {i === 0 ? 'bg-transparent' : 'bg-border'}"></div>
                  <div class="h-px flex-1 {i === node.children.length - 1 ? 'bg-transparent' : 'bg-border'}"></div>
                </div>
                <!-- Vertical line to child -->
                <div class="w-px h-6 bg-border"></div>
                {@render orgNode(child, depth + 1)}
              </div>
            {/each}
          </div>
        </div>
      {:else}
        {@render orgNode(node.children[0], depth + 1)}
      {/if}
    {/if}
  </div>
{/snippet}
