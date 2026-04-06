<script lang="ts">
  /**
   * TypingIndicator — Dynamic Island-style pill that morphs between states.
   */

  interface Props {
    agents?: { name: string; icon?: string }[];
    connectionStatus?: 'connected' | 'reconnecting' | 'disconnected';
  }

  let { agents = [], connectionStatus = 'connected' }: Props = $props();

  let isVisible = $derived(agents.length > 0 || connectionStatus !== 'connected');

  let label = $derived(() => {
    if (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting') {
      return 'Reconnecting...';
    }
    if (agents.length === 0) return '';
    if (agents.length === 1) return `${agents[0].name} is typing`;
    if (agents.length === 2) return `${agents[0].name} and ${agents[1].name} are typing`;
    return `${agents[0].name} and ${agents.length - 1} others are typing`;
  });

  let isDisconnected = $derived(connectionStatus === 'disconnected' || connectionStatus === 'reconnecting');

  let pillClass = $derived(
    isDisconnected
      ? 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs backdrop-blur-sm transition-all duration-300 animate-pulse'
      : 'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs backdrop-blur-sm transition-all duration-300',
  );
</script>

<div
  class="flex justify-center px-4 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
  style="height: {isVisible ? '2rem' : '0px'}; opacity: {isVisible ? 1 : 0}; margin-bottom: {isVisible ? '0.25rem' : '0px'};"
>
  <div
    class={pillClass}
    style="background: {isDisconnected ? 'rgba(249,115,22,0.1)' : 'var(--clawdev-bg-surface)'}; color: {isDisconnected ? 'rgb(249,115,22)' : 'var(--clawdev-text-muted)'};"
  >
    <span class="truncate max-w-48">{label()}</span>
    {#if !isDisconnected && agents.length > 0}
      <span class="inline-flex items-center gap-0.5">
        <span class="w-1 h-1 rounded-full bg-current" style="animation: bounce-dot 1.2s ease-in-out infinite; animation-delay: 0s;"></span>
        <span class="w-1 h-1 rounded-full bg-current" style="animation: bounce-dot 1.2s ease-in-out infinite; animation-delay: 0.15s;"></span>
        <span class="w-1 h-1 rounded-full bg-current" style="animation: bounce-dot 1.2s ease-in-out infinite; animation-delay: 0.3s;"></span>
      </span>
    {/if}
  </div>
</div>
