<script lang="ts">
  /**
   * ActivityCharts — 2x2 grid of mini dashboard charts:
   * 1. Run Activity (line)
   * 2. Issues by Priority (donut)
   * 3. Issues by Status (horizontal bar)
   * 4. Success Rate (gauge donut)
   */
  import { LineChart, PieChart, BarChart } from 'echarts/charts';
  import {
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
  } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import BaseChart from './base-chart.svelte';
  import { api } from '$lib/api';
  import type { EChartsOption } from 'echarts';

  echarts.use([
    LineChart,
    PieChart,
    BarChart,
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
  ]);

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

  // ── Chart 1: Run Activity (line) ────────────────────────────────────
  let runActivityOption = $derived.by((): EChartsOption => {
    const today = new Date();
    const days: string[] = [];
    const countsMap = new Map<string, number>();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
      countsMap.set(key, 0);
    }

    for (const run of runs) {
      const dateStr = (run.createdAt ?? run.startedAt ?? run.date ?? '').slice(0, 10);
      if (countsMap.has(dateStr)) {
        countsMap.set(dateStr, (countsMap.get(dateStr) ?? 0) + 1);
      }
    }

    const values = days.map((d) => countsMap.get(d) ?? 0);
    const labels = days.map((d) => {
      const dt = new Date(d + 'T00:00:00');
      return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    });

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      grid: { left: 36, right: 12, top: 12, bottom: 24 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#3f3f46' } },
        axisLabel: { color: '#71717a', fontSize: 10, rotate: 0 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#27272a' } },
        axisLabel: { color: '#71717a', fontSize: 10 },
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: values,
          symbol: 'circle',
          symbolSize: 6,
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99, 102, 241, 0.35)' },
              { offset: 1, color: 'rgba(99, 102, 241, 0)' },
            ]),
          },
          lineStyle: { color: '#6366f1', width: 2.5 },
          itemStyle: { color: '#6366f1', borderColor: '#1a1a24', borderWidth: 2 },
        },
      ],
    };
  });

  // ── Chart 2: Issues by Priority (donut) ─────────────────────────────
  let priorityChartOption = $derived.by((): EChartsOption => {
    const priorityConfig = [
      { key: 'critical', label: 'Critical', color: '#EF4444' },
      { key: 'high', label: 'High', color: '#F97316' },
      { key: 'medium', label: 'Medium', color: '#3B82F6' },
      { key: 'low', label: 'Low', color: '#71717A' },
    ];

    const counts = new Map<string, number>();
    for (const p of priorityConfig) counts.set(p.key, 0);

    for (const issue of issues) {
      const pri = issue.priority ?? 'medium';
      counts.set(pri, (counts.get(pri) ?? 0) + 1);
    }

    const data = priorityConfig
      .map((p) => ({ name: p.label, value: counts.get(p.key) ?? 0, itemStyle: { color: p.color } }))
      .filter((d) => d.value > 0);

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'center',
        textStyle: { color: '#a1a1aa', fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 8,
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '75%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: true,
          label: { show: false },
          emphasis: {
            label: { show: false },
            scaleSize: 4,
          },
          data,
        },
      ],
    };
  });

  // ── Chart 3: Issues by Status (horizontal bar) ──────────────────────
  let statusChartOption = $derived.by((): EChartsOption => {
    const statusConfig = [
      { key: 'backlog', label: 'Backlog', color: '#64748b' },
      { key: 'todo', label: 'To Do', color: '#2563eb' },
      { key: 'in_progress', label: 'In Progress', color: '#f59e0b' },
      { key: 'in_review', label: 'In Review', color: '#8b5cf6' },
      { key: 'done', label: 'Done', color: '#10b981' },
    ];

    const counts = new Map<string, number>();
    for (const s of statusConfig) counts.set(s.key, 0);

    for (const issue of issues) {
      const st = issue.status ?? 'backlog';
      if (counts.has(st)) {
        counts.set(st, (counts.get(st) ?? 0) + 1);
      }
    }

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 11 },
      },
      grid: { left: 80, right: 24, top: 8, bottom: 8 },
      xAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#27272a' } },
        axisLabel: { color: '#71717a', fontSize: 10 },
      },
      yAxis: {
        type: 'category',
        data: statusConfig.map((s) => s.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#a1a1aa', fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: statusConfig.map((s) => ({
            value: counts.get(s.key) ?? 0,
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: s.color },
                { offset: 1, color: s.color + '99' },
              ]),
              borderRadius: [0, 4, 4, 0],
            },
          })),
          barWidth: 14,
        },
      ],
    };
  });

  // ── Chart 4: Success Rate (donut gauge) ─────────────────────────────
  let successRateOption = $derived.by((): EChartsOption => {
    let success = 0;
    let failed = 0;

    for (const run of runs) {
      const status = (run.status ?? '').toLowerCase();
      if (status === 'success' || status === 'completed' || status === 'passed') {
        success++;
      } else if (status === 'failed' || status === 'error' || status === 'errored') {
        failed++;
      }
    }

    const total = success + failed;
    const rate = total > 0 ? Math.round((success / total) * 100) : 0;
    const rateColor = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#fff', fontSize: 11 },
        formatter: '{b}: {c}',
      },
      graphic: [
        {
          type: 'group',
          left: 'center',
          top: 'center',
          children: [
            {
              type: 'text',
              style: {
                text: total > 0 ? `${rate}%` : 'N/A',
                fill: '#F8FAFC',
                fontSize: 22,
                fontWeight: 'bold' as const,
                textAlign: 'center' as const,
                textVerticalAlign: 'middle' as const,
              },
              left: 'center',
              top: -8,
            },
            {
              type: 'text',
              style: {
                text: total > 0 ? `${success}/${total} runs` : 'No runs',
                fill: '#71717a',
                fontSize: 11,
                textAlign: 'center' as const,
                textVerticalAlign: 'middle' as const,
              },
              left: 'center',
              top: 16,
            },
          ],
        },
      ],
      series: [
        {
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: { scaleSize: 3 },
          data:
            total > 0
              ? [
                  { value: success, name: 'Success', itemStyle: { color: rateColor } },
                  { value: failed, name: 'Failed', itemStyle: { color: '#ef444466' } },
                ]
              : [{ value: 1, name: 'No data', itemStyle: { color: '#27272a' } }],
        },
      ],
    };
  });
