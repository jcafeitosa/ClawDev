<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { api } from "$lib/api";
  import { PluginSlotOutlet } from "$lib/components/plugins";
  import PageSkeleton from "$lib/components/page-skeleton.svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { pluginUiContributionsStore, type PluginUiContribution } from "$stores/plugin-ui-contributions.svelte.js";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import {
    AlertTriangle,
    ArrowLeft,
    Circle,
    Cpu,
    Loader2,
    Package,
    Puzzle,
    Trash2,
    X,
  } from "lucide-svelte";
  import { onMount } from "svelte";
  import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Separator,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "$components/ui/index.js";

  interface PluginRecord {
    id: string;
    name: string;
    version?: string;
    author?: string;
    description?: string;
    enabled: boolean;
    status?: string;
    categories?: string[];
    lastError?: string | null;
    manifestJson?: {
      displayName?: string;
      description?: string;
      author?: string;
      version?: string;
      categories?: string[];
      capabilities?: string[];
    };
    [key: string]: unknown;
  }

  interface HealthStatus {
    healthy: boolean;
    message?: string;
    checks?: Array<{ name: string; passed: boolean; message?: string }>;
    lastError?: string;
    [key: string]: unknown;
  }

  interface LogEntry {
    id?: string;
    level: string;
    message: string;
    timestamp?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  let plugin = $state<PluginRecord | null>(null);
  let loading = $state(true);
  let pluginId = $derived($page.params.pluginId);
  let prefix = $derived($page.params.companyPrefix);
  let activeTab = $state("details");

  let health = $state<HealthStatus | null>(null);
  let healthLoading = $state(false);

  let logs = $state<LogEntry[]>([]);
  let logsLoading = $state(false);

  let uiContributions = $state<PluginUiContribution[]>([]);
  let uiContributionsLoading = $state(false);

  let confirmDelete = $state(false);
  let deleting = $state(false);

  const displayName = $derived(plugin?.manifestJson?.displayName ?? plugin?.name ?? "Plugin");
  const pluginDescription = $derived(
    plugin?.manifestJson?.description ?? plugin?.description ?? "No description provided.",
  );
  const author = $derived(plugin?.manifestJson?.author ?? plugin?.author ?? "Unknown");
  const version = $derived(plugin?.manifestJson?.version ?? plugin?.version ?? "0.0.0");
  const categories = $derived((plugin?.manifestJson?.categories ?? plugin?.categories ?? []) as string[]);
  const capabilities = $derived((plugin?.manifestJson?.capabilities ?? []) as string[]);
  const healthChecks = $derived(health?.checks ?? []);
  const lastError = $derived(plugin?.lastError ?? health?.lastError ?? null);
  const pluginContribution = $derived(uiContributions.find((entry) => entry.pluginId === pluginId) ?? null);
  const settingsSlots = $derived(pluginContribution?.slots?.filter((slot) => slot.type === "settingsPage") ?? []);
  const pageSlots = $derived(pluginContribution?.slots?.filter((slot) => slot.type === "page") ?? []);
  const pluginHostContext = $derived({
    companyId: resolveCompanyIdFromPrefix(prefix) ?? companyStore.selectedCompanyId ?? null,
    companyPrefix: prefix || null,
    projectId: null,
    entityId: pluginId ?? null,
    entityType: "plugin",
    parentEntityId: null,
    userId: null,
  });
  function formatTime(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function formatLevel(level: string) {
    const lower = level.toLowerCase();
    if (lower === "error") return "bg-red-600 text-red-100";
    if (lower === "warn" || lower === "warning") return "bg-yellow-600 text-yellow-100";
    if (lower === "info") return "bg-blue-600 text-blue-100";
    return "bg-zinc-600 text-zinc-100";
  }

  function setBreadcrumbsForPlugin(name?: string) {
    breadcrumbStore.set([
      { label: "Plugins", href: `/${prefix}/plugins` },
      { label: name ?? "Detail" },
    ]);
  }

  async function loadPlugin() {
    if (!pluginId) return;
    loading = true;
    try {
      const res = await api(`/api/plugins/${pluginId}`);
      if (!res.ok) throw new Error(await res.text());
      plugin = (await res.json()) as PluginRecord;
      setBreadcrumbsForPlugin(plugin?.name ?? displayName);
    } catch (error: any) {
      plugin = null;
      toastStore.push({
        title: "Failed to load plugin",
        body: error?.message ?? "Unable to load plugin details.",
        tone: "error",
      });
    } finally {
      loading = false;
    }
  }

  async function loadHealth() {
    if (!pluginId) return;
    healthLoading = true;
    try {
      const res = await api(`/api/plugins/${pluginId}/health`);
      if (res.ok) {
        health = (await res.json()) as HealthStatus;
      } else {
        health = { healthy: false, message: `HTTP ${res.status}` };
      }
    } catch {
      health = { healthy: false, message: "Unreachable" };
    } finally {
      healthLoading = false;
    }
  }

  async function loadLogs() {
    if (!pluginId) return;
    logsLoading = true;
    try {
      const res = await api(`/api/plugins/${pluginId}/logs?limit=50`);
      if (res.ok) {
        const data = await res.json();
        logs = Array.isArray(data) ? data : data.logs ?? data.items ?? [];
      } else {
        logs = [];
      }
    } catch {
      logs = [];
    } finally {
      logsLoading = false;
    }
  }

  function onTabChange(tab: string) {
    activeTab = tab;
    if (tab === "logs" && logs.length === 0) {
      void loadLogs();
    }
  }

  async function toggleEnabled() {
    if (!plugin) return;
    try {
      const res = await api(`/api/plugins/${pluginId}/${plugin.enabled ? "disable" : "enable"}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      plugin = { ...plugin, enabled: !plugin.enabled };
      toastStore.push({ title: `Plugin ${plugin.enabled ? "enabled" : "disabled"}`, tone: "success" });
    } catch (error: any) {
      toastStore.push({
        title: "Failed to toggle plugin",
        body: error?.message ?? "Unable to update plugin state.",
        tone: "error",
      });
    }
  }

  async function uninstallPlugin() {
    deleting = true;
    try {
      const res = await api(`/api/plugins/${pluginId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Plugin uninstalled", tone: "success" });
      goto(`/${prefix}/plugins`);
    } catch (error: any) {
      toastStore.push({
        title: "Failed to uninstall plugin",
        body: error?.message ?? "Unable to uninstall plugin.",
        tone: "error",
      });
    } finally {
      deleting = false;
      confirmDelete = false;
    }
  }

  onMount(() => {
    setBreadcrumbsForPlugin();
    uiContributionsLoading = true;
    void pluginUiContributionsStore
      .load()
      .then(() => {
        uiContributions = pluginUiContributionsStore.contributions;
      })
      .finally(() => {
        uiContributionsLoading = false;
      });
  });

  $effect(() => {
    if (!pluginId) return;
    void loadPlugin();
  });

  $effect(() => {
    if (!pluginId || !plugin) return;
    void loadHealth();
  });

</script>

<div class="space-y-6 p-6">
  {#if loading}
    <PageSkeleton />
  {:else if !plugin}
    <div class="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      Plugin not found.
    </div>
  {:else}
    <div class="space-y-4">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 space-y-3">
          <div class="flex items-center gap-3">
            <a
              href={`/${prefix}/plugins`}
              class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              <ArrowLeft class="h-4 w-4" />
            </a>
            <div class="flex min-w-0 items-center gap-2">
              <Puzzle class="h-6 w-6 text-zinc-500" />
              <h1 class="truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{displayName}</h1>
              <StatusBadge status={plugin.enabled ? "enabled" : "disabled"} />
              {#if plugin.status}
                <Badge variant={plugin.status === "ready" ? "default" : plugin.status === "error" ? "destructive" : "secondary"}>
                  {plugin.status}
                </Badge>
              {/if}
              <Badge variant="outline">v{version}</Badge>
            </div>
          </div>

          <p class="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {pluginDescription}
          </p>

          <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Author: {author}</span>
            <span>•</span>
            <span>Plugin ID: <span class="font-mono">{plugin.id}</span></span>
            {#if lastError}
              <span class="text-amber-600 dark:text-amber-400">• Error: {lastError}</span>
            {/if}
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-2">
          {#if pageSlots.length > 0}
            <Button variant="outline" size="sm" onclick={() => goto(`/${prefix}/plugins/${pluginId}/page`)}>
              Open Plugin Page
            </Button>
          {/if}
          <Button variant="outline" size="sm" onclick={() => goto(`/${prefix}/plugins/${pluginId}/settings`)}>
            Settings
          </Button>
          <Button variant="outline" size="sm" onclick={() => void loadHealth()} disabled={healthLoading}>
            {#if healthLoading}
              <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
            {/if}
            Refresh Health
          </Button>
          <Button variant="outline" size="sm" onclick={() => void loadLogs()} disabled={logsLoading}>
            {#if logsLoading}
              <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
            {/if}
            Refresh Logs
          </Button>
          <Button
            variant={plugin.enabled ? "destructive" : "default"}
            size="sm"
            onclick={toggleEnabled}
            disabled={deleting}
          >
            {plugin.enabled ? "Disable" : "Enable"}
          </Button>
          {#if confirmDelete}
            <div class="flex items-center gap-1.5">
              <Button variant="destructive" size="sm" onclick={uninstallPlugin} disabled={deleting}>
                {#if deleting}
                  <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                  Removing...
                {:else}
                  Confirm Uninstall
                {/if}
              </Button>
              <Button variant="ghost" size="sm" onclick={() => (confirmDelete = false)} disabled={deleting}>
                <X class="size-3.5" />
              </Button>
            </div>
          {:else}
            <Button variant="destructive" size="sm" onclick={() => (confirmDelete = true)}>
              <Trash2 class="size-3.5 mr-1.5" />
              Uninstall
            </Button>
          {/if}
        </div>
      </div>

      <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
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

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card class="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader class="pb-3">
            <CardDescription>Status</CardDescription>
            <CardTitle class="text-lg capitalize">{plugin.status ?? "unknown"}</CardTitle>
          </CardHeader>
        </Card>
        <Card class="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader class="pb-3">
            <CardDescription>Health</CardDescription>
            <CardTitle class="text-lg">{health?.healthy ? "Healthy" : "Unhealthy"}</CardTitle>
          </CardHeader>
        </Card>
        <Card class="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader class="pb-3">
            <CardDescription>Logs</CardDescription>
            <CardTitle class="text-lg">{logs.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card class="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader class="pb-3">
            <CardDescription>Capabilities</CardDescription>
            <CardTitle class="text-lg">{capabilities.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => (activeTab = value)} class="space-y-6">
        <TabsList class="w-full justify-start">
          <TabsTrigger value="details" onclick={() => (activeTab = "details")}>Details</TabsTrigger>
          <TabsTrigger value="logs" onclick={() => (activeTab = "logs")}>Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="details" class="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plugin UI</CardTitle>
              <CardDescription>Mounted page slot declared by the plugin bundle</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              {#if pageSlots.length > 0}
                <PluginSlotOutlet
                  pluginId={pluginId}
                  slotTypes={["page"]}
                  context={pluginHostContext}
                  routePath={pageSlots[0]?.routePath ?? null}
                  class="space-y-3"
                  itemClassName="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
                />
              {:else}
                <p class="text-sm text-zinc-500 dark:text-zinc-400">This plugin does not declare a page slot.</p>
              {/if}
            </CardContent>
          </Card>

          <div class="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Information</CardTitle>
                <CardDescription>Identity and manifest metadata</CardDescription>
              </CardHeader>
              <CardContent>
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between gap-4">
                    <dt class="text-zinc-500 dark:text-zinc-400">Name</dt>
                    <dd class="font-medium text-zinc-900 dark:text-zinc-100">{plugin.name}</dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-zinc-500 dark:text-zinc-400">Version</dt>
                    <dd class="font-mono">{version}</dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-zinc-500 dark:text-zinc-400">Author</dt>
                    <dd>{author}</dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-zinc-500 dark:text-zinc-400">Status</dt>
                    <dd><StatusBadge status={plugin.enabled ? "enabled" : "disabled"} /></dd>
                  </div>
                  <div class="flex justify-between gap-4">
                    <dt class="text-zinc-500 dark:text-zinc-400">ID</dt>
                    <dd class="font-mono text-xs break-all">{plugin.id}</dd>
                  </div>
                </dl>

                <Separator class="my-4" />

                <div class="space-y-3">
                  <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Categories</div>
                  <div class="flex flex-wrap gap-2">
                    {#if categories.length > 0}
                      {#each categories as category}
                        <Badge variant="outline" class="capitalize">{category}</Badge>
                      {/each}
                    {:else}
                      <span class="text-sm text-zinc-500 dark:text-zinc-400">None</span>
                    {/if}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle class="flex items-center gap-2">
                  <Cpu class="h-4 w-4" />
                  Health
                </CardTitle>
                <CardDescription>Registry, manifest, status, and error-state checks</CardDescription>
              </CardHeader>
              <CardContent class="space-y-4">
                {#if healthLoading}
                  <div class="flex items-center gap-2 text-sm text-zinc-500">
                    <div class="size-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                    Checking health...
                  </div>
                {:else if health}
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <Badge variant={health?.healthy ? "default" : "destructive"}>
                        {health.healthy ? "Healthy" : "Unhealthy"}
                      </Badge>
                      <span class="text-xs text-zinc-500 dark:text-zinc-400">
                        {health.message ?? `Status: ${health.status ?? plugin.status ?? "unknown"}`}
                      </span>
                    </div>

                    <div class="space-y-2">
                      {#each healthChecks as check}
                        <div class="flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                          {#if check.passed}
                            <span class="mt-1 inline-block size-3 rounded-full bg-emerald-500"></span>
                          {:else}
                            <span class="mt-1 inline-block size-3 rounded-full bg-red-500"></span>
                          {/if}
                          <div class="min-w-0">
                            <div class="font-medium text-zinc-900 dark:text-zinc-100">{check.name}</div>
                            {#if check.message}
                              <div class="text-xs text-zinc-500 dark:text-zinc-400">{check.message}</div>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>

                    {#if health.message && !healthChecks.length}
                      <p class="text-xs text-zinc-500 dark:text-zinc-400">{health.message}</p>
                    {/if}
                  </div>
                {:else}
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">Health status unavailable.</p>
                {/if}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>UI Contributions</CardTitle>
                <CardDescription>Page slots and launchers declared by this plugin</CardDescription>
              </CardHeader>
              <CardContent class="space-y-3 text-sm">
                {#if uiContributionsLoading}
                  <div class="text-sm text-zinc-500 dark:text-zinc-400">Loading UI contributions...</div>
                {:else if !pluginContribution}
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">This plugin does not declare any UI contributions.</p>
                {:else}
                  {#if pageSlots.length > 0}
                    <div class="space-y-2">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Page slots</div>
                      <div class="space-y-2">
                        {#each pageSlots as slot}
                          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                            <div class="flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                <p class="font-medium text-zinc-900 dark:text-zinc-100">{slot.displayName ?? "Plugin Page"}</p>
                                <p class="font-mono text-xs text-zinc-500">/{prefix}/{slot.routePath}</p>
                                <p class="mt-1 text-xs text-zinc-500">Export: {slot.exportName}</p>
                              </div>
                              <Badge variant="outline" class="shrink-0">page</Badge>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if settingsSlots.length > 0}
                    <div class="space-y-2">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Settings slots</div>
                      <div class="space-y-2">
                        {#each settingsSlots as slot}
                          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                            <div class="flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                <p class="font-medium text-zinc-900 dark:text-zinc-100">{slot.displayName ?? "Plugin Settings"}</p>
                                <p class="font-mono text-xs text-zinc-500">Export: {slot.exportName}</p>
                              </div>
                              <Badge variant="outline" class="shrink-0">settingsPage</Badge>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  {#if pluginContribution.launchers?.length}
                    <div class="space-y-2">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Launchers</div>
                      <div class="space-y-2">
                        {#each pluginContribution.launchers as launcher}
                          <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
                            <p class="font-medium text-zinc-900 dark:text-zinc-100">{launcher.displayName}</p>
                            <p class="mt-1 text-xs text-zinc-500">
                              Zone: {launcher.placementZone}{launcher.exportName ? ` · Export: ${launcher.exportName}` : ""}
                            </p>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/if}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Capabilities</CardTitle>
              <CardDescription>Declared host capabilities from the manifest</CardDescription>
            </CardHeader>
            <CardContent>
              {#if capabilities.length > 0}
                <div class="flex flex-wrap gap-2">
                  {#each capabilities as capability}
                    <Badge variant="secondary" class="font-mono text-[11px]">
                      {capability}
                    </Badge>
                  {/each}
                </div>
              {:else}
                <p class="text-sm text-zinc-500 dark:text-zinc-400">No capabilities declared.</p>
              {/if}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" class="space-y-4">
          {#if logsLoading}
            <div class="space-y-2">
              {#each Array(5) as _}
                <Skeleton class="h-8 rounded bg-zinc-100 dark:bg-zinc-800" />
              {/each}
            </div>
          {:else if logs.length === 0}
            <div class="rounded-xl border border-dashed px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              No logs available for this plugin.
            </div>
          {:else}
            <div class="flex justify-end">
              <Button variant="outline" size="sm" onclick={() => void loadLogs()}>
                Refresh Logs
              </Button>
            </div>
            <div class="max-h-[600px] divide-y divide-zinc-200 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {#each logs as entry, i (entry.id ?? i)}
                <div class="flex items-start gap-3 p-3 text-sm">
                  <span class={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${formatLevel(entry.level)}`}>
                    {entry.level}
                  </span>
                  {#if entry.timestamp || entry.createdAt}
                    <span class="shrink-0 whitespace-nowrap tabular-nums text-xs text-zinc-500 dark:text-zinc-400">
                      {formatTime(entry.timestamp ?? entry.createdAt ?? null)}
                    </span>
                  {/if}
                  <span class="break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">{entry.message}</span>
                </div>
              {/each}
            </div>
          {/if}
        </TabsContent>
      </Tabs>
    </div>
  {/if}
</div>
