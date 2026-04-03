<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge } from "$components/ui/index.js";
  import { Archive } from "lucide-svelte";
  import { onMount } from "svelte";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface ExecutionWorkspace {
    id: string;
    status?: string;
    agentName?: string;
    agentId?: string;
    branch?: string;
    projectId?: string;
    projectName?: string;
    issueId?: string;
    issueIdentifier?: string;
    lastUsedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let workspaces = $state<ExecutionWorkspace[]>([]);
  let loading = $state(true);
  let filter = $state<"all" | "active" | "archived">("all");
  let archivingIds = $state<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  let filteredWorkspaces = $derived(
    filter === "all"
      ? workspaces
      : workspaces.filter((ws) => {
          const status = (ws.status ?? "active").toLowerCase();
          return filter === "archived" ? status === "archived" : status !== "archived";
        })
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadWorkspaces() {
    if (!companyId) return;
    loading = true;
    try {
      const res = await api(`/api/companies/${companyId}/execution-workspaces`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      workspaces = Array.isArray(data) ? data : data.workspaces ?? data.items ?? [];
    } catch (err: any) {
      toastStore.push({ title: "Failed to load workspaces", body: err?.message, tone: "error" });
      workspaces = [];
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    breadcrumbStore.set([{ label: "Workspaces" }]);
    loadWorkspaces();
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function archiveWorkspace(ws: ExecutionWorkspace) {
    const newSet = new Set(archivingIds);
    newSet.add(ws.id);
    archivingIds = newSet;
    try {
      const res = await api(`/api/execution-workspaces/${ws.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Update local state
      workspaces = workspaces.map((w) =>
        w.id === ws.id ? { ...w, status: "archived" } : w
      );
      toastStore.push({ title: "Workspace archived", tone: "success" });
    } catch (err: any) {
      toastStore.push({ title: "Failed to archive workspace", body: err?.message, tone: "error" });
    } finally {
      const updated = new Set(archivingIds);
      updated.delete(ws.id);
      archivingIds = updated;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function shortId(id: string): string {
    return id.slice(0, 8);
  }

  const FILTER_OPTIONS: { value: "all" | "active" | "archived"; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
  ];
</script>

<div class="p-6 space-y-5">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Workspaces</h1>
  </div>

  <!-- Filter pills -->
  <div class="flex items-center gap-2">
    {#each FILTER_OPTIONS as opt (opt.value)}
      <button
        onclick={() => (filter = opt.value)}
        class="rounded-full px-3 py-1 text-xs font-medium transition-colors {filter === opt.value
          ? 'bg-primary text-white'
          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}"
      >
        {opt.label}
      </button>
    {/each}
  </div>

  <!-- Content -->
  {#if loading}
    <PageSkeleton lines={6} />
  {:else if filteredWorkspaces.length === 0}
    <EmptyState
      title={filter === "all" ? "No workspaces" : `No ${filter} workspaces`}
      description={filter === "all"
        ? "No execution workspaces found for this company."
        : `No workspaces with status "${filter}" found.`}
      icon="📦"
    />
  {:else}
    <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {#each filteredWorkspaces as ws (ws.id)}
        <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
          <a
            href="/{prefix}/workspaces/{ws.id}"
            class="flex items-center gap-3 min-w-0 flex-1"
          >
            <!-- Status badge -->
            <StatusBadge status={ws.status ?? "active"} />

            <!-- Workspace ID -->
            <span class="font-mono text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{shortId(ws.id)}</span>

            <!-- Agent name -->
            {#if ws.agentName}
              <Badge variant="outline" class="text-xs shrink-0">{ws.agentName}</Badge>
            {/if}

            <!-- Branch -->
            {#if ws.branch}
              <span class="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate max-w-[160px]">{ws.branch}</span>
            {/if}

            <!-- Project name -->
            {#if ws.projectName}
              <span class="text-xs text-zinc-600 dark:text-zinc-300 truncate">{ws.projectName}</span>
            {/if}

            <!-- Issue link -->
            {#if ws.issueIdentifier || ws.issueId}
              <span class="text-xs font-mono text-primary shrink-0">{ws.issueIdentifier ?? shortId(ws.issueId ?? "")}</span>
            {/if}
          </a>

          <div class="flex items-center gap-3 shrink-0 ml-3">
            <!-- Last used time -->
            {#if ws.lastUsedAt || ws.updatedAt}
              <TimeAgo date={ws.lastUsedAt ?? ws.updatedAt} class="text-xs text-zinc-500" />
            {/if}

            <!-- Archive action -->
            {#if (ws.status ?? "active") !== "archived"}
              <Button
                variant="ghost"
                size="sm"
                onclick={(e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); archiveWorkspace(ws); }}
                disabled={archivingIds.has(ws.id)}
                class="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <Archive class="size-3.5" />
              </Button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
