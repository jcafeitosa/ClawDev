<script lang="ts">
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import {
    summarizeToolInput,
    summarizeToolResult,
    type TranscriptBlock,
  } from '$lib/transcript/run-transcript';
  import {
    Bot, Check, ChevronDown, ChevronRight, CircleAlert,
    TerminalSquare, User, Wrench, Brain, AlertTriangle,
    FileText, Zap,
  } from 'lucide-svelte';

  interface Props {
    blocks: TranscriptBlock[];
    live?: boolean;
    limit?: number;
    emptyMessage?: string;
  }

  let { blocks, live = false, limit = 8, emptyMessage = 'No transcript captured.' }: Props = $props();

  let previewBlocks = $derived(blocks.slice(-limit));
  let expandedSet = $state<Set<number>>(new Set());

  function toggle(idx: number) {
    const next = new Set(expandedSet);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    expandedSet = next;
  }

  // ── Helpers ────────────────────────────────────────────────────

  function blockTone(block: TranscriptBlock): string {
    if (block.type === 'message') {
      return block.role === 'assistant'
        ? 'border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'border-violet-500/20 bg-violet-500/[0.06]';
    }
    if (block.type === 'thinking') return 'border-sky-500/20 bg-sky-500/[0.06]';
    if (block.type === 'tool') return block.isError
      ? 'border-red-500/20 bg-red-500/[0.06]'
      : block.status === 'running'
        ? 'border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'border-emerald-500/20 bg-emerald-500/[0.06]';
    if (block.type === 'tool_group') return block.items.some((i) => i.isError)
      ? 'border-red-500/20 bg-red-500/[0.06]'
      : block.items.some((i) => i.status === 'running')
        ? 'border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'border-emerald-500/20 bg-emerald-500/[0.06]';
    if (block.type === 'command_group') return block.items.some((i) => i.isError)
      ? 'border-red-500/20 bg-red-500/[0.06]'
      : block.items.some((i) => i.status === 'running')
        ? 'border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'border-emerald-500/20 bg-emerald-500/[0.06]';
    if (block.type === 'stderr_group') return 'border-amber-500/20 bg-amber-500/[0.06]';
    if (block.type === 'stdout') return 'border-border/60 bg-background/60';
    if (block.type === 'activity') return block.status === 'completed'
      ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
      : 'border-cyan-500/20 bg-cyan-500/[0.06]';
    if (block.type === 'event') {
      if (block.tone === 'error') return 'border-red-500/20 bg-red-500/[0.06]';
      if (block.tone === 'warn') return 'border-amber-500/20 bg-amber-500/[0.06]';
    }
    return 'border-border/60 bg-background/60';
  }

  function statusColor(status: string, isError?: boolean): string {
    if (isError || status === 'error') return 'text-red-600 dark:text-red-300';
    if (status === 'running') return 'text-cyan-600 dark:text-cyan-300';
    return 'text-emerald-600 dark:text-emerald-300';
  }

  function iconBg(status: string, isError?: boolean): string {
    if (isError || status === 'error') return 'border-red-500/25 bg-red-500/[0.08] text-red-600 dark:text-red-300';
    if (status === 'running') return 'border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-600 dark:text-cyan-300';
    return 'border-border/70 bg-background text-foreground/55';
  }

  function isCommandLike(block: TranscriptBlock) {
    return block.type === 'command_group';
  }
  function isToolLike(block: TranscriptBlock) {
    return block.type === 'tool' || block.type === 'tool_group';
  }

  function commandTitle(block: Extract<TranscriptBlock, { type: 'command_group' }>): string {
    const running = block.items.some((i) => i.status === 'running');
    if (running) return 'Executing command';
    return block.items.length === 1 ? 'Executed command' : `Executed ${block.items.length} commands`;
  }

  function toolGroupTitle(block: Extract<TranscriptBlock, { type: 'tool_group' }>): string {
    const running = block.items.some((i) => i.status === 'running');
    const names = [...new Set(block.items.map((i) => i.name))];
    const label = names.length === 1 ? names[0] : `${names.length} tools`;
    if (running) return `Using ${label}`;
    return block.items.length === 1 ? `Used ${label}` : `Used ${label} (${block.items.length} calls)`;
  }

  function commandSubtitle(block: Extract<TranscriptBlock, { type: 'command_group' }>): string {
    const running = [...block.items].reverse().find((i) => i.status === 'running');
    if (running) return summarizeToolInput('command_execution', running.input);
    const last = block.items[block.items.length - 1];
    return last ? summarizeToolInput('command_execution', last.input) : '';
  }

  function blockBody(block: TranscriptBlock): string {
    if (block.type === 'message') return block.text;
    if (block.type === 'thinking') return block.text;
    if (block.type === 'tool') return block.status === 'running'
      ? summarizeToolInput(block.name, block.input)
      : summarizeToolResult(block.result, block.isError);
    if (block.type === 'tool_group') return block.items.map((item) =>
      summarizeToolResult(item.result, item.isError) || summarizeToolInput(item.name, item.input)
    ).join('\n');
    if (block.type === 'stderr_group') return block.lines.map((l) => l.text).join('\n');
    if (block.type === 'stdout') return block.text;
    if (block.type === 'activity') return block.name;
    return '';
  }

  function trunc(s: string, max = 120): string {
    return s.length > max ? s.slice(0, max - 1) + '...' : s;
  }

  function formatPayload(v: unknown): string {
    if (typeof v === 'string') { try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; } }
    try { return JSON.stringify(v, null, 2); } catch { return String(v ?? ''); }
  }
