<script lang="ts">
  /**
   * PropertyRow — a single label:value row inside PropertiesPanel.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    children?: Snippet;
  }

  let { label, children }: Props = $props();
</script>

<div class="flex items-start justify-between gap-2 py-2 text-sm">
  <span class="shrink-0 text-zinc-500 dark:text-zinc-400">{label}</span>
  {#if children}
    <span class="text-right text-zinc-900 dark:text-zinc-100">
      {@render children()}
    </span>
  {/if}
</div>
