<script lang="ts">
  /**
   * BaseChart — ECharts wrapper for Svelte 5.
   * Handles initialization, resize, theme reactivity, and cleanup.
   */
  import * as echarts from 'echarts/core';
  import { CanvasRenderer } from 'echarts/renderers';
  import type { EChartsOption } from 'echarts';
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    option: EChartsOption;
    height?: string;
    class?: string;
  }

  let { option, height = '300px', class: className = '' }: Props = $props();

  let container: HTMLDivElement | undefined = $state();
  let chart: echarts.ECharts | undefined;
  let resizeObs: ResizeObserver | undefined;
  let themeObs: MutationObserver | undefined;
  let currentTheme: string | undefined;

  echarts.use([CanvasRenderer]);

  function detectTheme(): string | undefined {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.classList.contains('dark') ? 'dark' : undefined;
  }

  function initChart() {
    if (!container) return;
    const theme = detectTheme();
    if (chart && currentTheme === theme) return; // no change
    chart?.dispose();
    currentTheme = theme;
    chart = echarts.init(container, theme, { renderer: 'canvas' });
    chart.setOption({ backgroundColor: 'transparent', ...option }, { notMerge: true });
  }

  onMount(() => {
    if (!container) return;
    initChart();

    resizeObs = new ResizeObserver(() => chart?.resize());
    resizeObs.observe(container);

    // Watch theme class changes
    themeObs = new MutationObserver(() => {
      const newTheme = detectTheme();
      if (newTheme !== currentTheme) initChart();
    });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  });

  onDestroy(() => {
    themeObs?.disconnect();
    resizeObs?.disconnect();
    chart?.dispose();
    chart = undefined;
  });

  // React to option changes only
  $effect(() => {
    if (chart && option) {
      chart.setOption({ backgroundColor: 'transparent', ...option }, { notMerge: true });
    }
  });
</script>

<div bind:this={container} class={className} style="height: {height}; width: 100%;"></div>
