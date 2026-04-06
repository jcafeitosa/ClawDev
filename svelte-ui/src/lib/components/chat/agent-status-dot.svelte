<script lang="ts">
  /**
   * AgentStatusDot — small status indicator for agent online/offline/busy/typing state.
   */

  interface Props {
    status?: 'online' | 'busy' | 'offline' | 'typing';
    size?: 'sm' | 'md';
  }

  let { status = 'offline', size = 'sm' }: Props = $props();

  let sizeClass = $derived(size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5');

  let colorClass = $derived(() => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'typing': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline':
      default: return 'bg-gray-400';
    }
  });

  let shouldAnimate = $derived(status === 'online' || status === 'typing');
</script>

<span
  class="absolute bottom-0 right-0 rounded-full border-2 border-[var(--clawdev-card-bg)] {sizeClass} {colorClass()}"
  style={shouldAnimate
    ? `animation: pulse-ring ${status === 'typing' ? '1s' : '2s'} cubic-bezier(0.4, 0, 0.6, 1) infinite;`
    : ''}
></span>
