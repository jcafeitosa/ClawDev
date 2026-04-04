<script lang="ts">
  import { Sidebar } from "$components/layout/index.js";
  import { BreadcrumbBar } from "$components/layout/index.js";
  import { ToastViewport } from "$components/layout/index.js";
  import DevBanner from "$components/layout/dev-banner.svelte";
  import MobileBottomNav from "$components/layout/mobile-bottom-nav.svelte";
  import { NewIssueDialog, CommandPalette } from "$components/index.js";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { themeStore } from "$stores/theme.svelte.js";
  import { liveEventsStore } from "$stores/live-events.svelte.js";
  import { keyboardShortcutsStore } from "$stores/keyboard-shortcuts.svelte.js";
  import { resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { page } from "$app/stores";
  import { onMount, onDestroy } from "svelte";

  let { children } = $props();
  let healthInterval: ReturnType<typeof setInterval> | undefined;
  let companiesInterval: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    themeStore.init();
    sidebarStore.init();
    keyboardShortcutsStore.init();
    loadCompanies();

    // Periodic health check (detect server restarts / downtime)
    healthInterval = setInterval(() => {
      fetch("/api/health").catch(() => {});
    }, 30_000);

    // Periodic company list refresh (detect new companies / renames)
    companiesInterval = setInterval(() => {
      loadCompanies();
    }, 60_000);
  });

  // Reconnect live events when company changes
  $effect(() => {
    const id = resolveCompanyIdFromPrefix($page.params.companyPrefix) ?? companyStore.selectedCompanyId;
    if (id) liveEventsStore.reconnect(id);
  });

  onDestroy(() => {
    keyboardShortcutsStore.destroy();
    if (healthInterval) clearInterval(healthInterval);
    if (companiesInterval) clearInterval(companiesInterval);
  });

  // Sync company from route param
  $effect(() => {
    const prefix = $page.params.companyPrefix;
    if (prefix && companyStore.companies.length > 0) {
      const match = companyStore.companies.find(
        (c) => c.slug === prefix || c.id === prefix,
      );
      if (match && match.id !== companyStore.selectedCompanyId) {
        companyStore.select(match.id, "route_sync");
      }
    }
  });

  async function loadCompanies() {
    if (companyStore.companies.length > 0) return;
    companyStore.setLoading(true);
    try {
      const res = await fetch("/api/companies");
      if (!res.ok) throw new Error(`Failed to load companies: ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data ?? data.companies ?? [];
      companyStore.setCompanies(list);
    } catch (err) {
      companyStore.setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      companyStore.setLoading(false);
    }
  }
</script>

<div class="flex h-full flex-col overflow-hidden bg-[var(--clawdev-bg-base)]">
  <DevBanner />

  <div class="flex flex-1 overflow-hidden">
  <!-- Sidebar -->
  {#if sidebarStore.open || !sidebarStore.isMobile}
    <Sidebar />
  {/if}

  <!-- Main content -->
  <div class="flex flex-1 flex-col min-w-0 overflow-hidden">
    <BreadcrumbBar />
    <main class="flex-1 overflow-y-auto bg-[var(--clawdev-bg-base)] pb-16 md:pb-0">
      {@render children()}
    </main>
  </div>
  </div>
</div>

<MobileBottomNav companyPrefix={$page.params.companyPrefix ?? ''} />
<NewIssueDialog />
<CommandPalette />
<ToastViewport />
