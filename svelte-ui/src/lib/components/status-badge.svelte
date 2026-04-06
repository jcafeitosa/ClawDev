<script lang="ts">
  /**
   * StatusBadge — displays a colored badge for entity status.
   * Maps status strings to consistent colors across the app.
   */
  import { STATUS_BADGE_CLASSES } from "$lib/constants/visual";

  interface Props {
    status: string;
    class?: string;
  }

  let { status, class: className = '' }: Props = $props();

  let colors = $derived(STATUS_BADGE_CLASSES[status] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400');
  let label = $derived(status.replace(/_/g, ' '));
</script>

<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize {colors} {className}">
  {label}
</span>
