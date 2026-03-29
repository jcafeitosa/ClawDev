<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { openNewIssueDialog } from "$components/new-issue-dialog.svelte";
  import { cn } from "$utils/index.js";
  import {
    LayoutDashboard,
    Inbox,
    ListTodo,
    RotateCcw,
    Target,
    Boxes,
    Bot,
    ShieldCheck,
    Box,
    Building2,
    DollarSign,
    Activity,
    Plug,
    Settings,
    ChevronRight,
    ChevronDown,
    Plus,
    X,
    Cog,
    Play,
    Search,
    BookOpen,
    Moon,
    Sun,
    Menu,
  } from "lucide-svelte";

  const prefix = $derived(companyStore.selectedCompany?.slug ?? companyStore.selectedCompanyId ?? "");
  const companyName = $derived(companyStore.selectedCompany?.name ?? "ClawDev");
  const companyBrandColor = $derived(
    (companyStore.selectedCompany?.brandColor as string | undefined) ?? "#3B82F6"
  );
  const hasMultipleCompanies = $derived(companyStore.companies.length > 1);

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    badge?: () => string | number | null;
    badgeStyle?: "default" | "live" | "count";
    betaBadge?: boolean;
  }

  interface NavSection {
    key: string;
    label: string;
    items: NavItem[];
    defaultOpen: boolean;
  }

  interface SidebarProject {
    id: string;
    name: string;
    slug?: string;
    color?: string | null;
    status?: string;
  }

  interface SidebarAgent {
    id: string;
    name: string;
    slug?: string;
    urlKey?: string;
    icon?: string | null;
    iconColor?: string | null;
    nickname?: string | null;
    status?: string;
    role?: string;
  }

  /** Check if a string is an emoji (not a Lucide icon name) */
  function isEmoji(str: string | null | undefined): boolean {
    if (!str) return false;
    return /^\p{Emoji_Presentation}|\p{Extended_Pictographic}/u.test(str);
  }

  // ---------------------------------------------------------------------------
  // Aceternity-style expand/collapse on hover (desktop only)
  // ---------------------------------------------------------------------------
  let expanded = $state(false);

  function onMouseEnter() {
    if (!sidebarStore.isMobile) expanded = true;
  }

  function onMouseLeave() {
    if (!sidebarStore.isMobile) {
      expanded = false;
      companySwitcherOpen = false;
    }
  }

  // On mobile the sidebar is always "expanded" (full width) when open
  const isExpanded = $derived(sidebarStore.isMobile ? true : expanded);

  // ---------------------------------------------------------------------------
  // Theme toggle
  // ---------------------------------------------------------------------------
  let isDark = $state(true);

  $effect(() => {
    if (typeof document === "undefined") return;
    isDark = document.documentElement.classList.contains("dark");
  });

  function toggleTheme() {
    isDark = !isDark;
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    try {
      localStorage.setItem("paperclip.theme", isDark ? "dark" : "light");
      localStorage.setItem("clawdev.theme", isDark ? "dark" : "light");
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Badge data fetches
  // ---------------------------------------------------------------------------
  let inboxUnread = $state(0);
  let activeRunCount = $state<number | null>(null);
  let hasAgentErrors = $state(false);

  // Sidebar badges — use the dedicated endpoint
  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/sidebar-badges`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          inboxUnread = (data.approvals ?? 0) + (data.failedRuns ?? 0) + (data.inboxItems ?? 0);
        }
      })
      .catch(() => {});
  });

  // Active run count with periodic refresh via /live-runs
  let runBadgeInterval: ReturnType<typeof setInterval> | undefined;
  let liveRunsByAgent = $state<Map<string, number>>(new Map());

  function fetchActiveRunCount() {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/live-runs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.runs ?? [];
        const activeRuns = list.filter((r: any) => r.status === "running" || r.status === "queued");
        activeRunCount = activeRuns.length;
        const map = new Map<string, number>();
        for (const run of activeRuns) {
          const agentId = run.agentId;
          if (agentId) map.set(agentId, (map.get(agentId) ?? 0) + 1);
        }
        liveRunsByAgent = map;
      })
      .catch(() => { activeRunCount = null; liveRunsByAgent = new Map(); });
  }

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetchActiveRunCount();
    runBadgeInterval = setInterval(fetchActiveRunCount, 10_000);
    return () => { if (runBadgeInterval) clearInterval(runBadgeInterval); };
  });

  // ---------------------------------------------------------------------------
  // Projects list for sidebar
  // ---------------------------------------------------------------------------
  let allProjects = $state<SidebarProject[]>([]);
  let projectsExpanded = $state(false);

  const PROJECTS_COLLAPSED_LIMIT = 10;

  let visibleProjects = $derived(
    projectsExpanded ? allProjects : allProjects.slice(0, PROJECTS_COLLAPSED_LIMIT)
  );
  let hasMoreProjects = $derived(allProjects.length > PROJECTS_COLLAPSED_LIMIT);

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/projects?sort=name:asc`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data)) allProjects = data;
        else if (data?.projects) allProjects = data.projects;
        else allProjects = [];
      })
      .catch(() => { allProjects = []; });
  });

  // ---------------------------------------------------------------------------
  // Agents list for sidebar
  // ---------------------------------------------------------------------------
  let allAgents = $state<SidebarAgent[]>([]);
  let agentsExpanded = $state(false);

  const AGENTS_COLLAPSED_LIMIT = 10;

  let visibleAgents = $derived(
    agentsExpanded ? allAgents : allAgents.slice(0, AGENTS_COLLAPSED_LIMIT)
  );
  let hasMoreAgents = $derived(allAgents.length > AGENTS_COLLAPSED_LIMIT);

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/agents?sort=name:asc`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: SidebarAgent[] = Array.isArray(data)
          ? data
          : data?.agents
            ? data.agents
            : [];
        allAgents = list;
        hasAgentErrors = list.some((a) => a.status === "error");
      })
      .catch(() => { allAgents = []; });
  });

  // ---------------------------------------------------------------------------
  // Derived: company avatar status dot
  // ---------------------------------------------------------------------------
  const avatarStatusColor = $derived(
    hasAgentErrors
      ? "#ef4444"
      : activeRunCount != null && activeRunCount > 0
        ? "#22c55e"
        : null
  );

  // ---------------------------------------------------------------------------
  // Nav sections (standard icon-based navigation)
  // ---------------------------------------------------------------------------
  const sections: NavSection[] = [
    {
      key: "work",
      label: "Work",
      defaultOpen: true,
      items: [
        { label: "Issues", href: "issues", icon: ListTodo },
        { label: "Routines", href: "routines", icon: RotateCcw, betaBadge: true },
        { label: "Goals", href: "goals", icon: Target },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // "Company" section — company-level management pages
  // ---------------------------------------------------------------------------
  const moreSection: NavSection = {
    key: "company",
    label: "Company",
    defaultOpen: true,
    items: [
      { label: "Org", href: "org", icon: Building2 },
      { label: "Skills", href: "skills", icon: Boxes },
      { label: "Providers", href: "providers", icon: Plug },
      { label: "Costs", href: "costs", icon: DollarSign },
      { label: "Activity", href: "activity", icon: Activity },
      { label: "Settings", href: "settings", icon: Settings },
    ],
  };

  const allSections = [...sections, moreSection];

  // ---------------------------------------------------------------------------
  // Collapsible state — persisted in localStorage
  // ---------------------------------------------------------------------------
  const SECTION_STORAGE_KEY = "clawdev.sidebar.sections";
  const ALL_SECTION_KEYS = [...allSections.map((s) => s.key), "projects", "agents"];

  function loadSectionState(): Record<string, boolean> {
    const defaults: Record<string, boolean> = {};
    for (const s of allSections) defaults[s.key] = s.defaultOpen;
    defaults["projects"] = true;
    defaults["agents"] = true;

    if (typeof window === "undefined") return defaults;
    try {
      const stored = localStorage.getItem(SECTION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const key of ALL_SECTION_KEYS) {
          if (parsed[key] != null) defaults[key] = parsed[key];
        }
      }
    } catch { /* ignore */ }
    return defaults;
  }

  let sectionOpen = $state<Record<string, boolean>>(loadSectionState());

  function toggleSection(key: string) {
    sectionOpen[key] = !sectionOpen[key];
    try {
      localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(sectionOpen));
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Company switcher
  // ---------------------------------------------------------------------------
  let companySwitcherOpen = $state(false);

  function switchCompany(c: any) {
    companyStore.select(c.id, "manual");
    companySwitcherOpen = false;
    goto(`/${c.slug ?? c.id}/dashboard`);
  }

  $effect(() => {
    if (companySwitcherOpen) {
      const handler = () => { companySwitcherOpen = false; };
      document.addEventListener("click", handler, { once: true });
      return () => document.removeEventListener("click", handler);
    }
  });

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

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
  }

  const PROJECT_COLORS = [
    "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b",
  ];

  function projectColor(proj: SidebarProject): string {
    if (proj.color) return proj.color;
    let hash = 0;
    for (let i = 0; i < proj.name.length; i++) hash = (hash * 31 + proj.name.charCodeAt(i)) | 0;
    return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
  }

  function agentInitials(agent: SidebarAgent): string {
    if (agent.icon) return agent.icon;
    return agent.name.slice(0, 2).toUpperCase();
  }

  const AGENT_STATUS_COLORS: Record<string, string> = {
    running: "#3b82f6",
    idle: "#22c55e",
    paused: "#eab308",
    error: "#ef4444",
    stopped: "#6b7280",
  };

  function agentStatusColor(agent: SidebarAgent): string | null {
    if (!agent.status) return null;
    return AGENT_STATUS_COLORS[agent.status] ?? null;
  }
</script>

<!-- ======================================================================== -->
<!-- DESKTOP SIDEBAR — Aceternity-style: collapsed to icons, expands on hover -->
<!-- ======================================================================== -->
{#if !sidebarStore.isMobile}
  <aside
    data-slot="sidebar"
    class={cn(
      "fixed left-0 top-0 h-screen z-30 flex flex-col",
      "bg-[var(--clawdev-bg-surface)] text-[var(--clawdev-text-primary)] border-r border-[var(--clawdev-bg-surface-border)]",
      "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden",
      isExpanded ? "w-60" : "w-[60px]",
    )}
    onmouseenter={onMouseEnter}
    onmouseleave={onMouseLeave}
  >
    <!-- Header: Company avatar + name -->
    <div class="flex h-14 items-center px-3 border-b border-[var(--clawdev-bg-surface-border)] shrink-0">
      <div class="relative flex items-center gap-2.5 min-w-0 flex-1">
        {#if hasMultipleCompanies}
          <button
            class="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
            onclick={(e) => { e.stopPropagation(); if (isExpanded) companySwitcherOpen = !companySwitcherOpen; }}
            aria-label="Switch company"
          >
            <!-- Company avatar with status dot -->
            <div class="relative shrink-0">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white uppercase select-none shadow-sm shrink-0"
                style:background-color={companyBrandColor}
              >
                {companyName.charAt(0)}
              </div>
              {#if avatarStatusColor}
                <span
                  class={cn(
                    "absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[var(--clawdev-bg-base)]",
                    activeRunCount != null && activeRunCount > 0 && !hasAgentErrors && "animate-pulse",
                  )}
                  style:background-color={avatarStatusColor}
                ></span>
              {/if}
            </div>
            <span
              class={cn(
                "text-sm font-semibold truncate text-[var(--clawdev-text-primary)] whitespace-nowrap transition-opacity duration-200",
                isExpanded ? "opacity-100" : "opacity-0",
              )}
            >{companyName}</span>
            <ChevronDown
              class={cn(
                "size-3.5 shrink-0 text-[var(--clawdev-text-muted)] transition-all duration-200",
                companySwitcherOpen && "rotate-180",
                isExpanded ? "opacity-100" : "opacity-0 w-0",
              )}
            />
          </button>

          {#if companySwitcherOpen && isExpanded}
            <div class="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl z-50 py-1.5" onclick={(e) => e.stopPropagation()}>
              <div class="px-3 py-1.5 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest">
                Companies
              </div>
              {#each companyStore.companies as c (c.id)}
                <button
                  class={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors rounded-lg mx-1.5",
                    c.id === companyStore.selectedCompanyId
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-text-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                  style="width: calc(100% - 0.75rem);"
                  onclick={() => switchCompany(c)}
                >
                  <div
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white uppercase"
                    style:background-color={(c.brandColor as string) || "#3B82F6"}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <span class="truncate">{c.name}</span>
                </button>
              {/each}
              <div class="border-t border-[var(--clawdev-bg-surface-border)] mt-1.5 pt-1.5 mx-1.5">
                <a
                  href="/companies"
                  class="flex items-center gap-2 px-3 py-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors rounded-lg"
                >
                  <Plus class="size-3" />
                  Manage Companies
                </a>
              </div>
            </div>
          {/if}
        {:else}
          <!-- Single company -->
          <div class="relative shrink-0">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white uppercase select-none shrink-0"
              style:background-color={companyBrandColor}
            >
              {companyName.charAt(0)}
            </div>
            {#if avatarStatusColor}
              <span
                class={cn(
                  "absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[var(--clawdev-bg-base)]",
                  activeRunCount != null && activeRunCount > 0 && !hasAgentErrors && "animate-pulse",
                )}
                style:background-color={avatarStatusColor}
              ></span>
            {/if}
          </div>
          <span
            class={cn(
              "text-sm font-semibold truncate text-[var(--clawdev-text-primary)] whitespace-nowrap transition-opacity duration-200",
              isExpanded ? "opacity-100" : "opacity-0",
            )}
          >{companyName}</span>
        {/if}
      </div>
    </div>

    <!-- New Issue button -->
    <div class="px-2 pt-3 pb-1 shrink-0">
      <button
        onclick={openNewIssueDialog}
        class={cn(
          "flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--clawdev-primary)] text-xs font-medium text-white hover:bg-[var(--clawdev-primary-hover)] transition-colors",
          isExpanded ? "w-full px-3" : "w-9 mx-auto",
        )}
        title="New Issue"
      >
        <Plus class="size-4 shrink-0" />
        <span
          class={cn(
            "whitespace-nowrap transition-opacity duration-200",
            isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
          )}
        >New Issue</span>
      </button>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-3 pb-4">
      <!-- Top-level nav: Dashboard, Inbox -->
      <div class="space-y-0.5">
        <!-- Dashboard -->
        <a
          href={`/${prefix}/dashboard`}
          class={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
            isActive("dashboard")
              ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
              : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
          )}
          title="Dashboard"
        >
          <LayoutDashboard class="size-4 shrink-0" />
          <span class={cn("flex-1 truncate whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>Dashboard</span>
          {#if activeRunCount != null && activeRunCount > 0 && isExpanded}
            <span class="ml-auto flex items-center gap-1 text-[11px] font-medium tabular-nums text-[#60a5fa]">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
              {activeRunCount} live
            </span>
          {/if}
          {#if activeRunCount != null && activeRunCount > 0 && !isExpanded}
            <span class="absolute right-1.5 top-1 block h-2 w-2 rounded-full bg-[#3b82f6] animate-pulse"></span>
          {/if}
        </a>

        <!-- Inbox -->
        <a
          href={`/${prefix}/inbox`}
          class={cn(
            "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
            isActive("inbox")
              ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
              : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
          )}
          title="Inbox"
        >
          <Inbox class="size-4 shrink-0" />
          <span class={cn("flex-1 truncate whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>Inbox</span>
          {#if inboxUnread > 0}
            {#if isExpanded}
              <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums bg-[#ef4444] text-white">
                {formatBadge(inboxUnread)}
              </span>
            {:else}
              <span class="absolute right-1.5 top-1 block h-2 w-2 rounded-full bg-[#ef4444]"></span>
            {/if}
          {/if}
        </a>
      </div>

      <!-- Standard nav sections (Work) -->
      {#each sections as section (section.key)}
        <div class="mt-4">
          {#if isExpanded}
            <button
              onclick={() => toggleSection(section.key)}
              class="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md group"
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
          {:else}
            <div class="mx-3 my-2 border-t border-[var(--clawdev-bg-surface-border)]"></div>
          {/if}

          {#if sectionOpen[section.key] || !isExpanded}
            <div class={cn("mt-1 space-y-0.5", isExpanded && "ml-[18px] border-l border-[var(--clawdev-bg-surface-border)] pl-0")}>
              {#each section.items as item (item.href)}
                <a
                  href={`/${prefix}/${item.href}`}
                  class={cn(
                    "relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    isActive(item.href)
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                  title={item.label}
                >
                  <item.icon class="size-4 shrink-0" />
                  <span class={cn("flex-1 truncate whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>{item.label}</span>

                  {#if item.betaBadge && isExpanded}
                    <span class="ml-0.5 inline-flex items-center rounded px-1 py-px text-[9px] font-semibold uppercase leading-tight bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">
                      Beta
                    </span>
                  {/if}

                  {#if item.badge}
                    {@const badgeValue = item.badge()}
                    {#if badgeValue != null}
                      {#if isExpanded}
                        {#if item.badgeStyle === "live"}
                          <span class="ml-auto flex items-center gap-1 text-[11px] font-medium tabular-nums text-[#60a5fa]">
                            <span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
                            {typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue}
                          </span>
                        {:else if item.badgeStyle === "count"}
                          <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums bg-[#ef4444] text-white">
                            {typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue}
                          </span>
                        {:else}
                          <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-muted)]">
                            {typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue}
                          </span>
                        {/if}
                      {:else}
                        <span class="absolute right-1.5 top-1 block h-2 w-2 rounded-full bg-[#3b82f6]"></span>
                      {/if}
                    {/if}
                  {/if}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      <!-- ================================================================== -->
      <!-- PROJECTS section                                                     -->
      <!-- ================================================================== -->
      <div class="mt-4">
        {#if isExpanded}
          <div class="flex items-center justify-between px-2 py-1">
            <button
              onclick={() => toggleSection("projects")}
              class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md"
              aria-expanded={sectionOpen["projects"]}
            >
              <ChevronRight
                class={cn(
                  "size-3 shrink-0 transition-transform duration-150",
                  sectionOpen["projects"] && "rotate-90",
                )}
              />
              <span class="select-none">Projects</span>
            </button>
            <a
              href={`/${prefix}/projects?new=true`}
              class="flex h-5 w-5 items-center justify-center rounded-md text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
              title="New project"
              aria-label="New project"
            >
              <Plus class="size-3" />
            </a>
          </div>
        {:else}
          <div class="mx-3 my-2 border-t border-[var(--clawdev-bg-surface-border)]"></div>
        {/if}

        {#if (sectionOpen["projects"] && isExpanded)}
          <div class="mt-1 ml-[18px] border-l border-[var(--clawdev-bg-surface-border)] pl-0">
            {#if allProjects.length === 0}
              <div class="px-3 py-2 text-xs text-[var(--clawdev-text-tertiary)] italic">
                No projects yet
              </div>
            {:else}
              {#each visibleProjects as proj (proj.id)}
                <a
                  href={`/${prefix}/projects/${proj.slug ?? proj.id}/issues`}
                  class={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    $page.url.pathname.includes(`/projects/${proj.slug ?? proj.id}`)
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                  title={proj.name}
                >
                  <span
                    class="h-2 w-2 rounded-full shrink-0"
                    style:background={projectColor(proj)}
                  ></span>
                  <span class={cn("flex-1 truncate whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>{proj.name}</span>
                </a>
              {/each}

              {#if hasMoreProjects}
                <button
                  onclick={() => { projectsExpanded = !projectsExpanded; }}
                  class="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-muted)] transition-colors w-full rounded-lg"
                >
                  {#if projectsExpanded}
                    Show fewer
                  {:else}
                    Show {allProjects.length - PROJECTS_COLLAPSED_LIMIT} more...
                  {/if}
                </button>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- Collapsed: show project dots stacked -->
        {#if !isExpanded && allProjects.length > 0}
          <div class="mt-1 space-y-0.5">
            {#each allProjects.slice(0, 5) as proj (proj.id)}
              <a
                href={`/${prefix}/projects/${proj.slug ?? proj.id}/issues`}
                class={cn(
                  "flex items-center justify-center rounded-lg px-3 py-2 transition-colors",
                  $page.url.pathname.includes(`/projects/${proj.slug ?? proj.id}`)
                    ? "bg-[rgba(59,130,246,0.10)]"
                    : "hover:bg-[var(--clawdev-card-hover)]",
                )}
                title={proj.name}
              >
                <span
                  class="h-2.5 w-2.5 rounded-full shrink-0"
                  style:background={projectColor(proj)}
                ></span>
              </a>
            {/each}
            {#if allProjects.length > 5}
              <a
                href={`/${prefix}/projects`}
                class="flex items-center justify-center rounded-lg px-3 py-1.5 text-[10px] text-[var(--clawdev-text-tertiary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
                title="All projects"
              >
                +{allProjects.length - 5}
              </a>
            {/if}
          </div>
        {/if}
      </div>

      <!-- ================================================================== -->
      <!-- AGENTS section                                                       -->
      <!-- ================================================================== -->
      <div class="mt-4">
        {#if isExpanded}
          <div class="flex items-center justify-between px-2 py-1">
            <button
              onclick={() => toggleSection("agents")}
              class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md"
              aria-expanded={sectionOpen["agents"]}
            >
              <ChevronRight
                class={cn(
                  "size-3 shrink-0 transition-transform duration-150",
                  sectionOpen["agents"] && "rotate-90",
                )}
              />
              <span class="select-none">Agents</span>
            </button>
            <a
              href={`/${prefix}/agents/new`}
              class="flex h-5 w-5 items-center justify-center rounded-md text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
              title="New agent"
              aria-label="New agent"
            >
              <Plus class="size-3" />
            </a>
          </div>
        {:else}
          <div class="mx-3 my-2 border-t border-[var(--clawdev-bg-surface-border)]"></div>
        {/if}

        {#if (sectionOpen["agents"] && isExpanded)}
          <div class="mt-1 ml-[18px] border-l border-[var(--clawdev-bg-surface-border)] pl-0 space-y-0.5">
            {#if allAgents.length === 0}
              <div class="px-3 py-2 text-xs text-[var(--clawdev-text-tertiary)] italic">
                No agents yet
              </div>
            {:else}
              {#each visibleAgents as agent (agent.id)}
                <a
                  href={`/${prefix}/agents/${agent.slug ?? agent.urlKey ?? agent.id}`}
                  class={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    $page.url.pathname.includes(`/agents/${agent.slug ?? agent.urlKey ?? agent.id}`)
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                  title={agent.nickname ?? agent.name}
                >
                  <!-- Agent icon with status dot -->
                  <div class="relative shrink-0">
                    {#if agent.icon && isEmoji(agent.icon)}
                      <span class="flex h-5 w-5 items-center justify-center text-sm select-none" title={agent.nickname ?? agent.name}>
                        {agent.icon}
                      </span>
                    {:else if agent.icon}
                      <span
                        class="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold uppercase"
                        style:background-color={agent.iconColor ? `${agent.iconColor}20` : 'var(--clawdev-card-hover)'}
                        style:color={agent.iconColor ?? 'var(--clawdev-text-muted)'}
                        title={agent.nickname ?? agent.name}
                      >
                        {agentInitials(agent)}
                      </span>
                    {:else}
                      <span
                        class="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold uppercase"
                        style:background-color={agent.iconColor ? `${agent.iconColor}20` : 'var(--clawdev-card-hover)'}
                        style:color={agent.iconColor ?? 'var(--clawdev-text-muted)'}
                        title={agent.nickname ?? agent.name}
                      >
                        {agentInitials(agent)}
                      </span>
                    {/if}
                    {#if agentStatusColor(agent)}
                      <span
                        class={cn(
                          "absolute -bottom-px -right-px block h-2 w-2 rounded-full border border-[var(--clawdev-bg-base)]",
                          agent.status === "running" && "animate-pulse",
                        )}
                        style:background-color={agentStatusColor(agent)}
                      ></span>
                    {/if}
                  </div>
                  <span
                    class={cn(
                      "flex-1 truncate whitespace-nowrap transition-opacity duration-200",
                      isExpanded ? "opacity-100" : "opacity-0",
                    )}
                    title={agent.nickname ? `${agent.name} (${agent.nickname})` : agent.name}
                  >
                    {agent.nickname ?? agent.name}
                  </span>
                  {#if liveRunsByAgent.get(agent.id) && isExpanded}
                    <span class="ml-auto flex items-center gap-1 text-[10px] font-medium tabular-nums text-[#60a5fa]">
                      <span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
                      {liveRunsByAgent.get(agent.id)} live
                    </span>
                  {/if}
                </a>
              {/each}

              {#if hasMoreAgents}
                <button
                  onclick={() => { agentsExpanded = !agentsExpanded; }}
                  class="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-muted)] transition-colors w-full rounded-lg"
                >
                  {#if agentsExpanded}
                    Show fewer
                  {:else}
                    Show {allAgents.length - AGENTS_COLLAPSED_LIMIT} more...
                  {/if}
                </button>
              {/if}
            {/if}
          </div>
        {/if}

        <!-- Collapsed: show agent icons stacked -->
        {#if !isExpanded && allAgents.length > 0}
          <div class="mt-1 space-y-0.5">
            {#each allAgents.slice(0, 5) as agent (agent.id)}
              <a
                href={`/${prefix}/agents/${agent.slug ?? agent.urlKey ?? agent.id}`}
                class={cn(
                  "flex items-center justify-center rounded-lg px-3 py-2 transition-colors",
                  $page.url.pathname.includes(`/agents/${agent.slug ?? agent.urlKey ?? agent.id}`)
                    ? "bg-[rgba(59,130,246,0.10)]"
                    : "hover:bg-[var(--clawdev-card-hover)]",
                )}
                title={agent.nickname ?? agent.name}
              >
                <div class="relative shrink-0">
                  {#if agent.icon && isEmoji(agent.icon)}
                    <span class="flex h-5 w-5 items-center justify-center text-sm select-none">
                      {agent.icon}
                    </span>
                  {:else}
                    <span
                      class="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold uppercase"
                      style:background-color={agent.iconColor ? `${agent.iconColor}20` : 'var(--clawdev-card-hover)'}
                      style:color={agent.iconColor ?? 'var(--clawdev-text-muted)'}
                    >
                      {agentInitials(agent)}
                    </span>
                  {/if}
                  {#if agentStatusColor(agent)}
                    <span
                      class={cn(
                        "absolute -bottom-px -right-px block h-2 w-2 rounded-full border border-[var(--clawdev-bg-base)]",
                        agent.status === "running" && "animate-pulse",
                      )}
                      style:background-color={agentStatusColor(agent)}
                    ></span>
                  {/if}
                </div>
              </a>
            {/each}
            {#if allAgents.length > 5}
              <a
                href={`/${prefix}/agents`}
                class="flex items-center justify-center rounded-lg px-3 py-1.5 text-[10px] text-[var(--clawdev-text-tertiary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
                title="All agents"
              >
                +{allAgents.length - 5}
              </a>
            {/if}
          </div>
        {/if}
      </div>

      <!-- ================================================================== -->
      <!-- MORE / COMPANY section                                               -->
      <!-- ================================================================== -->
      <div class="mt-4">
        {#if isExpanded}
          <button
            onclick={() => toggleSection(moreSection.key)}
            class="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md group"
            aria-expanded={sectionOpen[moreSection.key]}
          >
            <ChevronRight
              class={cn(
                "size-3 shrink-0 transition-transform duration-150",
                sectionOpen[moreSection.key] && "rotate-90",
              )}
            />
            <span class="select-none">{moreSection.label}</span>
          </button>
        {:else}
          <div class="mx-3 my-2 border-t border-[var(--clawdev-bg-surface-border)]"></div>
        {/if}

        {#if sectionOpen[moreSection.key] || !isExpanded}
          <div class={cn("mt-1 space-y-0.5", isExpanded && "ml-[18px] border-l border-[var(--clawdev-bg-surface-border)] pl-0")}>
            {#each moreSection.items as item (item.href)}
              <a
                href={`/${prefix}/${item.href}`}
                class={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors",
                  isActive(item.href)
                    ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                    : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                )}
                title={item.label}
              >
                <item.icon class="size-4 shrink-0" />
                <span class={cn("flex-1 truncate whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>{item.label}</span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </nav>

    <!-- Footer -->
    <div class="border-t border-[var(--clawdev-bg-surface-border)] px-2 py-3 space-y-1 shrink-0">
      <a
        href="/docs"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-3 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors rounded-lg px-3 py-1.5 hover:bg-[var(--clawdev-card-hover)]"
        title="Documentation"
      >
        <BookOpen class="size-3.5 shrink-0" />
        <span class={cn("whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>Documentation</span>
      </a>
      <div class="flex items-center justify-between px-3">
        <a
          href="/settings/general"
          class="flex items-center gap-3 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors rounded-lg py-1.5 hover:bg-[var(--clawdev-card-hover)] -mx-3 px-3 flex-1"
          title="Instance Settings"
        >
          <Cog class="size-3.5 shrink-0" />
          <span class={cn("whitespace-nowrap transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0")}>Instance Settings</span>
        </a>
        {#if isExpanded}
          <button
            onclick={toggleTheme}
            class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors shrink-0"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {#if isDark}
              <Sun class="size-3.5" />
            {:else}
              <Moon class="size-3.5" />
            {/if}
          </button>
        {/if}
      </div>
      {#if !isExpanded}
        <div class="flex justify-center">
          <button
            onclick={toggleTheme}
            class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {#if isDark}
              <Sun class="size-3.5" />
            {:else}
              <Moon class="size-3.5" />
            {/if}
          </button>
        </div>
      {/if}
      {#if isExpanded}
        <div class="text-[10px] text-[var(--clawdev-text-tertiary)] select-none pt-0.5 px-3">ClawDev v0.3.1</div>
      {/if}
    </div>
  </aside>
{/if}

<!-- ======================================================================== -->
<!-- MOBILE SIDEBAR — Full-width overlay (unchanged behavior)                  -->
<!-- ======================================================================== -->
{#if sidebarStore.isMobile && sidebarStore.open}
  <aside
    data-slot="sidebar"
    class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[var(--clawdev-bg-surface)] text-[var(--clawdev-text-primary)] border-r border-[var(--clawdev-bg-surface-border)] shadow-2xl transition-transform duration-200"
  >
    <!-- Header -->
    <div class="flex h-14 items-center justify-between px-4 border-b border-[var(--clawdev-bg-surface-border)]">
      <div class="relative flex items-center gap-2.5 min-w-0 flex-1">
        {#if hasMultipleCompanies}
          <button
            class="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
            onclick={(e) => { e.stopPropagation(); companySwitcherOpen = !companySwitcherOpen; }}
            aria-label="Switch company"
          >
            <div class="relative shrink-0">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white uppercase select-none shadow-sm"
                style:background-color={companyBrandColor}
              >
                {companyName.charAt(0)}
              </div>
              {#if avatarStatusColor}
                <span
                  class={cn(
                    "absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[var(--clawdev-bg-base)]",
                    activeRunCount != null && activeRunCount > 0 && !hasAgentErrors && "animate-pulse",
                  )}
                  style:background-color={avatarStatusColor}
                ></span>
              {/if}
            </div>
            <span class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">{companyName}</span>
            <ChevronDown class={cn("size-3.5 shrink-0 text-[var(--clawdev-text-muted)] transition-transform duration-150", companySwitcherOpen && "rotate-180")} />
          </button>

          {#if companySwitcherOpen}
            <div class="absolute top-full left-0 mt-1.5 w-56 rounded-xl border border-[var(--clawdev-bg-surface-border)] bg-[var(--clawdev-card-bg)] shadow-xl z-50 py-1.5" onclick={(e) => e.stopPropagation()}>
              <div class="px-3 py-1.5 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest">
                Companies
              </div>
              {#each companyStore.companies as c (c.id)}
                <button
                  class={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors rounded-lg mx-1.5",
                    c.id === companyStore.selectedCompanyId
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-text-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                  style="width: calc(100% - 0.75rem);"
                  onclick={() => switchCompany(c)}
                >
                  <div
                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white uppercase"
                    style:background-color={(c.brandColor as string) || "#3B82F6"}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <span class="truncate">{c.name}</span>
                </button>
              {/each}
              <div class="border-t border-[var(--clawdev-bg-surface-border)] mt-1.5 pt-1.5 mx-1.5">
                <a
                  href="/companies"
                  class="flex items-center gap-2 px-3 py-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors rounded-lg"
                >
                  <Plus class="size-3" />
                  Manage Companies
                </a>
              </div>
            </div>
          {/if}
        {:else}
          <div class="relative shrink-0">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white uppercase select-none"
              style:background-color={companyBrandColor}
            >
              {companyName.charAt(0)}
            </div>
            {#if avatarStatusColor}
              <span
                class={cn(
                  "absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full border-2 border-[var(--clawdev-bg-base)]",
                  activeRunCount != null && activeRunCount > 0 && !hasAgentErrors && "animate-pulse",
                )}
                style:background-color={avatarStatusColor}
              ></span>
            {/if}
          </div>
          <span class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">{companyName}</span>
        {/if}
      </div>
      <div class="flex items-center gap-1">
        <button
          onclick={openSearch}
          class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
          aria-label="Search (Ctrl+K)"
          title="Search (Ctrl+K)"
        >
          <Search class="size-4" />
        </button>
        <button
          class="text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] p-1 rounded-lg hover:bg-[var(--clawdev-card-hover)]"
          onclick={() => sidebarStore.set(false)}
          aria-label="Close sidebar"
        >
          <X class="size-4" />
        </button>
      </div>
    </div>

    <!-- New Issue button -->
    <div class="px-3 pt-3 pb-1">
      <button
        onclick={openNewIssueDialog}
        class="flex h-7 w-full items-center justify-center gap-1.5 rounded-md bg-[var(--clawdev-primary)] px-3 text-xs font-medium text-white hover:bg-[var(--clawdev-primary-hover)] transition-colors"
      >
        <Plus class="size-3.5" />
        New Issue
      </button>
    </div>

    <!-- Navigation (mobile — always fully expanded) -->
    <nav class="flex-1 overflow-y-auto px-3 pt-3 pb-4">
      <div class="space-y-0.5">
        <a
          href={`/${prefix}/dashboard`}
          class={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
            isActive("dashboard")
              ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
              : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
          )}
        >
          <LayoutDashboard class="size-4 shrink-0" />
          <span class="flex-1 truncate">Dashboard</span>
          {#if activeRunCount != null && activeRunCount > 0}
            <span class="ml-auto flex items-center gap-1 text-[11px] font-medium tabular-nums text-[#60a5fa]">
              <span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
              {activeRunCount} live
            </span>
          {/if}
        </a>
        <a
          href={`/${prefix}/inbox`}
          class={cn(
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
            isActive("inbox")
              ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
              : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
          )}
        >
          <Inbox class="size-4 shrink-0" />
          <span class="flex-1 truncate">Inbox</span>
          {#if inboxUnread > 0}
            <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums bg-[#ef4444] text-white">
              {formatBadge(inboxUnread)}
            </span>
          {/if}
        </a>
      </div>

      {#each sections as section (section.key)}
        <div class="mt-4">
          <button
            onclick={() => toggleSection(section.key)}
            class="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md group"
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

          {#if sectionOpen[section.key]}
            <div class="mt-1 space-y-0.5">
              {#each section.items as item (item.href)}
                <a
                  href={`/${prefix}/${item.href}`}
                  class={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    isActive(item.href)
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                >
                  <item.icon class="size-4 shrink-0" />
                  <span class="flex-1 truncate">{item.label}</span>
                  {#if item.betaBadge}
                    <span class="ml-0.5 inline-flex items-center rounded px-1 py-px text-[9px] font-semibold uppercase leading-tight bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">
                      Beta
                    </span>
                  {/if}
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}

      <!-- Projects (mobile) -->
      <div class="mt-4">
        <div class="flex items-center justify-between px-2 py-1">
          <button
            onclick={() => toggleSection("projects")}
            class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md"
            aria-expanded={sectionOpen["projects"]}
          >
            <ChevronRight class={cn("size-3 shrink-0 transition-transform duration-150", sectionOpen["projects"] && "rotate-90")} />
            <span class="select-none">Projects</span>
          </button>
          <a href={`/${prefix}/projects?new=true`} class="flex h-5 w-5 items-center justify-center rounded-md text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors" title="New project" aria-label="New project">
            <Plus class="size-3" />
          </a>
        </div>
        {#if sectionOpen["projects"]}
          <div class="mt-1 space-y-0.5">
            {#if allProjects.length === 0}
              <div class="px-3 py-2 text-xs text-[var(--clawdev-text-tertiary)] italic">No projects yet</div>
            {:else}
              {#each visibleProjects as proj (proj.id)}
                <a
                  href={`/${prefix}/projects/${proj.slug ?? proj.id}/issues`}
                  class={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    $page.url.pathname.includes(`/projects/${proj.slug ?? proj.id}`)
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                >
                  <span class="h-2 w-2 rounded-full shrink-0" style:background={projectColor(proj)}></span>
                  <span class="flex-1 truncate">{proj.name}</span>
                </a>
              {/each}
              {#if hasMoreProjects}
                <button onclick={() => { projectsExpanded = !projectsExpanded; }} class="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-muted)] transition-colors w-full rounded-lg">
                  {projectsExpanded ? "Show fewer" : `Show ${allProjects.length - PROJECTS_COLLAPSED_LIMIT} more...`}
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>

      <!-- Agents (mobile) -->
      <div class="mt-4">
        <div class="flex items-center justify-between px-2 py-1">
          <button
            onclick={() => toggleSection("agents")}
            class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md"
            aria-expanded={sectionOpen["agents"]}
          >
            <ChevronRight class={cn("size-3 shrink-0 transition-transform duration-150", sectionOpen["agents"] && "rotate-90")} />
            <span class="select-none">Agents</span>
          </button>
          <a href={`/${prefix}/agents/new`} class="flex h-5 w-5 items-center justify-center rounded-md text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors" title="New agent" aria-label="New agent">
            <Plus class="size-3" />
          </a>
        </div>
        {#if sectionOpen["agents"]}
          <div class="mt-1 space-y-0.5">
            {#if allAgents.length === 0}
              <div class="px-3 py-2 text-xs text-[var(--clawdev-text-tertiary)] italic">No agents yet</div>
            {:else}
              {#each visibleAgents as agent (agent.id)}
                <a
                  href={`/${prefix}/agents/${agent.slug ?? agent.urlKey ?? agent.id}`}
                  class={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    $page.url.pathname.includes(`/agents/${agent.slug ?? agent.urlKey ?? agent.id}`)
                      ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                      : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                  )}
                >
                  <div class="relative shrink-0">
                    {#if agent.icon && isEmoji(agent.icon)}
                      <span class="flex h-5 w-5 items-center justify-center text-sm select-none">{agent.icon}</span>
                    {:else}
                      <span class="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold uppercase" style:background-color={agent.iconColor ? `${agent.iconColor}20` : 'var(--clawdev-card-hover)'} style:color={agent.iconColor ?? 'var(--clawdev-text-muted)'}>
                        {agentInitials(agent)}
                      </span>
                    {/if}
                    {#if agentStatusColor(agent)}
                      <span class={cn("absolute -bottom-px -right-px block h-2 w-2 rounded-full border border-[var(--clawdev-bg-base)]", agent.status === "running" && "animate-pulse")} style:background-color={agentStatusColor(agent)}></span>
                    {/if}
                  </div>
                  <span class="flex-1 truncate" title={agent.nickname ? `${agent.name} (${agent.nickname})` : agent.name}>
                    {agent.nickname ?? agent.name}
                  </span>
                  {#if liveRunsByAgent.get(agent.id)}
                    <span class="ml-auto flex items-center gap-1 text-[10px] font-medium tabular-nums text-[#60a5fa]">
                      <span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
                      {liveRunsByAgent.get(agent.id)} live
                    </span>
                  {/if}
                </a>
              {/each}
              {#if hasMoreAgents}
                <button onclick={() => { agentsExpanded = !agentsExpanded; }} class="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-muted)] transition-colors w-full rounded-lg">
                  {agentsExpanded ? "Show fewer" : `Show ${allAgents.length - AGENTS_COLLAPSED_LIMIT} more...`}
                </button>
              {/if}
            {/if}
          </div>
        {/if}
      </div>

      <!-- More / Company section (mobile) -->
      <div class="mt-4">
        <button
          onclick={() => toggleSection(moreSection.key)}
          class="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold text-[var(--clawdev-text-tertiary)] uppercase tracking-widest hover:text-[var(--clawdev-text-muted)] transition-colors rounded-md group"
          aria-expanded={sectionOpen[moreSection.key]}
        >
          <ChevronRight class={cn("size-3 shrink-0 transition-transform duration-150", sectionOpen[moreSection.key] && "rotate-90")} />
          <span class="select-none">{moreSection.label}</span>
        </button>
        {#if sectionOpen[moreSection.key]}
          <div class="mt-1 space-y-0.5">
            {#each moreSection.items as item (item.href)}
              <a
                href={`/${prefix}/${item.href}`}
                class={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                  isActive(item.href)
                    ? "bg-[rgba(59,130,246,0.10)] text-[var(--clawdev-primary)] font-medium"
                    : "text-[var(--clawdev-text-muted)] hover:bg-[var(--clawdev-card-hover)] hover:text-[var(--clawdev-text-primary)]",
                )}
              >
                <item.icon class="size-4 shrink-0" />
                <span class="flex-1 truncate">{item.label}</span>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    </nav>

    <!-- Footer (mobile) -->
    <div class="border-t border-[var(--clawdev-bg-surface-border)] px-4 py-3 space-y-2">
      <a
        href="/docs"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2.5 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors rounded-lg px-1 py-1 hover:bg-[var(--clawdev-card-hover)] -mx-1"
      >
        <BookOpen class="size-3.5" />
        Documentation
      </a>
      <div class="flex items-center justify-between">
        <a
          href="/settings/general"
          class="flex items-center gap-2.5 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors rounded-lg px-1 py-1 hover:bg-[var(--clawdev-card-hover)] -mx-1"
        >
          <Cog class="size-3.5" />
          Instance Settings
        </a>
        <button
          onclick={toggleTheme}
          class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--clawdev-text-tertiary)] hover:text-[var(--clawdev-text-primary)] hover:bg-[var(--clawdev-card-hover)] transition-colors"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {#if isDark}
            <Sun class="size-3.5" />
          {:else}
            <Moon class="size-3.5" />
          {/if}
        </button>
      </div>
      <div class="text-[10px] text-[var(--clawdev-text-tertiary)] select-none pt-0.5">ClawDev v0.3.1</div>
    </div>
  </aside>
{/if}

<!-- Mobile overlay backdrop -->
{#if sidebarStore.isMobile && sidebarStore.open}
  <button
    class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
    onclick={() => sidebarStore.set(false)}
    aria-label="Close sidebar"
  ></button>
{/if}
