<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { PageLayout } from '$components/layout/index.js';
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from '$components/index.js';
  import {
    Button,
    Separator,
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '$components/ui/index.js';
  import {
    Archive,
    Server,
    Database,
    Clock,
    Terminal,
    ArrowLeft,
    Loader2,
    Play,
    Square,
    RotateCcw,
    CircleAlert,
    CheckCircle2,
  } from 'lucide-svelte';

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
    id?: string;
    name: string;
    type: string;
    status?: string;
    port?: number;
    url?: string;
    command?: string;
    cwd?: string;
    [key: string]: unknown;
  }

  interface ExecutionWorkspaceCloseAction {
    kind: string;
    label: string;
    description: string;
    command?: string | null;
  }

  interface ExecutionWorkspaceCloseLinkedIssue {
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    isTerminal: boolean;
  }

  interface ExecutionWorkspaceCloseGitReadiness {
    repoRoot?: string | null;
    workspacePath?: string | null;
    branchName?: string | null;
    baseRef?: string | null;
    hasDirtyTrackedFiles?: boolean;
    hasUntrackedFiles?: boolean;
    dirtyEntryCount?: number;
    untrackedEntryCount?: number;
    aheadCount?: number | null;
    behindCount?: number | null;
    isMergedIntoBase?: boolean | null;
    createdByRuntime?: boolean;
  }

  interface ExecutionWorkspaceCloseReadiness {
    workspaceId: string;
    state: 'ready' | 'ready_with_warnings' | 'blocked';
    blockingReasons: string[];
    warnings: string[];
    linkedIssues: ExecutionWorkspaceCloseLinkedIssue[];
    plannedActions: ExecutionWorkspaceCloseAction[];
    isDestructiveCloseAllowed: boolean;
    isSharedWorkspace: boolean;
    isProjectPrimaryWorkspace: boolean;
    git: ExecutionWorkspaceCloseGitReadiness | null;
    runtimeServices: RuntimeService[];
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
    config?: {
      provisionCommand?: string | null;
      teardownCommand?: string | null;
      cleanupCommand?: string | null;
      workspaceRuntime?: Record<string, unknown> | null;
      desiredState?: 'running' | 'stopped' | null;
    } | null;
    operations?: WorkspaceOperation[];
    runtimeServices?: RuntimeService[];
    services?: RuntimeService[];
    [key: string]: unknown;
  }

  interface ProjectWorkspace {
    id: string;
    runtimeConfig?: {
      workspaceRuntime?: Record<string, unknown> | null;
    } | null;
    [key: string]: unknown;
  }

  interface Project {
    id: string;
    workspaces?: ProjectWorkspace[];
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
  let closeDialogOpen = $state(false);
  let closing = $state(false);
  let closeReadiness = $state<ExecutionWorkspaceCloseReadiness | null>(null);
  let closeReadinessLoading = $state(false);
  let runtimeAction = $state<'start' | 'stop' | 'restart' | null>(null);
  let operationRefreshNonce = $state(0);
  let workspaceOperationsLoading = $state(false);
  let workspaceOperationsError = $state<string | null>(null);
  let project = $state<Project | null>(null);

  let workspaceId = $derived($page.params.workspaceId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let linkedProjectWorkspace = $derived(
    project?.workspaces?.find((item) => item.id === ws?.projectWorkspaceId) ?? null
  );
  let effectiveRuntimeConfig = $derived(
    ws?.config?.workspaceRuntime ??
      linkedProjectWorkspace?.runtimeConfig?.workspaceRuntime ??
      null
  );
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

  $effect(() => {
    if (!ws?.projectId) return;
    loadProject(ws.projectId);
  });

  $effect(() => {
    if (!workspaceId) return;
    operationRefreshNonce;
    loadWorkspaceOperations();
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
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: 'Failed to load workspace', body: err?.message, tone: 'error' });
      }
    } finally {
      loading = false;
    }
  }

  async function loadWorkspaceOperations() {
    if (!workspaceId) return;
    workspaceOperationsLoading = true;
    workspaceOperationsError = null;
    try {
      const res = await api(`/api/execution-workspaces/${workspaceId}/workspace-operations`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      operations = Array.isArray(data) ? data : data.operations ?? data.items ?? [];
    } catch (err: any) {
      workspaceOperationsError = err?.message ?? 'Failed to load workspace operations.';
      operations = [];
    } finally {
      workspaceOperationsLoading = false;
    }
  }

  async function loadProject(projectId: string) {
    try {
      const res = await api(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error(await res.text());
      project = await res.json();
    } catch {
      project = null;
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
    if (code == null) return 'text-muted-foreground/70';
    return code === 0 ? 'text-green-500' : 'text-red-500';
  }

  function operationStatusColor(status: string | undefined): string {
    switch (status) {
      case 'completed': case 'success': return 'bg-green-500/15 text-green-700 dark:text-green-400';
      case 'running': case 'in_progress': return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
      case 'failed': case 'error': return 'bg-red-500/15 text-red-700 dark:text-red-400';
      default: return 'bg-muted-foreground/15 text-muted-foreground';
    }
  }

  function closeStateColor(state: ExecutionWorkspaceCloseReadiness['state'] | null | undefined): string {
    switch (state) {
      case 'ready':
        return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
      case 'ready_with_warnings':
        return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
      case 'blocked':
        return 'bg-red-500/15 text-red-700 dark:text-red-300';
      default:
        return 'bg-muted-foreground/15 text-muted-foreground';
    }
  }

  async function loadCloseReadiness() {
    if (!workspaceId) return;
    closeReadinessLoading = true;
    try {
      const res = await api(`/api/execution-workspaces/${workspaceId}/close-readiness`);
      if (!res.ok) throw new Error(await res.text());
      closeReadiness = await res.json();
    } catch (err: any) {
      closeReadiness = null;
      toastStore.push({
        title: 'Failed to load workspace close readiness',
        body: err?.message,
        tone: 'error',
      });
    } finally {
      closeReadinessLoading = false;
    }
  }

  async function requestCloseWorkspace() {
    if (!workspaceId || !ws) return;
    closing = true;
    try {
      const res = await api(`/api/execution-workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: 'Workspace closed', tone: 'success' });
      closeDialogOpen = false;
      await loadWorkspace();
      operationRefreshNonce += 1;
    } catch (err: any) {
      toastStore.push({ title: 'Failed to close workspace', body: err?.message, tone: 'error' });
      await loadCloseReadiness();
    } finally {
      closing = false;
    }
  }

  async function controlRuntimeServices(action: 'start' | 'stop' | 'restart') {
    if (!workspaceId) return;
    runtimeAction = action;
    try {
      const res = await api(`/api/execution-workspaces/${workspaceId}/runtime-services/${action}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({
        title: action === 'stop' ? 'Runtime services stopped' : action === 'restart' ? 'Runtime services restarted' : 'Runtime services started',
        tone: 'success',
      });
      await loadWorkspace();
      operationRefreshNonce += 1;
      if (closeDialogOpen) await loadCloseReadiness();
    } catch (err: any) {
      toastStore.push({
        title: `Failed to ${action} runtime services`,
        body: err?.message,
        tone: 'error',
      });
    } finally {
      runtimeAction = null;
    }
  }

  async function openCloseDialog() {
    closeDialogOpen = true;
    await loadCloseReadiness();
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
  <PageLayout title="Workspace" description={ws.cwd ?? ws.id} fullWidth>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <StatusBadge status={ws.status ?? 'unknown'} />
        {#if ws.status !== 'archived'}
          <Button variant="outline" size="sm" class="gap-1.5" onclick={openCloseDialog}>
            <Archive class="w-3.5 h-3.5" />
            Close workspace
          </Button>
        {/if}
        <Button variant="outline" size="sm" href="/{companyPrefix}/workspaces">
          <ArrowLeft class="w-3.5 h-3.5 mr-1" />
          Back
        </Button>
      </div>
    {/snippet}

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
              <div class="rounded-lg border border-border divide-y divide-border">
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Mode</span>
                  <span class="text-foreground">{ws.mode ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Strategy Type</span>
                  <span class="text-foreground">{ws.strategyType ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Provider Type</span>
                  <span class="text-foreground">{ws.providerType ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Status</span>
                  <StatusBadge status={ws.status ?? 'unknown'} />
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Agent</span>
                  {#if ws.agentId}
                    <a href="/{companyPrefix}/agents/{ws.agentId}" class="text-primary hover:underline">
                      {ws.agentName ?? ws.agentId.slice(0, 8)}
                    </a>
                  {:else}
                    <span class="text-muted-foreground/70">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Branch</span>
                  <span class="font-mono text-foreground">{ws.branch ?? '--'}</span>
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Issue</span>
                  {#if ws.issueId}
                    <a href="/{companyPrefix}/issues/{ws.issueId}" class="text-primary hover:underline">
                      {ws.issueIdentifier ?? ws.issueId.slice(0, 8)}
                    </a>
                  {:else}
                    <span class="text-muted-foreground/70">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Project</span>
                  {#if ws.projectId}
                    <a href="/{companyPrefix}/projects/{ws.projectId}" class="text-primary hover:underline">
                      {ws.projectName ?? ws.projectId.slice(0, 8)}
                    </a>
                  {:else}
                    <span class="text-muted-foreground/70">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Last Used</span>
                  {#if ws.lastUsedAt}
                    <TimeAgo date={ws.lastUsedAt} class="text-xs" />
                  {:else}
                    <span class="text-muted-foreground/70">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Created</span>
                  {#if ws.createdAt}
                    <TimeAgo date={ws.createdAt} class="text-xs" />
                  {:else}
                    <span class="text-muted-foreground/70">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">Updated</span>
                  {#if ws.updatedAt}
                    <TimeAgo date={ws.updatedAt} class="text-xs" />
                  {:else}
                    <span class="text-muted-foreground/70">--</span>
                  {/if}
                </div>
                <div class="grid grid-cols-[140px_1fr] items-center px-4 py-3 text-sm">
                  <span class="text-muted-foreground">ID</span>
                  <span class="font-mono text-xs text-muted-foreground break-all">{ws.id}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="operations">
            <div class="mt-4">
              {#if workspaceOperationsLoading}
                <p class="text-sm text-muted-foreground">Loading workspace operations…</p>
              {:else if workspaceOperationsError}
                <p class="text-sm text-destructive">{workspaceOperationsError}</p>
              {:else if operations.length === 0}
                <EmptyState title="No operations" description="No workspace operations have been recorded yet." icon="🔧" />
              {:else}
                <div class="border rounded-lg divide-y divide-border dark:border-border">
                  <!-- Table header -->
                  <div class="grid grid-cols-[100px_1fr_90px_60px_80px_100px] items-center px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 rounded-t-lg">
                    <span>Phase</span>
                    <span>Command</span>
                    <span>Status</span>
                    <span>Exit</span>
                    <span>Duration</span>
                    <span class="text-right">Time</span>
                  </div>
                  {#each operations as op}
                    <div class="grid grid-cols-[100px_1fr_90px_60px_80px_100px] items-center px-4 py-3 text-sm hover:bg-muted/50">
                      <span class="text-foreground/80 font-medium text-xs capitalize">{op.phase ?? '--'}</span>
                      <span class="font-mono text-xs text-muted-foreground truncate pr-2" title={op.command ?? ''}>
                        <Terminal class="w-3 h-3 inline mr-1 text-muted-foreground/70" />
                        {truncateCommand(op.command)}
                      </span>
                      {#if op.status}
                        <span class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium capitalize {operationStatusColor(op.status)}">
                          {op.status.replace(/_/g, ' ')}
                        </span>
                      {:else}
                        <span class="text-muted-foreground/70 text-xs">--</span>
                      {/if}
                      <span class="font-mono text-xs {exitCodeColor(op.exitCode)}">
                        {op.exitCode != null ? op.exitCode : '--'}
                      </span>
                      <span class="text-xs text-muted-foreground">
                        <Clock class="w-3 h-3 inline mr-0.5 text-muted-foreground/70" />
                        {formatDuration(op.durationMs)}
                      </span>
                      <span class="text-right">
                        {#if op.startedAt}
                          <TimeAgo date={op.startedAt} class="text-xs" />
                        {:else}
                          <span class="text-xs text-muted-foreground/70">--</span>
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
                  <div class="rounded-lg border border-border p-4">
                    <div class="flex items-center gap-3 mb-2">
                      {#if svc.type === 'postgres' || svc.type === 'postgresql'}
                        <Database class="w-5 h-5 text-blue-500" />
                      {:else}
                        <Server class="w-5 h-5 text-muted-foreground/70" />
                      {/if}
                      <div>
                        <p class="text-sm font-medium text-foreground">{svc.name}</p>
                        <p class="text-xs text-muted-foreground">{svc.type}</p>
                      </div>
                      {#if svc.status}
                        <StatusBadge status={svc.status} class="ml-auto" />
                      {/if}
                    </div>
                    {#if svc.port}
                      <div class="text-xs text-muted-foreground font-mono">Port: {svc.port}</div>
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

      <div class="rounded-2xl border border-border bg-card p-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="space-y-1">
            <div class="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Runtime controls</div>
            <h2 class="text-lg font-semibold">Workspace services</h2>
            <p class="text-sm text-muted-foreground">
              {#if effectiveRuntimeConfig}
                Manage the local runtime services attached to this workspace.
              {:else}
                No runtime config is defined for this execution workspace yet.
              {/if}
            </p>
          </div>
          <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              size="sm"
              class="w-full sm:w-auto gap-1.5"
              disabled={runtimeAction !== null || !effectiveRuntimeConfig || !ws?.cwd}
              onclick={() => controlRuntimeServices("start")}
            >
              {#if runtimeAction === "start"}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {:else}
                <Play class="h-3.5 w-3.5" />
              {/if}
              Start
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="w-full sm:w-auto gap-1.5"
              disabled={runtimeAction !== null || !effectiveRuntimeConfig || !ws?.cwd}
              onclick={() => controlRuntimeServices("restart")}
            >
              {#if runtimeAction === "restart"}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {:else}
                <RotateCcw class="h-3.5 w-3.5" />
              {/if}
              Restart
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="w-full sm:w-auto gap-1.5"
              disabled={runtimeAction !== null || (ws.runtimeServices?.length ?? 0) === 0}
              onclick={() => controlRuntimeServices("stop")}
            >
              {#if runtimeAction === "stop"}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
              {:else}
                <Square class="h-3.5 w-3.5" />
              {/if}
              Stop
            </Button>
          </div>
        </div>
        <Separator class="my-4" />
        {#if runtimeServices.length > 0}
          <div class="space-y-3">
            {#each runtimeServices as svc}
              <div class="rounded-xl border border-border/80 bg-background px-3 py-2">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="space-y-1">
                    <div class="text-sm font-medium">{svc.name}</div>
                    <div class="text-xs text-muted-foreground">{svc.type}{svc.status ? ` · ${svc.status}` : ''}</div>
                    <div class="space-y-1 text-xs text-muted-foreground">
                      {#if svc.port}
                        <div>Port {svc.port}</div>
                      {/if}
                      {#if svc.url}
                        <a href={svc.url} target="_blank" rel="noreferrer" class="inline-flex items-center gap-1 hover:underline">
                          {svc.url}
                        </a>
                      {/if}
                    </div>
                  </div>
                  <StatusBadge status={svc.status ?? 'unknown'} />
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-muted-foreground">
            {effectiveRuntimeConfig
              ? "No runtime services are currently running for this execution workspace."
              : "No runtime config is defined for this execution workspace yet."}
          </p>
        {/if}
      </div>
    </div>

    <Dialog bind:open={closeDialogOpen}>
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Close workspace</DialogTitle>
          <DialogDescription>
            Review the workspace close readiness before ClawDev archives the workspace and stops its runtime services.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          {#if closeReadinessLoading}
            <p class="text-sm text-muted-foreground">Loading close readiness…</p>
          {:else if closeReadiness}
            <div class="flex items-center gap-2">
              <span class={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${closeStateColor(closeReadiness.state)}`}>
                {closeReadiness.state.replace(/_/g, ' ')}
              </span>
              {#if closeReadiness.isDestructiveCloseAllowed}
                <span class="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 class="h-3.5 w-3.5" />
                  Destructive close allowed
                </span>
              {/if}
            </div>

            {#if closeReadiness.blockingReasons.length > 0}
              <div class="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <div class="mb-2 flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                  <CircleAlert class="h-4 w-4" />
                  Blocking reasons
                </div>
                <ul class="space-y-1 text-sm text-red-700/90 dark:text-red-200">
                  {#each closeReadiness.blockingReasons as reason}
                    <li>• {reason}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            {#if closeReadiness.warnings.length > 0}
              <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div class="mb-2 text-sm font-medium text-amber-700 dark:text-amber-300">Warnings</div>
                <ul class="space-y-1 text-sm text-amber-700/90 dark:text-amber-200">
                  {#each closeReadiness.warnings as warning}
                    <li>• {warning}</li>
                  {/each}
                </ul>
              </div>
            {/if}

            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-lg border border-border p-3">
                <div class="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Linked issues</div>
                {#if closeReadiness.linkedIssues.length > 0}
                  <div class="space-y-2">
                    {#each closeReadiness.linkedIssues as issue}
                      <div class="flex items-start justify-between gap-3 text-sm">
                        <div class="min-w-0">
                          <div class="font-medium">{issue.identifier ?? issue.id.slice(0, 8)} · {issue.title}</div>
                          <div class="text-xs text-muted-foreground">{issue.status}{issue.isTerminal ? ' · terminal' : ''}</div>
                        </div>
                        <a href="/{companyPrefix}/issues/{issue.id}" class="text-xs text-primary hover:underline">Open</a>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="text-sm text-muted-foreground">No linked issues.</p>
                {/if}
              </div>

              <div class="rounded-lg border border-border p-3">
                <div class="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Git readiness</div>
                {#if closeReadiness.git}
                  <div class="space-y-1 text-sm">
                    <div>Workspace path: <span class="font-mono text-xs">{closeReadiness.git.workspacePath ?? '--'}</span></div>
                    <div>Branch: <span class="font-mono text-xs">{closeReadiness.git.branchName ?? '--'}</span></div>
                    <div>Base ref: <span class="font-mono text-xs">{closeReadiness.git.baseRef ?? '--'}</span></div>
                    <div>Dirty files: <span class="font-medium">{closeReadiness.git.dirtyEntryCount ?? 0}</span></div>
                    <div>Untracked files: <span class="font-medium">{closeReadiness.git.untrackedEntryCount ?? 0}</span></div>
                    <div>Ahead/behind: <span class="font-medium">{closeReadiness.git.aheadCount ?? 0}/{closeReadiness.git.behindCount ?? 0}</span></div>
                  </div>
                {:else}
                  <p class="text-sm text-muted-foreground">No git readiness data available.</p>
                {/if}
              </div>
            </div>

            {#if closeReadiness.plannedActions.length > 0}
              <div class="rounded-lg border border-border p-3">
                <div class="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Planned actions</div>
                <div class="space-y-2">
                  {#each closeReadiness.plannedActions as action}
                    <div class="rounded-md border border-border/70 bg-background px-3 py-2">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <div class="text-sm font-medium">{action.label}</div>
                          <div class="text-xs text-muted-foreground">{action.description}</div>
                        </div>
                        {#if action.command}
                          <span class="font-mono text-xs text-muted-foreground">{action.command}</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {:else}
            <p class="text-sm text-muted-foreground">
              Close readiness could not be loaded yet.
            </p>
          {/if}
        </div>

        <DialogFooter>
          <Button variant="outline" onclick={() => { closeDialogOpen = false; }}>
            Cancel
          </Button>
          <Button
            disabled={closing || closeReadiness?.state === 'blocked'}
            onclick={requestCloseWorkspace}
          >
            {#if closing}
              <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            {/if}
            Close workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </PageLayout>
{/if}
