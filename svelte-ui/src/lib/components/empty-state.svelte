<script lang="ts">
  /**
   * EmptyState — placeholder when a list/page has no content.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    icon?: string;
    children?: Snippet;
  }

  let { title, description, icon = '📭', children }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
  <span class="text-4xl mb-4">{icon}</span>
  <h3 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
  {#if description}
    <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-md">{description}</p>
  {/if}
  {#if children}
    <div class="mt-4">
      {@render children()}
    </div>
  {/if}
</div>
