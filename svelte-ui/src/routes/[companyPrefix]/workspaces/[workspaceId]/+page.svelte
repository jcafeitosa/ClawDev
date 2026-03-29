<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from '$components/index.js';
  import { Separator, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '$components/ui/index.js';
  import { Archive, Server, Database, Clock, Terminal, ArrowLeft } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface WorkspaceOperation {
    id: string;
    phase?: string;
    command?: string;
    status?: string;
    exitCode?: number | null;
    durationMs?: number | null;
    startedAt?: string;
    finishedAt?: string | null;
    [key: string]: unknown;
  }

  interface RuntimeService {
    name: string;
    type: string;
    status?: string;
    port?: number;
    [key: string]: unknown;
  }

  interface Workspace {
    id: string;
    cwd?: string;
    status?: string;
    mode?: string;
    strategyType?: string;
    providerType?: string;
    agentId?: string;
    agentName?: string;
    branch?: string;
    issueId?: string;
    issueIdentifier?: string;
    projectId?: string;
    projectName?: string;
    lastUsedAt?: string;
    createdAt?: string;
    updatedAt?: string;
    operations?: WorkspaceOperation[];
    runtimeServices?: RuntimeService[];
    services?: RuntimeService[];
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let ws = $state<Workspace | null>(null);
  let operations = $state<WorkspaceOperation[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state('overview');
  let archiving = $state(false);
  let confirmArchive = $state(false);

  let workspaceId = $derived($page.params.workspaceId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let runtimeServices = $derived<RuntimeService[]>(
    ws?.runtimeServices ?? ws?.services ?? []
  );

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  onMount(() => {
    breadcrumbStore.set([
      { label: 'Workspaces', href: `/${$page.params.companyPrefix}/workspaces` },
      { label: workspaceId ?? '' },
    ]);
  });

  $effect(() => {
    if (!workspaceId) return;
    loadWorkspace();
  });

  async function loadWorkspace() {
    if (!workspaceId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/execution-workspaces/${workspaceId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      const data = await res.json();
      ws = data;
      operations = data.operations ?? [];
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: 'Failed to load workspace', body: err?.message, tone: 'error' });
      }
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Archive
  // ---------------------------------------------------------------------------
  async function archiveWorkspace() {
    if (!workspaceId) return;
    archiving = true;
    try {
      const res = await api(`/api/execution-workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: 'Workspace archived', tone: 'success' });
      confirmArchive = false;
      await loadWorkspace();
    } catch (err: any) {
      toastStore.push({ title: 'Failed to archive workspace', body: err?.message, tone: 'error' });
    } finally {
      archiving = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function truncateCommand(cmd: string | undefined, maxLen = 80): string {
    if (!cmd) return '--';
    return cmd.length > maxLen ? cmd.slice(0, maxLen) + '...' : cmd;
  }

  function formatDuration(ms: number | null | undefined): string {
    if (ms == null) return '--';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return `${mins}m ${secs}s`;
  }

  function exitCodeColor(code: number | null | undefined): string {
    if (code == null) return 'text-zinc-400';
    return code === 0 ? 'text-green-500' : 'text-red-500';
  }

  function operationStatusColor(status: string | undefined): string {
    switch (status) {
      case 'completed': case 'success': return 'bg-green-500/15 text-green-700 dark:text-green-400';
      case 'running': case 'in_progress': return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
      case 'failed': case 'error': return 'bg-red-500/15 text-red-700 dark:text-red-400';
      default: return 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400';
    }
  }
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton />
  </div>
{:else if notFound || !ws}
  <div class="p-6">
    <EmptyState title="Workspace not found" description="The workspace you're looking for doesn't exist or you don't have access." icon="📂">
      <a href="/{companyPrefix}/workspaces" class="text-sm text-primary hover:underline">Back to workspaces</a>
    </EmptyState>
  </div>
{:else}
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50 truncate">
            Workspace
          </h1>
          <StatusBadge status={ws.status ?? 'unknown'} />
        </div>
        <p class="text-sm text-zinc-500 dark:text-zinc-400 font-mono truncate">{ws.cwd ?? ws.id}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        {#if ws.status !== 'archived'}
          {#if confirmArchive}
            <button
              onclick={archiveWorkspace}
              disabled={archiving}
              class="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              {archiving ? 'Archiving...' : 'Confirm Archive'}
            </button>
            <button
              onclick={() => { confirmArchive = false; }}
              class="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          {:else}
            <button
              onclick={() => { confirmArchive = true; }}
              class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Archive class="w-3.5 h-3.5" />
              Archive
            </button>
          {/if}
        {/if}
        <a
          href="/{companyPrefix}/workspaces"
          class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          Back
        </a>
      </div>
    </div>

    <!-- Main content + sidebar -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <Tabs bind:value={activeTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="operations">Operations ({operations.length})</TabsTrigger>
            {#if runtimeServices.length > 0}
              <TabsTrigger value="services">Services ({runtimeServices.length})</TabsTrigger>
            {/if}
          </TabsList>

          <TabsContent value="overview">
            <div class="mt-4 space-y-4">
              <!-- Property grid -->
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800">
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Mode</span>
                  <span class="text-zinc-900 dark:text-zinc-100">{ws.mode ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Strategy Type</span>
                  <span class="text-zinc-900 dark:text-zinc-100">{ws.strategyType ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Provider Type</span>
                  <span class="text-zinc-900 dark:text-zinc-100">{ws.providerType ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Status</span>
                  <StatusBadge status={ws.status ?? 'unknown'} />
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Agent</span>
                  {#if ws.agentId}
                    <a href="/{companyPrefix}/agents/{ws.agentId}" class="text-primary hover:underline">
                      {ws.agentName ?? ws.agentId.slice(0, 8)}
                    </a>
                  {:else}
                    <span class="text-zinc-400">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Branch</span>
                  <span class="font-mono text-zinc-900 dark:text-zinc-100">{ws.branch ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Issue</span>
                  {#if ws.issueId}
                    <a href="/{companyPrefix}/issues/{ws.issueId}" class="text-primary hover:underline">
                      {ws.issueIdentifier ?? ws.issueId.slice(0, 8)}
                    </a>
                  {:else}
                    <span class="text-zinc-400">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Project</span>
                  {#if ws.projectId}
                    <a href="/{companyPrefix}/projects/{ws.projectId}" class="text-primary hover:underline">
                      {ws.projectName ?? ws.projectId.slice(0, 8)}
                    </a>
                  {:else}
                    <span class="text-zinc-400">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Last Used</span>
                  {#if ws.lastUsedAt}
                    <TimeAgo date={ws.lastUsedAt} class="text-xs" />
                  {:else}
                    <span class="text-zinc-400">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Created</span>
                  {#if ws.createdAt}
                    <TimeAgo date={ws.createdAt} class="text-xs" />
                  {:else}
                    <span class="text-zinc-400">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">Updated</span>
                  {#if ws.updatedAt}
                    <TimeAgo date={ws.updatedAt} class="text-xs" />
                  {:else}
                    <span class="text-zinc-400">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-zinc-500 dark:text-zinc-400">ID</span>
                  <span class="font-mono text-xs text-zinc-500 break-all">{ws.id}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="operations">
            <div class="mt-4">
              {#if operations.length === 0}
                <EmptyState title="No operations" description="No workspace operations have been recorded yet." icon="🔧" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  <!-- Table header -->
                  <div class="grid grid-cols-[100px_1fr_90px_60px_80px_100px] items-center px-4 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-zinc-900/50 rounded-t-lg">
                    <span>Phase</span>
                    <span>Command</span>
                    <span>Status</span>
                    <span>Exit</span>
                    <span>Duration</span>
                    <span class="text-right">Time</span>
                  </div>
                  {#each operations as op}
                    <div class="grid grid-cols-[100px_1fr_90px_60px_80px_100px] items-center px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <span class="text-zinc-700 dark:text-zinc-300 font-medium text-xs capitalize">{op.phase ?? '--'}</span>
                      <span class="font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate pr-2" title={op.command ?? ''}>
                        <Terminal class="w-3 h-3 inline mr-1 text-zinc-400" />
                        {truncateCommand(op.command)}
                      </span>
                      {#if op.status}
                        <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium capitalize {operationStatusColor(op.status)}">
                          {op.status.replace(/_/g, ' ')}
                        </span>
                      {:else}
                        <span class="text-zinc-400 text-xs">--</span>
                      {/if}
                      <span class="font-mono text-xs {exitCodeColor(op.exitCode)}">
                        {op.exitCode != null ? op.exitCode : '--'}
                      </span>
                      <span class="text-xs text-zinc-500">
                        <Clock class="w-3 h-3 inline mr-0.5 text-zinc-400" />
                        {formatDuration(op.durationMs)}
                      </span>
                      <span class="text-right">
                        {#if op.startedAt}
                          <TimeAgo date={op.startedAt} class="text-xs" />
                        {:else}
                          <span class="text-xs text-zinc-400">--</span>
                        {/if}
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          {#if runtimeServices.length > 0}
            <TabsContent value="services">
              <div class="mt-4 space-y-3">
                {#each runtimeServices as svc}
                  <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                    <div class="flex items-center gap-3 mb-2">
                      {#if svc.type === 'postgres' || svc.type === 'postgresql'}
                        <Database class="w-5 h-5 text-blue-500" />
                      {:else}
                        <Server class="w-5 h-5 text-zinc-400" />
                      {/if}
                      <div>
                        <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{svc.name}</p>
                        <p class="text-xs text-zinc-500">{svc.type}</p>
                      </div>
                      {#if svc.status}
                        <StatusBadge status={svc.status} class="ml-auto" />
                      {/if}
                    </div>
                    {#if svc.port}
                      <div class="text-xs text-zinc-500 font-mono">Port: {svc.port}</div>
                    {/if}
                  </div>
                {/each}
              </div>
            </TabsContent>
          {/if}
        </Tabs>
      </div>

      <!-- Sidebar -->
      <PropertiesPanel>
        <PropertyRow label="Status">
          <StatusBadge status={ws.status ?? 'unknown'} />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Mode">
          <span class="text-xs capitalize">{ws.mode ?? '--'}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Strategy">
          <span class="text-xs">{ws.strategyType ?? '--'}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Provider">
          <span class="text-xs">{ws.providerType ?? '--'}</span>
        </PropertyRow>
        <Separator />
        {#if ws.agentId}
          <PropertyRow label="Agent">
            <a href="/{companyPrefix}/agents/{ws.agentId}" class="text-primary hover:underline text-xs">
              {ws.agentName ?? ws.agentId.slice(0, 8)}
            </a>
          </PropertyRow>
          <Separator />
        {/if}
        {#if ws.branch}
          <PropertyRow label="Branch">
            <span class="font-mono text-xs">{ws.branch}</span>
          </PropertyRow>
          <Separator />
        {/if}
        {#if ws.issueId}
          <PropertyRow label="Issue">
            <a href="/{companyPrefix}/issues/{ws.issueId}" class="text-primary hover:underline text-xs">
              {ws.issueIdentifier ?? ws.issueId.slice(0, 8)}
            </a>
          </PropertyRow>
          <Separator />
        {/if}
        {#if ws.projectId}
          <PropertyRow label="Project">
            <a href="/{companyPrefix}/projects/{ws.projectId}" class="text-primary hover:underline text-xs">
              {ws.projectName ?? ws.projectId.slice(0, 8)}
            </a>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Operations">
          <span class="font-medium">{operations.length}</span>
        </PropertyRow>
        <Separator />
        {#if ws.lastUsedAt}
          <PropertyRow label="Last Used">
            <TimeAgo date={ws.lastUsedAt} class="text-xs" />
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Created">
          <TimeAgo date={ws.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={ws.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{ws.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </div>
{/if}
