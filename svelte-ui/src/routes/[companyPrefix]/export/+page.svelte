<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Export' }]));

  const sections = ['agents', 'issues', 'goals', 'projects', 'routines', 'skills'];
  let selected = $state<Set<string>>(new Set(sections));
  let exporting = $state(false);

  function toggle(s: string) { const n = new Set(selected); n.has(s) ? n.delete(s) : n.add(s); selected = n; }
  function toggleAll() { selected = selected.size === sections.length ? new Set() : new Set(sections); }

  async function doExport() {
    exporting = true;
    try {
      const res = await api(`/api/companies/${companyStore.current?.id}/exports`, { method: 'POST', body: JSON.stringify({ sections: [...selected] }) });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${companyStore.current?.name ?? 'company'}-export.zip`; a.click();
      URL.revokeObjectURL(url);
    } finally { exporting = false; }
  }
</script>

<div class="mx-auto max-w-lg p-6 space-y-6">
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Export Company</h1>
  <p class="text-sm text-zinc-500">Select what to include in the export:</p>
  <button onclick={toggleAll} class="text-xs text-indigo-600 dark:text-indigo-400">{selected.size === sections.length ? 'Deselect all' : 'Select all'}</button>
  <div class="space-y-2">
    {#each sections as s}
      <label class="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <input type="checkbox" checked={selected.has(s)} onchange={() => toggle(s)} class="rounded" />
        <span class="text-sm capitalize text-zinc-900 dark:text-zinc-100">{s}</span>
      </label>
    {/each}
  </div>
  <button onclick={doExport} disabled={exporting || selected.size === 0} class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{exporting ? 'Exporting...' : 'Export ZIP'}</button>
</div>
