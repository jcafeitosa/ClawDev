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
    FolderKanban,
    Bot,
    ShieldCheck,
    Box,
    Building2,
    Puzzle,
    DollarSign,
    Activity,
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
    urlKey?: string;
    color?: string | null;
    status?: string;
  }

  interface SidebarAgent {
    id: string;
    name: string;
    slug?: string;
    urlKey?: string;
    icon?: string | null;
    status?: string;
    role?: string;
  }

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
      localStorage.setItem("clawdev.theme", isDark ? "dark" : "light");
      localStorage.setItem("clawdev.theme", isDark ? "dark" : "light");
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Badge data fetches
  // ---------------------------------------------------------------------------
  let inboxUnread = $state(0);
  let issueCount = $state<number | null>(null);
  let activeRunCount = $state<number | null>(null);
  let hasAgentErrors = $state(false);

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/inbox?status=unread&limit=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.total != null) inboxUnread = data.total;
      })
      .catch(() => {});
  });

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/issues?limit=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.total != null) issueCount = data.total;
        else if (Array.isArray(data)) issueCount = data.length;
      })
      .catch(() => {});
  });

  // Active run count with periodic refresh
  let runBadgeInterval: ReturnType<typeof setInterval> | undefined;

  function fetchActiveRunCount() {
    if (!companyStore.selectedCompanyId) return;
    fetch(`/api/companies/${companyStore.selectedCompanyId}/runs?status=running&limit=0`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.total != null) activeRunCount = data.total;
        else if (Array.isArray(data)) activeRunCount = data.length;
        else activeRunCount = null;
      })
      .catch(() => { activeRunCount = null; });
  }

  $effect(() => {
    if (!companyStore.selectedCompanyId) return;
    fetchActiveRunCount();
    runBadgeInterval = setInterval(fetchActiveRunCount, 15_000);
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
      ? "#ef4444"   // red — errors present
      : activeRunCount != null && activeRunCount > 0
        ? "#22c55e" // green — agents running
        : null       // no dot
  );

  // ---------------------------------------------------------------------------
  // Nav sections (standard icon-based navigation)
  // ---------------------------------------------------------------------------
  const sections: NavSection[] = [
    {
      key: "overview",
      label: "Overview",
      defaultOpen: true,
      items: [
        {
          label: "Dashboard",
          href: "dashboard",
          icon: LayoutDashboard,
          badge: () => activeRunCount != null && activeRunCount > 0 ? `${activeRunCount} live` : null,
          badgeStyle: "live",
        },
        {
          label: "Inbox",
          href: "inbox",
          icon: Inbox,
          badge: () => inboxUnread > 0 ? inboxUnread : null,
          badgeStyle: "count",
        },
      ],
    },
    {
      key: "work",
      label: "Work",
      defaultOpen: true,
      items: [
        { label: "Issues", href: "issues", icon: ListTodo },
        { label: "Runs", href: "runs", icon: Play },
        { label: "Routines", href: "routines", icon: RotateCcw, betaBadge: true },
        { label: "Goals", href: "goals", icon: Target },
      ],
    },
  ];

  // ---------------------------------------------------------------------------
  // "More" section — less-used pages under a collapsible group
  // ---------------------------------------------------------------------------
  const moreSection: NavSection = {
    key: "more",
    label: "More",
    defaultOpen: false,
    items: [
      { label: "Approvals", href: "approvals", icon: ShieldCheck },
      { label: "Workspaces", href: "workspaces", icon: Box },
      { label: "Org", href: "org", icon: Building2 },
      { label: "Skills", href: "skills", icon: Puzzle },
      { label: "Costs", href: "costs", icon: DollarSign },
      { label: "Activity", href: "activity", icon: Activity },
      { label: "Settings", href: "settings", icon: Settings },
    ],
  };

  // Combine all sections for collapsible state management
  const allSections = [...sections, moreSection];

  // ---------------------------------------------------------------------------
  // Collapsible state — persisted in localStorage
  // ---------------------------------------------------------------------------
  const SECTION_STORAGE_KEY = "clawdev.sidebar.sections";

  // Extra keys for projects/agents sections
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

  // Close company switcher on outside click
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

  /** Produce a deterministic color from a project's color field, or a hash-based fallback */
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

  /** Get the agent display icon — either a custom emoji/char or fallback initials */
  function agentInitials(agent: SidebarAgent): string {
    if (agent.icon) return agent.icon;
    return agent.name.slice(0, 2).toUpperCase();
  }

  /** Agent status dot color */
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
  <!-- Header: Company avatar + name with optional switcher -->
  <div class="flex h-14 items-center justify-between px-4 border-b border-[var(--clawdev-bg-surface-border)]">
    <div class="relative flex items-center gap-2.5 min-w-0 flex-1">
      {#if hasMultipleCompanies}
        <button
          class="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
          onclick={(e) => { e.stopPropagation(); companySwitcherOpen = !companySwitcherOpen; }}
          aria-label="Switch company"
        >
          <!-- Company avatar with status dot -->
          <div class="relative shrink-0">
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white uppercase select-none"
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
          <div class="absolute top-full left-0 mt-1 w-56 rounded-lg border border-[var(--clawdev-bg-surface-border)] bg-[#11111a] shadow-xl z-50 py-1" onclick={(e) => e.stopPropagation()}>
            <div class="px-3 py-1.5 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest">
              Companies
            </div>
            {#each companyStore.companies as c (c.id)}
              <button
                class={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  c.id === companyStore.selectedCompanyId
                    ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium"
                    : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]",
                )}
                onclick={() => switchCompany(c)}
              >
                <div
                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white uppercase"
                  style:background-color={(c.brandColor as string) || "#3B82F6"}
                >
                  {c.name.charAt(0)}
                </div>
                <span class="truncate">{c.name}</span>
              </button>
            {/each}
            <div class="border-t border-[var(--clawdev-bg-surface-border)] mt-1 pt-1">
              <a
                href="/companies"
                class="flex items-center gap-2 px-3 py-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              >
                <Plus class="size-3" />
                Manage Companies
              </a>
            </div>
          </div>
        {/if}
      {:else}
        <!-- Company avatar with status dot (single company) -->
        <div class="relative shrink-0">
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white uppercase select-none"
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
        class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
        aria-label="Search (Ctrl+K)"
        title="Search (Ctrl+K)"
      >
        <Search class="size-4" />
      </button>
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
  </div>

  <!-- New Issue button -->
  <div class="px-3 pt-3 pb-1">
    <button
      onclick={() => openNewIssueDialog()}
      class="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-[var(--clawdev-primary)] px-3 text-sm font-medium text-white hover:bg-[var(--clawdev-primary-hover)] transition-colors"
    >
      <Plus class="size-3.5" />
      New Issue
    </button>
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto px-3 pt-2 pb-4">
    <!-- Standard nav sections (Overview, Work) -->
    {#each sections as section (section.key)}
      <div class="mt-3 first:mt-0">
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

                <!-- Beta badge (e.g. Routines) -->
                {#if item.betaBadge}
                  <span class="ml-0.5 inline-flex items-center rounded px-1 py-px text-[9px] font-semibold uppercase leading-tight bg-[rgba(245,158,11,0.15)] text-[#f59e0b]">
                    Beta
                  </span>
                {/if}

                <!-- Live badge (Dashboard) -->
                {#if item.badge}
                  {@const badgeValue = item.badge()}
                  {#if badgeValue != null}
                    {#if item.badgeStyle === "live"}
                      <span class="ml-auto flex items-center gap-1 text-[11px] font-medium tabular-nums text-[#60a5fa]">
                        <span class="inline-block h-1.5 w-1.5 rounded-full bg-[#3b82f6] animate-pulse"></span>
                        {typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue}
                      </span>
                    {:else if item.badgeStyle === "count"}
                      <!-- Inbox-style count badge -->
                      <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums bg-[#ef4444] text-white">
                        {typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue}
                      </span>
                    {:else}
                      <span class="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-muted)]">
                        {typeof badgeValue === "number" ? formatBadge(badgeValue) : badgeValue}
                      </span>
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
    <!-- PROJECTS section with individual items                              -->
    <!-- ================================================================== -->
    <div class="mt-3">
      <div class="flex items-center justify-between px-1.5 py-1">
        <button
          onclick={() => toggleSection("projects")}
          class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm"
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
          class="flex h-5 w-5 items-center justify-center rounded text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          title="New project"
          aria-label="New project"
        >
          <Plus class="size-3" />
        </a>
      </div>

      {#if sectionOpen["projects"]}
        <div class="mt-0.5 space-y-px">
          {#if allProjects.length === 0}
            <div class="px-2.5 py-1.5 text-xs text-[var(--clawdev-text-muted)]/60 italic">
              No projects yet
            </div>
          {:else}
            {#each visibleProjects as proj (proj.id)}
              <a
                href={`/${prefix}/projects/${proj.urlKey ?? proj.slug ?? proj.id}`}
                class={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  $page.url.pathname.includes(`/projects/${proj.urlKey ?? proj.slug ?? proj.id}`)
                    ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium"
                    : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]",
                )}
              >
                <span
                  class="h-2 w-2 rounded-full shrink-0"
                  style:background={projectColor(proj)}
                ></span>
                <span class="flex-1 truncate">{proj.name}</span>
              </a>
            {/each}

            {#if hasMoreProjects}
              <button
                onclick={() => { projectsExpanded = !projectsExpanded; }}
                class="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--clawdev-text-muted)]/60 hover:text-[var(--clawdev-text-muted)] transition-colors w-full"
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
    </div>

    <!-- ================================================================== -->
    <!-- AGENTS section with individual items                                -->
    <!-- ================================================================== -->
    <div class="mt-3">
      <div class="flex items-center justify-between px-1.5 py-1">
        <button
          onclick={() => toggleSection("agents")}
          class="flex items-center gap-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm"
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
          class="flex h-5 w-5 items-center justify-center rounded text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          title="New agent"
          aria-label="New agent"
        >
          <Plus class="size-3" />
        </a>
      </div>

      {#if sectionOpen["agents"]}
        <div class="mt-0.5 space-y-px">
          {#if allAgents.length === 0}
            <div class="px-2.5 py-1.5 text-xs text-[var(--clawdev-text-muted)]/60 italic">
              No agents yet
            </div>
          {:else}
            {#each visibleAgents as agent (agent.id)}
              <a
                href={`/${prefix}/agents/${agent.slug ?? agent.urlKey ?? agent.id}`}
                class={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  $page.url.pathname.includes(`/agents/${agent.slug ?? agent.urlKey ?? agent.id}`)
                    ? "bg-[rgba(255,255,255,0.08)] text-[var(--clawdev-text-primary)] font-medium"
                    : "text-[var(--clawdev-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--clawdev-text-primary)]",
                )}
              >
                <!-- Agent icon with status dot -->
                <div class="relative shrink-0">
                  {#if agent.icon}
                    <span class="flex h-5 w-5 items-center justify-center text-sm" title={agent.name}>
                      {agent.icon}
                    </span>
                  {:else}
                    <span class="flex h-5 w-5 items-center justify-center rounded bg-[rgba(255,255,255,0.08)] text-[9px] font-bold text-[var(--clawdev-text-muted)] uppercase">
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
                <span class="flex-1 truncate">{agent.name}</span>
              </a>
            {/each}

            {#if hasMoreAgents}
              <button
                onclick={() => { agentsExpanded = !agentsExpanded; }}
                class="flex items-center gap-2 px-2.5 py-1 text-xs text-[var(--clawdev-text-muted)]/60 hover:text-[var(--clawdev-text-muted)] transition-colors w-full"
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
    </div>

    <!-- ================================================================== -->
    <!-- MORE section (less-used pages)                                      -->
    <!-- ================================================================== -->
    <div class="mt-3">
      <button
        onclick={() => toggleSection(moreSection.key)}
        class="flex w-full items-center gap-1 px-1.5 py-1 text-[10px] font-semibold text-[var(--clawdev-text-muted)] uppercase tracking-widest hover:text-[var(--clawdev-text-primary)] transition-colors rounded-sm group"
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

      {#if sectionOpen[moreSection.key]}
        <div class="mt-0.5 space-y-px">
          {#each moreSection.items as item (item.href)}
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
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </nav>

  <!-- Footer -->
  <div class="border-t border-[var(--clawdev-bg-surface-border)] px-4 py-3 space-y-1.5">
    <a
      href="/docs"
      target="_blank"
      rel="noopener noreferrer"
      class="flex items-center gap-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors"
    >
      <BookOpen class="size-3.5" />
      Documentation
    </a>
    <div class="flex items-center justify-between">
      <a
        href="/settings/general"
        class="flex items-center gap-2 text-xs text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] transition-colors"
      >
        <Cog class="size-3.5" />
        Instance Settings
      </a>
      <div class="flex items-center gap-1">
        <a
          href="/companies"
          class="flex h-6 w-6 items-center justify-center rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          aria-label="Create or manage companies"
          title="Create or manage companies"
        >
          <Plus class="size-3.5" />
        </a>
        <button
        onclick={toggleTheme}
        class="flex h-6 w-6 items-center justify-center rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
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
    </div>
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
