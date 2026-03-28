<script lang="ts">
  import { page } from "$app/stores";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { cn } from "$utils/index.js";
  import {
    LayoutDashboard,
    Inbox,
    ListTodo,
    RotateCcw,
    Target,
    FolderKanban,
    Bot,
    ShieldCheck,
    Building2,
    DollarSign,
    Activity,
    Settings,
    Zap,
    ChevronRight,
    Plus,
    X,
    Cog,
  } from "lucide-svelte";

  const prefix = $derived(companyStore.selectedCompany?.slug ?? companyStore.selectedCompanyId ?? "");
  const companyName = $derived(companyStore.selectedCompany?.name ?? "ClawDev");

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    badge?: () => string | number | null;
  }

  interface NavSection {
    key: string;
    label: string;
    items: NavItem[];
    defaultOpen: boolean;
  }

  // ---------------------------------------------------------------------------
  // Inbox unread count
  // ---------------------------------------------------------------------------
  let inboxUnread = $state(0);
  let issueCount = $state<number | null>(null);

  $effect(() => {
    if (!prefix) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/inbox?status=unread&limit=0`)
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.total != null) inboxUnread = data.total;
      })
      .catch(() => {});
  });

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/issues?limit=0`)
      .then((r) => {
        if (r.ok) return r.json();
        return null;
      })
      .then((data) => {
        if (data?.total != null) issueCount = data.total;
        else if (Array.isArray(data)) issueCount = data.length;
      })
      .catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------
  const sections: NavSection[] = [
    {
      key: "overview",
      label: "Overview",
      defaultOpen: true,
      items: [
        { label: "Dashboard", href: "dashboard", icon: LayoutDashboard },
        { label: "Inbox", href: "inbox", icon: Inbox, badge: () => inboxUnread > 0 ? inboxUnread : null },
      ],
    },
    {
      key: "work",
      label: "Work",
      defaultOpen: true,
      items: [
        { label: "Issues", href: "issues", icon: ListTodo, badge: () => issueCount },
        { label: "Routines", href: "routines", icon: RotateCcw },
        { label: "Goals", href: "goals", icon: Target },
      ],
    },
    {
      key: "manage",
      label: "Manage",
      defaultOpen: true,
      items: [
        { label: "Projects", href: "projects", icon: FolderKanban },
        { label: "Agents", href: "agents", icon: Bot },
        { label: "Approvals", href: "approvals", icon: ShieldCheck },
      ],
    },
    {
      key: "company",
      label: "Company",
      defaultOpen: false,
      items: [
        { label: "Org", href: "org", icon: Building2 },
        { label: "Costs", href: "costs", icon: DollarSign },
        { label: "Activity", href: "activity", icon: Activity },
        { label: "Settings", href: "settings", icon: Settings },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // Collapsible state
  // ---------------------------------------------------------------------------
  let sectionOpen = $state<Record<string, boolean>>(
    Object.fromEntries(sections.map((s) => [s.key, s.defaultOpen]))
  );

  function toggleSection(key: string) {
    sectionOpen[key] = !sectionOpen[key];
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function isActive(href: string): boolean {
    return $page.url.pathname.includes(`/${prefix}/${href}`);
  }

  function formatBadge(value: string | number): string {
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (isNaN(num)) return String(value);
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return String(num);
  }
</script>

<aside
  data-slot="sidebar"
  class={cn(
    "flex h-full w-60 shrink-0 flex-col border-r",
    "bg-[var(--clawdev-bg-base)] text-[var(--clawdev-text-primary)] border-[var(--clawdev-bg-surface-border)]",
    sidebarStore.isMobile && "fixed inset-y-0 left-0 z-50 shadow-xl",
    sidebarStore.isMobile && !sidebarStore.open && "-translate-x-full",
    "transition-transform duration-200",
  )}
>
  <!-- Header: Company name -->
  <div class="flex h-14 items-center justify-between px-4 border-b border-[var(--clawdev-bg-surface-border)]">
    <div class="flex items-center gap-2 min-w-0">
      <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--clawdev-primary)] text-[10px] font-bold text-white uppercase">
        {companyName.charAt(0)}
      </div>
      <span class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">{companyName}</span>
    </div>
    {#if sidebarStore.isMobile}
      <button
        class="text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] p-1 rounded-md"
        onclick={() => sidebarStore.set(false)}
        aria-label="Close sidebar"
      >
        <X class="size-4" />
      </button>
    {/if}
  </div>

  <!-- New Issue button -->
  <div class="px-3 pt-3 pb-1">
    <a
      href={`/${prefix}/issues/new`}
      class="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-[var(--clawdev-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--clawdev-primary-hover)] transition-colors"
    >
      <Plus class="size-3.5" />
      New Issue
    </a>
  </div>

  <!-- Navigation with collapsible sections -->
  <nav class="flex-1 overflow-y-auto px-3 pt-2 pb-4">
    {#each sections as section (section.key)}
      <div class="mt-3 first:mt-0">
        <!-- Section header (clickable toggle) -->
        <button
          onclick={() => toggleSection(section.key)}
          class="flex w-full items-center gap-1 px-1.5 py-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm group"
          aria-expanded={sectionOpen[section.key]}
        >
          <ChevronRight
            class={cn(
              "size-3 shrink-0 transition-transform duration-150",
              sectionOpen[section.key] && "rotate-90",
            )}
          />
          <span class="select-none">{section.label}</span>
        </button>

        <!-- Section items (animated collapse) -->
        {#if sectionOpen[section.key]}
          <div class="mt-0.5 space-y-px">
            {#each section.items as item (item.href)}
              <a
                href={`/${prefix}/${item.href}`}
                class={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium"
                    : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]",
                )}
              >
                <item.icon class="size-4 shrink-0" />
                <span class="flex-1 truncate">{item.label}</span>
                {#if item.badge}
                  {@const badgeValue = item.badge()}
                  {#if badgeValue != null}
                    <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] px-1.5 text-[10px] font-medium text-[var(--clawdev-text-muted)] tabular-nums">
                      {formatBadge(badgeValue)}
                    </span>
                  {/if}
                {/if}
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </nav>

  <!-- Footer -->
  <div class="border-t border-[var(--clawdev-bg-surface-border)] px-4 py-3 space-y-1.5">
    <a
      href={`/${prefix}/settings`}
      class="flex items-center gap-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors"
    >
      <Cog class="size-3.5" />
      Instance Settings
    </a>
    <div class="text-[10px] text-[var(--clawdev-text-muted)]/50 select-none">ClawDev v0.3.1</div>
  </div>
</aside>

<!-- Mobile overlay -->
{#if sidebarStore.isMobile && sidebarStore.open}
  <button
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
    onclick={() => sidebarStore.set(false)}
    aria-label="Close sidebar"
  ></button>
{/if}
