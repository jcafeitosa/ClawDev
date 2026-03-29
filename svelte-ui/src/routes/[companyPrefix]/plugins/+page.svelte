<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import { CardHoverEffect } from '$lib/components/aceternity';
  import {
    Button, Input, Separator, Skeleton,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
  } from '$components/ui/index.js';
  import { Plus, Package, Download, Loader2, X, Puzzle, Power, Trash2, AlertCircle } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Plugin {
    id: string;
    name: string;
    version?: string;
    author?: string;
    enabled?: boolean;
    status?: 'ready' | 'installed' | 'error' | 'disabled' | string;
    lastError?: string | null;
    description?: string;
    [key: string]: unknown;
  }

  interface ExamplePlugin {
    name: string;
    packageName: string;
    description?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let plugins = $state<Plugin[]>([]);
  let loading = $state(true);

  // Install dialog
  let showInstallDialog = $state(false);
  let installPackageName = $state('');
  let installLocalPath = $state(false);
  let installing = $state(false);
  let installError = $state<string | null>(null);

  // Uninstall confirmation
  let showUninstallDialog = $state(false);
  let uninstallTarget = $state<Plugin | null>(null);
  let uninstalling = $state(false);

  // Toggle (enable/disable) in-flight tracker
  let togglingPluginId = $state<string | null>(null);

  // Examples
  let examples = $state<ExamplePlugin[]>([]);
  let examplesLoading = $state(true);
  let installingExampleName = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadPlugins() {
    loading = true;
    try {
      const res = await api('/api/plugins');
      const data = await res.json();
      plugins = Array.isArray(data) ? data : data.plugins ?? [];
    } catch {
      plugins = [];
    } finally {
      loading = false;
    }
  }

  async function loadExamples() {
    examplesLoading = true;
    try {
      const res = await api('/api/plugins/examples');
      if (res.ok) {
        const data = await res.json();
        examples = Array.isArray(data) ? data : data.examples ?? [];
      }
    } catch {
      examples = [];
    } finally {
      examplesLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Install actions
  // ---------------------------------------------------------------------------
  async function installPlugin(packageName: string) {
    installing = true;
    installError = null;
    try {
      const payload: Record<string, unknown> = { packageName };
      if (installLocalPath) payload.isLocalPath = true;
      const res = await api('/api/plugins/install', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        let errMsg: string;
        try { errMsg = JSON.parse(errText).message ?? errText; } catch { errMsg = errText; }
        throw new Error(errMsg);
      }
      toastStore.push({ title: 'Plugin installed', body: `${packageName} installed successfully.`, tone: 'success' });
      showInstallDialog = false;
      installPackageName = '';
      installLocalPath = false;
      await loadPlugins();
    } catch (err: any) {
      installError = err?.message ?? 'Installation failed.';
    } finally {
      installing = false;
    }
  }

  async function installExample(example: ExamplePlugin) {
    installingExampleName = example.packageName;
    try {
      const res = await api('/api/plugins/install', {
        method: 'POST',
        body: JSON.stringify({ packageName: example.packageName }),
      });
      if (!res.ok) {
        const errText = await res.text();
        let errMsg: string;
        try { errMsg = JSON.parse(errText).message ?? errText; } catch { errMsg = errText; }
        throw new Error(errMsg);
      }
      toastStore.push({ title: 'Plugin installed', body: `${example.name} installed successfully.`, tone: 'success' });
      await loadPlugins();
    } catch (err: any) {
      toastStore.push({ title: 'Installation failed', body: err?.message, tone: 'error' });
    } finally {
      installingExampleName = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle enable / disable
  // ---------------------------------------------------------------------------
  async function togglePlugin(plugin: Plugin) {
    togglingPluginId = plugin.id;
    const action = plugin.enabled ? 'disable' : 'enable';
    try {
      const res = await api(`/api/plugins/${plugin.id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const errText = await res.text();
        let errMsg: string;
        try { errMsg = JSON.parse(errText).message ?? errText; } catch { errMsg = errText; }
        throw new Error(errMsg);
      }
      toastStore.push({ title: `Plugin ${action}d`, body: `${plugin.name} has been ${action}d.`, tone: 'success' });
      await loadPlugins();
    } catch (err: any) {
      toastStore.push({ title: `Failed to ${action} plugin`, body: err?.message ?? 'Unknown error', tone: 'error' });
    } finally {
      togglingPluginId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Uninstall
  // ---------------------------------------------------------------------------
  function confirmUninstall(plugin: Plugin) {
    uninstallTarget = plugin;
    uninstalling = false;
    showUninstallDialog = true;
  }

  async function executeUninstall() {
    if (!uninstallTarget) return;
    uninstalling = true;
    try {
      const res = await api(`/api/plugins/${uninstallTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errText = await res.text();
        let errMsg: string;
        try { errMsg = JSON.parse(errText).message ?? errText; } catch { errMsg = errText; }
        throw new Error(errMsg);
      }
      toastStore.push({ title: 'Plugin uninstalled', body: `${uninstallTarget.name} has been removed.`, tone: 'success' });
      showUninstallDialog = false;
      uninstallTarget = null;
      await loadPlugins();
    } catch (err: any) {
      toastStore.push({ title: 'Uninstall failed', body: err?.message ?? 'Unknown error', tone: 'error' });
    } finally {
      uninstalling = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Status badge helper
  // ---------------------------------------------------------------------------
  function pluginStatusBadge(plugin: Plugin): { label: string; color: string } {
    if (plugin.status === 'error') return { label: 'Error', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
    if (plugin.status === 'ready' || (plugin.enabled && plugin.status !== 'error')) return { label: 'Ready', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };
    if (plugin.status === 'disabled' || !plugin.enabled) return { label: 'Disabled', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' };
    return { label: plugin.status ?? 'Installed', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' };
  }

  function handleInstallSubmit() {
    if (!installPackageName.trim()) return;
    installPlugin(installPackageName.trim());
  }

  function handleInstallKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInstallSubmit();
    }
  }

  function openInstallDialog() {
    installPackageName = '';
    installLocalPath = false;
    installError = null;
    installing = false;
    showInstallDialog = true;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(() => {
    breadcrumbStore.set([{ label: 'Plugins' }]);
    loadPlugins();
    loadExamples();
  });
</script>

<div class="p-6 space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plugins</h1>
    <Button size="sm" onclick={openInstallDialog}>
      <Plus class="h-4 w-4 mr-1.5" />
      Install Plugin
    </Button>
  </div>

  <!-- Installed plugins -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(3) as _}
        <div class="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else if plugins.length === 0}
    <div class="flex flex-col items-center justify-center py-12 text-center">
      <div class="rounded-full bg-zinc-100 p-4 dark:bg-zinc-800 mb-3">
        <Puzzle class="h-8 w-8 text-zinc-400" />
      </div>
      <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No plugins installed.</p>
      <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Click "Install Plugin" to add one, or browse examples below.</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each plugins as p (p.id)}
        {@const badge = pluginStatusBadge(p)}
        {@const isToggling = togglingPluginId === p.id}
        <CardHoverEffect>
          <div class="p-5">
            <a href="/{$page.params.companyPrefix}/plugins/{p.id}" class="block">
              <div class="flex items-center justify-between">
                <h3 class="font-medium text-zinc-900 dark:text-zinc-100 truncate">{p.name}</h3>
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium {badge.color}">
                  {badge.label}
                </span>
              </div>
              {#if p.description}
                <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">{p.description}</p>
              {/if}
              <p class="mt-1 text-xs text-zinc-500">{p.version ?? '0.0.0'} · {p.author ?? 'Unknown'}</p>
            </a>

            {#if p.status === 'error' && p.lastError}
              <div class="mt-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-2.5 flex items-start gap-2">
                <AlertCircle class="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p class="text-xs text-red-700 dark:text-red-300 line-clamp-3">{p.lastError}</p>
              </div>
            {/if}

            <div class="mt-3 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={isToggling}
                onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); togglePlugin(p); }}
                title={p.enabled ? 'Disable plugin' : 'Enable plugin'}
              >
                {#if isToggling}
                  <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                {:else}
                  <Power class="h-3.5 w-3.5 {p.enabled ? 'text-emerald-500' : 'text-zinc-400'}" />
                {/if}
                <span class="ml-1.5">{p.enabled ? 'Disable' : 'Enable'}</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); confirmUninstall(p); }}
                title="Uninstall plugin"
                class="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHoverEffect>
      {/each}
    </div>
  {/if}

  <!-- Examples section -->
  {#if !examplesLoading && examples.length > 0}
    <Separator />
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Example Plugins</h2>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Ready-to-install plugins to help you get started.</p>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each examples as example (example.packageName)}
          {@const isInstalling = installingExampleName === example.packageName}
          {@const alreadyInstalled = plugins.some(p => p.name === example.name || p.name === example.packageName)}
          <div class="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-col justify-between gap-3 bg-white dark:bg-zinc-900">
            <div>
              <div class="flex items-center gap-2">
                <Package class="h-4 w-4 text-zinc-400 shrink-0" />
                <h3 class="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{example.name}</h3>
              </div>
              {#if example.description}
                <p class="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-3">{example.description}</p>
              {/if}
              <p class="mt-1 text-[11px] text-zinc-400 font-mono truncate">{example.packageName}</p>
            </div>
            <div class="flex justify-end">
              {#if alreadyInstalled}
                <span class="text-xs text-zinc-400 italic">Installed</span>
              {:else}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isInstalling}
                  onclick={() => installExample(example)}
                >
                  {#if isInstalling}
                    <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></span>
                    Installing...
                  {:else}
                    <Download class="h-3.5 w-3.5 mr-1.5" />
                    Install
                  {/if}
                </Button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {:else if examplesLoading}
    <Separator />
    <div class="space-y-4">
      <Skeleton class="h-6 w-40 rounded" />
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _}
          <div class="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<!-- ======================================================================= -->
<!-- Install Plugin Dialog                                                    -->
<!-- ======================================================================= -->
<Dialog bind:open={showInstallDialog}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Install Plugin</DialogTitle>
      <DialogDescription>
        Enter an npm package name or a local file path to install a plugin.
      </DialogDescription>
    </DialogHeader>

    <div class="space-y-4 py-2">
      <div class="space-y-2">
        <label for="install-pkg" class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Package Name</label>
        <Input
          id="install-pkg"
          bind:value={installPackageName}
          placeholder="e.g. @clawdev/plugin-hello-world or ./my-plugin"
          onkeydown={handleInstallKeydown}
          disabled={installing}
        />
      </div>

      <label class="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          bind:checked={installLocalPath}
          disabled={installing}
          class="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500"
        />
        <span class="text-sm text-zinc-700 dark:text-zinc-300">Install from local path</span>
      </label>

      {#if installError}
        <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
          <p class="text-sm text-red-700 dark:text-red-300">{installError}</p>
        </div>
      {/if}
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onclick={() => { showInstallDialog = false; }}
        disabled={installing}
      >
        Cancel
      </Button>
      <Button
        disabled={!installPackageName.trim() || installing}
        onclick={handleInstallSubmit}
      >
        {#if installing}
          <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></span>
          Installing...
        {:else}
          <Download class="h-4 w-4 mr-1.5" />
          Install
        {/if}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<!-- ======================================================================= -->
<!-- Uninstall Confirmation Dialog                                            -->
<!-- ======================================================================= -->
<Dialog bind:open={showUninstallDialog}>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>Uninstall Plugin</DialogTitle>
      <DialogDescription>
        Are you sure you want to uninstall <strong>{uninstallTarget?.name ?? 'this plugin'}</strong>? This action cannot be undone.
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button
        variant="outline"
        onclick={() => { showUninstallDialog = false; uninstallTarget = null; }}
        disabled={uninstalling}
      >
        Cancel
      </Button>
      <Button
        variant="destructive"
        disabled={uninstalling}
        onclick={executeUninstall}
      >
        {#if uninstalling}
          <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></span>
          Removing...
        {:else}
          <Trash2 class="h-4 w-4 mr-1.5" />
          Uninstall
        {/if}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
