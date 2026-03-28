<script lang="ts">
  /**
   * BackgroundGradient — animated gradient border effect for cards.
   * Inspired by Aceternity UI, ported to Svelte 5.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    class?: string;
    containerClass?: string;
    animate?: boolean;
  }

  let { children, class: className = '', containerClass = '', animate = true }: Props = $props();
</script>

<div class="relative p-[2px] group {containerClass}">
  <div
    class="absolute inset-0 rounded-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 blur-xl
      {animate ? 'animate-gradient-shift' : ''}"
    style="background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899, #f97316, #3b82f6);
           background-size: 400% 400%;"
  ></div>
  <div
    class="absolute inset-0 rounded-2xl
      {animate ? 'animate-gradient-shift' : ''}"
    style="background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899, #f97316, #3b82f6);
           background-size: 400% 400%;"
  ></div>
  <div class="relative rounded-[14px] bg-white dark:bg-zinc-950 {className}">
    {@render children()}
  </div>
</div>

<style>
  @keyframes gradient-shift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  :global(.animate-gradient-shift) {
    animation: gradient-shift 5s ease infinite;
  }
</style>
