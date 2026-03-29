<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Download, Eye, Loader2, Package, CheckCircle2 } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Export' }]));

  const sections = ['agents', 'issues', 'goals', 'projects', 'routines', 'skills'];
  let selected = $state<Set<string>>(new Set(sections));
  let exporting = $state(false);
  let previewing = $state(false);
  let previewData = $state<Record<string, number> | null>(null);
  let exportProgress = $state(0);
  let exportDone = $state(false);

  let companyId = $derived(companyStore.selectedCompany?.id);

  function toggle(s: string) {
    const n = new Set(selected);
    n.has(s) ? n.delete(s) : n.add(s);
    selected = n;
    previewData = null; // Reset preview when selection changes
  }

  function toggleAll() {
    selected = selected.size === sections.length ? new Set() : new Set(sections);
    previewData = null;
  }

  async function fetchPreview() {
    if (!companyId || selected.size === 0) return;
    previewing = true;
    try {
      const res = await api(`/api/companies/${companyId}/exports/preview`, {
        method: 'POST',
        body: JSON.stringify({ sections: [...selected] }),
      });
      if (res.ok) {
        const d = await res.json();
        previewData = d.counts ?? d;
      } else {
        toastStore.push({ title: 'Failed to load preview', tone: 'error' });
      }
    } catch {
      toastStore.push({ title: 'Failed to load preview', tone: 'error' });
    } finally {
      previewing = false;
    }
  }

  async function doExport() {
    if (!companyId) return;
    exporting = true;
    exportProgress = 0;
    exportDone = false;

    // Simulate progress (the actual download is a single request)
    const progressInterval = setInterval(() => {
      exportProgress = Math.min(exportProgress + Math.random() * 15, 90);
    }, 300);

    try {
      const res = await api(`/api/companies/${companyId}/exports`, {
        method: 'POST',
        body: JSON.stringify({ sections: [...selected] }),
      });
      clearInterval(progressInterval);
      exportProgress = 100;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyStore.selectedCompany?.name ?? 'company'}-export.zip`;
      a.click();
      URL.revokeObjectURL(url);

      exportDone = true;
      toastStore.push({ title: 'Export downloaded', tone: 'success' });
    } catch {
      clearInterval(progressInterval);
      toastStore.push({ title: 'Export failed', tone: 'error' });
    } finally {
      exporting = false;
    }
  }
</script>

<div class="mx-auto max-w-lg p-6 space-y-6">
  <div>
    <h1 class="text-xl font-bold text-foreground">Export Company</h1>
    <p class="mt-1 text-sm text-muted-foreground">Select what to include in the export:</p>
  </div>

  <button onclick={toggleAll} class="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
    {selected.size === sections.length ? 'Deselect all' : 'Select all'}
  </button>

  <div class="space-y-2">
    {#each sections as s}
      <label class="flex items-center gap-3 rounded-lg border border-border bg-card p-3 cursor-pointer transition-colors hover:bg-accent/40 {selected.has(s) ? 'border-blue-500/30' : ''}">
        <input
          type="checkbox"
          checked={selected.has(s)}
          onchange={() => toggle(s)}
          class="rounded border-white/20 bg-accent/60 text-blue-500 focus:ring-blue-500/30"
        />
        <Package class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm capitalize text-foreground">{s}</span>
        {#if previewData && previewData[s] !== undefined}
          <span class="ml-auto text-xs text-muted-foreground">{previewData[s]} items</span>
        {/if}
      </label>
    {/each}
  </div>

  <!-- Preview button and data -->
  {#if selected.size > 0 && !previewData}
    <button
      onclick={fetchPreview}
      disabled={previewing}
      class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
    >
      {#if previewing}
        <Loader2 class="h-4 w-4 animate-spin" />
        Loading preview...
      {:else}
        <Eye class="h-4 w-4" />
        Preview Export
      {/if}
    </button>
  {/if}

  {#if previewData}
    <div class="rounded-lg border border-border bg-card p-4 space-y-2">
      <h3 class="text-sm font-medium text-foreground">Export Preview</h3>
      <div class="space-y-1">
        {#each [...selected] as s}
          <div class="flex items-center justify-between text-sm">
            <span class="capitalize text-muted-foreground">{s}</span>
            <span class="font-medium text-foreground">{previewData[s] ?? 0} items</span>
          </div>
        {/each}
        <div class="mt-2 flex items-center justify-between border-t border-border/50 pt-2 text-sm">
          <span class="font-medium text-muted-foreground">Total</span>
          <span class="font-bold text-foreground">
            {Object.entries(previewData).filter(([k]) => selected.has(k)).reduce((sum, [, v]) => sum + (typeof v === 'number' ? v : 0), 0)} items
          </span>
        </div>
      </div>
    </div>
  {/if}

  <!-- Progress indicator -->
  {#if exporting}
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs text-muted-foreground">
        <span>Exporting...</span>
        <span>{Math.round(exportProgress)}%</span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-accent/60">
        <div
          class="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out"
          style="width: {exportProgress}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- Export button -->
  <button
    onclick={doExport}
    disabled={exporting || selected.size === 0}
    class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
  >
    {#if exportDone && !exporting}
      <CheckCircle2 class="h-4 w-4" />
      Export Complete - Download Again
    {:else if exporting}
      <Loader2 class="h-4 w-4 animate-spin" />
      Exporting...
    {:else}
      <Download class="h-4 w-4" />
      Export ZIP
    {/if}
  </button>
</div>
