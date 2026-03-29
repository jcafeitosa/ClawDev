<script lang="ts">
  import { api } from '$lib/api';

  let instanceName = $state('');
  let publicUrl = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);

  $effect(() => {
    api('/api/instance-settings').then(r => r.json()).then(d => { instanceName = d.instanceName ?? ''; publicUrl = d.publicUrl ?? ''; }).finally(() => { loading = false; });
  });

  async function save() {
    saving = true;
    saved = false;
    await api('/api/instance-settings', { method: 'PATCH', body: JSON.stringify({ instanceName, publicUrl }) });
    saving = false;
    saved = true;
    setTimeout(() => { saved = false; }, 2000);
  }
</script>

<div class="mx-auto max-w-2xl space-y-6 p-6">
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    <a href="/settings/general" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">General</a>
    <a href="/settings/experimental" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Experimental</a>
    <a href="/settings/users" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Users</a>
    <a href="/settings/status" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Status</a>
    <a href="/settings/api-keys" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">API Keys</a>
  </div>
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">General Settings</h1>
  {#if loading}
    <div class="space-y-4">{#each Array(2) as _}<div class="h-12 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else}
    <div class="space-y-4">
      <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Instance Name</span>
        <input bind:value={instanceName} class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
      <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Public URL</span>
        <input bind:value={publicUrl} class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
      <button onclick={save} disabled={saving} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}</button>
    </div>
  {/if}
</div>
