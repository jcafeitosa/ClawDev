<script lang="ts">
  /**
   * PropertiesPanel — right-side panel showing entity metadata.
   * Used in detail pages (issue, agent, project, goal, etc.)
   */
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();
</script>

<aside class="w-full lg:w-80 shrink-0 space-y-4 {className}">
  <div class="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
    {@render children()}
  </div>
</aside>
