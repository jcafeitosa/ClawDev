<script lang="ts">
  /**
   * StreamingIndicator — Claude Code-style real-time streaming status bar.
   * Shows: agent name/action + elapsed time + token count + stop button.
   */

  interface Props {
    agentName?: string;
    agentIcon?: string | null;
    action?: string;
    /** Stream start time (ISO string or Date) for elapsed timer */
    startedAt?: string | Date | null;
    /** Current token count */
    tokens?: number;
    /** Whether streaming is active */
    active?: boolean;
    /** Callback to stop/cancel the stream */
    onStop?: () => void;
  }

  let {
    agentName = '',
    agentIcon = null,
    action = 'Thinking',
    startedAt = null,
    tokens = 0,
    active = false,
    onStop,
  }: Props = $props();

  // ── Elapsed time ticker ──
  let elapsed = $state('');
  let intervalId: ReturnType<typeof setInterval> | undefined;

  function updateElapsed() {
    if (!startedAt) { elapsed = ''; return; }
    const start = typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt.getTime();
    const diff = Math.max(0, Date.now() - start);
    const secs = Math.floor(diff / 1000);
    if (secs < 60) {
      elapsed = `${secs}s`;
    } else {
      const mins = Math.floor(secs / 60);
      const remSecs = secs % 60;
      elapsed = `${mins}m ${remSecs}s`;
    }
  }

  $effect(() => {
    if (active && startedAt) {
      updateElapsed();
      intervalId = setInterval(updateElapsed, 1000);
      return () => { if (intervalId) clearInterval(intervalId); };
    } else {
      elapsed = '';
      if (intervalId) clearInterval(intervalId);
    }
  });

  // ── Format token count ──
  function formatTokens(n: number): string {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  }

  // ── Resolve icon to emoji ──
  const ICON_MAP: Record<string, string> = {
    crown: '👑', terminal: '💻', bot: '🤖', brain: '🧠', cpu: '⚙️',
    zap: '⚡', rocket: '🚀', globe: '🌍', server: '🖥️', database: '🗄️',
    cloud: '☁️', code: '💻', shield: '🛡️', star: '⭐', fire: '🔥',
  };
  function resolveEmoji(icon: string | null | undefined): string | null {
    if (!icon) return null;
    if (/[^\x00-\x7F]/.test(icon)) return icon;
    return ICON_MAP[icon.toLowerCase()] ?? null;
  }

  let emoji = $derived(resolveEmoji(agentIcon));
</script>

{#if active}
  <div class="streaming-indicator flex items-center justify-between px-4 py-2 border-t border-[var(--clawdev-bg-surface-border)]">
    <!-- Left: agent + action -->
    <div class="flex items-center gap-2 min-w-0">
      <!-- Animated pulse dot -->
      <div class="relative flex-shrink-0">
        <span class="flex h-2.5 w-2.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
        </span>
      </div>

      {#if emoji}
        <span class="text-sm flex-shrink-0">{emoji}</span>
      {/if}

      <span class="text-sm font-medium text-orange-500 dark:text-orange-400 truncate">
        {#if agentName}
          {agentName}
        {/if}
        {#if action}
          <span class="font-normal opacity-70">{agentName ? ' · ' : ''}{action}...</span>
        {/if}
      </span>

      <!-- Animated ellipsis -->
      <span class="inline-flex items-center gap-0.5 ml-0.5">
        <span class="w-1 h-1 rounded-full bg-orange-400" style="animation: bounce-dot 1.2s ease-in-out infinite;"></span>
        <span class="w-1 h-1 rounded-full bg-orange-400" style="animation: bounce-dot 1.2s ease-in-out infinite; animation-delay: 0.15s;"></span>
        <span class="w-1 h-1 rounded-full bg-orange-400" style="animation: bounce-dot 1.2s ease-in-out infinite; animation-delay: 0.3s;"></span>
      </span>
    </div>

    <!-- Right: elapsed + tokens + stop -->
    <div class="flex items-center gap-3 flex-shrink-0 text-xs text-[var(--clawdev-text-muted)]">
      {#if elapsed}
        <span class="tabular-nums opacity-60">{elapsed}</span>
      {/if}

      {#if tokens > 0}
        <span class="flex items-center gap-1 tabular-nums opacity-60">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          {formatTokens(tokens)} tokens
        </span>
      {/if}

      {#if onStop}
        <button
          onclick={onStop}
          class="flex items-center justify-center h-5 w-5 rounded-full border border-[var(--clawdev-bg-surface-border)] hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
          title="Stop generating"
        >
          <svg class="w-2.5 h-2.5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
        </button>
      {/if}
    </div>
  </div>
{/if}
