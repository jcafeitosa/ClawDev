<script lang="ts">
  /**
   * PriorityIcon — displays a colored priority indicator.
   */
  interface Props {
    priority: 'urgent' | 'high' | 'normal' | 'low' | string | null | undefined;
    class?: string;
  }

  let { priority, class: className = '' }: Props = $props();

  const config: Record<string, { color: string; icon: string }> = {
    urgent: { color: 'text-red-600 dark:text-red-400', icon: '⬆⬆' },
    high: { color: 'text-orange-600 dark:text-orange-400', icon: '⬆' },
    normal: { color: 'text-blue-600 dark:text-blue-400', icon: '—' },
    low: { color: 'text-zinc-500 dark:text-zinc-400', icon: '⬇' },
  };

  let cfg = $derived(config[priority ?? 'normal'] ?? config.normal);
</script>

<span class="inline-flex items-center text-xs font-medium {cfg.color} {className}" title="Priority: {priority ?? 'normal'}">
  {cfg.icon}
</span>
