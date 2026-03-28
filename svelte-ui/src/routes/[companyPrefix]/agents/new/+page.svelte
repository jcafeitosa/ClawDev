<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Agents', href: `/${$page.params.companyPrefix}/agents` }, { label: 'New' }]));

  let name = $state('');
  let role = $state('');
  let adapterType = $state('claude-local');
  let model = $state('');
  let systemPrompt = $state('');
  let creating = $state(false);
  let error = $state('');

  const adapters = ['claude-local', 'codex-local', 'cursor-local', 'gemini-local', 'opencode-local', 'pi-local', 'openclaw-gateway'];

  async function create() {
    if (!name.trim()) return;
    creating = true;
    error = '';
    try {
      const res = await api(`/api/companies/${companyStore.current?.id}/agents`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), role: role.trim() || undefined, adapterType, model: model.trim() || undefined, systemPrompt: systemPrompt.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
      const agent = await res.json();
      goto(`/${$page.params.companyPrefix}/agents/${agent.id}`);
    } catch (e: any) { error = e.message; }
    finally { creating = false; }
  }
</script>

<div class="mx-auto max-w-2xl p-6 space-y-6">
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Create Agent</h1>
  <form onsubmit={(e) => { e.preventDefault(); create(); }} class="space-y-4">
    <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name *</span>
      <input bind:value={name} required class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
    <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Role</span>
      <input bind:value={role} placeholder="e.g. Senior Engineer" class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
    <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Adapter</span>
      <select bind:value={adapterType} class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        {#each adapters as a}<option value={a}>{a}</option>{/each}
      </select></label>
    <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Model</span>
      <input bind:value={model} placeholder="e.g. claude-sonnet-4-5-20250514" class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" /></label>
    <label class="block"><span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">System Prompt</span>
      <textarea bind:value={systemPrompt} rows={4} class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"></textarea></label>
    {#if error}<p class="text-sm text-red-500">{error}</p>{/if}
    <button type="submit" disabled={creating || !name.trim()} class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{creating ? 'Creating...' : 'Create Agent'}</button>
  </form>
</div>
