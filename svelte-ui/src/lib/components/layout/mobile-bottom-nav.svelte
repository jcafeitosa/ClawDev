<script lang="ts">
  /**
   * MobileBottomNav — fixed bottom navigation bar for mobile devices.
   * Shows 5 primary navigation items with active state highlighting.
   * Hidden on md+ screens where the sidebar is visible.
   */
  import { page } from '$app/stores';
  import { sidebarStore } from '$stores/sidebar.svelte.js';
  import { LayoutDashboard, ListTodo, Inbox, Bot, Menu } from 'lucide-svelte';

  interface Props {
    companyPrefix: string;
    unreadCount?: number;
  }

  let { companyPrefix, unreadCount = 0 }: Props = $props();

  interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    match: string;
  }

  let navItems = $derived<NavItem[]>([
    { label: 'Dashboard', href: `/${companyPrefix}/dashboard`, icon: LayoutDashboard, match: '/dashboard' },
    { label: 'Issues', href: `/${companyPrefix}/issues`, icon: ListTodo, match: '/issues' },
    { label: 'Inbox', href: `/${companyPrefix}/inbox`, icon: Inbox, match: '/inbox' },
    { label: 'Agents', href: `/${companyPrefix}/agents`, icon: Bot, match: '/agents' },
  ]);

  let currentPath = $derived($page.url.pathname);

  function isActive(match: string): boolean {
    const base = `/${companyPrefix}${match}`;
    return currentPath === base || currentPath.startsWith(base + '/');
  }

  function toggleSidebar() {
    sidebarStore.toggle();
  }
</script>

<nav
  class="fixed bottom-0 inset-x-0 z-50 flex md:hidden items-center justify-around
         bg-background border-t border-border
         pb-[env(safe-area-inset-bottom,0px)]"
  aria-label="Mobile navigation"
>
  {#each navItems as item}
    {@const active = isActive(item.match)}
    <a
      href={item.href}
      class="flex flex-col items-center gap-0.5 py-2 px-3 min-w-0 relative
             transition-colors {active ? 'text-blue-400' : 'text-zinc-500 hover:text-zinc-300'}"
      aria-current={active ? 'page' : undefined}
    >
      {#if item.match === '/inbox' && unreadCount > 0}
        <span class="relative">
          <item.icon class="size-5" />
          <span
            class="absolute -top-1.5 -right-2 flex items-center justify-center min-w-[16px] h-4
                   rounded-full bg-red-500 text-white text-[10px] font-bold px-1 leading-none"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      {:else}
        <item.icon class="size-5" />
      {/if}
      <span class="text-[10px] font-medium leading-tight">{item.label}</span>
    </a>
  {/each}

  <!-- Menu button to toggle sidebar -->
  <button
    onclick={toggleSidebar}
    class="flex flex-col items-center gap-0.5 py-2 px-3 min-w-0
           transition-colors text-zinc-500 hover:text-zinc-300"
    aria-label="Toggle menu"
  >
    <Menu class="size-5" />
    <span class="text-[10px] font-medium leading-tight">Menu</span>
  </button>
</nav>
