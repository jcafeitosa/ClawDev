<script lang="ts">
  import { page } from '$app/stores';
  import { companyStore } from '$stores/company.svelte.js';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import PageSkeleton from '$lib/components/page-skeleton.svelte';
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import { Badge, Button, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton } from '$components/ui/index.js';
  import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '$components/ui/index.js';
  import {
    ArrowDown, Timer, Zap, PlayCircle, Bot, Terminal,
    ChevronDown, ChevronRight, XCircle, Radio, Eye, Code,
    AlignJustify, Rows3, Info, Activity
  } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface RunData {
    id: string;
    identifier?: string;
    status: string;
    agentId?: string | null;
    agentName?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    createdAt?: string;
    exitCode?: number | null;
    invocationSource?: string | null;
    trigger?: string | null;
    error?: string | null;
    errorMessage?: string | null;
    summary?: string | null;
    workspaceId?: string | null;
    workspaceName?: string | null;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | null;
    [key: string]: unknown;
  }

  interface TranscriptMessage {
    role: string;
    content: unknown;
    toolName?: string | null;
    tool_calls?: any[];
    [key: string]: unknown;
  }

  interface RunEvent {
    id?: string;
    type: string;
    timestamp?: string;
    createdAt?: string;
    details?: string | null;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let run = $state<RunData | null>(null);
  let transcript = $state<TranscriptMessage[]>([]);
  let events = $state<RunEvent[]>([]);
  let loading = $state(true);
  let eventsLoading = $state(true);

  let displayMode = $state<'nice' | 'raw'>('nice');
  let density = $state<'comfortable' | 'compact'>('comfortable');
  let activeTab = $state<'transcript' | 'events'>('transcript');
  let metadataOpen = $state(false);

  // Expanded state for compact mode
  let expandedMessages = $state<Set<number>>(new Set());

  // Auto-scroll
  let transcriptContainer = $state<HTMLDivElement | null>(null);
  let userScrolledUp = $state(false);
  let showScrollButton = $state(false);

  // Polling
  let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let runId = $derived($page.params.runId);
  let prefix = $derived($page.params.companyPrefix);
  let companyId = $derived(companyStore.selectedCompany?.id ?? '');
  let isLive = $derived(run?.status === 'started' || run?.status === 'running');

  let duration = $derived.by(() => {
    if (!run?.startedAt) return null;
    const start = new Date(run.startedAt).getTime();
    const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
    const diff = Math.max(0, end - start);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    if (mins < 60) return `${mins}m ${remSecs}s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  });

  let sourceBadge = $derived.by(() => {
    const src = run?.invocationSource ?? run?.trigger ?? null;
    if (!src) return null;
    const map: Record<string, { label: string; color: string }> = {
      timer: { label: 'Timer', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
      on_demand: { label: 'On Demand', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
      assignment: { label: 'Assignment', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
      automation: { label: 'Automation', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
    };
    return map[src] ?? { label: src.replace(/_/g, ' '), color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300' };
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadRun() {
    if (!runId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}`);
      if (res.ok) {
        const data = await res.json();
        run = data.run ?? data;
      }
    } catch { /* ignore */ }
  }

  async function loadTranscript() {
    if (!runId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}/transcript`);
      if (res.ok) {
        const data = await res.json();
        transcript = Array.isArray(data) ? data : data.messages ?? [];
      }
    } catch { /* ignore */ }
  }

  async function loadEvents() {
    if (!runId || !companyId) return;
    eventsLoading = true;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}/events`);
      if (res.ok) {
        const data = await res.json();
        events = Array.isArray(data) ? data : data.events ?? [];
      }
    } catch {
      events = [];
    } finally {
      eventsLoading = false;
    }
  }

  async function loadAll() {
    await Promise.all([loadRun(), loadTranscript()]);
    loading = false;
    // Auto-scroll on initial load
    requestAnimationFrame(() => scrollToBottom());
  }

  async function pollLiveData() {
    await Promise.all([loadRun(), loadTranscript()]);
    if (!userScrolledUp) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function cancelRun() {
    if (!runId) return;
    try {
      const res = await api(`/api/heartbeat-runs/${runId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: 'Run cancelled', tone: 'success' });
      await loadRun();
    } catch (err: any) {
      toastStore.push({ title: 'Failed to cancel run', body: err?.message, tone: 'error' });
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-scroll
  // ---------------------------------------------------------------------------
  function scrollToBottom() {
    if (transcriptContainer) {
      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
      userScrolledUp = false;
      showScrollButton = false;
    }
  }

  function handleScroll() {
    if (!transcriptContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = transcriptContainer;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    userScrolledUp = distFromBottom > 100;
    showScrollButton = distFromBottom > 200;
  }

  // ---------------------------------------------------------------------------
  // Compact mode toggle
  // ---------------------------------------------------------------------------
  function toggleExpand(index: number) {
    const next = new Set(expandedMessages);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    expandedMessages = next;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function getContentText(msg: TranscriptMessage): string {
    if (typeof msg.content === 'string') return msg.content;
    if (msg.content == null) return '';
    return JSON.stringify(msg.content, null, 2);
  }

  function hasToolCalls(msg: TranscriptMessage): boolean {
    return Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0;
  }

  function formatTokens(n: number | undefined | null): string {
    if (n == null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  let dataLoaded = false;
  onMount(() => {
    breadcrumbStore.set([
      { label: 'Runs', href: `/${$page.params.companyPrefix}/runs` },
      { label: runId ?? '' },
    ]);
    if (companyId) {
      dataLoaded = true;
      loadAll();
      loadEvents();
    }
  });

  // Retry loading when companyId becomes available
  $effect(() => {
    if (companyId && !dataLoaded && runId) {
      dataLoaded = true;
      loadAll();
      loadEvents();
    }
  });

  // Polling for live runs
  $effect(() => {
    if (isLive && !pollInterval) {
      pollInterval = setInterval(pollLiveData, 3000);
    } else if (!isLive && pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="p-6 space-y-6">
  {#if loading}
    <PageSkeleton showSidebar={false} />
  {:else if !run}
    <p class="text-red-500">Run not found.</p>
  {:else}
    <!-- ================================================================== -->
    <!-- Header                                                              -->
    <!-- ================================================================== -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Run {run.identifier ?? runId}
          </h1>
          <StatusBadge status={run.status ?? 'unknown'} />
          {#if isLive}
            <span class="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
              <span class="relative flex h-2 w-2">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              Live
            </span>
          {/if}
          {#if sourceBadge}
            <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize {sourceBadge.color}">
              {sourceBadge.label}
            </span>
          {/if}
          {#if run.exitCode != null}
            <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-mono {run.exitCode === 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}">
              exit {run.exitCode}
            </span>
          {/if}
        </div>

        <div class="mt-2 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400 flex-wrap">
          {#if run.agentName || run.agentId}
            <span class="flex items-center gap-1.5">
              <Bot class="h-3.5 w-3.5" />
              {#if run.agentId}
                <a href="/{prefix}/agents/{run.agentId}" class="text-primary hover:underline">
                  {run.agentName ?? run.agentId.slice(0, 8)}
                </a>
              {:else}
                {run.agentName}
              {/if}
            </span>
          {/if}
          {#if duration}
            <span class="flex items-center gap-1.5">
              <Timer class="h-3.5 w-3.5" />
              {duration}
            </span>
          {/if}
          <TimeAgo date={run.startedAt ?? run.createdAt} class="text-xs" />
        </div>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        {#if isLive}
          <Button variant="destructive" size="sm" onclick={cancelRun}>
            <XCircle class="h-4 w-4 mr-1.5" />
            Cancel Run
          </Button>
        {/if}
        <Button variant="outline" size="sm" href="/{prefix}/runs">
          Back
        </Button>
      </div>
    </div>

    <!-- ================================================================== -->
    <!-- Collapsible Metadata                                                -->
    <!-- ================================================================== -->
    <Collapsible bind:open={metadataOpen}>
      <CollapsibleTrigger class="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer">
        <Info class="h-4 w-4" />
        Metadata
        {#if metadataOpen}
          <ChevronDown class="h-4 w-4" />
        {:else}
          <ChevronRight class="h-4 w-4" />
        {/if}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div class="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {#if run.invocationSource}
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Source</p>
              <p class="text-sm text-zinc-900 dark:text-zinc-100 capitalize">{run.invocationSource.replace(/_/g, ' ')}</p>
            </div>
          {/if}
          {#if run.trigger}
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Trigger</p>
              <p class="text-sm text-zinc-900 dark:text-zinc-100 capitalize">{run.trigger.replace(/_/g, ' ')}</p>
            </div>
          {/if}
          {#if run.usage}
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Token Usage</p>
              <div class="flex items-center gap-3 text-sm text-zinc-900 dark:text-zinc-100">
                <span>In: {formatTokens(run.usage.inputTokens)}</span>
                <span>Out: {formatTokens(run.usage.outputTokens)}</span>
                {#if run.usage.totalTokens}
                  <span class="font-medium">Total: {formatTokens(run.usage.totalTokens)}</span>
                {/if}
              </div>
            </div>
          {/if}
          {#if run.workspaceName || run.workspaceId}
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3">
              <p class="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Workspace</p>
              <p class="text-sm text-zinc-900 dark:text-zinc-100">{run.workspaceName ?? run.workspaceId}</p>
            </div>
          {/if}
          {#if run.error || run.errorMessage}
            <div class="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 sm:col-span-2">
              <p class="text-[11px] font-medium uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">Error</p>
              <p class="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">{run.errorMessage ?? run.error}</p>
            </div>
          {/if}
          {#if run.summary}
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 sm:col-span-2 lg:col-span-3">
              <p class="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Summary</p>
              <div class="text-sm text-zinc-900 dark:text-zinc-100">
                <MarkdownBody content={run.summary} />
              </div>
            </div>
          {/if}
        </div>
      </CollapsibleContent>
    </Collapsible>

    <Separator />

    <!-- ================================================================== -->
    <!-- Tabs: Transcript / Events                                           -->
    <!-- ================================================================== -->
    <Tabs bind:value={activeTab}>
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <TabsList>
          <TabsTrigger value="transcript">Transcript ({transcript.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
        </TabsList>

        {#if activeTab === 'transcript'}
          <div class="flex items-center gap-2">
            <!-- Display mode toggle -->
            <div class="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 text-xs">
              <button
                class="rounded-md px-2.5 py-1 font-medium transition-colors {displayMode === 'nice' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
                onclick={() => displayMode = 'nice'}
              >
                <Eye class="h-3 w-3 inline mr-1" />Nice
              </button>
              <button
                class="rounded-md px-2.5 py-1 font-medium transition-colors {displayMode === 'raw' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
                onclick={() => displayMode = 'raw'}
              >
                <Code class="h-3 w-3 inline mr-1" />Raw
              </button>
            </div>

            <!-- Density toggle -->
            <div class="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 text-xs">
              <button
                class="rounded-md px-2.5 py-1 font-medium transition-colors {density === 'comfortable' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
                onclick={() => density = 'comfortable'}
              >
                <AlignJustify class="h-3 w-3 inline mr-1" />Full
              </button>
              <button
                class="rounded-md px-2.5 py-1 font-medium transition-colors {density === 'compact' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
                onclick={() => density = 'compact'}
              >
                <Rows3 class="h-3 w-3 inline mr-1" />Compact
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- ============================================================= -->
      <!-- Transcript Tab                                                  -->
      <!-- ============================================================= -->
      <TabsContent value="transcript">
        <div
          class="mt-4 space-y-3 max-h-[70vh] overflow-y-auto scroll-smooth relative"
          bind:this={transcriptContainer}
          onscroll={handleScroll}
        >
          {#if transcript.length === 0}
            <p class="text-sm text-zinc-500 py-8 text-center">No transcript available.</p>
          {:else}
            {#each transcript as msg, i}
              {@const text = getContentText(msg)}
              {@const isCompactTruncated = density === 'compact' && !expandedMessages.has(i) && text.split('\n').length > 3}
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 {density === 'compact' ? 'p-2.5' : 'p-3'}">
                <!-- Message header -->
                <div class="flex items-center gap-2 mb-1">
                  <span class="rounded px-1.5 py-0.5 text-xs font-medium {
                    msg.role === 'assistant'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                      : msg.role === 'tool'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                        : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }">{msg.role ?? 'unknown'}</span>
                  {#if msg.toolName}
                    <code class="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {msg.toolName}
                    </code>
                  {/if}
                  {#if density === 'compact' && text.split('\n').length > 3}
                    <button
                      class="ml-auto text-[11px] text-primary hover:underline"
                      onclick={() => toggleExpand(i)}
                    >
                      {expandedMessages.has(i) ? 'Collapse' : 'Expand'}
                    </button>
                  {/if}
                </div>

                <!-- Message body -->
                {#if displayMode === 'raw'}
                  <pre class="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 {isCompactTruncated ? 'line-clamp-3' : ''}">{text}</pre>
                {:else}
                  <!-- Nice mode -->
                  {#if msg.role === 'assistant' && text}
                    <div class="{isCompactTruncated ? 'line-clamp-3 overflow-hidden' : ''}">
                      <MarkdownBody content={text} />
                    </div>
                  {:else if msg.role === 'user'}
                    <p class="text-sm text-zinc-700 dark:text-zinc-300 {isCompactTruncated ? 'line-clamp-3' : ''}">{text}</p>
                  {:else}
                    <pre class="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300 font-mono text-xs {isCompactTruncated ? 'line-clamp-3' : ''}">{text}</pre>
                  {/if}

                  <!-- Tool calls -->
                  {#if hasToolCalls(msg)}
                    <div class="mt-2 space-y-1.5">
                      {#each msg.tool_calls as tc, j}
                        <Collapsible>
                          <CollapsibleTrigger class="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 cursor-pointer">
                            <Terminal class="h-3 w-3" />
                            <span>{tc.function?.name ?? tc.name ?? `tool_call_${j}`}</span>
                            <ChevronRight class="h-3 w-3 collapsible-icon" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <pre class="mt-1 rounded bg-zinc-50 dark:bg-zinc-800/50 p-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(tc.function?.arguments ?? tc.arguments ?? tc, null, 2)}</pre>
                          </CollapsibleContent>
                        </Collapsible>
                      {/each}
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          {/if}

          <!-- Scroll to bottom button -->
          {#if showScrollButton}
            <button
              class="sticky bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 shadow-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors z-10"
              onclick={scrollToBottom}
            >
              <ArrowDown class="h-3.5 w-3.5" />
              Scroll to bottom
            </button>
          {/if}
        </div>
      </TabsContent>

      <!-- ============================================================= -->
      <!-- Events Tab                                                      -->
      <!-- ============================================================= -->
      <TabsContent value="events">
        <div class="mt-4">
          {#if eventsLoading}
            <div class="space-y-2">
              {#each Array(4) as _}
                <div class="flex items-center gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <Skeleton class="h-4 w-20 rounded" />
                  <Skeleton class="h-4 w-32 rounded" />
                  <div class="flex-1"></div>
                  <Skeleton class="h-4 w-24 rounded" />
                </div>
              {/each}
            </div>
          {:else if events.length === 0}
            <p class="text-sm text-zinc-500 py-8 text-center">No events recorded.</p>
          {:else}
            <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {#each events as evt, i}
                <div class="flex items-start gap-3 p-3 text-sm {i % 2 === 0 ? '' : 'bg-zinc-50/50 dark:bg-zinc-800/20'}">
                  <span class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {evt.type}
                  </span>
                  <span class="text-zinc-700 dark:text-zinc-300 flex-1 min-w-0">
                    {#if evt.details}
                      <span class="whitespace-pre-wrap break-words">{evt.details}</span>
                    {:else}
                      <span class="text-zinc-400 italic">No details</span>
                    {/if}
                  </span>
                  <span class="shrink-0 text-xs text-zinc-500">
                    {#if evt.timestamp || evt.createdAt}
                      <TimeAgo date={evt.timestamp ?? evt.createdAt} class="text-xs" />
                    {/if}
                  </span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </TabsContent>
    </Tabs>
  {/if}
</div>
