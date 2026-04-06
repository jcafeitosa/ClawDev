<script lang="ts">
  /**
   * AnimatedTooltip — Spring-animated rich tooltip with caret arrow.
   * Supports text and rich content (via Snippet). Scale 0.9->1 + fade in.
   * Respects prefers-reduced-motion.
   */
  import type { Snippet } from 'svelte';

  interface Props {
    text?: string;
    content?: Snippet;
    children: Snippet;
    position?: 'top' | 'bottom';
    delay?: number;
  }

  let {
    text = '',
    content,
    children,
    position = 'top',
    delay = 200,
  }: Props = $props();

  let visible = $state(false);
  let showTimeout: ReturnType<typeof setTimeout> | undefined;
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;
  let triggerEl: HTMLDivElement | undefined = $state();
  let tooltipX = $state(0);
  let tooltipY = $state(0);

  function show() {
    clearTimeout(hideTimeout);
    showTimeout = setTimeout(() => {
      if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        tooltipX = rect.left + rect.width / 2;
        tooltipY = position === 'top' ? rect.top - 8 : rect.bottom + 8;
      }
      visible = true;
    }, delay);
  }

  function hide() {
    clearTimeout(showTimeout);
    hideTimeout = setTimeout(() => { visible = false; }, 100);
  }
</script>

<div
  class="inline-block"
  bind:this={triggerEl}
  role="presentation"
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
>
  {@render children()}
</div>

{#if visible}
  <div
    class="animated-tooltip-popup fixed z-[9999] pointer-events-none"
    style="left: {tooltipX}px; top: {tooltipY}px; transform: translate(-50%, {position === 'top' ? '-100%' : '0'});"
    role="tooltip"
  >
    <div class="rounded-lg px-2.5 py-1.5 text-[11px] border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-white/10 text-[var(--clawdev-text)] backdrop-blur-xl shadow-lg whitespace-nowrap animated-tooltip-content">
      {#if content}
        {@render content()}
      {:else}
        {text}
      {/if}
    </div>
    <!-- Caret arrow -->
    <div
      class="absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white/70 dark:bg-white/10 border border-black/[0.06] dark:border-white/[0.08] {position === 'top' ? '-bottom-1 border-t-0 border-l-0' : '-top-1 border-b-0 border-r-0'}"
    ></div>
  </div>
{/if}
