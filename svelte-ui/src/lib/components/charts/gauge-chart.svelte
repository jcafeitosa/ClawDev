<script lang="ts">
  /**
   * GaugeChart — ECharts gauge for single-metric display (budget %, success rate, etc.)
   * Colors graduate from green → yellow → red based on value.
   */
  import { GaugeChart as EGauge } from 'echarts/charts';
  import { TooltipComponent } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import BaseChart from './base-chart.svelte';
  import type { EChartsOption } from 'echarts';

  echarts.use([EGauge, TooltipComponent]);

  interface Props {
    value: number;
    max?: number;
    label?: string;
    height?: string;
    /** "ascending" = green→red (budget spend). "descending" = red→green (success rate) */
    colorMode?: 'ascending' | 'descending';
    class?: string;
  }

  let { value, max = 100, label = '', height = '200px', colorMode = 'ascending', class: className = '' }: Props = $props();

  let percent = $derived(Math.min(100, Math.max(0, (value / max) * 100)));

  let colorStops = $derived(
    colorMode === 'ascending'
      ? [[0.6, '#22c55e'], [0.8, '#eab308'], [1, '#ef4444']] // green → yellow → red
      : [[0.4, '#ef4444'], [0.7, '#eab308'], [1, '#22c55e']], // red → yellow → green
  );

  let option = $derived<EChartsOption>({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      itemStyle: { color: 'auto' },
      progress: {
        show: true,
        roundCap: true,
        width: 14,
      },
      pointer: { show: false },
      axisLine: {
        roundCap: true,
        lineStyle: { width: 14, color: colorStops as any },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: {
        show: !!label,
        fontSize: 12,
        color: '#94a3b8',
        offsetCenter: [0, '65%'],
      },
      detail: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'auto',
        offsetCenter: [0, '30%'],
        formatter: (v: number) => `${Math.round(v)}%`,
        valueAnimation: true,
      },
      data: [{ value: percent, name: label }],
    }],
  });
</script>

<BaseChart {option} {height} class={className} />
