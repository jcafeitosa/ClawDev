<script lang="ts">
  /**
   * FlipWords — Animated rotating placeholder text for empty states.
   * Words flip/rotate through with Y-axis rotation + opacity transition.
   * Respects prefers-reduced-motion.
   */

  interface Props {
    words?: string[];
    interval?: number;
    class?: string;
  }

  let {
    words = ['Start a conversation...', 'Share an idea...', 'Ask a question...', 'Collaborate together...'],
    interval = 3000,
    class: className = '',
  }: Props = $props();

  let currentIndex = $state(0);
  let animating = $state(false);

  $effect(() => {
    const timer = setInterval(() => {
      animating = true;
      setTimeout(() => {
        currentIndex = (currentIndex + 1) % words.length;
        animating = false;
      }, 400);
    }, interval);

    return () => clearInterval(timer);
  });

  let currentWord = $derived(words[currentIndex]);
</script>

<span
  class="inline-block flip-word {className}"
  class:flip-word-exit={animating}
  class:flip-word-enter={!animating}
  aria-live="polite"
>
  {currentWord}
</span>
