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
    Badge, Button, Input, Separator, Skeleton,
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
  } from '$components/ui/index.js';
  import { AlertTriangle, Plus, Package, Download, Loader2, Puzzle, Trash2, Power } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Plugin {
    id: string;
    name: string;
    packageName?: string;
    version?: string;
    author?: string;
    enabled?: boolean;
    status?: string;
    description?: string;
    lastError?: string | null;
    manifestJson?: {
      displayName?: string;
      version?: string;
      description?: string;
    };
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
  let installing = $state(false);
  let installError = $state<string | null>(null);
  let uninstallPlugin = $state<Plugin | null>(null);
  let uninstallDialogOpen = $state(false);
  let errorDetailsPlugin = $state<Plugin | null>(null);
  let errorDetailsDialogOpen = $state(false);

  // Examples
  let examples = $state<ExamplePlugin[]>([]);
  let examplesLoading = $state(true);
  let installingExampleName = $state<string | null>(null);

  function firstNonEmptyLine(value: string | null | undefined): string | null {
    if (!value) return null;
    const line = value
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean);
    return line ?? null;
  }

  function getPluginErrorSummary(plugin: Plugin): string {
    return firstNonEmptyLine(plugin.lastError) ?? 'Plugin entered an error state without a stored error message.';
  }

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
      const res = await api('/api/plugins/install', {
        method: 'POST',
        body: JSON.stringify({ packageName }),
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

  async function togglePluginEnabled(plugin: Plugin) {
    const action = plugin.enabled ? 'disable' : 'enable';
    try {
      const res = await api(`/api/plugins/${plugin.id}/${action}`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed to ${action} plugin.`);
      }
      toastStore.push({
        title: `Plugin ${plugin.enabled ? 'disabled' : 'enabled'}`,
        body: `${plugin.manifestJson?.displayName ?? plugin.name} ${plugin.enabled ? 'disabled' : 'enabled'} successfully.`,
        tone: 'success',
      });
      await loadPlugins();
    } catch (err: any) {
      toastStore.push({
        title: `Failed to ${action} plugin`,
        body: err?.message ?? `Unable to ${action} plugin.`,
        tone: 'error',
      });
    }
  }

  async function uninstallSelectedPlugin() {
    if (!uninstallPlugin) return;
    try {
      const res = await api(`/api/plugins/${uninstallPlugin.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Failed to uninstall plugin.');
      }
      toastStore.push({
        title: 'Plugin uninstalled',
        body: `${uninstallPlugin.manifestJson?.displayName ?? uninstallPlugin.name} removed successfully.`,
        tone: 'success',
      });
      uninstallPlugin = null;
      await loadPlugins();
    } catch (err: any) {
      toastStore.push({
        title: 'Failed to uninstall plugin',
        body: err?.message ?? 'Unable to uninstall plugin.',
        tone: 'error',
      });
    }
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
    installError = null;
    installing = false;
    showInstallDialog = true;
  }

  $effect(() => {
    if (!uninstallDialogOpen) {
      uninstallPlugin = null;
    }
  });

  $effect(() => {
    if (!errorDetailsDialogOpen) {
      errorDetailsPlugin = null;
    }
  });

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(() => {
    breadcrumbStore.set([{ label: 'Plugins' }]);
    loadPlugins();
    loadExamples();
  });
</script>

<div class="space-y-6 p-6">
  <div class="flex items-center justify-between gap-4">
    <div class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plugins</h1>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Install, enable, and inspect plugins for this company.
      </p>
    </div>
    <Button size="sm" onclick={openInstallDialog}>
      <Plus class="mr-1.5 h-4 w-4" />
      Install Plugin
    </Button>
  </div>

  <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
    <div class="flex items-start gap-3">
      <Puzzle class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div class="space-y-1 text-sm">
        <p class="font-medium text-foreground">Plugins are alpha.</p>
        <p class="text-muted-foreground">
          The plugin runtime and API surface are still changing. Expect breaking changes while this feature settles.
        </p>
      </div>
    </div>
  </div>

  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <Package class="h-5 w-5 text-muted-foreground" />
      <h2 class="text-base font-semibold">Available Plugins</h2>
      <Badge variant="outline">Examples</Badge>
    </div>

    {#if examplesLoading}
      <div class="space-y-4">
        <Skeleton class="h-6 w-40 rounded" />
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {#each Array(3) as _}
            <div class="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
          {/each}
        </div>
      </div>
    {:else if examples.length === 0}
      <div class="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No bundled example plugins were found in this checkout.
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each examples as example (example.packageName)}
          {@const isInstalling = installingExampleName === example.packageName}
          {@const alreadyInstalled = plugins.some(p => p.name === example.name || p.name === example.packageName)}
          <div class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div class="flex h-full flex-col justify-between gap-3">
              <div>
                <div class="flex items-center gap-2">
                  <Package class="h-4 w-4 shrink-0 text-zinc-400" />
                  <h3 class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{example.name}</h3>
                </div>
                {#if example.description}
                  <p class="mt-1.5 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{example.description}</p>
                {/if}
                <p class="mt-1 truncate font-mono text-[11px] text-zinc-400">{example.packageName}</p>
              </div>
              <div class="flex justify-end">
                {#if alreadyInstalled}
                  <span class="text-xs italic text-zinc-400">Installed</span>
                {:else}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isInstalling}
                    onclick={() => installExample(example)}
                  >
                    {#if isInstalling}
                      <span class="mr-1.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                      Installing...
                    {:else}
                      <Download class="mr-1.5 h-3.5 w-3.5" />
                      Install
                    {/if}
                  </Button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <Separator />

  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <Puzzle class="h-5 w-5 text-muted-foreground" />
      <h2 class="text-base font-semibold">Installed Plugins</h2>
    </div>

    {#if loading}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _}
          <div class="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
        {/each}
      </div>
    {:else if plugins.length === 0}
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <div class="mb-3 rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
          <Puzzle class="h-8 w-8 text-zinc-400" />
        </div>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No plugins installed.</p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Click "Install Plugin" to add one, or browse examples above.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each plugins as p (p.id)}
          <CardHoverEffect>
            <a href="/{$page.params.companyPrefix}/plugins/{p.id}" class="block p-5">
              <div class="flex items-center justify-between">
                <h3 class="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</h3>
                <StatusBadge status={p.status ?? (p.enabled ? 'enabled' : 'disabled')} />
              </div>
              {#if p.status === 'error' || p.lastError}
                <div class="mt-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                  <div class="flex items-start gap-3">
                    <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium text-red-700 dark:text-red-300">Plugin error</p>
                      <p class="mt-1 text-sm text-red-700/90 dark:text-red-200/90 break-words">
                        {getPluginErrorSummary(p)}
                      </p>
                    </div>
                  </div>
                </div>
              {:else if p.description}
                <p class="mt-1.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{p.description}</p>
              {/if}
              <p class="mt-1 text-xs text-zinc-500">{p.version ?? '0.0.0'} · {p.author ?? 'Unknown'}</p>
            </a>
            <div class="flex items-center justify-end gap-2 px-5 pb-5 pt-0">
              {#if p.status === 'error' || p.lastError}
                <Button
                  variant="outline"
                  size="sm"
                  class="border-red-500/30 bg-background/60 text-red-700 hover:bg-red-500/10 hover:text-red-800 dark:text-red-200 dark:hover:text-red-100"
                  onclick={() => {
                    errorDetailsPlugin = p;
                    errorDetailsDialogOpen = true;
                  }}
                >
                  View full error
                </Button>
              {/if}
              <Button
                variant="outline"
                size="sm"
                onclick={() => void togglePluginEnabled(p)}
              >
                <Power class="mr-1.5 h-4 w-4" />
                {p.enabled ? 'Disable' : 'Enable'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onclick={() => {
                  uninstallPlugin = p;
                  uninstallDialogOpen = true;
                }}
              >
                <Trash2 class="mr-1.5 h-4 w-4" />
                Uninstall
              </Button>
            </div>
          </CardHoverEffect>
        {/each}
      </div>
    {/if}
  </section>
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

<Dialog bind:open={uninstallDialogOpen}>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Uninstall Plugin</DialogTitle>
      <DialogDescription>
        Are you sure you want to uninstall <strong>{uninstallPlugin?.manifestJson?.displayName ?? uninstallPlugin?.name ?? 'this plugin'}</strong>? This action cannot be undone.
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button variant="outline" onclick={() => (uninstallDialogOpen = false)}>Cancel</Button>
      <Button
        variant="destructive"
        onclick={() => void uninstallSelectedPlugin().then(() => {
          uninstallDialogOpen = false;
        })}
        disabled={uninstallPlugin === null}
      >
        Uninstall
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog bind:open={errorDetailsDialogOpen}>
  <DialogContent class="sm:max-w-2xl">
    <DialogHeader>
      <DialogTitle>Error Details</DialogTitle>
      <DialogDescription>
        {errorDetailsPlugin?.manifestJson?.displayName ?? errorDetailsPlugin?.name ?? 'Plugin'} hit an error state.
      </DialogDescription>
    </DialogHeader>
    <div class="space-y-4">
      <div class="rounded-md border border-red-500/25 bg-red-500/[0.06] px-4 py-3">
        <div class="flex items-start gap-3">
          <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
          <div class="space-y-1 text-sm">
            <p class="font-medium text-red-700 dark:text-red-300">What errored</p>
            <p class="text-red-700/90 dark:text-red-200/90 break-words">
              {errorDetailsPlugin ? getPluginErrorSummary(errorDetailsPlugin) : 'No error summary available.'}
            </p>
          </div>
        </div>
      </div>
      <div class="space-y-2">
        <p class="text-sm font-medium">Full error output</p>
        <pre class="max-h-[50vh] overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-5 whitespace-pre-wrap break-words">
          {errorDetailsPlugin?.lastError ?? 'No stored error message.'}
        </pre>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onclick={() => (errorDetailsDialogOpen = false)}>
        Close
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
