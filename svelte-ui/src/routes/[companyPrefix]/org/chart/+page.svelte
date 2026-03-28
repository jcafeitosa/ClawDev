<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Org', href: `/${$page.params.companyPrefix}/org` }, { label: 'Chart' }]));

  let agents = $state<any[]>([]);
  let loading = $state(true);
  let companyId = $derived(companyStore.selectedCompany?.id);

  $effect(() => {
    if (!companyId) return;
    api(`/api/companies/${companyId}/agents`).then(r => r.json()).then(d => { agents = Array.isArray(d) ? d : d.agents ?? []; }).finally(() => { loading = false; });
  });

  let roots = $derived(agents.filter(a => !a.reportsTo));
  function children(parentId: string) { return agents.filter(a => a.reportsTo === parentId); }
</script>

{#snippet agentNode(agent: any, depth: number)}
  <div class="ml-{Math.min(depth * 6, 24)} border-l-2 border-zinc-200 pl-4 py-2 dark:border-zinc-700" style="margin-left: {depth * 24}px">
    <a href="/{$page.params.companyPrefix}/agents/{agent.id}" class="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <div class="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
        {(agent.name ?? '?')[0].toUpperCase()}
      </div>
      <div>
        <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{agent.name}</p>
        <p class="text-xs text-zinc-500">{agent.role ?? agent.adapterType ?? ''}</p>
      </div>
      <StatusBadge status={agent.status ?? 'idle'} />
    </a>
    {#each children(agent.id) as child (child.id)}
      {@render agentNode(child, depth + 1)}
    {/each}
  </div>
{/snippet}

<div class="p-6 space-y-4">
  <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Organization Chart</h1>
  {#if loading}
    <div class="space-y-3">{#each Array(5) as _}<div class="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else if roots.length === 0}
    <p class="text-sm text-zinc-500 py-8 text-center">No agents found.</p>
  {:else}
    {#each roots as root (root.id)}
      {@render agentNode(root, 0)}
    {/each}
  {/if}
</div>
