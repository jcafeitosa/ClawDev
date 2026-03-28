<script lang="ts">
  /**
   * StatusBadge — displays a colored badge for entity status.
   * Maps status strings to consistent colors across the app.
   */
  interface Props {
    status: string;
    class?: string;
  }

  let { status, class: className = '' }: Props = $props();

  const colorMap: Record<string, string> = {
    // Issue / task statuses
    open: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    'in_progress': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    in_review: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
    done: 'bg-green-500/15 text-green-700 dark:text-green-400',
    closed: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    blocked: 'bg-red-500/15 text-red-700 dark:text-red-400',
    // Agent statuses
    active: 'bg-green-500/15 text-green-700 dark:text-green-400',
    idle: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    paused: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    terminated: 'bg-red-500/15 text-red-700 dark:text-red-400',
    // Run statuses
    queued: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    running: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
    completed: 'bg-green-500/15 text-green-700 dark:text-green-400',
    failed: 'bg-red-500/15 text-red-700 dark:text-red-400',
    cancelled: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    // Approval statuses
    pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    approved: 'bg-green-500/15 text-green-700 dark:text-green-400',
    rejected: 'bg-red-500/15 text-red-700 dark:text-red-400',
    // Routine statuses
    enabled: 'bg-green-500/15 text-green-700 dark:text-green-400',
    disabled: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  };

  let colors = $derived(colorMap[status] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400');
  let label = $derived(status.replace(/_/g, ' '));
</script>

<span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize {colors} {className}">
  {label}
</span>
