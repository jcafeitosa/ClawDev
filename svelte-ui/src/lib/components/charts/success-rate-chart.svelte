<script lang="ts">
  /**
   * SuccessRateChart -- bar chart showing daily success rate over 14 days.
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
    const map = new Map<string, { succeeded: number; total: number }>();
    for (const day of days) map.set(day, { succeeded: 0, total: 0 });
    for (const run of runs) {
      const day = String(run.createdAt ?? run.startedAt ?? '').slice(0, 10);
      const entry = map.get(day);
      if (!entry) continue;
      entry.total++;
      if (run.status === 'succeeded' || run.status === 'completed' || run.status === 'success') entry.succeeded++;
    }
    return map;
  });

  let hasData = $derived(Array.from(grouped.values()).some(v => v.total > 0));
</script>

{#if !hasData}
  <p class="text-xs text-muted-foreground">No runs yet</p>
{:else}
  <div>
    <div class="flex items-end gap-[3px] h-20">
      {#each days as day}
        {@const entry = grouped.get(day)}
        {@const rate = (entry?.total ?? 0) > 0 ? (entry?.succeeded ?? 0) / entry!.total : 0}
        {@const color = (entry?.total ?? 0) === 0 ? undefined : rate >= 0.8 ? '#10b981' : rate >= 0.5 ? '#eab308' : '#ef4444'}
        <div class="flex-1 h-full flex flex-col justify-end" title="{day}: {(entry?.total ?? 0) > 0 ? Math.round(rate * 100) : 0}% ({entry?.succeeded ?? 0}/{entry?.total ?? 0})">
          {#if (entry?.total ?? 0) > 0}
            <div style="height: {rate * 100}%; min-height: 2px; background-color: {color};"></div>
          {:else}
            <div class="bg-muted/30 rounded-sm" style="height: 2px;"></div>
          {/if}
        </div>
      {/each}
    </div>
    <div class="flex gap-[3px] mt-1.5">
      {#each days as day, i}
        <div class="flex-1 text-center">
          {#if i === 0 || i === 6 || i === 13}
            <span class="text-[9px] text-muted-foreground tabular-nums">{formatDayLabel(day, i)}</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
