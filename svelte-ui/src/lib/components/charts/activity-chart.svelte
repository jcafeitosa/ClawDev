<script lang="ts">
  /**
   * ActivityChart — shows agent activity over time (area chart).
   */
  import { LineChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import type { EChartsOption } from 'echarts';
  import BaseChart from './base-chart.svelte';

  echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent]);

  interface Props {
    data: { date: string; runs: number; issues: number }[];
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
    },
    legend: {
      data: ['Runs', 'Issues'],
      textStyle: { color: '#a1a1aa' },
      top: 0,
    },
    grid: { left: 40, right: 16, top: 40, bottom: 24 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: '#3f3f46' } },
      axisLabel: { color: '#71717a', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#27272a' } },
      axisLabel: { color: '#71717a', fontSize: 11 },
    },
    series: [
      {
        name: 'Runs',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.runs),
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(99, 102, 241, 0.3)' },
          { offset: 1, color: 'rgba(99, 102, 241, 0)' },
        ])},
        lineStyle: { color: '#6366f1', width: 2 },
        itemStyle: { color: '#6366f1' },
      },
      {
        name: 'Issues',
        type: 'line',
        smooth: true,
        data: data.map((d) => d.issues),
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
          { offset: 1, color: 'rgba(16, 185, 129, 0)' },
        ])},
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
      },
    ],
  });
</script>

<BaseChart {option} {height} class={className} />
