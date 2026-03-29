<script lang="ts">
  /**
   * CardHoverEffect — card with animated hover spotlight.
   * Inspired by Aceternity UI, ported to Svelte 5.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    class?: string;
  }

  let { children, class: className = '' }: Props = $props();

  let mouseX = $state(0);
  let mouseY = $state(0);
  let isHovered = $state(false);

  function handleMouseMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  }
</script>

<div
  class="relative overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow duration-300
    hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900 {className}"
  onmouseenter={() => (isHovered = true)}
  onmouseleave={() => (isHovered = false)}
  onmousemove={handleMouseMove}
  role="presentation"
>
  {#if isHovered}
    <div
      class="pointer-events-none absolute -inset-px rounded-xl opacity-30 transition-opacity duration-300"
      style="background: radial-gradient(400px circle at {mouseX}px {mouseY}px, rgba(139, 92, 246, 0.15), transparent 40%);"
    ></div>
  {/if}
  <div class="relative">
    {@render children()}
  </div>
</div>
