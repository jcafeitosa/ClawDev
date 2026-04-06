<script lang="ts">
  /**
   * TextGenerateEffect — word-by-word fade-in animation.
   * Inspired by Aceternity UI, ported to Svelte 5.
   */
  import { onDestroy } from 'svelte';

  interface Props {
    text: string;
    speed?: number;
    className?: string;
    oncomplete?: () => void;
  }

  let { text, speed = 40, className = '', oncomplete }: Props = $props();

  let words = $derived(text.split(/(\s+)/));
  let currentIndex = $state(0);
  let intervalId: ReturnType<typeof setInterval> | undefined;

  // Respect prefers-reduced-motion
  let prefersReducedMotion = $state(false);

  $effect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mql.matches;
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotion = e.matches; };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  });

  $effect(() => {
    // Reset on text change
    currentIndex = 0;
    if (intervalId) clearInterval(intervalId);

    if (prefersReducedMotion) {
      currentIndex = words.length;
      oncomplete?.();
      return;
    }

    intervalId = setInterval(() => {
      if (currentIndex < words.length) {
        currentIndex++;
      } else {
        clearInterval(intervalId);
        intervalId = undefined;
        oncomplete?.();
      }
    }, speed);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

<span class={className}>
  {#each words as word, i (i)}
    <span
      class="inline transition-all duration-300 ease-out"
      style="opacity: {i < currentIndex ? 1 : 0}; filter: blur({i < currentIndex ? 0 : 4}px);"
    >{word}</span>
  {/each}
</span>