</script>

{#if loading}
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    {#each Array(4) as _}
      <div class="rounded-xl border border-border bg-card p-4">
        <div class="mb-3 h-4 w-28 animate-pulse rounded bg-accent/75"></div>
        <div class="h-[200px] animate-pulse rounded-lg bg-accent/40"></div>
      </div>
    {/each}
  </div>
{:else}
  <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
    <!-- Run Activity -->
    <div class="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Run Activity
      </h3>
      <BaseChart option={runActivityOption} height="200px" />
    </div>

    <!-- Issues by Priority -->
    <div class="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Issues by Priority
      </h3>
      {#if issues.length === 0}
        <div class="flex h-[200px] items-center justify-center">
          <p class="text-xs text-muted-foreground/60">No issues</p>
        </div>
      {:else}
        <BaseChart option={priorityChartOption} height="200px" />
      {/if}
    </div>

    <!-- Issues by Status -->
    <div class="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Issues by Status
      </h3>
      {#if issues.length === 0}
        <div class="flex h-[200px] items-center justify-center">
          <p class="text-xs text-muted-foreground/60">No issues</p>
        </div>
      {:else}
        <BaseChart option={statusChartOption} height="200px" />
      {/if}
    </div>

    <!-- Success Rate -->
    <div class="rounded-xl border border-border bg-card p-4 transition-colors hover:border-border">
      <h3 class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Success Rate
      </h3>
      <BaseChart option={successRateOption} height="200px" />
    </div>
  </div>
{/if}
