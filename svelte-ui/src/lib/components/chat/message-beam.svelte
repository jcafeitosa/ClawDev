<script lang="ts">
  /**
   * MessageBeam — animated vertical beam/line connecting thread parent to replies.
   */

  interface Props {
    active?: boolean;
    color?: string;
  }

  let { active = true, color = 'var(--clawdev-primary)' }: Props = $props();
</script>

<svg class="w-0.5 h-full flex-shrink-0" viewBox="0 0 2 100" preserveAspectRatio="none">
  {#if active}
    <line
      x1="1" y1="0" x2="1" y2="100"
      stroke={color}
      stroke-width="2"
      stroke-dasharray="8 4"
      style="animation: beam-flow 1s linear infinite; opacity: 0.5;"
    />
  {:else}
    <line
      x1="1" y1="0" x2="1" y2="100"
      stroke={color}
      stroke-width="2"
      style="opacity: 0.15;"
    />
  {/if}
</svg>

<style>
  @media (prefers-reduced-motion: reduce) {
    line {
      animation: none !important;
    }
  }
</style>
