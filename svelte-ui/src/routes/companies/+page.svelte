<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { companyStore } from '$stores/company.svelte.js';
  import { CardHoverEffect } from '$lib/components/aceternity';

  let companies = $state<any[]>([]);
  let loading = $state(true);
  let showCreate = $state(false);
  let newName = $state('');
  let creating = $state(false);

  $effect(() => {
    api('/api/companies').then(r => r.json()).then(d => { companies = Array.isArray(d) ? d : d.companies ?? []; }).finally(() => { loading = false; });
  });

  function select(c: any) {
    companyStore.setCurrent(c);
    goto(`/${c.prefix ?? c.id}/dashboard`);
  }

  async function create() {
    if (!newName.trim()) return;
    creating = true;
    try {
      const res = await api('/api/companies', { method: 'POST', body: JSON.stringify({ name: newName.trim() }) });
      const c = await res.json();
      companies = [...companies, c];
      newName = '';
      showCreate = false;
      select(c);
    } finally { creating = false; }
  }
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Companies</h1>
    <button onclick={() => (showCreate = !showCreate)} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">New Company</button>
  </div>

  {#if showCreate}
    <form onsubmit={(e) => { e.preventDefault(); create(); }} class="flex gap-3">
      <input bind:value={newName} placeholder="Company name" class="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
      <button type="submit" disabled={creating} class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{creating ? '...' : 'Create'}</button>
    </form>
  {/if}

  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(3) as _}<div class="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>{/each}
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each companies as c (c.id)}
        <CardHoverEffect>
          <button onclick={() => select(c)} class="w-full p-6 text-left">
            <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</h3>
            <p class="mt-1 text-sm text-zinc-500">{c.prefix ?? c.id}</p>
          </button>
        </CardHoverEffect>
      {/each}
    </div>
  {/if}
</div>
