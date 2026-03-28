<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api';

  let config = $state<Record<string, any>>({});
  let loading = $state(true);
  let saving = $state(false);
  let pluginId = $derived($page.params.pluginId);

  $effect(() => {
    if (!pluginId) return;
    api(`/api/plugins/${pluginId}/config`).then(r => r.json()).then(d => { config = d ?? {}; }).finally(() => { loading = false; });
  });

  async function save() {
    saving = true;
    await api(`/api/plugins/${pluginId}/config`, { method: 'PATCH', body: JSON.stringify(config) });
    saving = false;
  }
</script>

<div class="mx-auto max-w-2xl p-6 space-y-6">
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Plugin Settings</h1>
  {#if loading}
    <div class="space-y-3">{#each Array(3) as _}<div class="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else}
    <pre class="rounded-lg bg-zinc-100 p-4 text-xs dark:bg-zinc-800 overflow-auto">{JSON.stringify(config, null, 2)}</pre>
    <button onclick={save} disabled={saving} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
  {/if}
</div>
