<script lang="ts">
  import { page } from "$app/stores";
  import { PluginLauncherOutlet, PluginSlotOutlet } from "$lib/components/plugins/index.js";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import {
    Menu, ChevronRight, LayoutDashboard, Inbox, ListTodo, Bot, Target,
    FolderKanban, ShieldCheck, DollarSign, Activity, Settings, Puzzle,
    FileText, Users, Clock, Zap, BookOpen, CircleDot,
  } from "lucide-svelte";
  import type { ComponentType } from "svelte";
  import { cn } from "$utils/index.js";

  const crumbs = $derived(breadcrumbStore.items);
  const companyPrefix = $derived($page.params.companyPrefix ?? "");
  const companyId = $derived(resolveCompanyIdFromPrefix(companyPrefix) ?? companyStore.selectedCompanyId ?? null);
  const companyName = $derived(
    companyStore.companies.find((c) => c.id === companyId)?.name ?? companyPrefix ?? ""
  );
  const pluginHostContext = $derived({
    companyId,
    companyPrefix: companyPrefix || null,
    projectId: null,
    entityId: null,
    entityType: null,
    parentEntityId: null,
    userId: null,
  });

  // ClickUp-style icon mapping for breadcrumb context
  const BREADCRUMB_ICONS: Record<string, ComponentType> = {
    Dashboard: LayoutDashboard, Inbox, Issues: ListTodo, Agents: Bot,
    Goals: Target, Projects: FolderKanban, Approvals: ShieldCheck,
    Costs: DollarSign, Activity, Settings, Plugins: Puzzle, Documents: FileText,
    Org: Users, Runs: Clock, Routines: Zap, Skills: BookOpen,
  };

  function getCrumbIcon(label: string): ComponentType | null {
    return BREADCRUMB_ICONS[label] ?? null;
  }
</script>

<header
  data-slot="breadcrumb-bar"
  class="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4 bg-background"
>
  {#if sidebarStore.isMobile}
    <button
      class="p-1 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
      onclick={() => sidebarStore.toggle()}
      aria-label="Toggle sidebar"
    >
      <Menu class="size-5" />
    </button>
  {/if}

  <!-- Company context chip -->
  {#if companyName && crumbs.length > 0}
    <a
      href="/{companyPrefix}/dashboard"
      class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
    >
      <span class="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
        {companyName.charAt(0).toUpperCase()}
      </span>
    </a>
    <ChevronRight class="size-3.5 text-muted-foreground/40 shrink-0" />
  {/if}

  <!-- Breadcrumb trail -->
  {#if crumbs.length === 0}
    <span class="font-heading text-sm font-semibold text-foreground">{companyName || 'Dashboard'}</span>
  {:else}
    <nav class="flex items-center gap-1 text-sm truncate min-w-0">
      {#each crumbs as crumb, i}
        {#if i > 0}
          <ChevronRight class="size-3.5 text-muted-foreground/40 shrink-0" />
        {/if}
        {@const icon = getCrumbIcon(crumb.label)}
        {@const isLast = i === crumbs.length - 1}
        {#if !isLast && crumb.href}
          {@const CrumbIcon = icon}
          <a
            href={crumb.href}
            class="flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors truncate max-w-[160px]"
          >
            {#if CrumbIcon}<CrumbIcon class="size-3.5 shrink-0" />{/if}
            <span class="truncate">{crumb.label}</span>
          </a>
        {:else}
          {@const CrumbIcon = icon}
          <span class="flex items-center gap-1.5 px-1.5 py-0.5 truncate max-w-[240px] {isLast ? 'font-heading font-semibold text-foreground' : 'text-muted-foreground'}">
            {#if CrumbIcon}<CrumbIcon class="size-3.5 shrink-0" />{/if}
            <span class="truncate">{crumb.label}</span>
          </span>
        {/if}
      {/each}
    </nav>
  {/if}

  <div class="ml-auto flex items-center gap-2">
    <PluginSlotOutlet
      slotTypes={["globalToolbar"]}
      context={pluginHostContext}
      class="flex items-center gap-2"
      itemClassName="inline-flex items-center"
    />
    <PluginLauncherOutlet
      placementZones={["globalToolbarButton", "toolbarButton"]}
      context={pluginHostContext}
      class="flex items-center gap-2"
      itemClassName="inline-flex items-center"
    />
  </div>
</header>
