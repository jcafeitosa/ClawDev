<script lang="ts">
  /**
   * RunActivityChart -- stacked bar chart showing succeeded/failed/other runs per day.
   * Matches Paperclip's lightweight CSS-based chart (no ECharts).
   */
  import { formatDayLabel, getLast14Days } from './chart-helpers';

  interface Run {
    status: string;
    createdAt?: string;
    startedAt?: string;
    [key: string]: unknown;
  }

  interface Props {
    runs: Run[];
  }

  let { runs }: Props = $props();

  let days = $derived(getLast14Days());

  let grouped = $derived.by(() => {
    const map = new Map<string, { succeeded: number; failed: number; other: number }>();
    for (const day of days) map.set(day, { succeeded: 0, failed: 0, other: 0 });
    for (const run of runs) {
      const day = String(run.createdAt ?? run.startedAt ?? '').slice(0, 10);
      const entry = map.get(day);
      if (!entry) continue;
      if (run.status === 'succeeded' || run.status === 'completed' || run.status === 'success') entry.succeeded++;
      else if (run.status === 'failed' || run.status === 'error' || run.status === 'timed_out') entry.failed++;
      else entry.other++;
    }
    return map;
  });

  let maxValue = $derived(Math.max(...Array.from(grouped.values()).map(v => v.succeeded + v.failed + v.other), 1));
  let hasData = $derived(Array.from(grouped.values()).some(v => v.succeeded + v.failed + v.other > 0));
</script>

{#if !hasData}
  <p class="text-xs text-muted-foreground">No runs yet</p>
{:else}
  <div>
    <div class="flex items-end gap-[3px] h-20">
      {#each days as day}
        {@const entry = grouped.get(day)}
        {@const total = (entry?.succeeded ?? 0) + (entry?.failed ?? 0) + (entry?.other ?? 0)}
        {@const heightPct = (total / maxValue) * 100}
        <div class="flex-1 h-full flex flex-col justify-end" title="{day}: {total} runs">
          {#if total > 0}
            <div class="flex flex-col-reverse gap-px overflow-hidden" style="height: {heightPct}%; min-height: 2px;">
              {#if (entry?.succeeded ?? 0) > 0}
                <div class="bg-emerald-500" style="flex: {entry?.succeeded}"></div>
              {/if}
              {#if (entry?.failed ?? 0) > 0}
                <div class="bg-red-500" style="flex: {entry?.failed}"></div>
              {/if}
              {#if (entry?.other ?? 0) > 0}
                <div class="bg-neutral-500" style="flex: {entry?.other}"></div>
              {/if}
            </div>
          {:else}
            <div class="bg-muted/30 rounded-sm" style="height: 2px;"></div>
          {/if}
        </div>
      {/each}
    </div>
    <!-- Date labels -->
    <div class="flex gap-[3px] mt-1.5">
      {#each days as day, i}
        <div class="flex-1 text-center">
          {#if i === 0 || i === 6 || i === 13}
            <span class="text-[9px] text-muted-foreground tabular-nums">{formatDayLabel(day, i)}</span>
          {/if}
        </div>
      {/each}
    </div>
    <!-- Legend -->
    <div class="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2">
      <span class="flex items-center gap-1 text-[9px] text-muted-foreground">
        <span class="h-1.5 w-1.5 rounded-full shrink-0 bg-emerald-500"></span>
        Succeeded
      </span>
      <span class="flex items-center gap-1 text-[9px] text-muted-foreground">
        <span class="h-1.5 w-1.5 rounded-full shrink-0 bg-red-500"></span>
        Failed
      </span>
      <span class="flex items-center gap-1 text-[9px] text-muted-foreground">
        <span class="h-1.5 w-1.5 rounded-full shrink-0 bg-neutral-500"></span>
        Other
      </span>
    </div>
  </div>
{/if}
