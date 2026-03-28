<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Import' }]));

  let file = $state<File | null>(null);
  let preview = $state<any>(null);
  let importing = $state(false);
  let done = $state(false);
  let dragover = $state(false);

  function handleFile(f: File) { file = f; preview = { name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' }; }
  function onDrop(e: DragEvent) { e.preventDefault(); dragover = false; const f = e.dataTransfer?.files[0]; if (f) handleFile(f); }
  function onInput(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); }

  async function doImport() {
    if (!file) return;
    importing = true;
    const fd = new FormData();
    fd.append('file', file);
    await api(`/api/companies/${companyStore.current?.id}/imports/apply`, { method: 'POST', body: fd });
    importing = false;
    done = true;
  }
</script>

<div class="mx-auto max-w-lg p-6 space-y-6">
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Import Company Data</h1>
  <div
    class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors {dragover ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950' : 'border-zinc-300 dark:border-zinc-700'}"
    ondragover={(e) => { e.preventDefault(); dragover = true; }}
    ondragleave={() => { dragover = false; }}
    ondrop={onDrop}
    role="presentation"
  >
    <p class="text-sm text-zinc-500">Drag & drop a ZIP or JSON file, or</p>
    <label class="mt-2 cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
      Browse <input type="file" accept=".zip,.json" class="hidden" onchange={onInput} />
    </label>
  </div>
  {#if preview}
    <div class="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{preview.name}</p>
      <p class="text-xs text-zinc-500">{preview.size}</p>
    </div>
    <button onclick={doImport} disabled={importing} class="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{importing ? 'Importing...' : done ? 'Done!' : 'Apply Import'}</button>
  {/if}
</div>
