<script lang="ts">
  import { page } from "$app/stores";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { cn } from "$utils/index.js";
  import {
    LayoutDashboard,
    Inbox,
    ListTodo,
    Timer,
    Target,
    Users,
    Zap,
    FolderKanban,
    DollarSign,
    Activity,
    Settings,
    Plus,
    Search,
    X,
  } from "lucide-svelte";

  const prefix = $derived(companyStore.selectedCompany?.slug ?? companyStore.selectedCompanyId ?? "");

  interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
  }

  const primaryNav: NavItem[] = [
    { label: "Dashboard", href: "dashboard", icon: LayoutDashboard },
    { label: "Inbox", href: "inbox", icon: Inbox },
  ];

  const workNav: NavItem[] = [
    { label: "Issues", href: "issues", icon: ListTodo },
    { label: "Routines", href: "routines", icon: Timer },
    { label: "Goals", href: "goals", icon: Target },
  ];

  const companyNav: NavItem[] = [
    { label: "Agents", href: "agents", icon: Zap },
    { label: "Projects", href: "projects", icon: FolderKanban },
    { label: "Org", href: "org", icon: Users },
    { label: "Costs", href: "costs", icon: DollarSign },
    { label: "Activity", href: "activity", icon: Activity },
    { label: "Settings", href: "settings", icon: Settings },
  ];

  function isActive(href: string): boolean {
    return $page.url.pathname.includes(`/${prefix}/${href}`);
  }
</script>

<aside
  data-slot="sidebar"
  class={cn(
    "bg-sidebar text-sidebar-foreground border-sidebar-border flex h-full w-60 shrink-0 flex-col border-r",
    sidebarStore.isMobile && "fixed inset-y-0 left-0 z-50 shadow-xl",
    sidebarStore.isMobile && !sidebarStore.open && "-translate-x-full",
    "transition-transform duration-200",
  )}
>
  <!-- Header -->
  <div class="flex h-14 items-center justify-between px-4">
    <span class="text-sm font-semibold truncate">{companyStore.selectedCompany?.name ?? "ClawDev"}</span>
    <div class="flex items-center gap-1">
      <button class="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-md hover:bg-sidebar-accent" aria-label="Search">
        <Search class="size-4" />
      </button>
      {#if sidebarStore.isMobile}
        <button class="text-sidebar-foreground/60 hover:text-sidebar-foreground p-1 rounded-md" onclick={() => sidebarStore.set(false)} aria-label="Close sidebar">
          <X class="size-4" />
        </button>
      {/if}
    </div>
  </div>

  <!-- New Issue -->
  <div class="px-3 pb-2">
    <button class="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border px-3 text-xs font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
      <Plus class="size-3.5" />
      New Issue
    </button>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto px-3 pb-4">
    <!-- Primary -->
    <div class="space-y-0.5">
      {#each primaryNav as item}
        <a
          href={`/${prefix}/${item.href}`}
          data-active={isActive(item.href)}
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground transition-colors"
        >
          <item.icon class="size-4 shrink-0" />
          {item.label}
        </a>
      {/each}
    </div>

    <!-- Work -->
    <div class="mt-6">
      <div class="mb-1 px-2 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">Work</div>
      <div class="space-y-0.5">
        {#each workNav as item}
          <a
            href={`/${prefix}/${item.href}`}
            data-active={isActive(item.href)}
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground transition-colors"
          >
            <item.icon class="size-4 shrink-0" />
            {item.label}
          </a>
        {/each}
      </div>
    </div>

    <!-- Company -->
    <div class="mt-6">
      <div class="mb-1 px-2 text-xs font-medium text-sidebar-foreground/40 uppercase tracking-wider">Company</div>
      <div class="space-y-0.5">
        {#each companyNav as item}
          <a
            href={`/${prefix}/${item.href}`}
            data-active={isActive(item.href)}
            class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground transition-colors"
          >
            <item.icon class="size-4 shrink-0" />
            {item.label}
          </a>
        {/each}
      </div>
    </div>
  </nav>
</aside>

<!-- Mobile overlay -->
{#if sidebarStore.isMobile && sidebarStore.open}
  <button class="fixed inset-0 z-40 bg-black/50" onclick={() => sidebarStore.set(false)} aria-label="Close sidebar"></button>
{/if}
