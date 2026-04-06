<script lang="ts">
  /**
   * ProfileHoverCard — Glassmorphism popover on agent avatar hover.
   * Aceternity-inspired scale+fade entrance with backdrop-blur.
   * Respects prefers-reduced-motion.
   */
  import type { Snippet } from 'svelte';
  import AgentStatusDot from './agent-status-dot.svelte';
  import { AtSign, MessageSquare, ExternalLink } from 'lucide-svelte';

  interface Props {
    name: string;
    role?: string;
    icon?: string | null;
    status?: 'online' | 'busy' | 'offline' | 'typing';
    children: Snippet;
    onMention?: () => void;
    onDm?: () => void;
    onViewProfile?: () => void;
  }

  let {
    name,
    role = '',
    icon = null,
    status = 'offline',
    children,
    onMention,
    onDm,
    onViewProfile,
  }: Props = $props();

  let visible = $state(false);
  let hoveringTrigger = $state(false);
  let hoveringCard = $state(false);
  let hideTimeout: ReturnType<typeof setTimeout> | undefined;
  let showTimeout: ReturnType<typeof setTimeout> | undefined;
  let triggerEl: HTMLDivElement | undefined = $state();
  let cardEl: HTMLDivElement | undefined = $state();
  let posAbove = $state(false);

  function show() {
    clearTimeout(hideTimeout);
    showTimeout = setTimeout(() => {
      if (triggerEl) {
        const rect = triggerEl.getBoundingClientRect();
        posAbove = rect.top > window.innerHeight / 2;
      }
      visible = true;
    }, 300);
  }

  function scheduleHide() {
    clearTimeout(showTimeout);
    hideTimeout = setTimeout(() => {
      if (!hoveringTrigger && !hoveringCard) {
        visible = false;
      }
    }, 200);
  }

  $effect(() => {
    if (hoveringTrigger || hoveringCard) {
      show();
    } else {
      scheduleHide();
    }
  });

  const ICON_NAME_TO_EMOJI: Record<string, string> = {
    crown: '\u{1F451}', terminal: '\u{1F4BB}', bot: '\u{1F916}', brain: '\u{1F9E0}', cpu: '\u2699\uFE0F',
    zap: '\u26A1', rocket: '\u{1F680}', globe: '\u{1F30D}', server: '\u{1F5A5}\uFE0F', database: '\u{1F5C4}\uFE0F',
    cloud: '\u2601\uFE0F', code: '\u{1F4BB}', shield: '\u{1F6E1}\uFE0F', star: '\u2B50', heart: '\u2764\uFE0F',
    fire: '\u{1F525}', target: '\u{1F3AF}', pencil: '\u270F\uFE0F', book: '\u{1F4D6}', lightbulb: '\u{1F4A1}',
  };

  function resolveEmoji(ic: string | null | undefined): string | null {
    if (!ic) return null;
    if (/[^\x00-\x7F]/.test(ic)) return ic;
    return ICON_NAME_TO_EMOJI[ic.toLowerCase()] ?? null;
  }

  function getInitials(n: string): string {
    return n.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
</script>

<div
  class="relative inline-block"
  bind:this={triggerEl}
  role="presentation"
  onmouseenter={() => (hoveringTrigger = true)}
  onmouseleave={() => (hoveringTrigger = false)}
>
  {@render children()}

  {#if visible}
    <div
      bind:this={cardEl}
      class="profile-hover-card absolute z-50 w-56 {posAbove ? 'bottom-full mb-2' : 'top-full mt-2'} left-0"
      role="presentation"
      onmouseenter={() => (hoveringCard = true)}
      onmouseleave={() => (hoveringCard = false)}
    >
      <div class="rounded-xl border border-white/10 dark:border-white/10 bg-white/80 dark:bg-[#1a1a24]/80 backdrop-blur-xl shadow-2xl p-3 profile-hover-card-inner">
        <!-- Agent info -->
        <div class="flex items-center gap-3 mb-3">
          <div class="relative">
            <div class="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold" style="background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))">
              {#if resolveEmoji(icon)}
                <span class="text-2xl">{resolveEmoji(icon)}</span>
              {:else}
                <span class="opacity-70 text-sm">{getInitials(name)}</span>
              {/if}
            </div>
            <AgentStatusDot {status} size="md" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate">{name}</p>
            {#if role}
              <span class="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--clawdev-primary)]/10 text-[var(--clawdev-primary)] font-medium mt-0.5">{role}</span>
            {/if}
            <p class="text-[10px] opacity-50 mt-0.5 capitalize">{status}</p>
          </div>
        </div>

        <!-- Quick actions -->
        <div class="flex items-center gap-1 pt-2 border-t border-[var(--clawdev-bg-surface-border)]">
          {#if onDm}
            <button
              onclick={onDm}
              class="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-[11px] hover:bg-[var(--clawdev-bg-surface)] transition-colors"
            >
              <MessageSquare class="h-3 w-3 opacity-60" />
              <span>Message</span>
            </button>
          {/if}
          {#if onMention}
            <button
              onclick={onMention}
              class="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-[11px] hover:bg-[var(--clawdev-bg-surface)] transition-colors"
            >
              <AtSign class="h-3 w-3 opacity-60" />
              <span>Mention</span>
            </button>
          {/if}
          {#if onViewProfile}
            <button
              onclick={onViewProfile}
              class="flex items-center gap-1.5 flex-1 px-2 py-1.5 rounded-lg text-[11px] hover:bg-[var(--clawdev-bg-surface)] transition-colors"
            >
              <ExternalLink class="h-3 w-3 opacity-60" />
              <span>Profile</span>
            </button>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
