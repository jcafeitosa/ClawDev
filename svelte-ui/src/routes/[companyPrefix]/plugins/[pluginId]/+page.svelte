<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import PageSkeleton from '$lib/components/page-skeleton.svelte';

  let plugin = $state<any>(null);
  let loading = $state(true);
  let pluginId = $derived($page.params.pluginId);

  onMount(() => breadcrumbStore.set([{ label: 'Plugins', href: `/${$page.params.companyPrefix}/plugins` }, { label: 'Detail' }]));

  $effect(() => {
    if (!pluginId) return;
    api(`/api/plugins/${pluginId}`).then(r => r.json()).then(d => { plugin = d; breadcrumbStore.set([{ label: 'Plugins', href: `/${$page.params.companyPrefix}/plugins` }, { label: d.name ?? pluginId }]); }).finally(() => { loading = false; });
  });

  async function toggleEnabled() {
    if (!plugin) return;
    await api(`/api/plugins/${pluginId}/${plugin.enabled ? 'disable' : 'enable'}`, { method: 'POST' });
    plugin = { ...plugin, enabled: !plugin.enabled };
  }
</script>

<div class="p-6 space-y-6">
  {#if loading}
    <PageSkeleton />
  {:else if !plugin}
    <p class="text-red-500">Plugin not found.</p>
  {:else}
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{plugin.name}</h1>
        <p class="text-sm text-zinc-500">{plugin.version ?? '0.0.0'} · {plugin.author ?? 'Unknown'}</p>
      </div>
      <div class="flex gap-3">
        <a href="/{$page.params.companyPrefix}/plugins/{pluginId}/settings" class="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">Settings</a>
        <button onclick={toggleEnabled} class="rounded-lg px-4 py-2 text-sm font-medium text-white {plugin.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}">{plugin.enabled ? 'Disable' : 'Enable'}</button>
      </div>
    </div>
    <p class="text-sm text-zinc-600 dark:text-zinc-400">{plugin.description ?? ''}</p>
    <StatusBadge status={plugin.enabled ? 'enabled' : 'disabled'} />
  {/if}
</div>
