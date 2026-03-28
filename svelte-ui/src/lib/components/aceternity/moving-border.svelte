<script lang="ts">
  /**
   * MovingBorder — animated border that travels around a container.
   * Inspired by Aceternity UI, ported to Svelte 5.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    duration?: number;
    borderRadius?: string;
    class?: string;
    containerClass?: string;
    borderColor?: string;
  }

  let {
    children,
    duration = 3000,
    borderRadius = '1rem',
    class: className = '',
    containerClass = '',
    borderColor = 'hsl(240 80% 65%)',
  }: Props = $props();

  let animDuration = $derived(`${duration}ms`);
</script>

<div
  class="relative overflow-hidden p-[1px] {containerClass}"
  style="border-radius: {borderRadius};"
>
  <div
    class="absolute inset-0"
    style="border-radius: {borderRadius};"
  >
    <div
      class="absolute h-[200%] w-[200%] animate-moving-border"
      style="
        --border-color: {borderColor};
        --duration: {animDuration};
        background: conic-gradient(from 0deg, transparent 0 340deg, {borderColor} 360deg);
        top: -50%;
        left: -50%;
      "
    ></div>
  </div>
  <div
    class="relative bg-white dark:bg-zinc-950 {className}"
    style="border-radius: calc({borderRadius} - 1px);"
  >
    {@render children()}
  </div>
</div>

<style>
  @keyframes moving-border-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  :global(.animate-moving-border) {
    animation: moving-border-spin var(--duration, 3000ms) linear infinite;
  }
</style>
