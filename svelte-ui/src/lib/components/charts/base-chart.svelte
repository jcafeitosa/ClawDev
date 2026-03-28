<script lang="ts">
  /**
   * BaseChart — ECharts wrapper for Svelte 5.
   * Handles initialization, resize, theme, and cleanup.
   */
  import * as echarts from 'echarts/core';
  import { CanvasRenderer } from 'echarts/renderers';
  import type { EChartsOption } from 'echarts';

  interface Props {
    option: EChartsOption;
    height?: string;
    class?: string;
    theme?: 'light' | 'dark';
  }

  let { option, height = '300px', class: className = '', theme = 'dark' }: Props = $props();

  let container: HTMLDivElement | undefined = $state();
  let chart: echarts.ECharts | undefined = $state();

  // Register renderer once
  echarts.use([CanvasRenderer]);

  $effect(() => {
    if (!container) return;

    chart = echarts.init(container, theme === 'dark' ? 'dark' : undefined, {
      renderer: 'canvas',
    });

    const observer = new ResizeObserver(() => chart?.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart?.dispose();
    };
  });

  $effect(() => {
    if (chart && option) {
      chart.setOption(option, { notMerge: true });
    }
  });
</script>

<div bind:this={container} class={className} style="height: {height}; width: 100%;"></div>