</script>

<div class="space-y-2">
  <!-- Header -->
  <div class="flex items-center justify-between gap-3">
    <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      Transcript ({blocks.length})
    </span>
    {#if live}
      <span class="flex items-center gap-1 text-[10px] font-medium text-cyan-500">
        <span class="relative flex h-2 w-2">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-cyan-400"></span>
        </span>
        Live
      </span>
    {/if}
  </div>

  {#if previewBlocks.length === 0}
    <p class="text-[10px] italic text-muted-foreground/60">{emptyMessage}</p>
  {:else}
    <div class="space-y-2">
      {#each previewBlocks as block, idx (`${block.type}-${block.ts}-${idx}`)}
        {@const expanded = expandedSet.has(idx)}

        <!-- ═══ COMMAND GROUP ═══ -->
        {#if block.type === 'command_group'}
          {@const running = block.items.some((i) => i.status === 'running')}
          {@const hasError = block.items.some((i) => i.isError)}

          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="flex cursor-pointer items-start gap-2" onclick={() => toggle(idx)}>
              <!-- Stacked terminal icons -->
              <div class="flex shrink-0 items-center mt-0.5">
                {#each block.items.slice(0, Math.min(block.items.length, 3)) as _, i}
                  <span
                    class="inline-flex h-5 w-5 items-center justify-center rounded-full border shadow-sm {i > 0 ? '-ml-1.5' : ''} {iconBg(running ? 'running' : hasError ? 'error' : 'completed')} {running ? 'animate-pulse' : ''}"
                  >
                    <TerminalSquare size={12} />
                  </span>
                {/each}
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-muted-foreground/70">
                  {commandTitle(block)}
                </div>
                <div class="mt-1 break-words font-mono text-[10px] leading-4 text-foreground/85">
                  {trunc(commandSubtitle(block), 80)}
                </div>
                {#if !running}
                  <div class="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] {hasError ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}">
                    {hasError ? 'Error' : 'Done'}
                  </div>
                {/if}
              </div>
              <button
                type="button"
                class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                onclick={(e) => { e.stopPropagation(); toggle(idx); }}
              >
                {#if expanded}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
              </button>
            </div>

            {#if expanded}
              <div class="mt-2 space-y-2 border-t border-border/40 pt-2">
                {#each block.items as item, i}
                  <div class="flex items-start gap-2">
                    <span class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border {iconBg(item.status, item.isError)}">
                      <TerminalSquare size={10} />
                    </span>
                    <div class="min-w-0 flex-1">
                      <pre class="m-0 whitespace-pre-wrap break-all font-mono text-[10px] leading-4 text-foreground/80">{summarizeToolInput('command_execution', item.input)}</pre>
                      {#if item.result}
                        <pre class="m-0 mt-1 whitespace-pre-wrap break-words font-mono text-[9px] leading-3.5 {item.isError ? 'text-red-700 dark:text-red-300' : 'text-foreground/60'}">{trunc(formatPayload(item.result), 200)}</pre>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        <!-- ═══ TOOL (single) ═══ -->
        {:else if block.type === 'tool'}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)} {block.isError ? 'ring-1 ring-red-500/10' : ''}">
            <div class="flex items-start gap-2">
              <!-- Status icon -->
              <span class="mt-0.5 {statusColor(block.status, block.isError)}">
                {#if block.isError || block.status === 'error'}
                  <CircleAlert size={14} />
                {:else if block.status === 'completed'}
                  <Check size={14} />
                {:else}
                  <Wrench size={14} class="animate-spin-slow" />
                {/if}
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {block.name}
                  </span>
                  <span class="text-[9px] font-semibold uppercase tracking-[0.14em] {statusColor(block.status, block.isError)}">
                    {block.status === 'running' ? 'Running' : block.isError ? 'Error' : 'Done'}
                  </span>
                  <TimeAgo date={block.ts} class="text-[9px] text-muted-foreground/60" />
                </div>
                <pre class="m-0 mt-1 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/80">{trunc(blockBody(block))}</pre>
              </div>

              <button
                type="button"
                class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                onclick={() => toggle(idx)}
              >
                {#if expanded}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
              </button>
            </div>

            {#if expanded}
              <div class="mt-2 grid gap-2 border-t border-border/40 pt-2 {block.isError ? 'rounded-lg border border-red-500/20 bg-red-500/[0.04] p-2' : ''}">
                <div>
                  <div class="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Input</div>
                  <pre class="m-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] text-foreground/80">{formatPayload(block.input) || '<empty>'}</pre>
                </div>
                <div>
                  <div class="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Result</div>
                  <pre class="m-0 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] {block.isError ? 'text-red-700 dark:text-red-300' : 'text-foreground/80'}">{block.result ? formatPayload(block.result) : 'Waiting...'}</pre>
                </div>
              </div>
            {/if}
          </div>

        <!-- ═══ TOOL GROUP ═══ -->
        {:else if block.type === 'tool_group'}
          {@const running = block.items.some((i) => i.status === 'running')}
          {@const hasError = block.items.some((i) => i.isError)}

          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="flex cursor-pointer items-start gap-2" onclick={() => toggle(idx)}>
              <span class="mt-0.5 {statusColor(running ? 'running' : hasError ? 'error' : 'completed')}">
                {#if hasError}<CircleAlert size={14} />{:else if running}<Wrench size={14} class="animate-spin-slow" />{:else}<Check size={14} />{/if}
              </span>
              <div class="min-w-0 flex-1">
                <div class="text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-muted-foreground/70">
                  {toolGroupTitle(block)}
                </div>
                <div class="mt-1 text-[9px] font-semibold uppercase tracking-[0.14em] {statusColor(running ? 'running' : hasError ? 'error' : 'completed')}">
                  {running ? 'Running' : hasError ? 'Error' : 'Done'}
                </div>
              </div>
              <button
                type="button"
                class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                onclick={(e) => { e.stopPropagation(); toggle(idx); }}
              >
                {#if expanded}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
              </button>
            </div>

            {#if expanded}
              <div class="mt-2 space-y-2 border-t border-border/40 pt-2">
                {#each block.items as item, i}
                  <div class="flex items-start gap-2">
                    <span class="mt-0.5 {statusColor(item.status, item.isError)}">
                      {#if item.isError}<CircleAlert size={12} />{:else if item.status === 'completed'}<Check size={12} />{:else}<Wrench size={12} />{/if}
                    </span>
                    <div class="min-w-0 flex-1">
                      <span class="text-[10px] font-semibold uppercase text-muted-foreground">{item.name}</span>
                      <pre class="m-0 mt-0.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/80">{trunc(item.status === 'running' ? summarizeToolInput(item.name, item.input) : summarizeToolResult(item.result, item.isError), 160)}</pre>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

        <!-- ═══ THINKING ═══ -->
        {:else if block.type === 'thinking'}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <div class="flex items-center gap-2">
              <Brain size={12} class="shrink-0 text-sky-600 dark:text-sky-300" />
              <span class="rounded-full border border-sky-500/20 bg-sky-500/[0.1] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                Thinking
              </span>
              <TimeAgo date={block.ts} class="text-[9px] text-muted-foreground/60" />
            </div>
            <div class="mt-1.5">
              <MarkdownBody content={blockBody(block)} class="italic text-foreground/70 text-[11px] leading-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
            </div>
          </div>

        <!-- ═══ MESSAGE ═══ -->
        {:else if block.type === 'message'}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <div class="flex items-center gap-2">
              {#if block.role === 'assistant'}
                <Bot size={12} class="shrink-0 text-cyan-600 dark:text-cyan-300" />
              {:else}
                <User size={12} class="shrink-0 text-violet-600 dark:text-violet-300" />
              {/if}
              {#if block.role !== 'assistant'}
                <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">User</span>
              {/if}
              <TimeAgo date={block.ts} class="text-[9px] text-muted-foreground/60" />
            </div>
            <div class="mt-1.5">
              <MarkdownBody content={blockBody(block)} class="text-[11px] leading-4 text-foreground/85 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
            </div>
            {#if live && block === previewBlocks[previewBlocks.length - 1] && block.role === 'assistant'}
              <div class="mt-1.5 inline-flex items-center gap-1 text-[9px] font-medium italic text-muted-foreground">
                <span class="relative flex h-1.5 w-1.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70"></span>
                  <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-current"></span>
                </span>
                Streaming
              </div>
            {/if}
          </div>

        <!-- ═══ STDERR GROUP ═══ -->
        {:else if block.type === 'stderr_group'}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <div class="flex items-center gap-2">
              <AlertTriangle size={12} class="shrink-0 text-amber-600 dark:text-amber-300" />
              <span class="rounded-full border border-amber-500/20 bg-amber-500/[0.1] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                stderr ({block.lines.length})
              </span>
              <TimeAgo date={block.ts} class="text-[9px] text-muted-foreground/60" />
            </div>
            <pre class="m-0 mt-1.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/80">{trunc(blockBody(block), 200)}</pre>
          </div>

        <!-- ═══ ACTIVITY ═══ -->
        {:else if block.type === 'activity'}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <div class="flex items-center gap-2">
              <Zap size={12} class="shrink-0 {block.status === 'completed' ? 'text-emerald-600 dark:text-emerald-300' : 'text-cyan-600 dark:text-cyan-300'}" />
              <span class="text-[10px] font-semibold text-muted-foreground">{block.name}</span>
              <span class="text-[9px] font-semibold uppercase tracking-[0.14em] {statusColor(block.status)}">
                {block.status === 'completed' ? 'Done' : 'Running'}
              </span>
            </div>
          </div>

        <!-- ═══ EVENT ═══ -->
        {:else if block.type === 'event'}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <div class="flex items-center gap-2">
              <FileText size={12} class="shrink-0 text-muted-foreground" />
              <span class="text-[10px] text-muted-foreground">{block.text}</span>
            </div>
          </div>

        <!-- ═══ STDOUT / FALLBACK ═══ -->
        {:else}
          <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
            <pre class="m-0 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/80">{trunc(blockBody(block), 200)}</pre>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  :global(.animate-spin-slow) {
    animation: spin 3s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
