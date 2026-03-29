<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { Settings, Play, Pause, AlertCircle } from "lucide-svelte";
  import { onMount } from "svelte";

  let pluginId = $derived($page.params.pluginId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let plugin = $state<any>(null);
  let jobs = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let toggling = $state(false);

  $effect(() => {
    if (!pluginId) return;
    loading = true;
    error = null;

    Promise.all([
      api.api.plugins({ id: pluginId }).get(),
      api.api.plugins({ id: pluginId }).jobs.get().catch(() => ({ data: [] })),
    ])
      .then(([pluginRes, jobsRes]) => {
        plugin = pluginRes.data;
        jobs = (jobsRes.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load plugin";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Plugins", href: `/${companyPrefix}/plugins` },
      { label: plugin?.name ?? "Plugin" },
    ]);
  });

  async function togglePlugin() {
    if (!plugin) return;
    toggling = true;

    try {
      const newStatus = plugin.status === "active" ? "disabled" : "active";
      await api.api.plugins({ id: pluginId }).put({ status: newStatus });
      plugin = { ...plugin, status: newStatus };
      toastStore.push({
        title: `Plugin ${newStatus === "active" ? "enabled" : "disabled"}`,
        tone: "success",
      });
    } catch {
      toastStore.push({ title: "Failed to update plugin", tone: "error" });
    } finally {
      toggling = false;
    }
  }
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-48 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-96 rounded bg-muted animate-pulse"></div>
    <div class="grid gap-4 md:grid-cols-2 mt-6">
      {#each Array(4) as _}
        <div class="h-24 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if plugin}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold text-foreground">{plugin.name}</h1>
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          {#if plugin.version}
            <span>v{plugin.version}</span>
          {/if}
          {#if plugin.author}
            <span>by {plugin.author}</span>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <a
          href="/{companyPrefix}/plugins/{pluginId}/settings"
          class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <Settings class="size-3.5" />
          Settings
        </a>
        <button
          onclick={togglePlugin}
          disabled={toggling}
          class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium shadow transition-colors disabled:opacity-50
            {plugin.status === 'active'
              ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'}"
        >
          {#if plugin.status === "active"}
            <Pause class="size-3.5" />
            {toggling ? "Disabling..." : "Disable"}
          {:else}
            <Play class="size-3.5" />
            {toggling ? "Enabling..." : "Enable"}
          {/if}
        </button>
      </div>
    </div>

    <!-- Status -->
    <div class="flex items-center gap-2">
      <span
        class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
          {plugin.status === 'active' ? 'bg-green-500/10 text-green-500' :
           plugin.status === 'error' ? 'bg-destructive/10 text-destructive' :
           'bg-muted text-muted-foreground'}"
      >
        {plugin.status ?? "installed"}
      </span>
    </div>

    <!-- Description -->
    {#if plugin.description}
      <div class="rounded-lg border border-border bg-card p-4">
        <p class="text-sm text-muted-foreground">{plugin.description}</p>
      </div>
    {/if}

    <!-- Properties grid -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</dt>
        <dd class="mt-1 text-sm text-foreground">{plugin.type ?? "worker"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Installed</dt>
        <dd class="mt-1 text-sm text-foreground">
          {plugin.installedAt ? new Date(plugin.installedAt).toLocaleDateString() : "—"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Capabilities</dt>
        <dd class="mt-1 text-sm text-foreground">
          {#if plugin.capabilities?.length}
            {plugin.capabilities.join(", ")}
          {:else}
            —
          {/if}
        </dd>
      </div>
    </div>

    <!-- Jobs -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium text-foreground">Recent Jobs</h2>
      {#if jobs.length === 0}
        <p class="text-sm text-muted-foreground">No jobs executed yet.</p>
      {:else}
        <div class="divide-y divide-border rounded-lg border border-border bg-card">
          {#each jobs.slice(0, 20) as job}
            <div class="flex items-center justify-between p-3">
              <div class="space-y-0.5">
                <p class="text-sm text-foreground">{job.type ?? job.id}</p>
                <p class="text-xs text-muted-foreground">
                  {job.createdAt ? new Date(job.createdAt).toLocaleString() : "—"}
                </p>
              </div>
              <span
                class="text-xs rounded-full px-2 py-0.5
                  {job.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                   job.status === 'running' ? 'bg-blue-500/10 text-blue-500' :
                   job.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                   'bg-muted text-muted-foreground'}"
              >
                {job.status ?? "queued"}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
