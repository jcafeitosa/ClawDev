<script lang="ts">
  /**
   * PriorityChart -- stacked bar chart showing issues by priority over 14 days.
   */
  import { PRIORITY_ORDER, PRIORITY_VISUALS } from '$lib/constants/visual';
  import { formatDayLabel, getLast14Days } from './chart-helpers';

  interface Issue {
    priority?: string | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface Props {
    issues: Issue[];
  }

  let { issues }: Props = $props();

  let days = $derived(getLast14Days());

  let grouped = $derived.by(() => {
    const map = new Map<string, Record<string, number>>();
    for (const day of days) map.set(day, { critical: 0, high: 0, medium: 0, low: 0 });
    for (const issue of issues) {
      const day = String(issue.createdAt ?? '').slice(0, 10);
      const entry = map.get(day);
      if (!entry) continue;
      const p = issue.priority ?? 'low';
      if (p in entry) entry[p]++;
    }
    return map;
  });

  let maxValue = $derived(Math.max(...Array.from(grouped.values()).map(v => Object.values(v).reduce((a, b) => a + b, 0)), 1));
  let hasData = $derived(Array.from(grouped.values()).some(v => Object.values(v).reduce((a, b) => a + b, 0) > 0));
</script>

{#if !hasData}
  <p class="text-xs text-muted-foreground">No issues</p>
{:else}
  <div>
    <div class="flex items-end gap-[3px] h-20">
      {#each days as day}
        {@const entry = grouped.get(day)}
        {@const total = entry ? Object.values(entry).reduce((a, b) => a + b, 0) : 0}
        {@const heightPct = (total / maxValue) * 100}
        <div class="flex-1 h-full flex flex-col justify-end" title="{day}: {total} issues">
          {#if total > 0}
            <div class="flex flex-col-reverse gap-px overflow-hidden" style="height: {heightPct}%; min-height: 2px;">
              {#each PRIORITY_ORDER as p}
                {#if entry && (entry[p] ?? 0) > 0}
                  <div style="flex: {entry[p]}; background-color: {PRIORITY_VISUALS[p]?.hex ?? '#6b7280'};"></div>
                {/if}
              {/each}
            </div>
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
    <div class="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2">
      {#each PRIORITY_ORDER as p}
        <span class="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span class="h-1.5 w-1.5 rounded-full shrink-0" style="background-color: {PRIORITY_VISUALS[p]?.hex ?? '#6b7280'};"></span>
          {PRIORITY_VISUALS[p]?.label ?? p.charAt(0).toUpperCase() + p.slice(1)}
        </span>
      {/each}
    </div>
  </div>
{/if}
