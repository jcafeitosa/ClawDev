<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Upload, Eye, Loader2, FileArchive, CheckCircle2, AlertTriangle } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Import' }]));

  let file = $state<File | null>(null);
  let fileInfo = $state<{ name: string; size: string } | null>(null);
  let importing = $state(false);
  let previewing = $state(false);
  let done = $state(false);
  let dragover = $state(false);

  let previewData = $state<any>(null);
  let collisionStrategy = $state<'skip' | 'overwrite' | 'rename'>('skip');
  let importResults = $state<any>(null);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);

  function handleFile(f: File) {
    file = f;
    fileInfo = { name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' };
    previewData = null;
    importResults = null;
    done = false;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragover = false;
    const f = e.dataTransfer?.files[0];
    if (f) handleFile(f);
  }

  function onInput(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) handleFile(f);
  }

  function resetFile() {
    file = null;
    fileInfo = null;
    previewData = null;
    importResults = null;
    done = false;
  }

  async function fetchPreview() {
    if (!file || !companyId) return;
    previewing = true;
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api(`/api/companies/${companyId}/imports/preview`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        previewData = await res.json();
      } else {
        toastStore.push({ title: 'Failed to generate preview', tone: 'error' });
      }
    } catch {
      toastStore.push({ title: 'Failed to generate preview', tone: 'error' });
    } finally {
      previewing = false;
    }
  }

  async function doImport() {
    if (!file || !companyId) return;
    importing = true;
    importResults = null;
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('collisionStrategy', collisionStrategy);
      const res = await api(`/api/companies/${companyId}/imports/apply`, {
        method: 'POST',
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        importResults = data;
        done = true;
        toastStore.push({ title: 'Import completed successfully', tone: 'success' });
      } else {
        toastStore.push({ title: 'Import failed', tone: 'error' });
      }
    } catch {
      toastStore.push({ title: 'Import failed', tone: 'error' });
    } finally {
      importing = false;
    }
  }
</script>

<div class="mx-auto max-w-lg p-6 space-y-6">
  <div>
    <h1 class="text-xl font-bold text-foreground">Import Company Data</h1>
    <p class="mt-1 text-sm text-muted-foreground">Upload a ZIP or JSON file to import data into your workspace</p>
  </div>

  <!-- Drop zone -->
  {#if !done}
    <div
      class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors
        {dragover ? 'border-blue-500 bg-blue-500/5' : 'border-white/[0.12] hover:border-white/[0.2]'}"
      ondragover={(e) => { e.preventDefault(); dragover = true; }}
      ondragleave={() => { dragover = false; }}
      ondrop={onDrop}
      role="presentation"
    >
      <Upload class="mb-3 h-8 w-8 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">Drag & drop a ZIP or JSON file, or</p>
      <label class="mt-3 cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60">
        Browse files
        <input type="file" accept=".zip,.json" class="hidden" onchange={onInput} />
      </label>
    </div>
  {/if}

  <!-- File info -->
  {#if fileInfo && !done}
    <div class="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <FileArchive class="h-5 w-5 text-blue-400" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-foreground truncate">{fileInfo.name}</p>
        <p class="text-xs text-muted-foreground">{fileInfo.size}</p>
      </div>
      <button onclick={resetFile} class="text-xs text-muted-foreground hover:text-foreground transition-colors">Remove</button>
    </div>
  {/if}

  <!-- Preview button -->
  {#if file && !previewData && !done}
    <button
      onclick={fetchPreview}
      disabled={previewing}
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
    >
      {#if previewing}
        <Loader2 class="h-4 w-4 animate-spin" />
        Analyzing file...
      {:else}
        <Eye class="h-4 w-4" />
        Preview Import
      {/if}
    </button>
  {/if}

  <!-- Preview data -->
  {#if previewData && !done}
    <div class="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 class="text-sm font-medium text-foreground">Import Preview</h3>

      <!-- Entity counts -->
      {#if previewData.counts || previewData.entities}
        {@const counts = previewData.counts ?? previewData.entities ?? previewData}
        <div class="space-y-1">
          {#each Object.entries(counts) as [key, value]}
            <div class="flex items-center justify-between text-sm">
              <span class="capitalize text-muted-foreground">{key}</span>
              <span class="font-medium text-foreground">{value} items</span>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Conflicts warning -->
      {#if previewData.conflicts && previewData.conflicts > 0}
        <div class="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p class="text-sm font-medium text-amber-300">{previewData.conflicts} potential conflicts</p>
            <p class="text-xs text-amber-400/70">Entities that already exist in your workspace</p>
          </div>
        </div>
      {/if}

      <!-- Collision strategy selector -->
      <div class="space-y-2">
        <label for="collision-strategy" class="text-xs font-medium text-muted-foreground">Collision Strategy</label>
        <select
          id="collision-strategy"
          bind:value={collisionStrategy}
          class="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="skip">Skip existing - keep current data</option>
          <option value="overwrite">Overwrite - replace with imported data</option>
          <option value="rename">Rename - import as new with suffix</option>
        </select>
      </div>
    </div>
  {/if}

  <!-- Import button -->
  {#if file && !done}
    <button
      onclick={doImport}
      disabled={importing}
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
    >
      {#if importing}
        <Loader2 class="h-4 w-4 animate-spin" />
        Importing...
      {:else}
        <Upload class="h-4 w-4" />
        Apply Import
      {/if}
    </button>
  {/if}

  <!-- Import results -->
  {#if done && importResults}
    <div class="rounded-lg border border-green-500/20 bg-green-500/5 p-5 space-y-4">
      <div class="flex items-center gap-3">
        <CheckCircle2 class="h-6 w-6 text-green-400" />
        <h3 class="text-lg font-semibold text-foreground">Import Complete</h3>
      </div>

      <div class="space-y-1">
        {#if importResults.created !== undefined}
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Created</span>
            <span class="font-medium text-green-400">{importResults.created}</span>
          </div>
        {/if}
        {#if importResults.updated !== undefined}
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Updated</span>
            <span class="font-medium text-blue-400">{importResults.updated}</span>
          </div>
        {/if}
        {#if importResults.skipped !== undefined}
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Skipped</span>
            <span class="font-medium text-muted-foreground">{importResults.skipped}</span>
          </div>
        {/if}
        {#if importResults.errors !== undefined && importResults.errors > 0}
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">Errors</span>
            <span class="font-medium text-red-400">{importResults.errors}</span>
          </div>
        {/if}
      </div>

      <!-- Per-entity breakdown if available -->
      {#if importResults.details}
        <div class="border-t border-border/50 pt-3 space-y-1">
          <h4 class="text-xs font-medium text-muted-foreground">Breakdown</h4>
          {#each Object.entries(importResults.details) as [entity, detail]}
            <div class="flex items-center justify-between text-sm">
              <span class="capitalize text-muted-foreground">{entity}</span>
              <span class="text-xs text-foreground">
                {(detail as any).created ?? 0} created, {(detail as any).updated ?? 0} updated, {(detail as any).skipped ?? 0} skipped
              </span>
            </div>
          {/each}
        </div>
      {/if}

      <button
        onclick={resetFile}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
      >
        Import Another File
      </button>
    </div>
  {:else if done}
    <!-- Fallback if no structured results -->
    <div class="flex flex-col items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-6">
      <CheckCircle2 class="h-8 w-8 text-green-400" />
      <h3 class="text-lg font-semibold text-foreground">Import Complete</h3>
      <p class="text-sm text-muted-foreground">Your data has been imported successfully</p>
      <button
        onclick={resetFile}
        class="mt-2 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
      >
        Import Another File
      </button>
    </div>
  {/if}
</div>
