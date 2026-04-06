<script lang="ts">
  /**
   * ActivityCharts — 2x2 grid of mini stacked bar charts:
   * 1. Run Activity (stacked: succeeded / failed / other)
   * 2. Issues by Priority (stacked: critical / high / medium / low)
   * 3. Issues by Status (stacked: todo / in_progress / in_review / done / blocked / cancelled / backlog)
   * 4. Success Rate (single bar per day, colored by rate)
   */
  import { BarChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import BaseChart from './base-chart.svelte';
  import { api } from '$lib/api';
  import type { EChartsOption } from 'echarts';
  import { formatDayLabel, getLast14Days } from './chart-helpers';

  echarts.use([BarChart, GridComponent, TooltipComponent]);

  interface Props {
    companyId: string;
  }

  let { companyId }: Props = $props();

  // ── State ──────────────────────────────────────────────────────────
  let runs = $state<any[]>([]);
  let issues = $state<any[]>([]);
  let loading = $state(true);

  // ── Data fetching ──────────────────────────────────────────────────
  async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
      const res = await api(url);
      if (!res.ok) return fallback;
      return (await res.json()) as T;
    } catch {
      return fallback;
    }
  }

  $effect(() => {
    if (!companyId) return;
    loading = true;

    Promise.all([
      safeFetch(`/api/companies/${companyId}/heartbeat-runs?limit=100`, []),
      safeFetch(`/api/companies/${companyId}/issues`, []),
    ]).then(([runData, issueData]) => {
      runs = Array.isArray(runData) ? runData : (runData as any)?.runs ?? (runData as any)?.data ?? [];
      issues = Array.isArray(issueData) ? issueData : (issueData as any)?.issues ?? (issueData as any)?.data ?? [];
      loading = false;
    });
  });

  const tooltipStyle = {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderColor: 'transparent',
    textStyle: { color: '#fff', fontSize: 11 },
  };

  const chartGrid = { left: 0, right: 0, top: 4, bottom: 20, containLabel: false };

  function makeXAxis(days: string[]) {
    return {
      type: 'category' as const,
      data: days.map((d, i) => formatDayLabel(d, i)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#71717a', fontSize: 9 },
    };
  }

  function makeYAxis() {
    return {
      type: 'value' as const,
      show: true,
      axisLabel: { show: false },
      axisTick: { show: false },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#27272a' } },
    };
  }

  // ── Chart 1: Run Activity ──────────────────────────────────────────
  let runActivityOption = $derived.by((): EChartsOption | null => {
    if (runs.length === 0) return null;

    const days = getLast14Days();
    const succeeded = new Map<string, number>();
    const failed = new Map<string, number>();
    const other = new Map<string, number>();
    for (const d of days) {
      succeeded.set(d, 0);
      failed.set(d, 0);
      other.set(d, 0);
    }

    for (const run of runs) {
      const dateStr = (run.createdAt ?? run.startedAt ?? run.date ?? '').slice(0, 10);
      if (!succeeded.has(dateStr)) continue;
      const status = run.status ?? '';
      if (status === 'succeeded') {
        succeeded.set(dateStr, (succeeded.get(dateStr) ?? 0) + 1);
      } else if (status === 'failed' || status === 'timed_out') {
        failed.set(dateStr, (failed.get(dateStr) ?? 0) + 1);
      } else {
        other.set(dateStr, (other.get(dateStr) ?? 0) + 1);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle },
      grid: chartGrid,
      xAxis: makeXAxis(days),
      yAxis: makeYAxis(),
      series: [
        {
          name: 'Succeeded',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 12,
          data: days.map((d) => succeeded.get(d) ?? 0),
          itemStyle: { color: '#10b981' },
        },
        {
          name: 'Failed',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 12,
          data: days.map((d) => failed.get(d) ?? 0),
          itemStyle: { color: '#ef4444' },
        },
        {
          name: 'Other',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 12,
          data: days.map((d) => other.get(d) ?? 0),
          itemStyle: { color: '#71717a' },
        },
      ],
    };
  });

  // ── Chart 2: Issues by Priority ────────────────────────────────────
  const priorityConfig = [
    { key: 'critical', label: 'Critical', color: '#ef4444' },
    { key: 'high', label: 'High', color: '#f97316' },
    { key: 'medium', label: 'Medium', color: '#eab308' },
    { key: 'low', label: 'Low', color: '#6b7280' },
  ];

  let priorityChartOption = $derived.by((): EChartsOption | null => {
    if (issues.length === 0) return null;

    const days = getLast14Days();
    const buckets = new Map<string, Map<string, number>>();
    for (const d of days) {
      const m = new Map<string, number>();
      for (const p of priorityConfig) m.set(p.key, 0);
      buckets.set(d, m);
    }

    for (const issue of issues) {
      const dateStr = (issue.createdAt ?? '').slice(0, 10);
      const dayBucket = buckets.get(dateStr);
      if (!dayBucket) continue;
      const pri = issue.priority ?? 'medium';
      dayBucket.set(pri, (dayBucket.get(pri) ?? 0) + 1);
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle },
      grid: chartGrid,
      xAxis: makeXAxis(days),
      yAxis: makeYAxis(),
      series: priorityConfig.map((p) => ({
        name: p.label,
        type: 'bar' as const,
        stack: 'total',
        barMaxWidth: 12,
        data: days.map((d) => buckets.get(d)?.get(p.key) ?? 0),
        itemStyle: { color: p.color },
      })),
    };
  });

  // ── Chart 3: Issues by Status ──────────────────────────────────────
  const statusConfig = [
    { key: 'todo', label: 'To Do', color: '#3b82f6' },
    { key: 'in_progress', label: 'In Progress', color: '#8b5cf6' },
    { key: 'in_review', label: 'In Review', color: '#a855f7' },
    { key: 'done', label: 'Done', color: '#10b981' },
    { key: 'blocked', label: 'Blocked', color: '#ef4444' },
    { key: 'cancelled', label: 'Cancelled', color: '#6b7280' },
    { key: 'backlog', label: 'Backlog', color: '#64748b' },
  ];

  let statusChartOption = $derived.by((): EChartsOption | null => {
    if (issues.length === 0) return null;

    const days = getLast14Days();
    const buckets = new Map<string, Map<string, number>>();
    for (const d of days) {
      const m = new Map<string, number>();
      for (const s of statusConfig) m.set(s.key, 0);
      buckets.set(d, m);
    }

    for (const issue of issues) {
      const dateStr = (issue.createdAt ?? '').slice(0, 10);
      const dayBucket = buckets.get(dateStr);
      if (!dayBucket) continue;
      const st = issue.status ?? 'backlog';
      dayBucket.set(st, (dayBucket.get(st) ?? 0) + 1);
    }

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, ...tooltipStyle },
      grid: chartGrid,
      xAxis: makeXAxis(days),
      yAxis: makeYAxis(),
      series: statusConfig.map((s) => ({
        name: s.label,
        type: 'bar' as const,
        stack: 'total',
        barMaxWidth: 12,
        data: days.map((d) => buckets.get(d)?.get(s.key) ?? 0),
        itemStyle: { color: s.color },
      })),
    };
  });

  // ── Chart 4: Success Rate ──────────────────────────────────────────
  let successRateOption = $derived.by((): EChartsOption | null => {
    if (runs.length === 0) return null;

    const days = getLast14Days();
    const succeededMap = new Map<string, number>();
    const totalMap = new Map<string, number>();
    for (const d of days) {
      succeededMap.set(d, 0);
      totalMap.set(d, 0);
    }

    for (const run of runs) {
      const dateStr = (run.createdAt ?? run.startedAt ?? run.date ?? '').slice(0, 10);
      if (!totalMap.has(dateStr)) continue;
      totalMap.set(dateStr, (totalMap.get(dateStr) ?? 0) + 1);
      if (run.status === 'succeeded') {
        succeededMap.set(dateStr, (succeededMap.get(dateStr) ?? 0) + 1);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        ...tooltipStyle,
        formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p.dataIndex;
          const day = days[idx];
          const total = totalMap.get(day) ?? 0;
          const rate = total > 0 ? Math.round(((succeededMap.get(day) ?? 0) / total) * 100) : 0;
          return `${day}<br/>Rate: ${total > 0 ? rate + '%' : 'N/A'} (${succeededMap.get(day) ?? 0}/${total})`;
        },
      },
      grid: chartGrid,
      xAxis: makeXAxis(days),
      yAxis: { ...makeYAxis(), max: 100 },
      series: [
        {
          type: 'bar',
          barMaxWidth: 12,
          data: days.map((d) => {
            const total = totalMap.get(d) ?? 0;
            if (total === 0) {
              return { value: 5, itemStyle: { color: '#27272a' } };
            }
            const rate = (succeededMap.get(d) ?? 0) / total;
            const pct = Math.round(rate * 100);
            const color = rate >= 0.8 ? '#10b981' : rate >= 0.5 ? '#eab308' : '#ef4444';
            return { value: pct, itemStyle: { color } };
          }),
        },
      ],
    };
  });
