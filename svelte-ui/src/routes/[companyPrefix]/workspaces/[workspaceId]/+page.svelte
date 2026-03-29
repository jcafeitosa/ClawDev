<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { Monitor, GitBranch, AlertCircle, RefreshCw } from "lucide-svelte";
  import { onMount } from "svelte";

  let workspaceId = $derived($page.params.workspaceId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let workspace = $state<any>(null);
  let logs = $state<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let refreshing = $state(false);

  let logContainerRef: HTMLElement;

  $effect(() => {
    if (!workspaceId) return;
    loading = true;
    error = null;

    api.api["execution-workspaces"]({ id: workspaceId }).get()
      .then((res) => {
        workspace = res.data;
        logs = (workspace as any)?.logs ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load workspace";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Workspaces" },
      { label: workspace?.name ?? `Workspace` },
    ]);
  });

  // Auto-scroll to bottom when new logs appear
  $effect(() => {
    if (logContainerRef && logs.length > 0) {
      logContainerRef.scrollTop = logContainerRef.scrollHeight;
    }
  });

  async function refreshLogs() {
    if (!workspaceId) return;
    refreshing = true;

    try {
      const res = await api.api["execution-workspaces"]({ id: workspaceId }).get();
      workspace = res.data;
      logs = (workspace as any)?.logs ?? [];
    } catch {
      // Silently fail
    } finally {
      refreshing = false;
    }
  }

  const statusConfig: Record<string, { color: string; label: string }> = {
    running: { color: "bg-blue-500", label: "Running" },
    idle: { color: "bg-yellow-500", label: "Idle" },
    completed: { color: "bg-green-500", label: "Completed" },
    failed: { color: "bg-red-500", label: "Failed" },
    provisioning: { color: "bg-purple-500", label: "Provisioning" },
  };
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-48 rounded bg-muted animate-pulse"></div>
    <div class="grid gap-4 md:grid-cols-3">
      {#each Array(3) as _}
        <div class="h-20 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
    <div class="h-64 rounded-lg bg-muted animate-pulse"></div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if workspace}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <Monitor class="size-5 text-muted-foreground" />
        <div>
          <h1 class="text-xl font-semibold text-foreground">{workspace.name ?? "Workspace"}</h1>
          <p class="text-xs text-muted-foreground font-mono">{workspaceId}</p>
        </div>
      </div>
      {@const status = statusConfig[workspace.status] ?? { color: "bg-muted-foreground", label: workspace.status ?? "unknown" }}
      <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-foreground">
        <span class="size-2 rounded-full {status.color} animate-pulse"></span>
        {status.label}
      </span>
    </div>

    <!-- Properties -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent</dt>
        <dd class="mt-1 text-sm text-foreground">
          {#if workspace.agentId}
            <a href="/{companyPrefix}/agents/{workspace.agentId}" class="hover:underline">
              {workspace.agentName ?? workspace.agentId}
            </a>
          {:else}
            —
          {/if}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <GitBranch class="size-3" />
          Branch
        </dt>
        <dd class="mt-1 text-sm text-foreground font-mono">{workspace.branch ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issue</dt>
        <dd class="mt-1 text-sm text-foreground">
          {#if workspace.issueId}
            <a href="/{companyPrefix}/issues/{workspace.issueId}" class="hover:underline">
              {workspace.issueTitle ?? workspace.issueId}
            </a>
          {:else}
            —
          {/if}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</dt>
        <dd class="mt-1 text-sm text-foreground">
          {workspace.createdAt ? new Date(workspace.createdAt).toLocaleString() : "—"}
        </dd>
      </div>
    </div>

    <!-- Path -->
    {#if workspace.workspacePath}
      <div class="rounded-lg border border-border bg-card p-4">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Workspace Path</dt>
        <dd class="text-sm text-foreground font-mono bg-muted/50 rounded p-2 overflow-x-auto">
          {workspace.workspacePath}
        </dd>
      </div>
    {/if}

    <!-- Logs -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-foreground">Live Output</h2>
        <button
          onclick={refreshLogs}
          disabled={refreshing}
          class="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw class="size-3 {refreshing ? 'animate-spin' : ''}" />
          Refresh
        </button>
      </div>

      <div
        bind:this={logContainerRef}
        class="rounded-lg border border-border bg-zinc-950 dark:bg-zinc-950 p-4 font-mono text-xs text-green-400 max-h-96 overflow-y-auto space-y-0.5"
      >
        {#if logs.length === 0}
          <p class="text-zinc-500">No output yet.</p>
        {:else}
          {#each logs as line, i}
            <div class="flex gap-3">
              <span class="text-zinc-600 select-none shrink-0 w-8 text-right">{i + 1}</span>
              <span class="whitespace-pre-wrap break-all">{line}</span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}
