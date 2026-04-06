<script lang="ts">
  /**
   * FloatingActionDock — macOS Dock-style action bar for chat messages.
   * Icons magnify on hover (hovered + neighbors scale), pill-shaped glass effect.
   * Popups teleported to document.body to escape overflow-hidden + hidden ancestors.
   */
  import { Reply, Smile, Pin, Bookmark, MoreHorizontal, Pencil, Trash2, Copy, ExternalLink } from 'lucide-svelte';
  import { onMount } from 'svelte';

  interface Props {
    onReply?: () => void;
    onReact?: (emoji: string) => void;
    onPin?: () => void;
    onBookmark?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onCopyText?: () => void;
    onCopyLink?: () => void;
    visible?: boolean;
    isPinned?: boolean;
    isBookmarked?: boolean;
    isOwnMessage?: boolean;
  }

  let {
    onReply,
    onReact,
    onPin,
    onBookmark,
    onEdit,
    onDelete,
    onCopyText,
    onCopyLink,
    visible = false,
    isPinned = false,
    isBookmarked = false,
    isOwnMessage = false,
  }: Props = $props();

  interface DockAction {
    id: string;
    icon: typeof Reply;
    label: string;
  }

  const actions: DockAction[] = [
    { id: 'reply', icon: Reply, label: 'Reply in thread' },
    { id: 'react', icon: Smile, label: 'Add reaction' },
    { id: 'pin', icon: Pin, label: 'Pin message' },
    { id: 'bookmark', icon: Bookmark, label: 'Save message' },
    { id: 'more', icon: MoreHorizontal, label: 'More actions' },
  ];

  const popularEmojis = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '✅', '🚀', '💯', '🤔', '👏', '😍'];

  let hoveredIndex = $state<number | null>(null);
  let showEmojiPicker = $state(false);
  let showMoreMenu = $state(false);
  let dockEl: HTMLDivElement | undefined = $state();
  let popupX = $state(0);
  let popupY = $state(0);

  // Portal containers — appended to document.body
  let emojiPortal: HTMLDivElement | undefined;
  let morePortal: HTMLDivElement | undefined;
  let mounted = $state(false);

  onMount(() => {
    emojiPortal = document.createElement('div');
    morePortal = document.createElement('div');
    document.body.appendChild(emojiPortal);
    document.body.appendChild(morePortal);
    mounted = true;
    return () => {
      emojiPortal?.remove();
      morePortal?.remove();
    };
  });

  // Render emoji picker into portal
  $effect(() => {
    if (!mounted || !emojiPortal) return;
    if (showEmojiPicker) {
      emojiPortal.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'dock-popup-fixed fixed z-[9999]';
      wrapper.style.cssText = `left: ${popupX}px; top: ${popupY}px; transform: translateY(-100%);`;

      const inner = document.createElement('div');
      inner.className = 'p-2 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl';
      inner.style.cssText = 'animation: dock-fade-in 0.15s ease-out both;';

      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-6 gap-0.5';

      for (const emoji of popularEmojis) {
        const btn = document.createElement('button');
        btn.className = 'w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--clawdev-bg-surface)] transition-colors text-base';
        btn.textContent = emoji;
        btn.title = emoji;
        btn.style.cssText = 'transition: transform 0.1s;';
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.25)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = (e) => {
          e.stopPropagation();
          onReact?.(emoji);
          showEmojiPicker = false;
        };
        grid.appendChild(btn);
      }

      inner.appendChild(grid);
      wrapper.appendChild(inner);
      emojiPortal.appendChild(wrapper);
    } else {
      emojiPortal.innerHTML = '';
    }
  });

  // Render more menu into portal
  $effect(() => {
    if (!mounted || !morePortal) return;
    if (showMoreMenu) {
      morePortal.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'dock-popup-fixed fixed z-[9999]';
      wrapper.style.cssText = `left: ${popupX}px; top: ${popupY}px; transform: translate(-100%, -100%);`;

      const inner = document.createElement('div');
      inner.className = 'py-1 min-w-[140px] rounded-lg border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl';

      const menuItems: { label: string; action: string; iconSvg: string; danger?: boolean }[] = [
        { label: 'Copy text', action: 'copy-text', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' },
        { label: 'Copy link', action: 'copy-link', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>' },
      ];

      if (isOwnMessage) {
        menuItems.push({ label: '---', action: '', iconSvg: '' });
        menuItems.push({ label: 'Edit message', action: 'edit', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>' });
      }

      menuItems.push({ label: '---', action: '', iconSvg: '' });
      menuItems.push({ label: 'Delete message', action: 'delete', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>', danger: true });

      for (const item of menuItems) {
        if (item.label === '---') {
          const hr = document.createElement('div');
          hr.className = 'my-1 border-t border-[var(--clawdev-bg-surface-border)]';
          inner.appendChild(hr);
          continue;
        }
        const btn = document.createElement('button');
        btn.className = `flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-[var(--clawdev-bg-surface)] transition-colors text-left ${item.danger ? 'text-red-400' : ''}`;
        btn.innerHTML = `<span class="${item.danger ? '' : 'opacity-60'}">${item.iconSvg}</span> ${item.label}`;
        btn.onclick = (e) => {
          e.stopPropagation();
          showMoreMenu = false;
          switch (item.action) {
            case 'edit': onEdit?.(); break;
            case 'delete': onDelete?.(); break;
            case 'copy-text': onCopyText?.(); break;
            case 'copy-link': onCopyLink?.(); break;
          }
        };
        inner.appendChild(btn);
      }

      wrapper.appendChild(inner);
      morePortal.appendChild(wrapper);
    } else {
      morePortal.innerHTML = '';
    }
  });

  function getScale(index: number): number {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.35;
    if (distance === 1) return 1.15;
    return 1;
  }

  function updatePopupPosition(align: 'left' | 'right') {
    if (!dockEl) return;
    const rect = dockEl.getBoundingClientRect();
    popupY = rect.top - 4;
    popupX = align === 'left' ? rect.left : rect.right;
  }

  function handleClick(id: string) {
    switch (id) {
      case 'reply': onReply?.(); break;
      case 'react':
        showMoreMenu = false;
        updatePopupPosition('left');
        showEmojiPicker = !showEmojiPicker;
        break;
      case 'pin': onPin?.(); break;
      case 'bookmark': onBookmark?.(); break;
      case 'more':
        showEmojiPicker = false;
        updatePopupPosition('right');
        showMoreMenu = !showMoreMenu;
        break;
    }
  }

  function handleMouseLeave() {
    hoveredIndex = null;
  }

  // Click outside to close popups (delay to avoid catching the opening click)
  $effect(() => {
    if (showEmojiPicker || showMoreMenu) {
      let armed = false;
      const raf = requestAnimationFrame(() => { armed = true; });
      const handler = (e: MouseEvent) => {
        if (!armed) return;
        const target = e.target as HTMLElement;
        if (dockEl?.contains(target)) return;
        if (target.closest('.dock-popup-fixed')) return;
        showEmojiPicker = false;
        showMoreMenu = false;
      };
      document.addEventListener('click', handler, true);
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('click', handler, true);
      };
    }
  });
</script>

{#if visible}
  <div
    bind:this={dockEl}
    class="floating-action-dock relative inline-flex items-end gap-0.5 px-1.5 py-1 rounded-xl border border-white/10 dark:border-white/10 bg-white/80 dark:bg-[#1a1a24]/80 backdrop-blur-xl shadow-xl"
    onmouseleave={handleMouseLeave}
    role="toolbar"
    tabindex="0"
    aria-label="Message actions"
  >
    {#each actions as action, i (action.id)}
      {@const ActionIcon = action.icon}
      <button
        class="floating-dock-item flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--clawdev-bg-surface)] transition-colors {action.id === 'pin' && isPinned ? 'text-[var(--clawdev-primary)]' : ''} {action.id === 'bookmark' && isBookmarked ? 'text-yellow-500' : ''}"
        style="transform: scale({getScale(i)}); transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);"
        onmouseenter={() => (hoveredIndex = i)}
        onclick={() => handleClick(action.id)}
        title={action.id === 'pin' && isPinned ? 'Unpin message' : action.id === 'bookmark' && isBookmarked ? 'Remove bookmark' : action.label}
        aria-label={action.label}
      >
        <ActionIcon class="h-3.5 w-3.5 {action.id === 'pin' && isPinned ? 'opacity-100 fill-current' : action.id === 'bookmark' && isBookmarked ? 'opacity-100 fill-current' : 'opacity-60'}" />
      </button>
    {/each}
  </div>
{/if}
