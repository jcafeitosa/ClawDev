<script lang="ts">
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
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Separator,
    Skeleton,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
  } from "$components/ui/index.js";
  import { PageLayout } from "$components/layout/index.js";
  import {
    ActivitySquare,
    AlertTriangle,
    ArrowLeft,
    CalendarClock,
    CheckCircle,
    Clock,
    Cpu,
    Loader2,
    Puzzle,
    Webhook,
    XCircle,
  } from "lucide-svelte";
  import { onMount } from "svelte";

  type JsonRecord = Record<string, any>;
  type TabKey = "configuration" | "status";

  interface PluginRecord {
    id: string;
    name?: string;
    pluginKey?: string;
    version?: string;
    author?: string;
    description?: string;
    enabled?: boolean;
    status?: string;
    categories?: string[];
    lastError?: string | null;
    manifestJson?: {
      id?: string;
      displayName?: string;
      description?: string;
      author?: string;
      version?: string;
      categories?: string[];
      capabilities?: string[];
      instanceConfigSchema?: JsonRecord;
    };
  }

  interface PluginConfigRow {
    configJson?: Record<string, unknown> | null;
    lastError?: string | null;
    updatedAt?: string;
  }

  interface PluginDashboard {
    pluginId: string;
    worker?: {
      status?: string;
      pid?: number | null;
      uptime?: number | null;
      consecutiveCrashes?: number | null;
      totalCrashes?: number | null;
      pendingRequests?: number | null;
      lastCrashAt?: string | null;
      nextRestartAt?: string | null;
    } | null;
    recentJobRuns: Array<{
      id: string;
      jobId?: string;
      jobKey?: string;
      trigger?: string;
      status?: string;
      durationMs?: number | null;
      error?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      createdAt?: string;
    }>;
    recentWebhookDeliveries: Array<{
      id: string;
      webhookKey?: string;
      status?: string;
      durationMs?: number | null;
      error?: string | null;
      startedAt?: string | null;
      finishedAt?: string | null;
      createdAt?: string;
    }>;
    health: {
      pluginId: string;
      status: string;
      healthy: boolean;
      checks: Array<{ name: string; passed: boolean; message?: string }>;
      lastError?: string;
    };
    checkedAt: string;
  }

  interface PluginHealth {
    pluginId: string;
    status: string;
    healthy: boolean;
    checks: Array<{ name: string; passed: boolean; message?: string }>;
    lastError?: string;
  }

  interface PluginLogEntry {
    id?: string;
    level: string;
    message: string;
    timestamp?: string;
    createdAt?: string;
  }

  let plugin = $state<PluginRecord | null>(null);
  let pluginLoading = $state(true);

  let configRow = $state<PluginConfigRow | null>(null);
  let configLoading = $state(true);
  let configSaving = $state(false);
  let configTesting = $state(false);
  let configTestResult = $state<string | null>(null);
  let configTestTone = $state<"success" | "warning" | "destructive" | null>(null);

  let dashboard = $state<PluginDashboard | null>(null);
  let dashboardLoading = $state(true);
  let dashboardError = $state("");

  let uiContributions = $state<PluginUiContribution[]>([]);
  let uiLoading = $state(true);

  let health = $state<PluginHealth | null>(null);
  let healthLoading = $state(true);
  let healthError = $state("");

  let logs = $state<PluginLogEntry[]>([]);
  let logsLoading = $state(true);
  let logsError = $state("");

  let showRawJson = $state(false);
  let rawJsonText = $state("");
  let rawJsonError = $state("");
  let activeTab = $state<TabKey>("configuration");

  const pluginId = $derived($page.params.pluginId);
  const companyPrefix = $derived($page.params.companyPrefix);
  const manifest = $derived((plugin?.manifestJson ?? null) as Record<string, any> | null);
  const schema = $derived((manifest?.instanceConfigSchema ?? null) as JsonRecord | null);
  const schemaProperties = $derived(
    Object.entries((schema?.properties ?? {}) as Record<string, JsonRecord>),
  );
  const schemaPropertyMap = $derived(new Map(schemaProperties));
  const schemaRequired = $derived(
    new Set(Array.isArray(schema?.required) ? (schema.required as string[]) : []),
  );
  const hasSchema = $derived(schemaProperties.length > 0);
  const displayName = $derived(manifest?.displayName ?? plugin?.name ?? "Plugin");
  const description = $derived(
    manifest?.description ?? plugin?.description ?? "No description provided.",
  );
  const author = $derived(manifest?.author ?? plugin?.author ?? "Unknown");
  const version = $derived(manifest?.version ?? plugin?.version ?? "0.0.0");
  const categories = $derived(
    ((manifest?.categories ?? plugin?.categories ?? []) as string[]) ?? [],
  );
  const capabilities = $derived((manifest?.capabilities ?? []) as string[]);
  const configError = $derived(configRow?.lastError ?? plugin?.lastError ?? null);
  const pluginContribution = $derived(uiContributions.find((entry) => entry.pluginId === pluginId) ?? null);
  const settingsSlots = $derived(pluginContribution?.slots?.filter((slot) => slot.type === "settingsPage") ?? []);
  const pageSlots = $derived(pluginContribution?.slots?.filter((slot) => slot.type === "page") ?? []);
  const launcherSlots = $derived(pluginContribution?.launchers ?? []);
  const pluginHostContext = $derived({
    companyId: resolveCompanyIdFromPrefix(companyPrefix) ?? companyStore.selectedCompanyId ?? null,
    companyPrefix: companyPrefix || null,
    projectId: null,
    entityId: pluginId ?? null,
    entityType: "plugin",
    parentEntityId: null,
    userId: null,
  });

  let config = $state<Record<string, unknown>>({});
  let diagnosticsTimer: ReturnType<typeof setInterval> | null = null;

  function toObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  function schemaDefaultValues(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const [key, property] of schemaProperties) {
      if (property && Object.prototype.hasOwnProperty.call(property, "default")) {
        defaults[key] = property.default;
      }
    }
    return defaults;
  }

  function normaliseConfigRow(row: PluginConfigRow | null): Record<string, unknown> {
    return {
      ...schemaDefaultValues(),
      ...toObject(row?.configJson ?? null),
    };
  }

  function formatTime(value?: string | null) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
  }

  function formatDuration(value?: number | null) {
    if (value == null) return "—";
    if (value < 1000) return `${value}ms`;
    const seconds = Math.floor(value / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  }

  function healthTone(healthy: boolean) {
    return healthy ? "success" : "destructive";
  }

  function loadBreadcrumbs() {
    breadcrumbStore.set([
      { label: "Plugins", href: `/${companyPrefix}/plugins` },
      { label: displayName || "Plugin", href: `/${companyPrefix}/plugins/${pluginId}` },
      { label: "Settings" },
    ]);
  }

  async function loadPlugin() {
    if (!pluginId) return;
    pluginLoading = true;
    try {
      const res = await api(`/api/plugins/${pluginId}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      plugin = (await res.json()) as PluginRecord;
      loadBreadcrumbs();
    } catch (error: any) {
      plugin = null;
      toastStore.push({
        title: "Failed to load plugin",
        body: error?.message ?? "Unable to load plugin details.",
        tone: "error",
      });
    } finally {
      pluginLoading = false;
    }
  }

  async function loadConfig() {
    if (!pluginId) return;
    configLoading = true;
    try {
      const res = await api(`/api/plugins/${pluginId}/config`);
      if (res.ok) {
        const row = (await res.json()) as PluginConfigRow | null;
        configRow = row;
        config = normaliseConfigRow(row);
        rawJsonText = JSON.stringify(config, null, 2);
        rawJsonError = "";
      } else if (res.status === 404) {
        configRow = null;
        config = schemaDefaultValues();
        rawJsonText = JSON.stringify(config, null, 2);
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (error: any) {
      configRow = null;
      config = schemaDefaultValues();
      rawJsonText = JSON.stringify(config, null, 2);
      toastStore.push({
        title: "Failed to load plugin config",
        body: error?.message ?? "Unable to load config.",
        tone: "error",
      });
    } finally {
      configLoading = false;
    }
  }

  async function loadDashboard() {
    if (!pluginId) return;
    dashboardLoading = true;
    dashboardError = "";
    try {
      const res = await api(`/api/plugins/${pluginId}/dashboard`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      dashboard = (await res.json()) as PluginDashboard;
    } catch (error: any) {
      dashboard = null;
      dashboardError = error?.message ?? "Unable to load runtime dashboard.";
    } finally {
      dashboardLoading = false;
    }
  }

  async function loadHealth() {
    if (!pluginId) return;
    healthLoading = true;
    healthError = "";
    try {
      const res = await api(`/api/plugins/${pluginId}/health`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      health = (await res.json()) as PluginHealth;
    } catch (error: any) {
      health = null;
      healthError = error?.message ?? "Unable to load health diagnostics.";
    } finally {
      healthLoading = false;
    }
  }

  async function loadLogs() {
    if (!pluginId) return;
    logsLoading = true;
    logsError = "";
    try {
      const res = await api(`/api/plugins/${pluginId}/logs?limit=50`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = await res.json();
      logs = Array.isArray(payload) ? payload : payload.logs ?? payload.items ?? [];
    } catch (error: any) {
      logs = [];
      logsError = error?.message ?? "Unable to load plugin logs.";
    } finally {
      logsLoading = false;
    }
  }

  async function refreshStatus() {
    await Promise.allSettled([loadDashboard(), loadHealth(), loadLogs()]);
  }

  function updateField(key: string, value: unknown) {
    config = { ...config, [key]: value };
    configTestResult = null;
    configTestTone = null;
  }

  function syncRawJson() {
    rawJsonText = JSON.stringify(config, null, 2);
    rawJsonError = "";
  }

  function applyRawJson() {
    try {
      const parsed = JSON.parse(rawJsonText);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        rawJsonError = "Root must be a JSON object";
        return false;
      }
      config = parsed;
      rawJsonError = "";
      return true;
    } catch (error: any) {
      rawJsonError = `Invalid JSON: ${error.message}`;
      return false;
    }
  }

  function getFieldValue(key: string, schemaNode?: JsonRecord | null) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      return config[key];
    }
    if (schemaNode && Object.prototype.hasOwnProperty.call(schemaNode, "default")) {
      return schemaNode.default;
    }
    if (schemaNode?.type === "boolean") return false;
    if (schemaNode?.type === "number" || schemaNode?.type === "integer") return 0;
    if (schemaNode?.type === "array") return [];
    if (schemaNode?.type === "object") return {};
    return "";
  }

  function inferFieldKind(schemaNode: JsonRecord | undefined, value: unknown): "boolean" | "number" | "json" | "enum" | "string" {
    if (schemaNode && Array.isArray(schemaNode.enum)) return "enum";
    const schemaType = schemaNode?.type as string | undefined;
    if (schemaType === "boolean" || typeof value === "boolean") return "boolean";
    if (schemaType === "number" || schemaType === "integer" || typeof value === "number") return "number";
    if (schemaType === "array" || schemaType === "object") return "json";
    if (typeof value === "object" && value !== null) return "json";
    return "string";
  }

  function formatEnumValue(option: unknown) {
    if (typeof option === "string") return option;
    if (typeof option === "number" || typeof option === "boolean") return String(option);
    return JSON.stringify(option);
  }

  function parseEnumValue(raw: string, schemaNode?: JsonRecord | null) {
    const options = Array.isArray(schemaNode?.enum) ? (schemaNode?.enum as unknown[]) : [];
    for (const option of options) {
      if (formatEnumValue(option) === raw) {
        return option;
      }
    }
    return raw;
  }

  async function saveConfig() {
    if (showRawJson && !applyRawJson()) return;
    if (!pluginId) return;

    configSaving = true;
    try {
      const res = await api(`/api/plugins/${pluginId}/config`, {
        method: "POST",
        body: JSON.stringify({ configJson: config }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? `Save failed (${res.status})`);
      }
      const savedRow = (payload && typeof payload === "object" ? payload : null) as PluginConfigRow | null;
      configRow = savedRow;
      config = normaliseConfigRow(savedRow);
      rawJsonText = JSON.stringify(config, null, 2);
      toastStore.push({ title: "Settings saved", tone: "success" });
    } catch (error: any) {
      toastStore.push({
        title: "Failed to save settings",
        body: error?.message ?? "Unable to save plugin config.",
        tone: "error",
      });
    } finally {
      configSaving = false;
    }
  }

  async function testConfig() {
    if (showRawJson && !applyRawJson()) return;
    if (!pluginId) return;

    configTesting = true;
    configTestResult = null;
    configTestTone = null;
    try {
      const res = await api(`/api/plugins/${pluginId}/config/test`, {
        method: "POST",
        body: JSON.stringify({ configJson: config }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? payload?.message ?? `Test failed (${res.status})`);
      }
      if (payload?.valid === false) {
        configTestTone = payload?.supported === false ? "warning" : "destructive";
        configTestResult = payload?.message ?? "Configuration test failed.";
        return;
      }
      configTestTone = payload?.warnings?.length ? "warning" : "success";
      configTestResult = payload?.message ?? "Configuration looks good.";
    } catch (error: any) {
      configTestTone = "destructive";
      configTestResult = error?.message ?? "Unable to test settings.";
    } finally {
      configTesting = false;
    }
  }

  onMount(() => {
    loadBreadcrumbs();
  });

  $effect(() => {
    if (!pluginId) return;
    void loadPlugin();
  });

  $effect(() => {
    if (!pluginId || !plugin) return;
    void loadConfig();
  });

  $effect(() => {
    if (!pluginId || !plugin) return;
    void refreshStatus();

    if (diagnosticsTimer) {
      clearInterval(diagnosticsTimer);
    }
    diagnosticsTimer = setInterval(() => {
      void refreshStatus();
    }, 30_000);

    return () => {
      if (diagnosticsTimer) {
        clearInterval(diagnosticsTimer);
        diagnosticsTimer = null;
      }
    };
  });

  $effect(() => {
    if (!pluginId || !plugin) return;
    uiLoading = true;
    void pluginUiContributionsStore
      .load()
      .then(() => {
        uiContributions = pluginUiContributionsStore.contributions;
      })
      .finally(() => {
        uiLoading = false;
      });
  });
</script>

<PageLayout title={displayName} description={`Configure ${displayName} plugin behavior.`} fullWidth>
<div class="space-y-6 max-w-6xl">
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0 space-y-3">
      <div class="flex items-center gap-3">
        <a
          href={`/${companyPrefix}/plugins`}
          class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          <ArrowLeft class="h-4 w-4" />
        </a>
        <div class="flex min-w-0 items-center gap-2">
          <Puzzle class="h-6 w-6 text-zinc-500" />
          <h1 class="truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {displayName}
          </h1>
          {#if plugin?.enabled !== undefined}
            <StatusBadge status={plugin.enabled ? "enabled" : "disabled"} />
          {/if}
          {#if plugin?.status}
            <Badge variant={plugin.status === "ready" ? "default" : plugin.status === "error" ? "destructive" : "secondary"}>
              {plugin.status}
            </Badge>
          {/if}
          <Badge variant="outline">v{version}</Badge>
        </div>
      </div>

      <p class="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {description}
      </p>

      <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span>Author: {author}</span>
        <span>•</span>
        <span>Plugin ID: <span class="font-mono">{plugin?.id ?? pluginId}</span></span>
        {#if configRow?.updatedAt}
          <span>•</span>
          <span>Config updated {formatTime(configRow.updatedAt)}</span>
        {/if}
        {#if configError}
          <span class="text-amber-600 dark:text-amber-400">• Config error: {configError}</span>
        {/if}
      </div>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <Button variant="outline" size="sm" onclick={() => void refreshStatus()} disabled={dashboardLoading || healthLoading || logsLoading}>
        {#if dashboardLoading || healthLoading || logsLoading}
          <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
        {/if}
        Refresh
      </Button>
    </div>
  </div>

  {#if pluginLoading}
    <PageSkeleton />
  {:else if !plugin}
    <div class="rounded-xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      Plugin not found.
    </div>
  {:else}
    <Tabs value={activeTab} onValueChange={(value) => (activeTab = value as TabKey)} class="space-y-6">
      <TabsList class="w-full justify-start">
        <TabsTrigger value="configuration" onclick={() => (activeTab = "configuration")}>
          Configuration
        </TabsTrigger>
        <TabsTrigger value="status" onclick={() => (activeTab = "status")}>
          Status
        </TabsTrigger>
      </TabsList>

      <TabsContent value="configuration" class="space-y-6">
        {#if settingsSlots.length > 0}
          <Card>
            <CardHeader>
              <CardTitle>Plugin Settings UI</CardTitle>
              <CardDescription>Mounted settings slot declared by the plugin bundle</CardDescription>
            </CardHeader>
            <CardContent class="space-y-3">
              <PluginSlotOutlet
                pluginId={pluginId}
                slotTypes={["settings"]}
                context={pluginHostContext}
                routePath={settingsSlots[0]?.routePath ?? null}
                class="space-y-3"
                itemClassName="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
              />
            </CardContent>
          </Card>
        {/if}

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div class="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
                <CardDescription>Manifest metadata and operator-facing capabilities</CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                <div class="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]">
                  <div class="space-y-3">
                    <h3 class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Description</h3>
                    <p class="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{description}</p>
                  </div>
                  <div class="grid gap-4 text-sm">
                    <div>
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Author</div>
                      <div class="mt-1 text-zinc-900 dark:text-zinc-100">{author}</div>
                    </div>
                    <div>
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Categories</div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        {#if categories.length > 0}
                          {#each categories as category}
                            <Badge variant="outline" class="capitalize">{category}</Badge>
                          {/each}
                        {:else}
                          <span class="text-zinc-500 dark:text-zinc-400">None</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Card class="border-zinc-200/80 dark:border-zinc-800">
                    <CardHeader class="pb-3">
                      <CardDescription>Capabilities</CardDescription>
                      <CardTitle class="text-lg">{capabilities.length}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card class="border-zinc-200/80 dark:border-zinc-800">
                    <CardHeader class="pb-3">
                      <CardDescription>Status</CardDescription>
                      <CardTitle class="text-lg capitalize">{plugin.status}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card class="border-zinc-200/80 dark:border-zinc-800">
                    <CardHeader class="pb-3">
                      <CardDescription>Version</CardDescription>
                      <CardTitle class="text-lg">v{version}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {#if capabilities.length > 0}
                  <div class="space-y-3">
                    <h3 class="text-sm font-medium text-zinc-500 dark:text-zinc-400">Capabilities</h3>
                    <div class="flex flex-wrap gap-2">
                      {#each capabilities as capability}
                        <Badge variant="secondary" class="font-mono text-[11px]">
                          {capability}
                        </Badge>
                      {/each}
                    </div>
                  </div>
                {/if}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Edit the plugin's operator config. Saved values are validated against the manifest schema when present.
                </CardDescription>
              </CardHeader>
              <CardContent class="space-y-5">
                {#if configLoading}
                  <div class="space-y-3">
                    <Skeleton class="h-10 w-full rounded-md" />
                    <Skeleton class="h-10 w-full rounded-md" />
                    <Skeleton class="h-10 w-full rounded-md" />
                  </div>
                {:else if showRawJson}
                  <div class="space-y-3">
                    <Textarea
                      bind:value={rawJsonText}
                      rows={18}
                      spellcheck="false"
                      class="font-mono text-xs"
                    />
                    {#if rawJsonError}
                      <p class="text-xs text-red-500">{rawJsonError}</p>
                    {/if}
                  </div>
                {:else if hasSchema}
                  <div class="space-y-4">
                    {#each schemaProperties as [key, property]}
                      {@const value = getFieldValue(key, property)}
                      {@const fieldKind = inferFieldKind(property, value)}
                      {@const isRequired = schemaRequired.has(key)}

                      <div class="space-y-2 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                        <div class="flex items-center justify-between gap-3">
                          <label for={`field-${key}`} class="block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {property.title ?? key}
                            {#if isRequired}
                              <span class="ml-1 text-red-500">*</span>
                            {/if}
                          </label>
                          {#if property.description}
                            <span class="text-[11px] text-zinc-400 dark:text-zinc-500">{property.description}</span>
                          {/if}
                        </div>

                        {#if fieldKind === "boolean"}
                          <button
                            id={`field-${key}`}
                            role="switch"
                            aria-checked={Boolean(value)}
                            aria-label={`Toggle ${key}`}
                            onclick={() => updateField(key, !Boolean(value))}
                            class={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                              value ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-600"
                            }`}
                          >
                            <span
                              class={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                                value ? "translate-x-5" : "translate-x-0"
                              }`}
                            ></span>
                          </button>
                          <span class="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                            {value ? "Enabled" : "Disabled"}
                          </span>
                        {:else if fieldKind === "number"}
                          <Input
                            id={`field-${key}`}
                            type="number"
                            value={String(value ?? "")}
                            oninput={(event) => {
                              const nextValue = (event.currentTarget as HTMLInputElement).value;
                              if (nextValue === "") {
                                updateField(key, "");
                                return;
                              }
                              const parsed = property.type === "integer" ? parseInt(nextValue, 10) : parseFloat(nextValue);
                              if (!Number.isNaN(parsed)) updateField(key, parsed);
                            }}
                          />
                        {:else if fieldKind === "enum"}
                          <select
                            id={`field-${key}`}
                            value={formatEnumValue(value)}
                            oninput={(event) => updateField(key, parseEnumValue((event.currentTarget as HTMLSelectElement).value, property))}
                            class="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            {#each (property.enum as unknown[] ?? []) as option}
                              <option value={formatEnumValue(option)}>{formatEnumValue(option)}</option>
                            {/each}
                          </select>
                        {:else if fieldKind === "json"}
                          <Textarea
                            id={`field-${key}`}
                            rows={5}
                            spellcheck="false"
                            value={JSON.stringify(value ?? {}, null, 2)}
                            oninput={(event) => {
                              try {
                                const parsed = JSON.parse((event.currentTarget as HTMLTextAreaElement).value);
                                updateField(key, parsed);
                              } catch {
                                // Keep the previous parsed value until the JSON becomes valid.
                              }
                            }}
                            class="font-mono text-xs"
                          />
                        {:else}
                          <Input
                            id={`field-${key}`}
                            type="text"
                            value={value?.toString?.() ?? ""}
                            oninput={(event) => updateField(key, (event.currentTarget as HTMLInputElement).value)}
                          />
                        {/if}
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-950">
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">
                      This plugin does not declare an instance configuration schema.
                    </p>
                    <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      Use Raw JSON to edit the stored configuration directly.
                    </p>
                  </div>
                {/if}

                {#if configError}
                  <div class="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
                    {configError}
                  </div>
                {/if}
              </CardContent>
            </Card>
          </div>

          <div class="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
                <CardDescription>Save or validate the current config</CardDescription>
              </CardHeader>
              <CardContent class="space-y-3">
                <div class="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => {
                      if (showRawJson) {
                        if (!applyRawJson()) {
                          return;
                        }
                      } else {
                        syncRawJson();
                      }
                      showRawJson = !showRawJson;
                    }}
                  >
                    {showRawJson ? "Form View" : "Raw JSON"}
                  </Button>

                  <Button variant="outline" size="sm" onclick={() => void testConfig()} disabled={configTesting || configLoading}>
                    {#if configTesting}
                      <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                    {/if}
                    Test
                  </Button>

                  <Button size="sm" onclick={() => void saveConfig()} disabled={configSaving || configLoading}>
                    {#if configSaving}
                      <Loader2 class="mr-1.5 h-4 w-4 animate-spin" />
                    {/if}
                    Save Settings
                  </Button>
                </div>

                {#if configTestResult}
                  <div class={`rounded-xl border px-3 py-2 text-sm ${
                    configTestTone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                      : configTestTone === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                        : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
                  }`}>
                    {configTestResult}
                  </div>
                {/if}

                {#if showRawJson}
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Editing raw JSON lets you patch nested structures directly. Validation still happens on save.
                  </p>
                {:else if hasSchema}
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Form mode is generated from the manifest schema when available.
                  </p>
                {:else}
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">
                    Raw JSON is the only editing mode for plugins without a configuration schema.
                  </p>
                {/if}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>UI Contributions</CardTitle>
                <CardDescription>Slots and launchers declared by installed plugin bundles</CardDescription>
              </CardHeader>
              <CardContent class="space-y-4">
                {#if uiLoading}
                  <div class="space-y-2">
                    <Skeleton class="h-10 w-full rounded-md" />
                    <Skeleton class="h-10 w-full rounded-md" />
                  </div>
                {:else if pluginContribution}
                  <div class="space-y-3 text-sm">
                    <div class="flex flex-wrap gap-2">
                      <Badge variant="outline">{pluginContribution.displayName ?? pluginContribution.pluginKey ?? pluginContribution.pluginId}</Badge>
                      <Badge variant="secondary">v{pluginContribution.version ?? version}</Badge>
                      <Badge variant="outline">{pluginContribution.uiEntryFile ?? "ui entry"}</Badge>
                    </div>

                    <div class="space-y-2">
                      <h3 class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Settings slots</h3>
                      {#if settingsSlots.length > 0}
                        <div class="space-y-2">
                          {#each settingsSlots as slot}
                            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                              <p class="font-medium text-zinc-900 dark:text-zinc-100">{slot.displayName ?? slot.id}</p>
                              {#if slot.exportName}
                                <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Export: {slot.exportName}</p>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="text-zinc-500 dark:text-zinc-400">No settings slots declared.</p>
                      {/if}
                    </div>

                    <div class="space-y-2">
                      <h3 class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Page slots</h3>
                      {#if pageSlots.length > 0}
                        <div class="space-y-2">
                          {#each pageSlots as slot}
                            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                              <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                  <p class="font-medium text-zinc-900 dark:text-zinc-100">{slot.displayName ?? slot.id}</p>
                                  {#if slot.exportName}
                                    <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Export: {slot.exportName}</p>
                                  {/if}
                                </div>
                                {#if slot.routePath}
                                  <Badge variant="outline" class="font-mono text-[10px]">/{slot.routePath}</Badge>
                                {/if}
                              </div>
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="text-zinc-500 dark:text-zinc-400">No page slots declared.</p>
                      {/if}
                    </div>

                    {#if launcherSlots.length > 0}
                      <div class="space-y-2">
                        <h3 class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Launchers</h3>
                        <div class="space-y-2">
                          {#each launcherSlots as launcher}
                            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                              <p class="font-medium text-zinc-900 dark:text-zinc-100">{launcher.displayName ?? launcher.id}</p>
                              {#if launcher.exportName}
                                <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Export: {launcher.exportName}</p>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}

                    {#if pageSlots.length > 0}
                      <div class="flex justify-end">
                        <a
                          href={`/${companyPrefix}/plugins/${pluginId}/page`}
                          class="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                        >
                          Open plugin page
                        </a>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">This plugin does not declare UI contributions.</p>
                {/if}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manifest Summary</CardTitle>
                <CardDescription>What the plugin declares to the host</CardDescription>
              </CardHeader>
              <CardContent class="space-y-4 text-sm">
                <div class="space-y-1">
                  <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Plugin ID</div>
                  <div class="font-mono text-xs break-all text-zinc-900 dark:text-zinc-100">{plugin?.pluginKey ?? plugin?.id}</div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Minimum Host Version</div>
                  <div class="text-zinc-900 dark:text-zinc-100">
                    {manifest?.minimumHostVersion ?? manifest?.minimumClawDevVersion ?? "Not declared"}
                  </div>
                </div>
                <div class="space-y-1">
                  <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Capabilities</div>
                  <div class="flex flex-wrap gap-2 pt-1">
                    {#if capabilities.length > 0}
                      {#each capabilities as capability}
                        <Badge variant="secondary" class="font-mono text-[11px]">{capability}</Badge>
                      {/each}
                    {:else}
                      <span class="text-zinc-500 dark:text-zinc-400">None declared</span>
                    {/if}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="status" class="space-y-6">
        <div class="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div class="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle class="flex items-center gap-2">
                  <ActivitySquare class="h-4 w-4" />
                  Runtime Dashboard
                </CardTitle>
                <CardDescription>Worker process, recent jobs, and webhook deliveries</CardDescription>
              </CardHeader>
              <CardContent class="space-y-6">
                {#if dashboardLoading}
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {#each Array(4) as _}
                      <Skeleton class="h-24 rounded-xl" />
                    {/each}
                  </div>
                {:else if dashboard}
                  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Worker</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {dashboard.worker?.status ?? "Unknown"}
                      </div>
                      <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        PID {dashboard.worker?.pid ?? "—"} · {formatDuration(dashboard.worker?.uptime ?? null)}
                      </div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Recent Jobs</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {dashboard.recentJobRuns.length}
                      </div>
                      <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Last 10 runs</div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Webhook Deliveries</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {dashboard.recentWebhookDeliveries.length}
                      </div>
                      <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Last 10 deliveries</div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Checked</div>
                      <div class="mt-1 flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                        <CalendarClock class="h-3.5 w-3.5 text-zinc-400" />
                        {formatTime(dashboard.checkedAt)}
                      </div>
                      <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Live snapshot
                      </div>
                    </div>
                  </div>

                  <div class="grid gap-6 lg:grid-cols-2">
                    <div class="space-y-3">
                      <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Job Runs</h3>
                      {#if dashboard.recentJobRuns.length > 0}
                        <div class="space-y-2">
                          {#each dashboard.recentJobRuns as run}
                            <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                              <div class="flex items-center justify-between gap-3">
                                <div class="min-w-0">
                                  <div class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {run.jobKey ?? run.jobId ?? run.id}
                                  </div>
                                  <div class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                    {run.trigger ?? "manual"} · {formatTime(run.startedAt ?? run.createdAt ?? null)}
                                  </div>
                                </div>
                                <Badge variant={run.status === "success" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
                                  {run.status ?? "unknown"}
                                </Badge>
                              </div>
                              <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                Duration {formatDuration(run.durationMs ?? null)}
                              </div>
                              {#if run.error}
                                <p class="mt-2 text-xs text-red-600 dark:text-red-300">{run.error}</p>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="text-sm text-zinc-500 dark:text-zinc-400">No recent job runs.</p>
                      {/if}
                    </div>

                    <div class="space-y-3">
                      <h3 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        <Webhook class="h-4 w-4 text-zinc-500" />
                        Recent Webhook Deliveries
                      </h3>
                      {#if dashboard.recentWebhookDeliveries.length > 0}
                        <div class="space-y-2">
                          {#each dashboard.recentWebhookDeliveries as delivery}
                            <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                              <div class="flex items-center justify-between gap-3">
                                <div class="min-w-0">
                                  <div class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                    {delivery.webhookKey ?? delivery.id}
                                  </div>
                                  <div class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                    {formatTime(delivery.startedAt ?? delivery.createdAt ?? null)}
                                  </div>
                                </div>
                                <Badge variant={delivery.status === "success" ? "default" : delivery.status === "failed" ? "destructive" : "secondary"}>
                                  {delivery.status ?? "unknown"}
                                </Badge>
                              </div>
                              <div class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                                Duration {formatDuration(delivery.durationMs ?? null)}
                              </div>
                              {#if delivery.error}
                                <p class="mt-2 text-xs text-red-600 dark:text-red-300">{delivery.error}</p>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {:else}
                        <p class="text-sm text-zinc-500 dark:text-zinc-400">No webhook deliveries recorded yet.</p>
                      {/if}
                    </div>
                  </div>
                {:else}
                  <div class="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                    {dashboardError || "Runtime dashboard unavailable."}
                  </div>
                {/if}
              </CardContent>
            </Card>
          </div>

          <div class="space-y-6">
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
                  <Skeleton class="h-24 rounded-xl" />
                {:else if health}
                  <div class="space-y-3">
                    <div class="flex items-center gap-2">
                      <Badge variant={health.healthy ? "default" : "destructive"}>
                        {health.healthy ? "Healthy" : "Unhealthy"}
                      </Badge>
                      <span class="text-xs text-zinc-500 dark:text-zinc-400">
                        Status: {health.status}
                      </span>
                    </div>

                    <div class="space-y-2">
                      {#each health.checks as check}
                        <div class="flex items-start gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                          {#if check.passed}
                            <CheckCircle class="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          {:else}
                            <XCircle class="mt-0.5 h-4 w-4 text-red-600 dark:text-red-400" />
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

                    {#if health.lastError}
                      <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                        {health.lastError}
                      </div>
                    {/if}
                  </div>
                {:else}
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">
                    {healthError || "Health check unavailable."}
                  </p>
                {/if}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle class="flex items-center gap-2">
                  <Clock class="h-4 w-4" />
                  Runtime Snapshot
                </CardTitle>
                <CardDescription>Worker diagnostics from the latest dashboard poll</CardDescription>
              </CardHeader>
              <CardContent class="space-y-3 text-sm">
                {#if dashboardLoading}
                  <Skeleton class="h-24 rounded-xl" />
                {:else if dashboard?.worker}
                  <div class="grid gap-3">
                    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Worker Status</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{dashboard.worker.status ?? "unknown"}</div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pending Requests</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {dashboard.worker.pendingRequests ?? "—"}
                      </div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Crash Count</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {dashboard.worker.totalCrashes ?? 0} total · {dashboard.worker.consecutiveCrashes ?? 0} consecutive
                      </div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Last Crash</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {formatTime(dashboard.worker.lastCrashAt ?? null)}
                      </div>
                    </div>
                    <div class="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                      <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Next Restart</div>
                      <div class="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                        {formatTime(dashboard.worker.nextRestartAt ?? null)}
                      </div>
                    </div>
                  </div>
                {:else}
                  <p class="text-sm text-zinc-500 dark:text-zinc-400">
                    Worker diagnostics are unavailable for this plugin.
                  </p>
                {/if}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <ActivitySquare class="h-4 w-4" />
              Recent Logs
            </CardTitle>
            <CardDescription>Most recent log entries emitted by the plugin worker</CardDescription>
          </CardHeader>
          <CardContent>
            {#if logsLoading}
              <div class="space-y-2">
                {#each Array(5) as _}
                  <Skeleton class="h-12 rounded-lg" />
                {/each}
              </div>
            {:else if logs.length > 0}
              <div class="space-y-2">
                {#each logs as entry}
                  <div class="flex items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                    <Badge variant="outline" class="shrink-0 font-mono text-[11px] uppercase">
                      {entry.level}
                    </Badge>
                    <div class="min-w-0 flex-1">
                      <p class="break-all font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {entry.message}
                      </p>
                      <div class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatTime(entry.timestamp ?? entry.createdAt ?? null)}
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {logsError || "No logs available for this plugin."}
              </div>
            {/if}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  {/if}
</div>
</PageLayout>
