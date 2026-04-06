<script lang="ts">
  /**
   * PieChart — ECharts doughnut for proportional data (agent status, issue breakdown, etc.)
   */
  import { PieChart as EPie } from 'echarts/charts';
  import { TooltipComponent, LegendComponent } from 'echarts/components';
  import * as echarts from 'echarts/core';
  import BaseChart from './base-chart.svelte';
  import type { EChartsOption } from 'echarts';
  import { CHART_SERIES_COLORS } from '$lib/constants/visual';

  echarts.use([EPie, TooltipComponent, LegendComponent]);

  interface DataItem {
    name: string;
    value: number;
    color?: string;
  }

  interface Props {
    data: DataItem[];
    height?: string;
    title?: string;
    doughnut?: boolean;
    class?: string;
  }

  let { data, height = '250px', title = '', doughnut = true, class: className = '' }: Props = $props();

  let option = $derived<EChartsOption>({
    tooltip: {
      trigger: 'item',
      backgroundColor: 'auto',
      textStyle: { fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      orient: 'horizontal',
      bottom: 0,
      textStyle: { color: '#94a3b8', fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 8,
    },
    series: [{
      type: 'pie',
      radius: doughnut ? ['45%', '70%'] : ['0%', '70%'],
      center: ['50%', '45%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: doughnut ? 6 : 0, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 13, fontWeight: 'bold', fontFamily: 'Inter, sans-serif' },
        itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' },
      },
      data: data.map((d, i) => ({
        name: d.name,
        value: d.value,
        itemStyle: { color: d.color ?? CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length] },
      })),
    }],
  });
</script>

{#if title}
  <div class="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
{/if}
<BaseChart {option} {height} class={className} />
