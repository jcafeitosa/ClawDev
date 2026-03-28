<script lang="ts">
  /**
   * Sparkles — configurable sparkle particle effect.
   * Inspired by Aceternity UI, ported to Svelte 5.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
    class?: string;
    particleCount?: number;
    color?: string;
  }

  let { children, class: className = '', particleCount = 12, color = '#8b5cf6' }: Props = $props();

  let particles = $derived(
    Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      size: Math.random() * 3 + 1,
      top: Math.random() * 100,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      duration: Math.random() * 1.5 + 1,
    })),
  );
</script>

<div class="relative inline-block {className}">
  {#each particles as p (p.id)}
    <span
      class="absolute rounded-full pointer-events-none animate-sparkle-pulse"
      style="
        width: {p.size}px;
        height: {p.size}px;
        top: {p.top}%;
        left: {p.left}%;
        background: {color};
        animation-delay: {p.delay}s;
        animation-duration: {p.duration}s;
      "
    ></span>
  {/each}
  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  @keyframes sparkle-pulse {
    0%, 100% { opacity: 0; transform: scale(0); }
    50% { opacity: 1; transform: scale(1); }
  }
  :global(.animate-sparkle-pulse) {
    animation: sparkle-pulse 2s ease-in-out infinite;
  }
</style>
