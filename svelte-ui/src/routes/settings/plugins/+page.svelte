<script lang="ts">
  import { api } from '$lib/api';
  import { toastStore } from '$lib/stores/toast.svelte';
  import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
    Badge, Button, Input, Skeleton, Alert, AlertTitle, AlertDescription,
  } from '$lib/components/ui/index.js';
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
        <Puzzle class="h-6 w-6 text-muted-foreground" />
        <h1 class="truncate text-xl font-semibold text-foreground">Plugins</h1>
      </div>
      <p class="text-sm text-muted-foreground">
        Manage the global plugin runtime, install examples, and inspect plugin health.
      </p>
    </div>
    <Button variant="outline" onclick={() => loadPlugins()} disabled={loading || refreshing}>
      <RefreshCcw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
      Refresh
    </Button>
  </div>

  <Alert variant="warning">
    <AlertTriangle class="h-4 w-4" />
    <AlertTitle>Plugins are alpha.</AlertTitle>
    <AlertDescription>
      The plugin runtime and API surface are still changing. Expect breaking changes while this feature settles.
    </AlertDescription>
  </Alert>

  <!-- Install a Plugin -->
  <Card class="border-border/60">
    <CardHeader>
      <div class="flex items-center gap-2">
        <PackagePlus class="h-5 w-5 text-muted-foreground" />
        <div>
          <CardTitle>Install a Plugin</CardTitle>
          <CardDescription>Enter an npm package name or a local path to install a plugin into the instance runtime.</CardDescription>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-3">
      <div class="flex flex-col gap-3 sm:flex-row">
        <Input
          bind:value={installPackageName}
          placeholder="@clawdev/plugin-hello-world-example or ./my-plugin"
          class="flex-1"
        />
        <Button
          disabled={installing || !installPackageName.trim()}
          onclick={handleInstallSubmit}
        >
          {#if installing}
            <Loader2 class="h-4 w-4 animate-spin" />
            Installing...
          {:else}
            <Download class="h-4 w-4" />
            Install
          {/if}
        </Button>
      </div>

      {#if installError}
        <Alert variant="destructive">
          <AlertDescription>{installError}</AlertDescription>
        </Alert>
      {/if}
    </CardContent>
  </Card>

  {#if error}
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {/if}

  <!-- Available Plugins (Examples) -->
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <Package class="h-5 w-5 text-muted-foreground" />
      <h2 class="text-base font-semibold text-foreground">Available Plugins</h2>
    </div>

    {#if examplesLoading}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _}
          <Skeleton class="h-28 rounded-xl" />
        {/each}
      </div>
    {:else if examples.length === 0}
      <div class="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
        No bundled example plugins were found in this checkout.
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each examples as example (example.packageName)}
          {@const isInstalling = installExampleName === example.packageName}
          {@const alreadyInstalled = plugins.some((plugin) => plugin.name === example.name || plugin.packageName === example.packageName)}
          <Card class="border-border/60">
            <CardContent class="flex h-full flex-col justify-between gap-3 pt-6">
              <div>
                <div class="flex items-center gap-2">
                  <Package class="h-4 w-4 shrink-0 text-muted-foreground" />
                  <h3 class="truncate text-sm font-medium text-foreground">{example.name}</h3>
                </div>
                {#if example.description}
                  <p class="mt-1.5 line-clamp-3 text-xs text-muted-foreground">{example.description}</p>
                {/if}
                <p class="mt-1 truncate font-mono text-[11px] text-muted-foreground/60">{example.packageName}</p>
              </div>
              <div class="flex justify-end">
                {#if alreadyInstalled}
                  <Badge variant="secondary">Installed</Badge>
                {:else}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isInstalling}
                    onclick={() => installExample(example)}
                  >
                    {#if isInstalling}
                      <Loader2 class="h-3.5 w-3.5 animate-spin" />
                      Installing...
                    {:else}
                      <Download class="h-3.5 w-3.5" />
                      Install
                    {/if}
                  </Button>
                {/if}
              </div>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Installed Plugins -->
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <Puzzle class="h-5 w-5 text-muted-foreground" />
      <h2 class="text-base font-semibold text-foreground">Installed Plugins</h2>
    </div>

    {#if loading}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each Array(3) as _}
          <Skeleton class="h-32 rounded-xl" />
        {/each}
      </div>
    {:else if plugins.length === 0}
      <Card class="border-border/60">
        <CardContent class="flex flex-col items-center justify-center py-12">
          <div class="mb-3 rounded-full bg-accent p-4">
            <Puzzle class="h-8 w-8 text-muted-foreground" />
          </div>
          <p class="text-sm font-medium text-foreground">No plugins installed.</p>
          <p class="mt-1 text-xs text-muted-foreground">Install an example above or use the package installer below.</p>
        </CardContent>
      </Card>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {#each plugins as plugin (plugin.id)}
          <Card class="border-border/60">
            <CardContent class="pt-6">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3 class="truncate text-sm font-medium text-foreground">
                    {plugin.manifestJson?.displayName ?? plugin.name}
                  </h3>
                  <p class="mt-1 text-xs text-muted-foreground">
                    {plugin.version ?? plugin.manifestJson?.version ?? '0.0.0'} -- {plugin.author ?? 'Unknown'}
                  </p>
                </div>
                <Badge variant="secondary" class="text-[11px] uppercase tracking-wide">
                  {formatStatus(plugin)}
                </Badge>
              </div>

              {#if plugin.status === 'error' || plugin.lastError}
                <Alert variant="destructive" class="mt-3">
                  <AlertTriangle class="h-4 w-4" />
                  <AlertTitle>Plugin error</AlertTitle>
                  <AlertDescription>{getPluginErrorSummary(plugin)}</AlertDescription>
                </Alert>
              {:else if plugin.description}
                <p class="mt-3 line-clamp-3 text-xs text-muted-foreground">{plugin.description}</p>
              {/if}

              <div class="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={busyById[plugin.id]}
                  onclick={() => togglePlugin(plugin)}
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
                </Button>

                <Button
                  variant="outline"
                  size="xs"
                  onclick={() => {
                    errorDetailsPlugin = plugin;
                    errorDetailsDialogOpen = true;
                  }}
                >
                  View details
                </Button>

                <Button
                  variant="outline"
                  size="xs"
                  class="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onclick={() => {
                    uninstallPlugin = plugin;
                    uninstallDialogOpen = true;
                  }}
                >
                  <Trash2 class="h-3.5 w-3.5" />
                  Uninstall
                </Button>
              </div>
            </CardContent>
          </Card>
        {/each}
      </div>
    {/if}
  </section>
</div>
