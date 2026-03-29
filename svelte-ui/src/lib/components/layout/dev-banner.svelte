<script lang="ts">
  import { onMount } from 'svelte';
  import { Terminal, GitFork, X } from 'lucide-svelte';
  import { browser } from '$app/environment';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let devServer = $state(false);
  let worktreePath = $state<string | null>(null);
  let dismissed = $state(false);
  let loaded = $state(false);

  const DISMISS_KEY = 'clawdev.dev-banner.dismissed';

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(async () => {
    // Check sessionStorage for dismiss state
    if (browser) {
      try {
        dismissed = sessionStorage.getItem(DISMISS_KEY) === '1';
      } catch { /* ignore */ }
    }

    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const health = await res.json();
        devServer = !!health.devServer;
        worktreePath = health.worktreePath ?? health.worktree ?? health.gitWorktree ?? null;
      }
    } catch {
      // Health endpoint unavailable — assume not dev mode
    } finally {
      loaded = true;
    }
  });

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function dismiss() {
    dismissed = true;
    if (browser) {
      try {
        sessionStorage.setItem(DISMISS_KEY, '1');
      } catch { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let showDevBanner = $derived(loaded && !dismissed && devServer);
  let showWorktreeBanner = $derived(loaded && !dismissed && !!worktreePath);
  let showAny = $derived(showDevBanner || showWorktreeBanner);
</script>

{#if showAny}
  <div class="dev-banner-strip relative z-[60] w-full shrink-0">
    {#if showDevBanner}
      <div class="flex items-center justify-center gap-2 bg-amber-500/15 border-b border-amber-500/20 px-4 py-1.5 text-xs text-amber-300">
        <Terminal class="size-3.5 shrink-0" />
        <span class="font-medium">Dev Mode</span>
        <span class="hidden sm:inline text-amber-300/70">&mdash; Auto-restart enabled</span>
        <button
          class="ml-auto rounded p-0.5 text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
          onclick={dismiss}
          aria-label="Dismiss banner"
        >
          <X class="size-3.5" />
        </button>
      </div>
    {/if}

    {#if showWorktreeBanner}
      <div class="flex items-center justify-center gap-2 bg-blue-500/10 border-b border-blue-500/15 px-4 py-1.5 text-xs text-blue-300">
        <GitFork class="size-3.5 shrink-0" />
        <span>Running in git worktree:</span>
        <code class="font-mono text-blue-200/80 truncate max-w-[300px]">{worktreePath}</code>
        {#if !showDevBanner}
          <button
            class="ml-auto rounded p-0.5 text-blue-400/60 hover:text-blue-300 hover:bg-blue-500/10 transition-colors"
            onclick={dismiss}
            aria-label="Dismiss banner"
          >
            <X class="size-3.5" />
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}
