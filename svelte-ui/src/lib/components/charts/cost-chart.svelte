<script lang="ts">
  /**
   * CostChart — shows LLM cost breakdown (bar + line combo).
   */
  import { BarChart, LineChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import type { EChartsOption } from 'echarts';
  import BaseChart from './base-chart.svelte';

  echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent]);

  interface Props {
    data: { date: string; input: number; output: number; total: number }[];
    height?: string;
    class?: string;
  }

  let { data, height = '300px', class: className = '' }: Props = $props();

  let option = $derived<EChartsOption>({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(0,0,0,0.8)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fff', fontSize: 12 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      valueFormatter: (v: any) => `$${Number(v).toFixed(4)}`,
    },
    legend: {
      data: ['Input tokens', 'Output tokens', 'Total'],
      textStyle: { color: '#a1a1aa' },
      top: 0,
    },
    grid: { left: 50, right: 16, top: 40, bottom: 24 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#71717a', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#71717a', fontSize: 11, formatter: '${value}' },
    },
    series: [
      {
        name: 'Input tokens',
        type: 'bar',
        stack: 'cost',
        data: data.map((d) => d.input),
        itemStyle: { color: '#6366f1', borderRadius: [0, 0, 0, 0] },
      },
      {
        name: 'Output tokens',
        type: 'bar',
        stack: 'cost',
        data: data.map((d) => d.output),
        itemStyle: { color: '#8b5cf6', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Total',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.total),
        lineStyle: { color: '#f97316', width: 2, type: 'dashed' },
        itemStyle: { color: '#f97316' },
        symbol: 'none',
      },
    ],
  });
</script>

<BaseChart {option} {height} class={className} />
