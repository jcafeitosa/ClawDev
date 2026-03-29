<script lang="ts">
  /**
   * TimeAgo — displays a relative timestamp that updates.
   */
  interface Props {
    date: string | Date | null | undefined;
    class?: string;
  }

  let { date, class: className = '' }: Props = $props();

  function format(d: string | Date | null | undefined): string {
    if (!d) return '—';
    const now = Date.now();
    const then = new Date(d).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(d).toLocaleDateString();
  }

  let text = $derived(format(date));
</script>

<time
  class="text-zinc-500 dark:text-zinc-400 {className}"
  datetime={date ? new Date(date).toISOString() : undefined}
  title={date ? new Date(date).toLocaleString() : undefined}
>
  {text}
</time>
