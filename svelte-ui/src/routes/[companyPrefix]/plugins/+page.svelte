<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import { CardHoverEffect } from '$lib/components/aceternity';

  onMount(() => breadcrumbStore.set([{ label: 'Plugins' }]));

  let plugins = $state<any[]>([]);
  let loading = $state(true);

  $effect(() => {
    api('/api/plugins').then(r => r.json()).then(d => { plugins = Array.isArray(d) ? d : d.plugins ?? []; }).finally(() => { loading = false; });
  });
</script>

<div class="p-6 space-y-4">
  <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plugins</h1>
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{#each Array(3) as _}<div class="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else if plugins.length === 0}
    <p class="text-sm text-zinc-500 py-8 text-center">No plugins installed.</p>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each plugins as p (p.id)}
        <CardHoverEffect>
          <a href="/{$page.params.companyPrefix}/plugins/{p.id}" class="block p-5">
            <div class="flex items-center justify-between">
              <h3 class="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</h3>
              <StatusBadge status={p.enabled ? 'enabled' : 'disabled'} />
            </div>
            <p class="mt-1 text-xs text-zinc-500">{p.version ?? '0.0.0'} · {p.author ?? 'Unknown'}</p>
          </a>
        </CardHoverEffect>
      {/each}
    </div>
  {/if}
</div>
