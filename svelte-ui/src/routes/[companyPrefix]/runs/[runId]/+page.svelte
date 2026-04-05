<script lang="ts">
  import { page } from '$app/stores';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { PageLayout } from '$components/layout/index.js';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import PageSkeleton from '$lib/components/page-skeleton.svelte';
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton, Separator } from '$components/ui/index.js';
  import {
    buildTranscriptFromLog,
    compactWs,
    displayToolName,
    humanize,
    isCommandTool,
    normalizeTranscript,
    parseStructuredResult,
    parseSystemActivity,
    summarizeToolInput,
    summarizeToolResult,
    trunc,
    type TranscriptBlock,
    type TranscriptEntry,
    type CommandItem,
    type ToolGroupItem,
  } from '$lib/transcript/run-transcript';
  import { goto } from '$app/navigation';
  import {
    Bot, Terminal, ChevronRight, ChevronDown, XCircle,
    Check, Wrench, CircleAlert, User, TerminalSquare,
    RotateCcw, Plus, Play, Pause, CheckCircle2, Clock, Timer, Loader2, Slash,
    ExternalLink,
  } from 'lucide-svelte';

  interface RunData {
    id: string; identifier?: string; status: string;
    agentId?: string | null; agentName?: string | null;
    startedAt?: string | null; finishedAt?: string | null; createdAt?: string;
    exitCode?: number | null; signal?: string | null;
    invocationSource?: string | null; trigger?: string | null; triggerDetail?: string | null;
    error?: string | null; errorMessage?: string | null; errorCode?: string | null;
    summary?: string | null; workspaceId?: string | null; workspaceName?: string | null;
    sessionIdBefore?: string | null; sessionIdAfter?: string | null;
    stdoutExcerpt?: string | null; stderrExcerpt?: string | null;
    logRef?: string | null; logBytes?: number | null;
    usageJson?: Record<string, unknown> | null;
    resultJson?: Record<string, unknown> | null;
    [key: string]: unknown;
  }

  interface RunEvent {
    id?: number; seq: number; eventType: string; stream?: string | null;
    level?: string | null; color?: string | null;
    message?: string | null; payload?: Record<string, unknown> | null;
    createdAt: string;
  }

  interface TouchedIssue {
    issueId: string; identifier?: string | null; title?: string | null; status?: string | null;
  }

  interface WorkspaceOp {
    id: string; phase: string; status: string;
    startedAt?: string | null; finishedAt?: string | null;
    command?: string | null; cwd?: string | null;
    stderrExcerpt?: string | null; stdoutExcerpt?: string | null;
    metadata?: Record<string, unknown> | null;
  }

  function formatToolPayload(v: unknown): string {
    if (typeof v === 'string') { try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; } }
    try { return JSON.stringify(v, null, 2); } catch { return String(v ?? ''); }
  }

  // ============================================================
  // State
  // ============================================================
  let run = $state<RunData | null>(null);
  let loading = $state(true);
  let logText = $state('');
  let logLoading = $state(false);
  let events = $state<RunEvent[]>([]);
  let touchedIssues = $state<TouchedIssue[]>([]);
  let workspaceOps = $state<WorkspaceOp[]>([]);

  let transcriptMode = $state<'nice' | 'raw'>('nice');
  let openBlocks = $state<Set<number>>(new Set());
  let sessionOpen = $state(false);

  let transcriptContainer = $state<HTMLDivElement | null>(null);
  let userScrolledUp = $state(false);
  let showScrollBtn = $state(false);
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // ============================================================
  // Derived
  // ============================================================
  let runId = $derived($page.params.runId);
  let prefix = $derived($page.params.companyPrefix);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix(prefix));
  let companyId = $derived(routeCompanyId ?? '');
  let isLive = $derived(run?.status === 'started' || run?.status === 'running');

  let transcriptEntries = $derived.by(() => logText ? buildTranscriptFromLog(logText) : []);
  let transcriptBlocks = $derived.by(() => normalizeTranscript(transcriptEntries, isLive));

  let adapterInvokePayload = $derived.by(() => {
    const evt = events.find(e => e.eventType === 'adapter.invoke');
    return evt?.payload ?? null;
  });

  let metrics = $derived.by(() => {
    const raw = run?.usageJson;
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const input = Math.max(0, Math.floor(Number(r.rawInputTokens ?? r.inputTokens ?? 0)));
    const cached = Math.max(0, Math.floor(Number(r.rawCachedInputTokens ?? r.cachedInputTokens ?? 0)));
    const output = Math.max(0, Math.floor(Number(r.rawOutputTokens ?? r.outputTokens ?? 0)));
    if (input <= 0 && cached <= 0 && output <= 0) return null;
    const costCents = typeof r.costCents === 'number' ? r.costCents : 0;
    const costUsd = costCents > 0 ? costCents / 100 : 0;
    return { input, cached, output, costUsd };
  });

  let hasSession = $derived(!!(run?.sessionIdBefore || run?.sessionIdAfter));
  let sessionChanged = $derived(!!(run?.sessionIdBefore && run?.sessionIdAfter && run.sessionIdBefore !== run.sessionIdAfter));

  const timeFormat: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  let startTime = $derived(run?.startedAt ? new Date(run.startedAt).toLocaleTimeString('en-US', timeFormat) : null);
  let endTime = $derived(run?.finishedAt ? new Date(run.finishedAt).toLocaleTimeString('en-US', timeFormat) : null);

  let duration = $derived.by(() => {
    if (!run?.startedAt) return null;
    const start = new Date(run.startedAt).getTime();
    const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
    const secs = Math.floor(Math.max(0, end - start) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60), rs = secs % 60;
    if (mins < 60) return `${mins}m ${rs}s`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  });

  // ============================================================
  // Data fetching
  // ============================================================
  async function loadRun() {
    if (!runId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}`);
      if (res.ok) { const d = await res.json(); run = d.run ?? d; }
    } catch { /* ignore */ }
  }

  async function loadLog() {
    if (!runId || !companyId) return;
    logLoading = true;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}/log?limitBytes=2000000`);
      if (res.ok) { const d = await res.json(); logText = typeof d.content === 'string' ? d.content : ''; }
    } catch { /* ignore */ } finally { logLoading = false; }
  }

  async function loadEvents() {
    if (!runId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}/events?limit=500`);
      if (res.ok) { const d = await res.json(); events = Array.isArray(d) ? d : d.events ?? []; }
    } catch { /* ignore */ }
  }

  async function loadTouchedIssues() {
    if (!runId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/runs/${runId}/issues`);
      if (res.ok) { const d = await res.json(); touchedIssues = Array.isArray(d) ? d : []; }
    } catch { /* ignore */ }
  }

  async function loadWorkspaceOps() {
    if (!runId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}/workspace-operations`);
      if (res.ok) { const d = await res.json(); workspaceOps = Array.isArray(d) ? d : []; }
    } catch { /* ignore */ }
  }

  async function loadAll() {
    await Promise.all([loadRun(), loadLog(), loadEvents(), loadTouchedIssues(), loadWorkspaceOps()]);
    loading = false;
    requestAnimationFrame(() => scrollToBottom());
  }

  async function pollLive() {
    await Promise.all([loadRun(), loadLog()]);
    if (!userScrolledUp) requestAnimationFrame(() => scrollToBottom());
  }

  async function cancelRun() {
    if (!runId) return;
    try {
      const res = await api(`/api/heartbeat-runs/${runId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: 'Run cancelled', tone: 'success' });
      await loadRun();
    } catch (err: any) {
      toastStore.push({ title: 'Failed to cancel', body: err?.message, tone: 'error' });
    }
  }

  // ============================================================
  // Sidebar: runs list for this agent
  // ============================================================
  let agentRuns = $state<any[]>([]);
  let agentRunsLoading = $state(true);

  async function loadAgentRuns() {
    if (!companyId || !run?.agentId) { agentRunsLoading = false; return; }
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs?agentId=${run.agentId}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        agentRuns = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
      }
    } catch { /* ignore */ }
    agentRunsLoading = false;
  }

  // ============================================================
  // Retry failed run
  // ============================================================
  let retrying = $state(false);
  async function retryRun() {
    if (!run || retrying) return;
    retrying = true;
    try {
      const payload: Record<string, unknown> = { source: 'on_demand', triggerDetail: 'manual', reason: 'retry_failed_run' };
      const ctx = run.contextSnapshot as Record<string, unknown> | null;
      if (ctx) {
        const inner: Record<string, unknown> = {};
        if (typeof ctx.issueId === 'string' && ctx.issueId) inner.issueId = ctx.issueId;
        if (typeof ctx.taskId === 'string' && ctx.taskId) inner.taskId = ctx.taskId;
        if (typeof ctx.taskKey === 'string' && ctx.taskKey) inner.taskKey = ctx.taskKey;
        if (Object.keys(inner).length > 0) payload.payload = inner;
      }
      const res = await api(`/api/agents/${run.agentId}/wakeup`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result?.id) {
        goto(`/${prefix}/runs/${result.id}`);
      } else {
        toastStore.push({ title: 'Retry was skipped', tone: 'warn' });
      }
    } catch (err: any) {
      toastStore.push({ title: err.message ?? 'Failed to retry run', tone: 'error' });
    } finally {
      retrying = false;
    }
  }

  // ============================================================
  // Invocation source badge helpers
  // ============================================================
  function sourceLabel(src: string | null | undefined): string {
    if (!src) return '';
    const map: Record<string, string> = { timer: 'Timer', assignment: 'Assignment', on_demand: 'On-demand', automation: 'Automation' };
    return map[src] ?? humanize(src);
  }
  function sourceColor(src: string | null | undefined): string {
    if (!src) return 'bg-gray-500/10 text-gray-500';
    const map: Record<string, string> = {
      timer: 'bg-blue-500/10 text-blue-500', assignment: 'bg-violet-500/10 text-violet-500',
      on_demand: 'bg-cyan-500/10 text-cyan-500', automation: 'bg-gray-500/10 text-gray-500',
    };
    return map[src] ?? 'bg-gray-500/10 text-gray-500';
  }

  // Sidebar run status icon helper
  function runStatusIcon(status: string) {
    if (status === 'succeeded') return { icon: CheckCircle2, color: 'text-emerald-500' };
    if (status === 'failed' || status === 'timed_out') return { icon: XCircle, color: 'text-red-500' };
    if (status === 'running' || status === 'queued') return { icon: Loader2, color: 'text-cyan-500 animate-spin' };
    if (status === 'cancelled') return { icon: Slash, color: 'text-gray-500' };
    return { icon: Clock, color: 'text-yellow-500' };
  }

  // ============================================================
  // Scroll
  // ============================================================
  function scrollToBottom() {
    if (transcriptContainer) { transcriptContainer.scrollTop = transcriptContainer.scrollHeight; userScrolledUp = false; showScrollBtn = false; }
  }
  function handleScroll() {
    if (!transcriptContainer) return;
    const { scrollTop, scrollHeight, clientHeight } = transcriptContainer;
    const d = scrollHeight - scrollTop - clientHeight;
    userScrolledUp = d > 32; showScrollBtn = d > 200;
  }

  function toggleBlock(i: number) {
    const next = new Set(openBlocks);
    if (next.has(i)) next.delete(i); else next.add(i);
    openBlocks = next;
  }

  // ============================================================
  // Helpers
  // ============================================================
  function formatTokens(n: number | null | undefined) {
    if (n == null) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  function wsPhaseLabel(phase: string) {
    const m: Record<string, string> = { setup: 'Setup', provision: 'Provision', teardown: 'Teardown' };
    return m[phase] ?? humanize(phase);
  }

  function wsStatusColor(status: string) {
    if (status === 'completed') return 'text-emerald-700 dark:text-emerald-300';
    if (status === 'failed') return 'text-red-700 dark:text-red-300';
    if (status === 'running') return 'text-cyan-700 dark:text-cyan-300';
    return 'text-muted-foreground';
  }

  // ============================================================
  // Lifecycle
  // ============================================================
  let dataLoaded = false;
  onMount(() => {
    breadcrumbStore.set([
      { label: 'Agents', href: `/${$page.params.companyPrefix}/agents` },
      ...(run?.agentName ? [{ label: run.agentName, href: `/${$page.params.companyPrefix}/agents/${run.agentId}` }] : []),
      { label: 'Runs', href: `/${$page.params.companyPrefix}/runs` },
      { label: run?.identifier ?? runId?.slice(0, 8) ?? '' },
    ]);
    if (companyId) { dataLoaded = true; loadAll().then(() => loadAgentRuns()); }
  });

  $effect(() => {
    if (companyId && !dataLoaded && runId) { dataLoaded = true; loadAll(); }
  });

  $effect(() => {
    if (isLive && !pollInterval) { pollInterval = setInterval(pollLive, 3000); }
    else if (!isLive && pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  });

  onDestroy(() => { if (pollInterval) clearInterval(pollInterval); });
</script>

{#snippet toolStatusIcon(status: string, size = 'h-3.5 w-3.5')}
  {#if status === 'error'}
    <CircleAlert class="{size} shrink-0 text-red-600 dark:text-red-300" />
  {:else if status === 'completed'}
    <Check class="{size} shrink-0 text-emerald-600 dark:text-emerald-300" />
  {:else}
    <Wrench class="{size} shrink-0 text-cyan-600 dark:text-cyan-300" />
  {/if}
{/snippet}

{#snippet renderBlock(block: TranscriptBlock, i: number)}
  {#if block.type === 'message'}
    <div>
      {#if block.role === 'user'}
        <div class="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <User class="h-3.5 w-3.5" />
          <span>User</span>
        </div>
      {/if}
      <MarkdownBody content={block.text} class="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-sm" />
      {#if block.streaming}
        <div class="mt-2 inline-flex items-center gap-1 text-[10px] font-medium italic text-muted-foreground">
          <span class="relative flex h-1.5 w-1.5">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70"></span>
            <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-current"></span>
          </span>
          Streaming
        </div>
      {/if}
    </div>

  {:else if block.type === 'thinking'}
    <div class="italic text-foreground/70 text-sm leading-6">
      <MarkdownBody content={block.text} class="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 italic text-foreground/70" />
    </div>

  {:else if block.type === 'tool'}
    {@const open = openBlocks.has(i)}
    {@const parsed = parseStructuredResult(block.result)}
    {@const summary = block.status === 'running'
      ? summarizeToolInput(block.name, block.input)
      : block.status === 'completed' && parsed?.body
        ? trunc(parsed.body.split('\n')[0] ?? parsed.body, 140)
        : summarizeToolResult(block.result, block.isError)}
    {@const statusTone = block.status === 'running' ? 'text-cyan-700 dark:text-cyan-300' : block.status === 'error' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}
    <div class="{block.status === 'error' ? 'rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3' : ''}">
      <div class="flex items-start gap-2">
        <span class="mt-0.5">{@render toolStatusIcon(block.status)}</span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{block.name}</span>
            <span class="text-[10px] font-semibold uppercase tracking-[0.14em] {statusTone}">{block.status === 'running' ? 'Running' : block.status === 'error' ? 'Errored' : 'Completed'}</span>
          </div>
          <div class="mt-1 break-words text-foreground/80 text-sm">{summary}</div>
        </div>
        <button
          class="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          onclick={() => toggleBlock(i)}
        >
          {#if open}<ChevronDown class="h-4 w-4" />{:else}<ChevronRight class="h-4 w-4" />{/if}
        </button>
      </div>
      {#if open}
        <div class="mt-3 {block.status === 'error' ? 'rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3' : ''}">
          <div class="grid gap-3 lg:grid-cols-2">
            <div>
              <div class="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Input</div>
              <pre class="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">{formatToolPayload(block.input) || '<empty>'}</pre>
            </div>
            <div>
              <div class="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Result</div>
              <pre class="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] {block.status === 'error' ? 'text-red-700 dark:text-red-300' : 'text-foreground/80'}">{block.result ? formatToolPayload(block.result) : 'Waiting for result...'}</pre>
            </div>
          </div>
        </div>
      {/if}
    </div>

  {:else if block.type === 'command_group'}
    {@const open = openBlocks.has(i)}
    {@const hasError = block.items.some(it => it.status === 'error')}
    {@const isRunning = block.items.some(it => it.status === 'running')}
    {@const title = isRunning ? 'Executing command' : block.items.length === 1 ? 'Executed command' : `Executed ${block.items.length} commands`}
    {@const runningItem = [...block.items].reverse().find(it => it.status === 'running')}
    {@const subtitle = runningItem ? summarizeToolInput('command_execution', runningItem.input) : null}
    <div class="{open && hasError ? 'rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3' : ''}">
      <div class="flex cursor-pointer gap-2 {subtitle ? 'items-start' : 'items-center'}" role="button" tabindex="0"
        onclick={() => toggleBlock(i)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBlock(i); } }}>
        <div class="flex shrink-0 {subtitle ? 'mt-0.5' : ''} items-center">
          {#each block.items.slice(0, Math.min(block.items.length, 3)) as _, idx}
            <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-sm {idx > 0 ? '-ml-2' : ''} {isRunning ? 'bg-cyan-50 border-background/70 dark:bg-cyan-900/30' : hasError ? 'bg-red-50 border-background/70 dark:bg-red-900/30' : 'bg-muted border-background/70'}">
              <TerminalSquare class="h-3.5 w-3.5 shrink-0 text-foreground/70" />
            </span>
          {/each}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</span>
            <span class="text-[10px] font-semibold uppercase tracking-[0.14em] {isRunning ? 'text-cyan-700 dark:text-cyan-300' : 'text-foreground/70'}">{isRunning ? 'Running' : hasError ? 'Error' : 'Done'}</span>
          </div>
          {#if subtitle}<div class="mt-1 break-words text-foreground/80 text-sm">{subtitle}</div>{/if}
        </div>
        <div class="mt-0.5 inline-flex h-5 w-5 items-center justify-center text-muted-foreground">
          {#if open}<ChevronDown class="h-4 w-4" />{:else}<ChevronRight class="h-4 w-4" />{/if}
        </div>
      </div>
      {#if open}
        <div class="mt-3 space-y-3">
          {#each block.items as item, j}
            <div class="{item.status === 'error' ? 'rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3' : j > 0 ? 'border-t border-border/40 pt-3' : ''}">
              <div class="flex items-start gap-2 mb-2">
                <span class="mt-0.5">{@render toolStatusIcon(item.status)}</span>
                <pre class="flex-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">{summarizeToolInput('command_execution', item.input)}</pre>
              </div>
              {#if item.result}
                <pre class="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] {item.status === 'error' ? 'text-red-700 dark:text-red-300' : 'text-foreground/60'}">{formatToolPayload(item.result)}</pre>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if block.type === 'tool_group'}
    {@const open = openBlocks.has(i)}
    {@const hasError = block.items.some(it => it.status === 'error')}
    {@const isRunning = block.items.some(it => it.status === 'running')}
    <div>
      <div class="flex cursor-pointer items-center gap-2" role="button" tabindex="0"
        onclick={() => toggleBlock(i)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBlock(i); } }}>
        <Wrench class="h-3.5 w-3.5 shrink-0 {isRunning ? 'text-cyan-600' : hasError ? 'text-red-600' : 'text-emerald-600'}" />
        <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{block.items.length} tools</span>
        <span class="text-[10px] font-semibold uppercase tracking-[0.14em] {isRunning ? 'text-cyan-700 dark:text-cyan-300' : hasError ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}">{isRunning ? 'Running' : hasError ? 'Error' : 'Done'}</span>
        <div class="ml-auto inline-flex h-5 w-5 items-center justify-center text-muted-foreground">
          {#if open}<ChevronDown class="h-4 w-4" />{:else}<ChevronRight class="h-4 w-4" />{/if}
        </div>
      </div>
      {#if open}
        <div class="mt-2 space-y-2 pl-5">
          {#each block.items as item}
            <div class="flex items-start gap-2">
              <span class="mt-0.5">{@render toolStatusIcon(item.status, 'h-3 w-3')}</span>
              <div>
                <div class="text-[11px] font-semibold text-muted-foreground">{item.name}</div>
                <div class="text-xs text-foreground/70 mt-0.5">{summarizeToolResult(item.result, item.isError)}</div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

  {:else if block.type === 'stderr_group'}
    {@const open = openBlocks.has(i)}
    <div class="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-2 text-amber-700 dark:text-amber-300">
      <div class="flex cursor-pointer items-center gap-2" role="button" tabindex="0"
        onclick={() => toggleBlock(i)}
        onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBlock(i); } }}>
        <span class="text-[10px] font-semibold uppercase">{block.lines.length} log {block.lines.length === 1 ? 'line' : 'lines'}</span>
        {#if open}<ChevronDown class="h-3.5 w-3.5" />{:else}<ChevronRight class="h-3.5 w-3.5" />{/if}
      </div>
      {#if open}
        <pre class="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] pl-2">{block.lines.map(l => l.text).join('\n')}</pre>
      {/if}
    </div>

  {:else if block.type === 'stdout'}
    <pre class="whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/70">{block.text}</pre>

  {:else if block.type === 'activity'}
    <div class="flex items-start gap-2">
      {#if block.status === 'completed'}
        <Check class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
      {:else}
        <span class="relative mt-1 flex h-2.5 w-2.5 shrink-0">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-70"></span>
          <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
        </span>
      {/if}
      <div class="break-words text-foreground/80">{block.name}</div>
    </div>

  {:else if block.type === 'event'}
    {#if block.tone === 'error'}
      <div class="rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-red-700 dark:text-red-300">
        <div class="flex items-start gap-2">
          <CircleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="whitespace-pre-wrap break-words text-sm">{block.text}</div>
          </div>
        </div>
      </div>
    {:else if block.label === 'result'}
      <div class="whitespace-pre-wrap break-words text-sky-700 dark:text-sky-300 text-sm">{block.text}</div>
    {:else}
      <div class="flex items-start gap-2 text-xs {block.tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : 'text-foreground/75'}">
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{block.label}</span>
          {#if block.text}<span class="ml-2 break-all">{block.text}</span>{/if}
        </div>
      </div>
    {/if}
  {/if}
{/snippet}

<PageLayout title={run?.agentName ? `Run — ${run.agentName}` : `Run ${$page.params.runId.slice(0, 8)}`} fullWidth>
<div class="flex min-h-screen">
  <!-- ====================================================== -->
  <!-- LEFT SIDEBAR: Runs list -->
  <!-- ====================================================== -->
  {#if !loading && run?.agentId}
    <aside class="hidden lg:block w-72 shrink-0 border-r border-border overflow-y-auto">
      <div class="p-3">
        <a href="/{prefix}/runs" class="text-xs text-muted-foreground hover:text-foreground transition-colors">
          &larr; All runs
        </a>
      </div>
      <div class="divide-y divide-border">
        {#each agentRuns as r (r.id)}
          {@const si = runStatusIcon(r.status)}
          {@const StatusIcon = si.icon}
          {@const isSelected = r.id === runId}
          {@const usage = r.usageJson as Record<string, unknown> | null}
          {@const totalTokens = (usage?.totalTokens ?? usage?.inputTokens) as number | undefined}
          {@const costCents = usage?.costCents as number | undefined}
          <a
            href="/{prefix}/runs/{r.id}"
            class="flex items-start gap-2 px-3 py-2.5 text-xs no-underline transition-colors border-b border-border last:border-b-0
              {isSelected ? 'bg-accent/40' : 'hover:bg-accent/20'}"
          >
            <StatusIcon class="h-3.5 w-3.5 shrink-0 mt-0.5 {si.color}" />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-mono text-xs text-muted-foreground">{r.identifier?.slice(0, 8) ?? r.id.slice(0, 8)}</span>
                {#if sourceLabel(r.invocationSource)}
                  <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium {sourceColor(r.invocationSource)}">
                    {sourceLabel(r.invocationSource)}
                  </span>
                {/if}
                <span class="text-[11px] text-muted-foreground ml-auto shrink-0">
                  <TimeAgo date={r.createdAt ?? r.startedAt} class="!text-[11px]" />
                </span>
              </div>
              {#if r.error || r.summary || r.resultJson}
                <p class="mt-0.5 truncate text-muted-foreground text-[10px] pl-[22px]">
                  {(r.error ?? r.summary ?? (r.resultJson ? JSON.stringify(r.resultJson).slice(0, 60) : '')).slice(0, 60)}
                </p>
              {/if}
              {#if totalTokens || costCents}
                <div class="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground pl-[22px]">
                  {#if totalTokens}<span>{formatTokens(totalTokens)} tok</span>{/if}
                  {#if costCents != null && costCents > 0}<span>${(costCents / 100).toFixed(3)}</span>{/if}
                </div>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    </aside>
  {/if}

  <!-- ====================================================== -->
  <!-- MAIN CONTENT                                            -->
  <!-- ====================================================== -->
  <div class="flex-1 min-w-0 p-6 space-y-4">
  {#if loading}
    <PageSkeleton showSidebar={false} />
  {:else if !run}
    <p class="text-destructive">Run not found.</p>
  {:else}

    <!-- Agent Header -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <button class="flex h-12 w-12 items-center justify-center rounded-lg bg-accent hover:bg-accent/80 transition-colors" title="Agent icon">
          <Bot class="h-6 w-6 text-muted-foreground" />
        </button>
        <div>
          <h2 class="text-2xl font-bold text-foreground">{run.agentName ?? 'Agent'}</h2>
          {#if run.agentId}
            <a href="/{prefix}/agents/{run.agentId}" class="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {run.agentName ?? run.agentId.slice(0, 8)}
            </a>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Assign Task -->
        <a
          href="/{prefix}/issues/new?assigneeAgentId={run.agentId}"
          class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Plus class="h-3.5 w-3.5" />
          Assign Task
        </a>
        <!-- Run Heartbeat -->
        <button
          class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          onclick={async () => {
            try {
              const res = await api(`/api/agents/${run!.agentId}/wakeup`, { method: 'POST', body: JSON.stringify({ source: 'on_demand', triggerDetail: 'manual' }) });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const result = await res.json();
              if (result?.id) goto(`/${prefix}/runs/${result.id}`);
              else toastStore.push({ title: 'Run was skipped', tone: 'warn' });
            } catch (err) { toastStore.push({ title: 'Failed to run heartbeat', tone: 'error' }); }
          }}
        >
          <Play class="h-3.5 w-3.5" />
          Run Heartbeat
        </button>
        <!-- Pause -->
        {#if run.status === 'running' || run.status === 'queued'}
          <button
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
            onclick={cancelRun}
          >
            <Pause class="h-3.5 w-3.5" />
            Pause
          </button>
        {/if}
        <!-- Status badge -->
        {#if run.status}
          <StatusBadge status={run.status} />
        {/if}
      </div>
    </div>

    <!-- ====================================================== -->
    <!-- Summary Card                                            -->
    <!-- ====================================================== -->
    <div class="border border-border rounded-lg overflow-hidden">
      <div class="flex flex-col sm:flex-row">
        <!-- Left: status + timing + error -->
        <div class="flex-1 p-4 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <StatusBadge status={run.status ?? 'unknown'} />
            {#if sourceLabel(run.invocationSource)}
              <Badge variant="secondary" class="text-[10px] {sourceColor(run.invocationSource)}">
                {sourceLabel(run.invocationSource)}
              </Badge>
            {/if}
            {#if run.status === 'running' || run.status === 'queued'}
              <button class="text-destructive text-xs h-6 px-2 rounded-md hover:bg-destructive/10 transition-colors" onclick={cancelRun}>
                Cancel
              </button>
            {/if}
            {#if run.status === 'failed' || run.status === 'timed_out'}
              <button
                class="inline-flex items-center gap-1 text-xs h-6 px-2 rounded-md hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground"
                onclick={retryRun}
                disabled={retrying}
              >
                <RotateCcw class="h-3 w-3 {retrying ? 'animate-spin' : ''}" />
                Retry
              </button>
            {/if}
          </div>
          {#if startTime}
            <div class="space-y-0.5">
              <div class="text-sm font-mono">
                {startTime}{#if endTime}<span class="text-muted-foreground"> → </span>{endTime}{/if}
              </div>
              <div class="text-[11px] text-muted-foreground">
                {#if run.startedAt}<TimeAgo date={run.startedAt} class="text-[11px]" />{/if}
                {#if run.finishedAt}<span> → </span><TimeAgo date={run.finishedAt} class="text-[11px]" />{/if}
              </div>
              {#if duration}<div class="text-xs text-muted-foreground">Duration: {duration}</div>{/if}
            </div>
          {:else if run.createdAt}
            <div class="text-[11px] text-muted-foreground"><TimeAgo date={run.createdAt} class="text-[11px]" /></div>
          {/if}
          {#if run.error || run.errorMessage}
            <div class="text-xs">
              <span class="text-red-600 dark:text-red-400">{run.errorMessage ?? run.error}</span>
              {#if run.errorCode}<span class="text-muted-foreground ml-1">({run.errorCode})</span>{/if}
            </div>
          {/if}
          {#if run.exitCode != null && run.exitCode !== 0}
            <div class="text-xs text-red-600 dark:text-red-400">
              Exit code {run.exitCode}{#if run.signal}<span class="text-muted-foreground ml-1">(signal: {run.signal})</span>{/if}
            </div>
          {/if}
        </div>

        <!-- Right: metrics -->
        {#if metrics}
          <div class="border-t sm:border-t-0 sm:border-l border-border p-4 grid grid-cols-2 gap-x-8 gap-y-3 content-center tabular-nums">
            <div><div class="text-xs text-muted-foreground">Input</div><div class="text-sm font-medium font-mono">{formatTokens(metrics.input)}</div></div>
            <div><div class="text-xs text-muted-foreground">Output</div><div class="text-sm font-medium font-mono">{formatTokens(metrics.output)}</div></div>
            <div><div class="text-xs text-muted-foreground">Cached</div><div class="text-sm font-medium font-mono">{formatTokens(metrics.cached)}</div></div>
            <div><div class="text-xs text-muted-foreground">Cost</div><div class="text-sm font-medium font-mono">{metrics.costUsd > 0 ? `$${metrics.costUsd.toFixed(4)}` : '—'}</div></div>
          </div>
        {/if}
      </div>

      <!-- Session row -->
      {#if hasSession}
        <div class="border-t border-border">
          <button class="flex items-center gap-1.5 w-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors" onclick={() => sessionOpen = !sessionOpen}>
            <ChevronRight class="h-3 w-3 transition-transform {sessionOpen ? 'rotate-90' : ''}" />
            Session{#if sessionChanged}<span class="text-yellow-400 ml-1">(changed)</span>{/if}
          </button>
          {#if sessionOpen}
            <div class="px-4 pb-3 space-y-1 text-xs">
              {#if run.sessionIdBefore}
                <div class="flex items-center gap-2">
                  <span class="text-muted-foreground w-12">{sessionChanged ? 'Before' : 'ID'}</span>
                  <code class="font-mono text-foreground break-all">{run.sessionIdBefore}</code>
                </div>
              {/if}
              {#if sessionChanged && run.sessionIdAfter}
                <div class="flex items-center gap-2">
                  <span class="text-muted-foreground w-12">After</span>
                  <code class="font-mono text-foreground break-all">{run.sessionIdAfter}</code>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- ====================================================== -->
    <!-- Issues Touched                                          -->
    <!-- ====================================================== -->
    {#if touchedIssues.length > 0}
      <div class="space-y-2">
        <span class="text-xs font-medium text-muted-foreground">Issues Touched ({touchedIssues.length})</span>
        <div class="border border-border rounded-lg divide-y divide-border">
          {#each touchedIssues as issue}
            <a href="/{prefix}/issues/{issue.identifier ?? issue.issueId}" class="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-accent/20 transition-colors no-underline text-inherit">
              <div class="flex items-center gap-2 min-w-0">
                {#if issue.status}<StatusBadge status={issue.status} />{/if}
                <span class="truncate">{issue.title ?? issue.issueId}</span>
              </div>
              {#if issue.identifier}<span class="shrink-0 text-muted-foreground font-mono ml-2">{issue.identifier}</span>{/if}
            </a>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ====================================================== -->
    <!-- stderr excerpt (shown outside log when failed)         -->
    <!-- ====================================================== -->
    {#if run.stderrExcerpt && !logText}
      <div class="space-y-1">
        <span class="text-xs font-medium text-red-600 dark:text-red-400">stderr</span>
        <pre class="bg-neutral-100 dark:bg-neutral-950 rounded-md p-3 text-xs font-mono text-red-700 dark:text-red-300 overflow-x-auto whitespace-pre-wrap">{run.stderrExcerpt}</pre>
      </div>
    {/if}
    {#if run.stdoutExcerpt && !run.logRef && !logText}
      <div class="space-y-1">
        <span class="text-xs font-medium text-muted-foreground">stdout</span>
        <pre class="bg-neutral-100 dark:bg-neutral-950 rounded-md p-3 text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{run.stdoutExcerpt}</pre>
      </div>
    {/if}

    <!-- ====================================================== -->
    <!-- Log Viewer                                              -->
    <!-- ====================================================== -->
    <div class="space-y-3">

      <!-- Workspace Operations -->
      {#if workspaceOps.length > 0}
        <div class="rounded-lg border border-border bg-background/60 p-3 space-y-3">
          <div class="text-xs font-medium text-muted-foreground">Workspace ({workspaceOps.length})</div>
          <div class="space-y-3">
            {#each workspaceOps as op}
              {@const meta = op.metadata ?? {}}
              <div class="rounded-md border border-border/70 bg-background/70 p-3 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="text-sm font-medium">{wsPhaseLabel(op.phase)}</div>
                  <span class="text-xs font-medium {wsStatusColor(op.status)}">{humanize(op.status)}</span>
                  {#if op.startedAt}<div class="text-[11px] text-muted-foreground"><TimeAgo date={op.startedAt} class="text-[11px]" /></div>{/if}
                </div>
                {#if op.command}<div class="text-xs break-all"><span class="text-muted-foreground">Command: </span><span class="font-mono">{op.command}</span></div>{/if}
                {#if op.cwd}<div class="text-xs break-all"><span class="text-muted-foreground">Working dir: </span><span class="font-mono">{op.cwd}</span></div>{/if}
                {#if typeof meta.branchName === 'string' || typeof meta.worktreePath === 'string' || typeof meta.repoRoot === 'string'}
                  <div class="grid gap-1 text-xs sm:grid-cols-2">
                    {#if typeof meta.branchName === 'string'}<div><span class="text-muted-foreground">Branch: </span><span class="font-mono">{meta.branchName}</span></div>{/if}
                    {#if typeof meta.baseRef === 'string'}<div><span class="text-muted-foreground">Base ref: </span><span class="font-mono">{meta.baseRef}</span></div>{/if}
                    {#if typeof meta.worktreePath === 'string'}<div class="break-all"><span class="text-muted-foreground">Worktree: </span><span class="font-mono">{meta.worktreePath}</span></div>{/if}
                    {#if typeof meta.repoRoot === 'string'}<div class="break-all"><span class="text-muted-foreground">Repo root: </span><span class="font-mono">{meta.repoRoot}</span></div>{/if}
                  </div>
                {/if}
                {#if typeof meta.created === 'boolean'}<div class="text-xs text-muted-foreground">{meta.created ? 'Created by this run' : 'Reused existing workspace'}</div>{/if}
                {#if op.stderrExcerpt?.trim()}
                  <div>
                    <div class="mb-1 text-xs text-red-700 dark:text-red-300">stderr excerpt</div>
                    <pre class="rounded-md bg-red-50 p-2 text-xs whitespace-pre-wrap break-all text-red-800 dark:bg-neutral-950 dark:text-red-100">{op.stderrExcerpt}</pre>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Invocation (from adapter.invoke event) -->
      {#if adapterInvokePayload}
        <div class="rounded-lg border border-border bg-background/60 p-3 space-y-2">
          <div class="text-xs font-medium text-muted-foreground">Invocation</div>
          {#if typeof adapterInvokePayload.adapterType === 'string'}
            <div class="text-xs"><span class="text-muted-foreground">Adapter: </span>{adapterInvokePayload.adapterType}</div>
          {/if}
          {#if typeof adapterInvokePayload.cwd === 'string'}
            <div class="text-xs break-all"><span class="text-muted-foreground">Working dir: </span><span class="font-mono">{adapterInvokePayload.cwd}</span></div>
          {/if}
          {#if typeof adapterInvokePayload.command === 'string'}
            <div class="text-xs break-all">
              <span class="text-muted-foreground">Command: </span>
              <span class="font-mono">{[adapterInvokePayload.command, ...(Array.isArray(adapterInvokePayload.commandArgs) ? adapterInvokePayload.commandArgs.filter((v): v is string => typeof v === 'string') : [])].join(' ')}</span>
            </div>
          {/if}
          {#if Array.isArray(adapterInvokePayload.commandNotes) && adapterInvokePayload.commandNotes.length > 0}
            <div>
              <div class="text-xs text-muted-foreground mb-1">Command notes</div>
              <ul class="list-disc pl-5 space-y-1">
                {#each adapterInvokePayload.commandNotes.filter((v: unknown): v is string => typeof v === 'string' && v.trim().length > 0) as note}
                  <li class="text-xs break-all font-mono">{note}</li>
                {/each}
              </ul>
            </div>
          {/if}
          {#if adapterInvokePayload.prompt !== undefined}
            <div>
              <div class="text-xs text-muted-foreground mb-1">Prompt</div>
              <pre class="bg-neutral-100 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap">{typeof adapterInvokePayload.prompt === 'string' ? adapterInvokePayload.prompt : JSON.stringify(adapterInvokePayload.prompt, null, 2)}</pre>
            </div>
          {/if}
          {#if adapterInvokePayload.context !== undefined}
            <div>
              <div class="text-xs text-muted-foreground mb-1">Context</div>
              <pre class="bg-neutral-100 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(adapterInvokePayload.context, null, 2)}</pre>
            </div>
          {/if}
          {#if adapterInvokePayload.env !== undefined}
            {@const env = typeof adapterInvokePayload.env === 'object' && adapterInvokePayload.env !== null ? adapterInvokePayload.env as Record<string, unknown> : null}
            <div>
              <div class="text-xs text-muted-foreground mb-1">Environment</div>
              <pre class="bg-neutral-100 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap font-mono">{env ? Object.keys(env).sort().map(k => `${k}=${env[k]}`).join('\n') : String(adapterInvokePayload.env)}</pre>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Transcript header -->
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-muted-foreground">
          Transcript ({transcriptBlocks.length})
        </span>
        <div class="flex items-center gap-2">
          <div class="inline-flex rounded-lg border border-border/70 bg-background/70 p-0.5">
            {#each (['nice', 'raw'] as const) as mode}
              <button
                class="rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors {transcriptMode === mode ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
                onclick={() => transcriptMode = mode}
              >{mode}</button>
            {/each}
          </div>
          {#if isLive}
            <span class="flex items-center gap-1 text-xs text-cyan-400">
              <span class="relative flex h-2 w-2">
                <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              Live
            </span>
          {/if}
        </div>
      </div>

      <!-- Transcript container -->
      <div class="max-h-[38rem] overflow-y-auto rounded-2xl border border-border/70 bg-background/40 p-3 sm:p-4 relative"
        bind:this={transcriptContainer}
        onscroll={handleScroll}>
        {#if logLoading}
          <p class="text-xs text-muted-foreground">Loading run logs...</p>
        {:else if transcriptMode === 'raw'}
          {#if transcriptEntries.length === 0}
            <p class="text-xs text-muted-foreground italic">{run.logRef ? 'Waiting for transcript...' : 'No persisted transcript for this run.'}</p>
          {:else}
            <div class="font-mono space-y-1 text-[11px]">
              {#each transcriptEntries as entry, idx (`${entry.kind}-${entry.ts}-${idx}`)}
                <div class="grid gap-x-3 grid-cols-[auto_1fr]">
                  <span class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{entry.kind}</span>
                  <pre class="min-w-0 whitespace-pre-wrap break-words text-foreground/80">{
                    entry.kind === 'tool_call' ? `${entry.name}\n${formatToolPayload(entry.input)}`
                    : entry.kind === 'tool_result' ? formatToolPayload(entry.content)
                    : entry.kind === 'result' ? `${entry.text}\n${formatTokens(entry.inputTokens)} in / ${formatTokens(entry.outputTokens)} out / $${entry.costUsd.toFixed(6)}`
                    : entry.kind === 'init' ? `model=${entry.model}${entry.sessionId ? ` session=${entry.sessionId}` : ''}`
                    : entry.text
                  }</pre>
                </div>
              {/each}
            </div>
          {/if}
        {:else if transcriptBlocks.length === 0}
          <p class="text-xs text-muted-foreground italic">{run.logRef ? 'Waiting for transcript...' : 'No persisted transcript for this run.'}</p>
        {:else}
          <div class="space-y-3">
            {#each transcriptBlocks as block, i (i)}
              {@render renderBlock(block, i)}
            {/each}
          </div>
        {/if}

        {#if showScrollBtn}
          <button class="sticky bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background shadow-lg hover:opacity-90 transition-opacity z-10" onclick={scrollToBottom}>
            ↓ Jump to live
          </button>
        {/if}
      </div>

      <!-- Failure details -->
      {#if run.status === 'failed' || run.status === 'timed_out'}
        <div class="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
          <div class="text-xs font-medium text-red-700 dark:text-red-300">Failure details</div>
          {#if run.error}
            <div class="text-xs text-red-600 dark:text-red-200">
              <span class="text-red-700 dark:text-red-300">Error: </span>{run.error}
            </div>
          {/if}
          {#if run.stderrExcerpt?.trim()}
            <div>
              <div class="text-xs text-red-700 dark:text-red-300 mb-1">stderr excerpt</div>
              <pre class="bg-red-50 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-100">{run.stderrExcerpt}</pre>
            </div>
          {/if}
          {#if run.resultJson}
            <div>
              <div class="text-xs text-red-700 dark:text-red-300 mb-1">adapter result JSON</div>
              <pre class="bg-red-50 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-100">{JSON.stringify(run.resultJson, null, 2)}</pre>
            </div>
          {/if}
          {#if run.stdoutExcerpt?.trim() && !run.resultJson}
            <div>
              <div class="text-xs text-red-700 dark:text-red-300 mb-1">stdout excerpt</div>
              <pre class="bg-red-50 dark:bg-neutral-950 rounded-md p-2 text-xs overflow-x-auto whitespace-pre-wrap text-red-800 dark:text-red-100">{run.stdoutExcerpt}</pre>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Events -->
      {#if events.length > 0}
        <div>
          <div class="mb-2 text-xs font-medium text-muted-foreground">Events ({events.length})</div>
          <div class="bg-neutral-100 dark:bg-neutral-950 rounded-lg p-3 font-mono text-xs space-y-0.5">
            {#each events as evt}
              {@const levelColors: Record<string, string> = { info: 'text-foreground', warn: 'text-yellow-600 dark:text-yellow-400', error: 'text-red-600 dark:text-red-400' }}
              {@const streamColors: Record<string, string> = { stdout: 'text-foreground', stderr: 'text-red-600 dark:text-red-300', system: 'text-blue-600 dark:text-blue-300' }}
              {@const color = evt.color ?? (evt.level ? levelColors[evt.level] : null) ?? (evt.stream ? streamColors[evt.stream] : null) ?? 'text-foreground'}
              <div class="flex gap-2">
                <span class="text-neutral-400 dark:text-neutral-600 shrink-0 select-none w-16">
                  {new Date(evt.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <span class="shrink-0 w-14 {evt.stream ? (streamColors[evt.stream] ?? 'text-neutral-500') : 'text-neutral-500'}">
                  {evt.stream ? `[${evt.stream}]` : ''}
                </span>
                <span class="break-all {color}">
                  {evt.message ?? (evt.payload ? JSON.stringify(evt.payload) : '')}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

  {/if}
  </div>
</div>
</PageLayout>
