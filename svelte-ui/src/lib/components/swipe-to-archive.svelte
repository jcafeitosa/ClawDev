<script lang="ts">
  import { Archive } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    onArchive,
    threshold = 100,
    children,
  }: {
    onArchive: () => void;
    threshold?: number;
    children: Snippet;
  } = $props();

  let startX = $state(0);
  let currentX = $state(0);
  let swiping = $state(false);
  let archived = $state(false);

  let offset = $derived(swiping ? Math.max(0, startX - currentX) : 0);
  let triggered = $derived(offset > threshold);

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    currentX = startX;
    swiping = true;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!swiping) return;
    currentX = e.touches[0].clientX;
  }

  function handleTouchEnd() {
    if (triggered && !archived) {
      archived = true;
      onArchive();
    }
    swiping = false;
    startX = 0;
    currentX = 0;
  }
</script>

<div
  class="relative overflow-hidden rounded-xl touch-pan-y"
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  role="group"
>
  <!-- Archive reveal background -->
  <div
    class="absolute inset-y-0 right-0 flex items-center justify-end px-5 transition-colors
           {triggered ? 'bg-red-600' : 'bg-red-600/30'}"
    style="width: {Math.max(offset, 0)}px;"
  >
    {#if offset > 30}
      <Archive class="h-5 w-5 text-white {triggered ? 'scale-110' : 'scale-100'} transition-transform" />
    {/if}
  </div>

  <!-- Content -->
  <div
    class="relative transition-transform {swiping ? '' : 'duration-200'}"
    style="transform: translateX({swiping ? -offset : 0}px);"
  >
    {@render children()}
  </div>
</div>
