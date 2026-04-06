<script lang="ts">
  /**
   * RichContentRenderer — renders message body with support for:
   * - Mermaid diagrams (```mermaid ... ```)
   * - Chart.js charts (```chart ... ``` with JSON config)
   * - Code blocks with syntax highlighting styling
   * - Inline markdown (bold, italic, code, links)
   * Falls back to MentionHighlight for plain text segments.
   */
  import { onMount } from 'svelte';

  interface Props {
    body: string;
    searchQuery?: string;
  }

  let { body, searchQuery = '' }: Props = $props();

  // Parse body into segments: text, mermaid, chart, code
  type Segment =
    | { type: 'text'; content: string }
    | { type: 'mermaid'; content: string }
    | { type: 'chart'; content: string }
    | { type: 'code'; lang: string; content: string };

  let segments = $derived<Segment[]>(parseSegments(body));

  function parseSegments(raw: string): Segment[] {
    const result: Segment[] = [];
    // Match fenced code blocks: ```lang\n...\n```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(raw)) !== null) {
      // Text before this code block
      if (match.index > lastIndex) {
        result.push({ type: 'text', content: raw.slice(lastIndex, match.index) });
      }
      const lang = match[1].toLowerCase();
      const content = match[2].trim();

      if (lang === 'mermaid') {
        result.push({ type: 'mermaid', content });
      } else if (lang === 'chart' || lang === 'chartjs') {
        result.push({ type: 'chart', content });
      } else {
        result.push({ type: 'code', lang: lang || 'text', content });
      }
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < raw.length) {
      result.push({ type: 'text', content: raw.slice(lastIndex) });
    }

    return result;
  }

  // ── Mermaid rendering ──
  let mermaidLoaded = $state(false);
  let mermaidModule: any = $state(null);
  let mermaidCounter = $state(0);

  /** Detect dark mode from <html> class */
  function isDarkMode(): boolean {
    if (typeof document === 'undefined') return true;
    return document.documentElement.classList.contains('dark');
  }

  $effect(() => {
    const hasMermaid = segments.some((s) => s.type === 'mermaid');
    if (hasMermaid && !mermaidLoaded) {
      const dark = isDarkMode();
      import('mermaid').then((mod) => {
        mod.default.initialize({
          startOnLoad: false,
          theme: dark ? 'dark' : 'default',
          themeVariables: dark
            ? {
                darkMode: true,
                background: 'transparent',
                primaryColor: '#3b82f6',
                primaryTextColor: '#e5e7eb',
                primaryBorderColor: '#4b5563',
                lineColor: '#6b7280',
                secondaryColor: '#8b5cf6',
                tertiaryColor: '#1f2937',
              }
            : {
                darkMode: false,
                background: 'transparent',
                primaryColor: '#3b82f6',
                primaryTextColor: '#1f2937',
                primaryBorderColor: '#d1d5db',
                lineColor: '#9ca3af',
                secondaryColor: '#8b5cf6',
                tertiaryColor: '#f3f4f6',
              },
        });
        mermaidModule = mod.default;
        mermaidLoaded = true;
      });
    }
  });

  // ── Chart.js rendering ──
  let chartJsLoaded = $state(false);
  let chartJsModule: any = $state(null);

  $effect(() => {
    const hasChart = segments.some((s) => s.type === 'chart');
    if (hasChart && !chartJsLoaded) {
      import('chart.js/auto').then((mod) => {
        chartJsModule = mod.default ?? mod;
        chartJsLoaded = true;
      });
    }
  });

  // ── Text rendering helpers ──
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function renderText(text: string): string {
    // Process line-by-line for block elements, then inline formatting
    const lines = text.split('\n');
    const outputLines: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    function flushTable() {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const dataRows = tableRows.slice(2); // skip separator row
        let html = '<table class="rich-table"><thead><tr>';
        for (const cell of headerRow.split('|').filter(Boolean)) {
          html += `<th>${renderInline(cell.trim())}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (const row of dataRows) {
          html += '<tr>';
          for (const cell of row.split('|').filter(Boolean)) {
            html += `<td>${renderInline(cell.trim())}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table>';
        outputLines.push(html);
        tableRows = [];
      }
      inTable = false;
    }

    for (const line of lines) {
      const trimmed = line.trim();

      // Table row detection
      if (/^\|.+\|$/.test(trimmed)) {
        if (/^\|[-:\s|]+\|$/.test(trimmed)) {
          // Separator row
          tableRows.push(trimmed);
          inTable = true;
          continue;
        }
        tableRows.push(trimmed);
        inTable = true;
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Horizontal rule
      if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
        outputLines.push('<hr class="rich-hr" />');
        continue;
      }

      // Headers
      const headerMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const sizes = ['text-lg font-bold', 'text-base font-bold', 'text-sm font-semibold', 'text-sm font-semibold', 'text-xs font-semibold', 'text-xs font-semibold'];
        outputLines.push(`<div class="${sizes[level - 1]} mt-2 mb-1">${renderInline(headerMatch[2])}</div>`);
        continue;
      }

      // Unordered list
      const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        outputLines.push(`<div class="flex gap-1.5 ml-2"><span class="opacity-40 select-none">&bull;</span><span>${renderInline(ulMatch[1])}</span></div>`);
        continue;
      }

      // Ordered list
      const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
      if (olMatch) {
        outputLines.push(`<div class="flex gap-1.5 ml-2"><span class="opacity-40 select-none tabular-nums">${olMatch[1]}.</span><span>${renderInline(olMatch[2])}</span></div>`);
        continue;
      }

      // Blockquote
      const bqMatch = trimmed.match(/^>\s*(.*)$/);
      if (bqMatch) {
        outputLines.push(`<div class="rich-blockquote">${renderInline(bqMatch[1])}</div>`);
        continue;
      }

      // Empty line
      if (trimmed === '') {
        outputLines.push('<div class="h-1"></div>');
        continue;
      }

      // Regular text
      outputLines.push(renderInline(trimmed));
    }

    if (inTable) flushTable();

    return outputLines.join('\n');
  }

  function renderInline(text: string): string {
    let result = escapeHtml(text);

    // Inline code
    result = result.replace(/`([^`]+)`/g, '<code class="rich-inline-code">$1</code>');
    // Bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Links
    result = result.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="rich-link">$1</a>',
    );
    // Auto-link URLs
    result = result.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="rich-link">$1</a>',
    );
    // @mentions
    result = result.replace(
      /@([a-zA-Z0-9_\s]+?)(?=\s|$|[.,!?]|&amp;|&lt;|&gt;)/g,
      '<span class="mention-chip">@$1</span>',
    );

    // Search highlight
    if (searchQuery && searchQuery.trim().length > 0) {
      const escaped = escapeRegExp(escapeHtml(searchQuery.trim()));
      const searchRegex = new RegExp(`(${escaped})`, 'gi');
      result = result.replace(searchRegex, '<span class="search-highlight">$1</span>');
    }

    return result;
  }

  // ── Mermaid element rendering ──
  function renderMermaidElement(el: HTMLElement, definition: string) {
    if (!mermaidModule || !el) return;
    const id = `mermaid-${Date.now()}-${mermaidCounter++}`;
    mermaidModule.render(id, definition).then(({ svg }: { svg: string }) => {
      el.innerHTML = svg;
    }).catch((err: any) => {
      el.innerHTML = `<pre class="text-red-400 text-xs p-2">Mermaid error: ${escapeHtml(String(err))}</pre>`;
    });
  }

  // ── Chart element rendering ──
  function renderChartElement(canvas: HTMLCanvasElement, configStr: string) {
    if (!chartJsModule || !canvas) return;
    try {
      const config = JSON.parse(configStr);
      const dark = isDarkMode();
      // Ensure theme-friendly defaults
      if (!config.options) config.options = {};
      if (!config.options.plugins) config.options.plugins = {};
      if (!config.options.plugins.legend) config.options.plugins.legend = {};
      if (!config.options.plugins.legend.labels) config.options.plugins.legend.labels = {};
      config.options.plugins.legend.labels.color = dark ? '#9ca3af' : '#374151';
      if (!config.options.scales) config.options.scales = {};
      for (const axis of ['x', 'y']) {
        if (!config.options.scales[axis]) config.options.scales[axis] = {};
        if (!config.options.scales[axis].ticks) config.options.scales[axis].ticks = {};
        config.options.scales[axis].ticks.color = dark ? '#6b7280' : '#6b7280';
        if (!config.options.scales[axis].grid) config.options.scales[axis].grid = {};
        config.options.scales[axis].grid.color = dark ? 'rgba(107,114,128,0.2)' : 'rgba(0,0,0,0.06)';
      }
      config.options.responsive = true;
      config.options.maintainAspectRatio = false;

      new chartJsModule(canvas, config);
    } catch (err) {
      const parent = canvas.parentElement;
      if (parent) {
        parent.innerHTML = `<pre class="text-red-400 text-xs p-2">Chart error: ${escapeHtml(String(err))}</pre>`;
      }
    }
  }
</script>

{#each segments as segment, i (i)}
  {#if segment.type === 'text'}
    <div class="text-sm break-words leading-relaxed rich-text-block">
      {@html renderText(segment.content)}
    </div>
  {:else if segment.type === 'mermaid'}
    <div class="rich-mermaid-container my-2 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-bg-surface)] p-4 overflow-x-auto">
      <div class="text-[10px] uppercase tracking-wider opacity-40 mb-2 flex items-center gap-1">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        Mermaid Diagram
      </div>
      {#if mermaidLoaded}
        <div use:renderMermaidElement={segment.content} class="mermaid-render flex justify-center"></div>
      {:else}
        <div class="flex items-center justify-center py-6 opacity-40">
          <div class="flex items-center gap-2 text-xs">
            <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            Loading diagram...
          </div>
        </div>
      {/if}
    </div>
  {:else if segment.type === 'chart'}
    <div class="rich-chart-container my-2 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-bg-surface)] p-4">
      <div class="text-[10px] uppercase tracking-wider opacity-40 mb-2 flex items-center gap-1">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
        Chart
      </div>
      {#if chartJsLoaded}
        <div class="h-48 relative">
          <canvas use:renderChartElement={segment.content}></canvas>
        </div>
      {:else}
        <div class="flex items-center justify-center py-6 opacity-40">
          <div class="flex items-center gap-2 text-xs">
            <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            Loading chart...
          </div>
        </div>
      {/if}
    </div>
  {:else if segment.type === 'code'}
    <div class="rich-code-block my-2 rounded-xl border border-[var(--clawdev-bg-surface-border)] overflow-hidden" style="background: var(--code-block-bg, #1a1b26);">
      <div class="flex items-center justify-between px-3 py-1.5 border-b" style="border-color: var(--code-block-border, rgba(255,255,255,0.05)); background: var(--code-block-header, rgba(255,255,255,0.03))">
        <span class="text-[10px] uppercase tracking-wider opacity-40 font-mono">{segment.lang}</span>
        <button
          onclick={() => navigator.clipboard.writeText(segment.content)}
          class="text-[10px] opacity-30 hover:opacity-70 transition-opacity px-1.5 py-0.5 rounded hover:bg-white/5"
        >
          Copy
        </button>
      </div>
      <pre class="p-3 text-xs font-mono overflow-x-auto leading-relaxed"><code>{segment.content}</code></pre>
    </div>
  {/if}
{/each}

<style>
  /* ── Light/dark mode CSS custom properties ── */
  :global(:root:not(.dark)) {
    --code-block-bg: #f8f9fa;
    --code-block-border: rgba(0,0,0,0.06);
    --code-block-header: rgba(0,0,0,0.03);
    --code-block-text: #1f2937;
    --code-block-label: rgba(0,0,0,0.5);
    --code-block-copy: rgba(0,0,0,0.4);
  }
  :global(:root.dark), :global(:root:not(.light)) {
    --code-block-bg: #1a1b26;
    --code-block-border: rgba(255,255,255,0.05);
    --code-block-header: rgba(255,255,255,0.03);
    --code-block-text: #e5e7eb;
    --code-block-label: rgba(255,255,255,0.4);
    --code-block-copy: rgba(255,255,255,0.3);
  }
  :global(.rich-code-block pre) {
    color: var(--code-block-text);
  }
  :global(.rich-code-block .opacity-40) {
    color: var(--code-block-label);
  }
  :global(.rich-code-block .opacity-30) {
    color: var(--code-block-copy);
  }
  :global(:root:not(.dark) .rich-mermaid-container),
  :global(:root:not(.dark) .rich-chart-container) {
    background: #f9fafb;
    border-color: rgba(0,0,0,0.08);
  }
  :global(.rich-inline-code) {
    background: rgba(139, 92, 246, 0.15);
    color: #c4b5fd;
    padding: 0.1em 0.35em;
    border-radius: 0.25rem;
    font-family: ui-monospace, monospace;
    font-size: 0.85em;
  }
  :global(.rich-link) {
    color: #60a5fa;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  :global(.rich-link:hover) {
    color: #93bbfd;
  }
  :global(:root:not(.dark) .rich-inline-code) {
    background: rgba(139, 92, 246, 0.1);
    color: #6d28d9;
  }
  :global(:root:not(.dark) .rich-link) {
    color: #2563eb;
  }
  :global(:root:not(.dark) .rich-link:hover) {
    color: #1d4ed8;
  }
  :global(.mermaid-render svg) {
    max-width: 100%;
    height: auto;
  }
  :global(.rich-table) {
    border-collapse: collapse;
    margin: 0.25rem 0;
    font-size: 0.8rem;
    width: 100%;
  }
  :global(.rich-table th),
  :global(.rich-table td) {
    border: 1px solid var(--clawdev-bg-surface-border, rgba(128,128,128,0.2));
    padding: 0.25rem 0.5rem;
    text-align: left;
  }
  :global(.rich-table th) {
    font-weight: 600;
    opacity: 0.8;
    background: var(--clawdev-bg-surface, rgba(128,128,128,0.05));
  }
  :global(.rich-hr) {
    border: none;
    border-top: 1px solid var(--clawdev-bg-surface-border, rgba(128,128,128,0.2));
    margin: 0.5rem 0;
  }
  :global(.rich-blockquote) {
    border-left: 3px solid var(--clawdev-primary, #3b82f6);
    padding-left: 0.75rem;
    opacity: 0.8;
    margin: 0.25rem 0;
  }
  :global(.rich-text-block) {
    white-space: normal;
  }
</style>