</script>

{#if loading}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {#each Array(4) as _}
      <div class="border border-border rounded-lg p-4 space-y-2 bg-card">
        <div class="h-3 w-20 animate-pulse rounded bg-accent/75"></div>
        <div class="h-[80px] animate-pulse rounded bg-accent/40"></div>
      </div>
    {/each}
  </div>
{:else}
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Chart 1: Run Activity -->
    <div class="border border-border rounded-lg p-4 space-y-2 bg-card">
      <div>
        <h3 class="text-xs font-medium text-muted-foreground">Run Activity</h3>
        <span class="text-[10px] text-muted-foreground/60">Last 14 days</span>
      </div>
      {#if runActivityOption}
        <BaseChart option={runActivityOption} height="80px" />
      {:else}
        <div class="flex h-[80px] items-center justify-center">
          <p class="text-[10px] text-muted-foreground/60">No runs yet</p>
        </div>
      {/if}
    </div>

    <!-- Chart 2: Issues by Priority -->
    <div class="border border-border rounded-lg p-4 space-y-2 bg-card">
      <div>
        <h3 class="text-xs font-medium text-muted-foreground">Issues by Priority</h3>
        <span class="text-[10px] text-muted-foreground/60">Last 14 days</span>
      </div>
      {#if priorityChartOption}
        <BaseChart option={priorityChartOption} height="80px" />
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          {#each priorityConfig as p}
            <div class="flex items-center gap-1">
              <span class="inline-block h-2 w-2 rounded-full" style="background:{p.color}"></span>
              <span class="text-[9px] text-muted-foreground">{p.label}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex h-[80px] items-center justify-center">
          <p class="text-[10px] text-muted-foreground/60">No issues</p>
        </div>
      {/if}
    </div>

    <!-- Chart 3: Issues by Status -->
    <div class="border border-border rounded-lg p-4 space-y-2 bg-card">
      <div>
        <h3 class="text-xs font-medium text-muted-foreground">Issues by Status</h3>
        <span class="text-[10px] text-muted-foreground/60">Last 14 days</span>
      </div>
      {#if statusChartOption}
        <BaseChart option={statusChartOption} height="80px" />
        <div class="flex flex-wrap gap-x-3 gap-y-1">
          {#each statusConfig as s}
            <div class="flex items-center gap-1">
              <span class="inline-block h-2 w-2 rounded-full" style="background:{s.color}"></span>
              <span class="text-[9px] text-muted-foreground">{s.label}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex h-[80px] items-center justify-center">
          <p class="text-[10px] text-muted-foreground/60">No issues</p>
        </div>
      {/if}
    </div>

    <!-- Chart 4: Success Rate -->
    <div class="border border-border rounded-lg p-4 space-y-2 bg-card">
      <div>
        <h3 class="text-xs font-medium text-muted-foreground">Success Rate</h3>
        <span class="text-[10px] text-muted-foreground/60">Last 14 days</span>
      </div>
      {#if successRateOption}
        <BaseChart option={successRateOption} height="80px" />
      {:else}
        <div class="flex h-[80px] items-center justify-center">
          <p class="text-[10px] text-muted-foreground/60">No runs yet</p>
        </div>
      {/if}
    </div>
  </div>
{/if}
