<script lang="ts">
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import {
    summarizeToolInput,
    summarizeToolResult,
    type TranscriptBlock,
  } from '$lib/transcript/run-transcript';

  interface Props {
    blocks: TranscriptBlock[];
    live?: boolean;
    limit?: number;
    emptyMessage?: string;
  }

  let { blocks, live = false, limit = 8, emptyMessage = 'No transcript captured.' }: Props = $props();

  let previewBlocks = $derived(blocks.slice(-limit));

  function blockLabel(block: TranscriptBlock): string {
    if (block.type === 'message') return block.role === 'assistant' ? 'Assistant' : 'User';
    if (block.type === 'thinking') return 'Thinking';
    if (block.type === 'tool') return block.name;
    if (block.type === 'tool_group') return `${block.items.length} tools`;
    if (block.type === 'command_group') return block.items.length === 1 ? 'Command' : `${block.items.length} commands`;
    if (block.type === 'stderr_group') return 'stderr';
    if (block.type === 'stdout') return 'stdout';
    if (block.type === 'activity') return block.name;
    return 'System';
  }

  function blockTone(block: TranscriptBlock): string {
    if (block.type === 'message') {
      if (block.role === 'assistant') return 'text-cyan-700 dark:text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.06]';
      return 'text-violet-700 dark:text-violet-300 border-violet-500/20 bg-violet-500/[0.06]';
    }
    if (block.type === 'thinking') return 'text-sky-700 dark:text-sky-300 border-sky-500/20 bg-sky-500/[0.06]';
    if (block.type === 'tool') return block.isError
      ? 'text-red-700 dark:text-red-300 border-red-500/20 bg-red-500/[0.06]'
      : block.status === 'running'
        ? 'text-cyan-700 dark:text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'text-emerald-700 dark:text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]';
    if (block.type === 'tool_group') return block.items.some((item) => item.isError)
      ? 'text-red-700 dark:text-red-300 border-red-500/20 bg-red-500/[0.06]'
      : block.items.some((item) => item.status === 'running')
        ? 'text-cyan-700 dark:text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'text-emerald-700 dark:text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]';
    if (block.type === 'command_group') return block.items.some((item) => item.isError)
      ? 'text-red-700 dark:text-red-300 border-red-500/20 bg-red-500/[0.06]'
      : block.items.some((item) => item.status === 'running')
        ? 'text-cyan-700 dark:text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.06]'
        : 'text-emerald-700 dark:text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]';
    if (block.type === 'stderr_group') return 'text-amber-700 dark:text-amber-300 border-amber-500/20 bg-amber-500/[0.06]';
    if (block.type === 'stdout') return 'text-muted-foreground border-border/60 bg-background/60';
    if (block.type === 'activity') return block.status === 'completed'
      ? 'text-emerald-700 dark:text-emerald-300 border-emerald-500/20 bg-emerald-500/[0.06]'
      : 'text-cyan-700 dark:text-cyan-300 border-cyan-500/20 bg-cyan-500/[0.06]';
    if (block.type === 'event') {
      if (block.tone === 'error') return 'text-red-700 dark:text-red-300 border-red-500/20 bg-red-500/[0.06]';
      if (block.tone === 'warn') return 'text-amber-700 dark:text-amber-300 border-amber-500/20 bg-amber-500/[0.06]';
      return 'text-muted-foreground border-border/60 bg-background/60';
    }
    return 'text-muted-foreground border-border/60 bg-background/60';
  }

  function blockBody(block: TranscriptBlock): string {
    if (block.type === 'message') return block.text;
    if (block.type === 'thinking') return block.text;
    if (block.type === 'tool') return block.status === 'running' ? summarizeToolInput(block.name, block.input) : summarizeToolResult(block.result, block.isError);
    if (block.type === 'tool_group') return block.items.map((item) => summarizeToolResult(item.result, item.isError) || summarizeToolInput(item.name, item.input)).join('\n');
    if (block.type === 'command_group') {
      const item = [...block.items].reverse().find((entry) => entry.status === 'running') ?? block.items[0];
      if (!item) return '';
      return summarizeToolInput('command_execution', item.input);
    }
    if (block.type === 'stderr_group') return block.lines.map((line) => line.text).join('\n');
    if (block.type === 'stdout') return block.text;
    if (block.type === 'activity') return block.name;
    return '';
  }

  function renderMarkdown(block: TranscriptBlock): boolean {
    return block.type === 'message' || block.type === 'thinking';
  }

  function isToolLike(block: TranscriptBlock): boolean {
    return block.type === 'tool' || block.type === 'tool_group' || block.type === 'command_group';
  }
</script>

<div class="space-y-2">
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
        <div class="rounded-lg border px-2.5 py-2 shadow-sm {blockTone(block)}">
          <div class="flex items-center gap-2">
            <span class="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] {blockTone(block)}">
              {blockLabel(block)}
            </span>
            <TimeAgo date={block.ts} class="text-[10px] text-muted-foreground" />
          </div>

          <div class="mt-1.5">
            {#if renderMarkdown(block)}
              <MarkdownBody content={blockBody(block)} class="text-[11px] leading-4 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" />
            {:else if isToolLike(block)}
              <pre class="m-0 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/80">{blockBody(block)}</pre>
            {:else}
              <pre class="m-0 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-foreground/80">{blockBody(block)}</pre>
            {/if}
          </div>

          {#if block.type === 'tool' && block.status !== 'running'}
            <div class="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] {block.isError ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}">
              {block.isError ? 'Error' : 'Completed'}
            </div>
          {:else if block.type === 'command_group'}
            <div class="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] {block.items.some((item) => item.isError) ? 'text-red-600 dark:text-red-300' : block.items.some((item) => item.status === 'running') ? 'text-cyan-600 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300'}">
              {block.items.some((item) => item.status === 'running') ? 'Running' : block.items.some((item) => item.isError) ? 'Error' : 'Done'}
            </div>
          {:else if block.type === 'tool_group'}
            <div class="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] {block.items.some((item) => item.isError) ? 'text-red-600 dark:text-red-300' : block.items.some((item) => item.status === 'running') ? 'text-cyan-600 dark:text-cyan-300' : 'text-emerald-600 dark:text-emerald-300'}">
              {block.items.some((item) => item.status === 'running') ? 'Running' : block.items.some((item) => item.isError) ? 'Error' : 'Done'}
            </div>
          {:else if block.type === 'stderr_group'}
            <div class="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-600 dark:text-amber-300">
              {block.lines.length} log {block.lines.length === 1 ? 'line' : 'lines'}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
