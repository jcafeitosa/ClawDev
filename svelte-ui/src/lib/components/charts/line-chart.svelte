<script lang="ts">
  /**
   * LineChart — ECharts line/area for trends over time (cost, runs, etc.)
   */
  import { LineChart as ELine } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import BaseChart from './base-chart.svelte';
  import type { EChartsOption } from 'echarts';

  echarts.use([ELine, GridComponent, TooltipComponent, LegendComponent]);

  interface Series {
    name: string;
    data: number[];
    color?: string;
    area?: boolean;
  }

  interface Props {
    labels: string[];
    series: Series[];
    height?: string;
    title?: string;
    yAxisLabel?: string;
    smooth?: boolean;
    class?: string;
  }

  let { labels, series, height = '250px', title = '', yAxisLabel = '', smooth = true, class: className = '' }: Props = $props();

  const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#ef4444', '#8b5cf6'];

  let option = $derived<EChartsOption>({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'auto',
      textStyle: { fontSize: 12 },
    },
    legend: {
      show: series.length > 1,
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 12,
      itemHeight: 3,
    },
    grid: { left: 40, right: 16, top: title ? 30 : 16, bottom: series.length > 1 ? 35 : 16, containLabel: false },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      name: yAxisLabel,
      nameTextStyle: { color: '#64748b', fontSize: 10 },
      axisLine: { show: false },
      axisLabel: { color: '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line' as const,
      smooth,
      data: s.data,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2, color: s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] },
      itemStyle: { color: s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] },
      ...(s.area ? {
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: (s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]) + '40' },
            { offset: 1, color: (s.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]) + '05' },
          ]),
        },
      } : {}),
    })),
  });
</script>

{#if title}
  <div class="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
{/if}
<BaseChart {option} {height} class={className} />
