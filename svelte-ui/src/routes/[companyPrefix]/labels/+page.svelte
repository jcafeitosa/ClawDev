<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Tag, Plus, Trash2, X } from 'lucide-svelte';
  import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Skeleton, Separator, Alert, AlertTitle, AlertDescription } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

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
  let error = $state<string | null>(null);
  let labels = $state<Label[]>([]);

  let showCreate = $state(false);
  let creating = $state(false);
  let formName = $state('');
  let formColor = $state('blue');

  let deletingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    loading = true;
    error = null;
    api(`/api/companies/${companyId}/labels`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        labels = Array.isArray(d) ? d : d.labels ?? [];
      })
      .catch((e) => {
        error = e.message ?? 'Failed to load labels';
      })
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

<PageLayout title="Labels" description="Organize issues, agents, and projects with labels">
  {#snippet actions()}
    <Button onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Label
    </Button>
  {/snippet}

  <!-- Create form -->
  {#if showCreate}
    <form
      onsubmit={(e) => { e.preventDefault(); createLabel(); }}
      class="rounded-xl border border-border bg-card overflow-hidden"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <h2 class="text-sm font-semibold text-foreground">New Label</h2>
        <button
          type="button"
          onclick={() => { showCreate = false; resetForm(); }}
          class="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 transition-colors"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <!-- Name -->
        <div>
          <label for="label-name" class="block text-sm font-medium text-foreground mb-1">Name</label>
          <input
            id="label-name"
            bind:value={formName}
            placeholder="e.g. bug, feature, urgent"
            class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- Color picker -->
        <div>
          <span class="block text-sm font-medium text-foreground mb-2">Color</span>
          <div class="flex items-center gap-3 flex-wrap">
            {#each COLOR_PRESETS as preset (preset.value)}
              <button
                type="button"
                onclick={() => (formColor = preset.value)}
                title={preset.name}
                class="h-8 w-8 rounded-full transition-all {preset.bg}
                  {formColor === preset.value
                    ? 'ring-2 ring-offset-2 ring-offset-card ' + preset.ring + ' scale-110'
                    : 'opacity-60 hover:opacity-100 hover:scale-105'}"
              ></button>
            {/each}
          </div>
          <p class="mt-2 text-xs text-muted-foreground">Selected: {colorPreset(formColor).name}</p>
        </div>

        <!-- Preview -->
        {#if formName.trim()}
          <div>
            <span class="block text-sm font-medium text-foreground mb-1">Preview</span>
            <div class="flex items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium {labelBadgeBg(formColor)}">
                <span class="h-2 w-2 rounded-full {dotClass(formColor)}"></span>
                {formName.trim()}
              </span>
            </div>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center gap-3 pt-2 border-t border-border/50">
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
            class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="glass-card p-5 space-y-3">
      {#each Array(6) as _}
        <Skeleton class="h-12 rounded-lg" />
      {/each}
    </div>

  <!-- Error state -->
  {:else if error}
    <Alert variant="destructive">
      <AlertTitle>Failed to load labels</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
      <button
        onclick={() => {
          loading = true;
          error = null;
          api(`/api/companies/${companyId}/labels`)
            .then((r) => r.json())
            .then((d) => { labels = Array.isArray(d) ? d : d.labels ?? []; })
            .catch((e) => { error = e.message; })
            .finally(() => { loading = false; });
        }}
        class="cursor-pointer mt-3 text-sm text-primary hover:underline transition-colors duration-150"
      >
        Retry
      </button>
    </Alert>

  <!-- Empty state -->
  {:else if labels.length === 0}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <Tag class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">No labels yet</h3>
      <p class="mt-1 text-sm text-muted-foreground">Labels help you categorize and filter your work</p>
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
    <div class="glass-card p-0 overflow-hidden">
      <div class="px-5 py-4 border-b border-border/50">
        <h3 class="text-sm font-semibold text-foreground">
          {labels.length} {labels.length === 1 ? 'label' : 'labels'}
        </h3>
      </div>

      <div class="divide-y divide-border/50">
        {#each labels as label (label.id)}
          <div class="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-accent/40 transition-colors">
            <!-- Left: color dot + name + badge -->
            <div class="flex items-center gap-3 min-w-0">
              <span class="h-3 w-3 shrink-0 rounded-full {dotClass(label.color)}"></span>
              <span class="text-sm font-medium text-foreground truncate">{label.name}</span>
              <Badge variant="outline" class="text-[10px] {labelBadgeBg(label.color)}">
                {colorPreset(label.color).name}
              </Badge>
            </div>

            <!-- Right: usage count + delete -->
            <div class="flex items-center gap-4 shrink-0">
              {#if label.usageCount !== undefined && label.usageCount !== null}
                <span class="text-xs text-muted-foreground tabular-nums">
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
                    class="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/40"
                  >
                    No
                  </button>
                </div>
              {:else}
                <button
                  onclick={() => (confirmDeleteId = label.id)}
                  class="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
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
</PageLayout>
