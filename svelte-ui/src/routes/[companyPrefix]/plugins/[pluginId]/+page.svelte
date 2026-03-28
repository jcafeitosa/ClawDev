<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { api } from "$lib/api";
  import { onMount } from "svelte";
  import StatusBadge from "$lib/components/status-badge.svelte";
  import PageSkeleton from "$lib/components/page-skeleton.svelte";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
  import { Trash2, X, Circle } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Plugin {
    id: string;
    name: string;
    version?: string;
    author?: string;
    description?: string;
    enabled: boolean;
    [key: string]: unknown;
  }

  interface HealthStatus {
    healthy: boolean;
    message?: string;
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

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let plugin = $state<Plugin | null>(null);
  let loading = $state(true);
  let pluginId = $derived($page.params.pluginId);
  let prefix = $derived($page.params.companyPrefix);
  let activeTab = $state("details");

  // Health state
  let health = $state<HealthStatus | null>(null);
  let healthLoading = $state(false);

  // Logs state
  let logs = $state<LogEntry[]>([]);
  let logsLoading = $state(false);

  // Delete state
  let confirmDelete = $state(false);
  let deleting = $state(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  onMount(() => {
    breadcrumbStore.set([
      { label: "Plugins", href: `/${prefix}/plugins` },
      { label: "Detail" },
    ]);
  });

  $effect(() => {
    if (!pluginId) return;
    loading = true;
    api(`/api/plugins/${pluginId}`)
      .then((r) => r.json())
      .then((d: Plugin) => {
        plugin = d;
        breadcrumbStore.set([
          { label: "Plugins", href: `/${prefix}/plugins` },
          { label: d.name ?? pluginId },
        ]);
      })
      .catch((err: any) => {
        toastStore.push({ title: "Failed to load plugin", body: err?.message, tone: "error" });
      })
      .finally(() => {
        loading = false;
      });
  });

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
      const res = await api(`/api/plugins/${pluginId}/logs`);
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

  // Load health on mount
  $effect(() => {
    if (pluginId && !loading) {
      loadHealth();
    }
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function toggleEnabled() {
    if (!plugin) return;
    try {
      const res = await api(`/api/plugins/${pluginId}/${plugin.enabled ? "disable" : "enable"}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      plugin = { ...plugin, enabled: !plugin.enabled };
      toastStore.push({ title: `Plugin ${plugin.enabled ? "enabled" : "disabled"}`, tone: "success" });
    } catch (err: any) {
      toastStore.push({ title: "Failed to toggle plugin", body: err?.message, tone: "error" });
    }
  }

  async function uninstallPlugin() {
    deleting = true;
    try {
      const res = await api(`/api/plugins/${pluginId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Plugin uninstalled", tone: "success" });
      goto(`/${prefix}/plugins`);
    } catch (err: any) {
      toastStore.push({ title: "Failed to uninstall plugin", body: err?.message, tone: "error" });
    } finally {
      deleting = false;
      confirmDelete = false;
    }
  }

  // Load logs when switching to logs tab
  function onTabChange(tab: string) {
    activeTab = tab;
    if (tab === "logs" && logs.length === 0) {
      loadLogs();
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const LOG_LEVEL_COLORS: Record<string, string> = {
    debug: "bg-zinc-600 text-zinc-100",
    info: "bg-blue-600 text-blue-100",
    warn: "bg-yellow-600 text-yellow-100",
    warning: "bg-yellow-600 text-yellow-100",
    error: "bg-red-600 text-red-100",
  };

  function logLevelClass(level: string): string {
    return LOG_LEVEL_COLORS[level.toLowerCase()] ?? "bg-zinc-600 text-zinc-100";
  }
</script>

<div class="p-6 space-y-6">
  {#if loading}
    <PageSkeleton />
  {:else if !plugin}
    <p class="text-red-500">Plugin not found.</p>
  {:else}
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{plugin.name}</h1>
          <StatusBadge status={plugin.enabled ? "enabled" : "disabled"} />
          <!-- Health indicator -->
          {#if healthLoading}
            <Circle class="size-3 text-zinc-400 animate-pulse" />
          {:else if health}
            <span
              class="inline-flex items-center gap-1 text-xs"
              title={health.message ?? (health.healthy ? "Healthy" : "Unhealthy")}
            >
              <span class="inline-block size-2.5 rounded-full {health.healthy ? 'bg-green-500' : 'bg-red-500'}"></span>
              <span class="text-zinc-500 dark:text-zinc-400">{health.healthy ? "Healthy" : "Unhealthy"}</span>
            </span>
          {/if}
        </div>
        <p class="text-sm text-zinc-500">{plugin.version ?? "0.0.0"} &middot; {plugin.author ?? "Unknown"}</p>
        {#if plugin.description}
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{plugin.description}</p>
        {/if}
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <a
          href="/{prefix}/plugins/{pluginId}/settings"
          class="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Settings
        </a>
        <button
          onclick={toggleEnabled}
          class="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors {plugin.enabled ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}"
        >
          {plugin.enabled ? "Disable" : "Enable"}
        </button>
        {#if confirmDelete}
          <div class="flex items-center gap-1.5">
            <Button variant="destructive" size="sm" onclick={uninstallPlugin} disabled={deleting}>
              {deleting ? "Removing..." : "Confirm Uninstall"}
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

    <!-- Tabs: Details + Logs -->
    <Tabs value={activeTab}>
      <TabsList>
        <TabsTrigger value="details" onclick={() => onTabChange("details")}>Details</TabsTrigger>
        <TabsTrigger value="logs" onclick={() => onTabChange("logs")}>Logs</TabsTrigger>
      </TabsList>

      <TabsContent value="details">
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <dt class="text-zinc-500 dark:text-zinc-400">Name</dt>
                  <dd class="font-medium text-zinc-900 dark:text-zinc-100">{plugin.name}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500 dark:text-zinc-400">Version</dt>
                  <dd class="font-mono">{plugin.version ?? "0.0.0"}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500 dark:text-zinc-400">Author</dt>
                  <dd>{plugin.author ?? "Unknown"}</dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500 dark:text-zinc-400">Status</dt>
                  <dd><StatusBadge status={plugin.enabled ? "enabled" : "disabled"} /></dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-500 dark:text-zinc-400">ID</dt>
                  <dd class="font-mono text-xs break-all">{plugin.id}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Health</CardTitle>
            </CardHeader>
            <CardContent>
              {#if healthLoading}
                <div class="flex items-center gap-2 text-sm text-zinc-500">
                  <div class="size-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                  Checking health...
                </div>
              {:else if health}
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="inline-block size-3 rounded-full {health.healthy ? 'bg-green-500' : 'bg-red-500'}"></span>
                    <span class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {health.healthy ? "Healthy" : "Unhealthy"}
                    </span>
                  </div>
                  {#if health.message}
                    <p class="text-xs text-zinc-500 dark:text-zinc-400">{health.message}</p>
                  {/if}
                  <Button variant="outline" size="sm" onclick={loadHealth}>
                    Refresh
                  </Button>
                </div>
              {:else}
                <p class="text-sm text-zinc-500">Health status unavailable.</p>
              {/if}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="logs">
        <div class="mt-4">
          {#if logsLoading}
            <div class="space-y-2">
              {#each Array(5) as _}
                <div class="h-8 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>
              {/each}
            </div>
          {:else if logs.length === 0}
            <div class="text-center py-12">
              <p class="text-sm text-zinc-500 dark:text-zinc-400">No logs available for this plugin.</p>
              <Button variant="outline" size="sm" class="mt-3" onclick={loadLogs}>
                Refresh Logs
              </Button>
            </div>
          {:else}
            <div class="flex justify-end mb-3">
              <Button variant="outline" size="sm" onclick={loadLogs}>
                Refresh Logs
              </Button>
            </div>
            <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800 max-h-[600px] overflow-y-auto">
              {#each logs as entry, i (entry.id ?? i)}
                <div class="flex items-start gap-3 p-3 text-sm">
                  <!-- Level badge -->
                  <span class="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase {logLevelClass(entry.level)}">
                    {entry.level}
                  </span>
                  <!-- Timestamp -->
                  {#if entry.timestamp || entry.createdAt}
                    <span class="text-xs text-zinc-500 dark:text-zinc-400 shrink-0 tabular-nums whitespace-nowrap">
                      {new Date(entry.timestamp ?? entry.createdAt ?? "").toLocaleString()}
                    </span>
                  {/if}
                  <!-- Message -->
                  <span class="text-zinc-700 dark:text-zinc-300 break-all font-mono text-xs leading-relaxed">{entry.message}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </TabsContent>
    </Tabs>
  {/if}
</div>
