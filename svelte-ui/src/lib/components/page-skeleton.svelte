<script lang="ts">
  /**
   * PageSkeleton — loading placeholder for detail pages.
   */
  interface Props {
    lines?: number;
    showSidebar?: boolean;
  }

  let { lines = 6, showSidebar = true }: Props = $props();
</script>

<div class="flex flex-col lg:flex-row gap-6 animate-pulse">
  <div class="flex-1 space-y-4">
    <!-- Title -->
    <div class="h-8 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800"></div>
    <!-- Subtitle -->
    <div class="h-4 w-1/3 rounded bg-zinc-200 dark:bg-zinc-800"></div>
    <!-- Content lines -->
    {#each Array(lines) as _}
      <div class="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800/50"></div>
    {/each}
  </div>

  {#if showSidebar}
    <div class="w-full lg:w-80 shrink-0 space-y-3">
      <div class="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        {#each Array(4) as _}
          <div class="flex justify-between py-2">
            <div class="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800"></div>
            <div class="h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-800/50"></div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
