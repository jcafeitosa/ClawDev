<script lang="ts">
  /**
   * MentionHighlight — renders message body with @mention chips and search highlighting.
   * Sanitizes HTML to prevent XSS.
   */

  interface Props {
    body: string;
    searchQuery?: string;
    mentionedAgents?: { name: string; id: string }[];
  }

  let { body, searchQuery = '', mentionedAgents = [] }: Props = $props();

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

  let renderedHtml = $derived(() => {
    let result = escapeHtml(body);

    // Highlight @mentions
    result = result.replace(
      /@([a-zA-Z0-9_\s]+?)(?=\s|$|[.,!?]|&amp;|&lt;|&gt;)/g,
      '<span class="mention-chip">@$1</span>',
    );

    // Highlight search query
    if (searchQuery && searchQuery.trim().length > 0) {
      const escaped = escapeRegExp(escapeHtml(searchQuery.trim()));
      const searchRegex = new RegExp(`(${escaped})`, 'gi');
      result = result.replace(searchRegex, '<span class="search-highlight">$1</span>');
    }

    return result;
  });
</script>

<p class="text-sm whitespace-pre-wrap break-words leading-relaxed">
  {@html renderedHtml()}
</p>
