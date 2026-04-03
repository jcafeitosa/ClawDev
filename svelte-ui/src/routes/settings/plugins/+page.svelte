<script lang="ts">
  import { api } from '$lib/api';
  import { toastStore } from '$lib/stores/toast.svelte';
  import {
    AlertTriangle,
    Download,
    Loader2,
    Package,
    Puzzle,
    PackagePlus,
    Power,
    RefreshCcw,
    Trash2,
  } from 'lucide-svelte';

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
  }

  interface ExamplePlugin {
    name: string;
    packageName: string;
    description?: string;
  }

  let plugins = $state<Plugin[]>([]);
  let examples = $state<ExamplePlugin[]>([]);
  let loading = $state(true);
  let examplesLoading = $state(true);
  let refreshing = $state(false);
  let installing = $state(false);
  let installPackageName = $state('');
  let installError = $state<string | null>(null);
  let error = $state<string | null>(null);
  let busyById = $state<Record<string, boolean>>({});
  let installExampleName = $state<string | null>(null);
  let uninstallPlugin = $state<Plugin | null>(null);
  let uninstallDialogOpen = $state(false);
  let errorDetailsPlugin = $state<Plugin | null>(null);
  let errorDetailsDialogOpen = $state(false);

  const tabs = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];

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

  function handleInstallSubmit() {
    const specifier = installPackageName.trim();
    if (!specifier) return;
    void installPlugin(specifier);
  }

  async function loadPlugins() {
    loading = plugins.length === 0;
    refreshing = plugins.length > 0;
    error = null;
    try {
      const res = await api('/api/plugins');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      plugins = Array.isArray(data) ? data : data.plugins ?? [];
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load plugins';
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function loadExamples() {
    examplesLoading = true;
    try {
      const res = await api('/api/plugins/examples');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      examples = Array.isArray(data) ? data : data.examples ?? [];
    } catch {
      examples = [];
    } finally {
      examplesLoading = false;
    }
  }

  async function installPlugin(specifier: string) {
    installing = true;
    installError = null;
    try {
      const source = specifier.trim().startsWith('.') || specifier.trim().startsWith('/') ? 'local' : 'npm';
      const res = await api('/api/plugins/install', {
        method: 'POST',
        body: JSON.stringify({ source, specifier: specifier.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toastStore.push({
        title: 'Plugin installed',
        body: `${specifier.trim()} installed successfully.`,
        tone: 'success',
      });
      installPackageName = '';
      await loadPlugins();
    } catch (err) {
      installError = err instanceof Error ? err.message : 'Installation failed';
    } finally {
      installing = false;
    }
  }

  async function installExample(example: ExamplePlugin) {
    installExampleName = example.packageName;
    try {
      const res = await api('/api/plugins/install', {
        method: 'POST',
        body: JSON.stringify({ source: 'npm', specifier: example.packageName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toastStore.push({
        title: 'Plugin installed',
        body: `${example.name} installed successfully.`,
        tone: 'success',
      });
      await loadPlugins();
    } catch (err) {
      toastStore.push({
        title: 'Installation failed',
        body: err instanceof Error ? err.message : 'Unknown error',
        tone: 'error',
      });
    } finally {
      installExampleName = null;
    }
  }

  async function togglePlugin(plugin: Plugin) {
    const action = plugin.enabled ? 'disable' : 'enable';
    busyById = { ...busyById, [plugin.id]: true };
    try {
      const res = await api(`/api/plugins/${plugin.id}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toastStore.push({
        title: `Plugin ${action}d`,
        body: `${plugin.manifestJson?.displayName ?? plugin.name} ${action}d successfully.`,
        tone: 'success',
      });
      await loadPlugins();
    } catch (err) {
      toastStore.push({
        title: `Failed to ${action} plugin`,
        body: err instanceof Error ? err.message : 'Unknown error',
        tone: 'error',
      });
    } finally {
      const { [plugin.id]: _removed, ...rest } = busyById;
      busyById = rest;
    }
  }

  async function uninstallSelectedPlugin() {
    if (!uninstallPlugin) return;
    try {
      const res = await api(`/api/plugins/${uninstallPlugin.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toastStore.push({
        title: 'Plugin uninstalled',
        body: `${uninstallPlugin.manifestJson?.displayName ?? uninstallPlugin.name} removed successfully.`,
        tone: 'success',
      });
      uninstallPlugin = null;
      await loadPlugins();
    } catch (err) {
      toastStore.push({
        title: 'Failed to uninstall plugin',
        body: err instanceof Error ? err.message : 'Unknown error',
        tone: 'error',
      });
    }
  }

  function formatStatus(plugin: Plugin): string {
    return plugin.status ?? (plugin.enabled ? 'enabled' : 'disabled');
  }

  $effect(() => {
    if (!uninstallDialogOpen) uninstallPlugin = null;
  });

  $effect(() => {
    if (!errorDetailsDialogOpen) errorDetailsPlugin = null;
  });

  $effect(() => {
    loadPlugins();
    loadExamples();
    const timer = setInterval(() => loadPlugins(), 30_000);
    return () => clearInterval(timer);
  });
</script>

<div class="space-y-6 p-6">
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0 space-y-1">
      <div class="flex items-center gap-2">
        <Puzzle class="h-6 w-6 text-zinc-400" />
        <h1 class="truncate text-xl font-semibold text-zinc-900 dark:text-zinc-50">Plugins</h1>
      </div>
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        Manage the global plugin runtime, install examples, and inspect plugin health.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => loadPlugins()}
        disabled={loading || refreshing}
        class="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <RefreshCcw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
        Refresh
      </button>
    </div>
  </div>

  <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
    <div class="flex items-start gap-3">
      <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div class="space-y-1 text-sm">
        <p class="font-medium text-foreground">Plugins are alpha.</p>
        <p class="text-muted-foreground">
          The plugin runtime and API surface are still changing. Expect breaking changes while this feature settles.
        </p>
      </div>
    </div>
  </div>

  <section class="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div class="flex items-center gap-2">
      <PackagePlus class="h-5 w-5 text-zinc-400" />
      <h2 class="text-base font-semibold">Install a Plugin</h2>
    </div>
    <p class="text-sm text-zinc-500 dark:text-zinc-400">
      Enter an npm package name or a local path to install a plugin into the instance runtime.
    </p>
    <div class="flex flex-col gap-3 sm:flex-row">
      <input
        type="text"
        bind:value={installPackageName}
        placeholder="@clawdev/plugin-hello-world-example or ./my-plugin"
        class="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-indigo-500 dark:border-zinc-700 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      <button
        type="button"
        disabled={installing || !installPackageName.trim()}
        onclick={handleInstallSubmit}
        class="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {#if installing}
          <Loader2 class="h-4 w-4 animate-spin" />
          Installing...
        {:else}
          <Download class="h-4 w-4" />
          Install
        {/if}
      </button>
    </div>

    {#if installError}
      <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
        {installError}
      </div>
    {/if}
  </section>

  {#if error}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
      {error}
    </div>
  {/if}

  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <Package class="h-5 w-5 text-muted-foreground" />
      <h2 class="text-base font-semibold">Available Plugins</h2>
    </div>

    {#if examplesLoading}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _}
          <div class="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
        {/each}
      </div>
    {:else if examples.length === 0}
      <div class="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No bundled example plugins were found in this checkout.
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each examples as example (example.packageName)}
          {@const isInstalling = installExampleName === example.packageName}
          {@const alreadyInstalled = plugins.some((plugin) => plugin.name === example.name || plugin.packageName === example.packageName)}
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
                  <button
                    type="button"
                    disabled={isInstalling}
                    onclick={() => installExample(example)}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {#if isInstalling}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                      Installing...
                    {:else}
                      <Download class="h-3.5 w-3.5" />
                      Install
                    {/if}
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>

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
      <div class="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <div class="mb-3 rounded-full bg-zinc-100 p-4 dark:bg-zinc-800">
          <Puzzle class="h-8 w-8 text-zinc-400" />
        </div>
        <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No plugins installed.</p>
        <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Install an example above or use the package installer below.</p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each plugins as plugin (plugin.id)}
          <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {plugin.manifestJson?.displayName ?? plugin.name}
                </h3>
                <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {plugin.version ?? plugin.manifestJson?.version ?? '0.0.0'} · {plugin.author ?? 'Unknown'}
                </p>
              </div>
              <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
                {formatStatus(plugin)}
              </span>
            </div>

            {#if plugin.status === 'error' || plugin.lastError}
              <div class="mt-3 rounded-md border border-red-500/25 bg-red-500/[0.06] px-3 py-2">
                <div class="flex items-start gap-3">
                  <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300" />
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-red-700 dark:text-red-300">Plugin error</p>
                    <p class="mt-1 text-sm text-red-700/90 dark:text-red-200/90 break-words">{getPluginErrorSummary(plugin)}</p>
                  </div>
                </div>
              </div>
            {:else if plugin.description}
              <p class="mt-3 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{plugin.description}</p>
            {/if}

            <div class="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busyById[plugin.id]}
                onclick={() => togglePlugin(plugin)}
                class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                {#if busyById[plugin.id]}
                  <Loader2 class="h-3.5 w-3.5 animate-spin" />
                  Saving...
                {:else if plugin.enabled}
                  <Power class="h-3.5 w-3.5" />
                  Disable
                {:else}
                  <Power class="h-3.5 w-3.5" />
                  Enable
                {/if}
              </button>

              <button
                type="button"
                onclick={() => {
                  errorDetailsPlugin = plugin;
                  errorDetailsDialogOpen = true;
                }}
                class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                View details
              </button>

              <button
                type="button"
                onclick={() => {
                  uninstallPlugin = plugin;
                  uninstallDialogOpen = true;
                }}
                class="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                <Trash2 class="h-3.5 w-3.5" />
                Uninstall
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>
