<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { onMount } from 'svelte';
  import PageSkeleton from '$lib/components/page-skeleton.svelte';

  let config = $state<Record<string, any>>({});
  let loading = $state(true);
  let saving = $state(false);
  let showRawJson = $state(false);
  let rawJsonText = $state('');
  let rawJsonError = $state('');
  let pluginId = $derived($page.params.pluginId);
  let companyPrefix = $derived($page.params.companyPrefix);

  onMount(() => breadcrumbStore.set([
    { label: 'Plugins', href: `/${companyPrefix}/plugins` },
    { label: 'Plugin', href: `/${companyPrefix}/plugins/${pluginId}` },
    { label: 'Settings' },
  ]));

  $effect(() => {
    if (!pluginId) return;
    api(`/api/plugins/${pluginId}/config`)
      .then(r => r.json())
      .then(d => {
        config = d ?? {};
        rawJsonText = JSON.stringify(config, null, 2);
        breadcrumbStore.set([
          { label: 'Plugins', href: `/${companyPrefix}/plugins` },
          { label: 'Plugin', href: `/${companyPrefix}/plugins/${pluginId}` },
          { label: 'Settings' },
        ]);
      })
      .finally(() => { loading = false; });
  });

  function detectType(value: any): 'string' | 'boolean' | 'number' | 'json' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object' && value !== null) return 'json';
    return 'string';
  }

  function updateField(key: string, value: any) {
    config = { ...config, [key]: value };
  }

  function syncRawJson() {
    rawJsonText = JSON.stringify(config, null, 2);
    rawJsonError = '';
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(rawJsonText);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        rawJsonError = 'Root must be a JSON object';
        return false;
      }
      config = parsed;
      rawJsonError = '';
      return true;
    } catch (e: any) {
      rawJsonError = `Invalid JSON: ${e.message}`;
      return false;
    }
  }

  async function save() {
    if (showRawJson && !applyRawJson()) return;

    saving = true;
    try {
      const res = await api(`/api/plugins/${pluginId}/config`, {
        method: 'PATCH',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      toastStore.push({ title: 'Settings saved', tone: 'success' });
      rawJsonText = JSON.stringify(config, null, 2);
    } catch (err: any) {
      toastStore.push({ title: 'Failed to save settings', body: err.message, tone: 'error' });
    } finally {
      saving = false;
    }
  }

  const configKeys = $derived(Object.keys(config));
</script>

<div class="mx-auto max-w-2xl p-6 space-y-6">
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Plugin Settings</h1>
    <button
      onclick={() => { if (showRawJson) { applyRawJson(); } else { syncRawJson(); } showRawJson = !showRawJson; }}
      class="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
    >
      {showRawJson ? 'Form View' : 'Raw JSON'}
    </button>
  </div>

  {#if loading}
    <PageSkeleton />
  {:else if showRawJson}
    <!-- Raw JSON editor -->
    <div class="space-y-3">
      <textarea
        bind:value={rawJsonText}
        rows="18"
        spellcheck="false"
        class="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-4 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
      ></textarea>
      {#if rawJsonError}
        <p class="text-xs text-red-500">{rawJsonError}</p>
      {/if}
    </div>
  {:else if configKeys.length === 0}
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 text-center">
      <p class="text-sm text-zinc-500 dark:text-zinc-400">No configuration keys found for this plugin.</p>
      <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Switch to Raw JSON to add configuration manually.</p>
    </div>
  {:else}
    <!-- Dynamic form fields -->
    <div class="space-y-4">
      {#each configKeys as key (key)}
        {@const value = config[key]}
        {@const type = detectType(value)}

        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <label for="field-{key}" class="block text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-2">
            {key}
          </label>

          {#if type === 'boolean'}
            <button
              id="field-{key}"
              role="switch"
              aria-checked={value}
              aria-label="Toggle {key}"
              onclick={() => updateField(key, !value)}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {value ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 {value ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
            <span class="ml-2 text-xs text-zinc-500 dark:text-zinc-400">{value ? 'Enabled' : 'Disabled'}</span>

          {:else if type === 'number'}
            <input
              id="field-{key}"
              type="number"
              value={value}
              oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (!isNaN(v)) updateField(key, v); }}
              class="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />

          {:else if type === 'json'}
            <textarea
              id="field-{key}"
              rows="5"
              spellcheck="false"
              value={JSON.stringify(value, null, 2)}
              oninput={(e) => { try { const parsed = JSON.parse((e.target as HTMLTextAreaElement).value); updateField(key, parsed); } catch {} }}
              class="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 font-mono text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-y"
            ></textarea>
            <p class="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">JSON object/array</p>

          {:else}
            <input
              id="field-{key}"
              type="text"
              value={value ?? ''}
              oninput={(e) => updateField(key, (e.target as HTMLInputElement).value)}
              class="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if !loading}
    <div class="flex justify-end pt-2">
      <button
        onclick={save}
        disabled={saving}
        class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  {/if}
</div>
