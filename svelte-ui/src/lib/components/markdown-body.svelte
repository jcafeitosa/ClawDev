<script lang="ts">
  /**
   * MarkdownBody — lightweight markdown-to-HTML renderer.
   * Converts common markdown syntax to styled HTML without external dependencies.
   * Sanitizes output to prevent XSS attacks.
   */
  interface Props {
    content: string;
    class?: string;
  }

  let { content, class: className = '' }: Props = $props();

  /**
   * Strip dangerous HTML constructs that could enable XSS.
   */
  function sanitize(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[\s\S]*?>/gi, '')
      .replace(/<form[\s\S]*?<\/form>/gi, '')
      .replace(/\bon\w+\s*=/gi, 'data-blocked=')
      .replace(/javascript\s*:/gi, 'blocked:')
      .replace(/vbscript\s*:/gi, 'blocked:');
  }

  /**
   * Escape HTML entities in raw text to prevent injection before markdown processing.
   */
  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Process inline markdown syntax: bold, italic, code, links, images.
   */
  function processInline(line: string): string {
    // Inline code (must come before bold/italic to avoid conflicts inside backticks)
    line = line.replace(
      /`([^`]+)`/g,
      '<code class="bg-white/10 rounded px-1 py-0.5 text-sm font-mono">$1</code>'
    );
    // Images (must come before links since ![...] would match [...])
    line = line.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="max-w-full rounded-lg my-2" />'
    );
    // Links
    line = line.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    // Bold
    line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic (asterisk)
    line = line.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    // Italic (underscore)
    line = line.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
    return line;
  }

  /**
   * Convert markdown string to sanitized HTML.
   */
  function renderMarkdown(md: string): string {
    if (!md || !md.trim()) return '';

    // Escape HTML first, then apply markdown transformations
    let text = escapeHtml(md);

    // Extract fenced code blocks before processing anything else
    const codeBlocks: string[] = [];
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
      const langAttr = lang ? ` data-lang="${lang}"` : '';
      const idx = codeBlocks.length;
      codeBlocks.push(
        `<pre class="bg-[#0a0a0f] rounded-lg p-4 overflow-x-auto my-3"${langAttr}><code class="text-sm font-mono text-[#e2e8f0]">${code.trim()}</code></pre>`
      );
      return `\n%%CODEBLOCK_${idx}%%\n`;
    });

    // Split into blocks by double newlines
    const blocks = text.split(/\n\n+/);
    const rendered: string[] = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // Code block placeholder
      const codeMatch = trimmed.match(/^%%CODEBLOCK_(\d+)%%$/);
      if (codeMatch) {
        rendered.push(codeBlocks[parseInt(codeMatch[1])]);
        continue;
      }

      // Horizontal rule
      if (/^-{3,}$/.test(trimmed)) {
        rendered.push('<hr class="border-white/[0.08] my-4" />');
        continue;
      }

      // Process line-by-line for headers, lists, blockquotes
      const lines = trimmed.split('\n');
      const firstLine = lines[0];

      // Headers
      const headerMatch = firstLine.match(/^(#{1,4})\s+(.+)/);
      if (headerMatch && lines.length === 1) {
        const level = headerMatch[1].length;
        const content = processInline(headerMatch[2]);
        const sizeClasses: Record<number, string> = {
          1: 'text-2xl font-bold mt-6 mb-3',
          2: 'text-xl font-semibold mt-5 mb-2',
          3: 'text-lg font-semibold mt-4 mb-2',
          4: 'text-base font-medium mt-3 mb-1',
        };
        rendered.push(`<h${level} class="${sizeClasses[level]}">${content}</h${level}>`);
        continue;
      }

      // Blockquote block
      if (lines.every((l) => l.startsWith('&gt; ') || l === '&gt;')) {
        const quoteContent = lines
          .map((l) => processInline(l.replace(/^&gt;\s?/, '')))
          .join('<br />');
        rendered.push(
          `<blockquote class="border-l-2 border-blue-500 pl-4 my-3 text-[#94A3B8] italic">${quoteContent}</blockquote>`
        );
        continue;
      }

      // Unordered list
      if (lines.every((l) => /^[\-\*]\s/.test(l))) {
        const items = lines
          .map((l) => `<li class="ml-4 list-disc">${processInline(l.replace(/^[\-\*]\s+/, ''))}</li>`)
          .join('');
        rendered.push(`<ul class="my-2 space-y-1">${items}</ul>`);
        continue;
      }

      // Ordered list
      if (lines.every((l) => /^\d+\.\s/.test(l))) {
        const items = lines
          .map((l) => `<li class="ml-4 list-decimal">${processInline(l.replace(/^\d+\.\s+/, ''))}</li>`)
          .join('');
        rendered.push(`<ol class="my-2 space-y-1">${items}</ol>`);
        continue;
      }

      // Mixed content: may contain inline code block placeholders
      if (trimmed.includes('%%CODEBLOCK_')) {
        const parts = trimmed.split(/(%%CODEBLOCK_\d+%%)/);
        for (const part of parts) {
          const cbMatch = part.match(/^%%CODEBLOCK_(\d+)%%$/);
          if (cbMatch) {
            rendered.push(codeBlocks[parseInt(cbMatch[1])]);
          } else if (part.trim()) {
            rendered.push(`<p class="my-2 leading-relaxed">${processInline(part.trim())}</p>`);
          }
        }
        continue;
      }

      // Default: paragraph
      const pContent = lines.map((l) => processInline(l)).join('<br />');
      rendered.push(`<p class="my-2 leading-relaxed">${pContent}</p>`);
    }

    return sanitize(rendered.join('\n'));
  }

  let html = $derived(renderMarkdown(content));
</script>

<div class="prose prose-sm dark:prose-invert max-w-none text-[#F8FAFC] {className}">
  {@html html}
</div>
