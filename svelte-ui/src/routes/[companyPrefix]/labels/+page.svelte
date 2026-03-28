<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Tag, Plus, Trash2, X } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Labels' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Label {
    id: string;
    name: string;
    color: string;
    usageCount?: number;
    createdAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // Color presets
  // ---------------------------------------------------------------------------
  const COLOR_PRESETS: { name: string; value: string; bg: string; ring: string }[] = [
    { name: 'Red',    value: 'red',    bg: 'bg-red-500',    ring: 'ring-red-400' },
    { name: 'Orange', value: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-400' },
    { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-500', ring: 'ring-yellow-400' },
    { name: 'Green',  value: 'green',  bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
    { name: 'Blue',   value: 'blue',   bg: 'bg-blue-500',  ring: 'ring-blue-400' },
    { name: 'Purple', value: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-400' },
    { name: 'Pink',   value: 'pink',   bg: 'bg-pink-500',  ring: 'ring-pink-400' },
    { name: 'Zinc',   value: 'zinc',   bg: 'bg-zinc-500',  ring: 'ring-zinc-400' },
  ];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let loading = $state(true);
  let labels = $state<Label[]>([]);

  let showCreate = $state(false);
  let creating = $state(false);
  let formName = $state('');
  let formColor = $state('blue');

  let deletingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);

  let companyId = $derived(companyStore.selectedCompany?.id);
  let prefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/labels`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        labels = Array.isArray(d) ? d : d.labels ?? [];
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function colorPreset(color: string) {
    return COLOR_PRESETS.find((c) => c.value === color) ?? COLOR_PRESETS[4]; // default blue
  }

  function dotClass(color: string): string {
    const preset = colorPreset(color);
    return preset.bg;
  }

  function labelBadgeBg(color: string): string {
    const map: Record<string, string> = {
      red: 'bg-red-500/10 text-red-400 border-red-500/30',
      orange: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
      yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
      green: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      purple: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      pink: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
      zinc: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
    };
    return map[color] ?? map.blue;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function resetForm() {
    formName = '';
    formColor = 'blue';
  }

  async function createLabel() {
    if (!companyId || !formName.trim()) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/labels`, {
        method: 'POST',
        body: JSON.stringify({ name: formName.trim(), color: formColor }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = await res.json();
      labels = [...labels, created];
      resetForm();
      showCreate = false;
    } catch (e) {
      console.error(e);
    } finally {
      creating = false;
    }
  }

  async function deleteLabel(labelId: string) {
    deletingId = labelId;
    try {
      const res = await api(`/api/labels/${labelId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      labels = labels.filter((l) => l.id !== labelId);
    } catch (e) {
      console.error(e);
    } finally {
      deletingId = null;
      confirmDeleteId = null;
    }
  }
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-[#F8FAFC]">Labels</h1>
      <p class="mt-1 text-sm text-[#94A3B8]">Organize issues, agents, and projects with labels</p>
    </div>
    <button
      onclick={() => (showCreate = !showCreate)}
      class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      <Plus class="h-4 w-4" />
      New Label
    </button>
  </div>

  <!-- Create form -->
  {#if showCreate}
    <form
      onsubmit={(e) => { e.preventDefault(); createLabel(); }}
      class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
        <h2 class="text-sm font-semibold text-[#F8FAFC]">New Label</h2>
        <button
          type="button"
          onclick={() => { showCreate = false; resetForm(); }}
          class="rounded-lg p-1 text-[#94A3B8] hover:bg-white/[0.05] transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <!-- Name -->
        <div>
          <label for="label-name" class="block text-sm font-medium text-[#F8FAFC] mb-1">Name</label>
          <input
            id="label-name"
            bind:value={formName}
            placeholder="e.g. bug, feature, urgent"
            class="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- Color picker -->
        <div>
          <span class="block text-sm font-medium text-[#F8FAFC] mb-2">Color</span>
          <div class="flex items-center gap-3 flex-wrap">
            {#each COLOR_PRESETS as preset (preset.value)}
              <button
                type="button"
                onclick={() => (formColor = preset.value)}
                title={preset.name}
                class="h-8 w-8 rounded-full transition-all {preset.bg}
                  {formColor === preset.value
                    ? 'ring-2 ring-offset-2 ring-offset-[#121218] ' + preset.ring + ' scale-110'
                    : 'opacity-60 hover:opacity-100 hover:scale-105'}"
              ></button>
            {/each}
          </div>
          <p class="mt-2 text-xs text-[#94A3B8]">Selected: {colorPreset(formColor).name}</p>
        </div>

        <!-- Preview -->
        {#if formName.trim()}
          <div>
            <span class="block text-sm font-medium text-[#F8FAFC] mb-1">Preview</span>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium {labelBadgeBg(formColor)}">
                <span class="h-2 w-2 rounded-full {dotClass(formColor)}"></span>
                {formName.trim()}
              </span>
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
          <button
            type="submit"
            disabled={creating || !formName.trim()}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create Label'}
          </button>
          <button
            type="button"
            onclick={() => { showCreate = false; resetForm(); }}
            class="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/[0.03]"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
      <div class="p-5 space-y-3">
        {#each Array(6) as _}
          <div class="h-12 animate-pulse rounded-lg bg-white/[0.05]"></div>
        {/each}
      </div>
    </div>

  <!-- Empty state -->
  {:else if labels.length === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-white/[0.05] p-4 mb-4">
        <Tag class="h-10 w-10 text-[#94A3B8]" />
      </div>
      <h3 class="text-lg font-medium text-[#F8FAFC]">No labels yet</h3>
      <p class="mt-1 text-sm text-[#94A3B8]">Labels help you categorize and filter your work</p>
      <button
        onclick={() => (showCreate = true)}
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus class="h-4 w-4" />
        New Label
      </button>
    </div>

  <!-- Labels list -->
  {:else}
    <div class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
      <div class="px-5 py-4 border-b border-white/[0.05]">
        <h2 class="text-sm font-semibold text-[#F8FAFC]">
          {labels.length} {labels.length === 1 ? 'label' : 'labels'}
        </h2>
      </div>

      <div class="divide-y divide-white/[0.05]">
        {#each labels as label (label.id)}
          <div class="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-white/[0.03] transition-colors">
            <!-- Left: color dot + name + badge -->
            <div class="flex items-center gap-3 min-w-0">
              <span class="h-3 w-3 shrink-0 rounded-full {dotClass(label.color)}"></span>
              <span class="text-sm font-medium text-[#F8FAFC] truncate">{label.name}</span>
              <span class="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium leading-none {labelBadgeBg(label.color)}">
                {colorPreset(label.color).name}
              </span>
            </div>

            <!-- Right: usage count + delete -->
            <div class="flex items-center gap-4 shrink-0">
              {#if label.usageCount !== undefined && label.usageCount !== null}
                <span class="text-xs text-[#94A3B8] tabular-nums">
                  {label.usageCount} {label.usageCount === 1 ? 'use' : 'uses'}
                </span>
              {/if}

              {#if confirmDeleteId === label.id}
                <!-- Delete confirmation inline -->
                <div class="flex items-center gap-2">
                  <span class="text-xs text-red-400">Delete?</span>
                  <button
                    onclick={() => deleteLabel(label.id)}
                    disabled={deletingId === label.id}
                    class="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingId === label.id ? 'Deleting...' : 'Yes'}
                  </button>
                  <button
                    onclick={() => (confirmDeleteId = null)}
                    class="rounded-md border border-white/[0.08] px-2.5 py-1 text-xs text-[#94A3B8] hover:bg-white/[0.03]"
                  >
                    No
                  </button>
                </div>
              {:else}
                <button
                  onclick={() => (confirmDeleteId = label.id)}
                  class="rounded-lg p-1.5 text-[#94A3B8] transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Delete label"
                >
                  <Trash2 class="h-4 w-4" />
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
