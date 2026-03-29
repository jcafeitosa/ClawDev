<script lang="ts">
  import { ArrowDown } from 'lucide-svelte';
  import { onMount, onDestroy } from 'svelte';

  let { target = undefined }: { target?: HTMLElement | undefined } = $props();

  let visible = $state(false);
  let scrollEl: HTMLElement | Window = $state(window);

  function getScrollTarget(): HTMLElement | Window {
    return target ?? window;
  }

  function getScrollTop(): number {
    const el = getScrollTarget();
    if (el instanceof Window) return window.scrollY;
    return el.scrollTop;
  }

  function getScrollMax(): number {
    const el = getScrollTarget();
    if (el instanceof Window) return document.documentElement.scrollHeight - window.innerHeight;
    return el.scrollHeight - el.clientHeight;
  }

  function handleScroll() {
    const top = getScrollTop();
    const max = getScrollMax();
    visible = max > 200 && top < max - 150;
  }

  function scrollToBottom() {
    const el = getScrollTarget();
    if (el instanceof Window) {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }

  onMount(() => {
    scrollEl = getScrollTarget();
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  });

  onDestroy(() => {
    scrollEl?.removeEventListener?.('scroll', handleScroll);
  });
</script>

{#if visible}
  <button
    onclick={scrollToBottom}
    aria-label="Scroll to bottom"
    class="fixed bottom-20 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full
           bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:scale-105
           active:scale-95 md:bottom-6 animate-in fade-in slide-in-from-bottom-2"
  >
    <ArrowDown class="h-4 w-4" />
  </button>
{/if}
