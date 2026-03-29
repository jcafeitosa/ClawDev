<script lang="ts">
  /**
   * Command Palette — keyboard-driven command launcher.
   *
   * Opens with Ctrl+K / Cmd+K. Provides:
   * 1. Static navigation commands (always available)
   * 2. Live issue search (debounced API, query >= 3 chars)
   * 3. Live agent search (debounced API, query >= 3 chars)
   * 4. Full keyboard navigation (arrows, enter, escape)
   */
  import { goto } from "$app/navigation";
  import { companyStore } from "$stores/company.svelte.js";
  import { api } from "$lib/api";
  import {
    Search,
    LayoutDashboard,
    ListTodo,
    Plus,
    Bot,
    FolderKanban,
    Target,
    ShieldCheck,
    RotateCcw,
    Zap,
    Activity,
    Inbox,
    DollarSign,
    Settings,
    Users,
    KeyRound,
    Tags,
    Puzzle,
    ArrowRight,
    Download,
    Upload,
    Building2,
    Loader2,
    Wallet,
    Globe,
  } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let open = $state(false);
  let query = $state("");
  let selectedIndex = $state(0);
  let searchingIssues = $state(false);
  let searchingAgents = $state(false);
  let issueResults = $state<Array<{ id: string; identifier: string; title: string }>>([]);
  let agentResults = $state<Array<{ id: string; name: string; description?: string }>>([]);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listEl = $state<HTMLDivElement | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const prefix = $derived(
    companyStore.selectedCompany?.slug ?? companyStore.selectedCompanyId ?? "",
  );
  const companyId = $derived(
    companyStore.selectedCompany?.id ?? companyStore.selectedCompanyId ?? "",
  );

  // ---------------------------------------------------------------------------
  // Navigation Commands (static)
  // ---------------------------------------------------------------------------
  interface NavCommand {
    id: string;
    label: string;
    description?: string;
    icon: typeof LayoutDashboard;
    href: string;
  }

  const allNavCommands: NavCommand[] = [
    { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, href: "dashboard" },
    { id: "nav-issues", label: "Issues", icon: ListTodo, href: "issues" },
    { id: "nav-issues-new", label: "New Issue", description: "Create a new issue", icon: Plus, href: "issues/new" },
    { id: "nav-agents", label: "Agents", icon: Bot, href: "agents" },
    { id: "nav-agents-new", label: "New Agent", description: "Register a new agent", icon: Plus, href: "agents/new" },
    { id: "nav-projects", label: "Projects", icon: FolderKanban, href: "projects" },
    { id: "nav-goals", label: "Goals", icon: Target, href: "goals" },
    { id: "nav-approvals", label: "Approvals", icon: ShieldCheck, href: "approvals" },
    { id: "nav-routines", label: "Routines", icon: RotateCcw, href: "routines" },
    { id: "nav-runs", label: "Runs", icon: Zap, href: "runs" },
    { id: "nav-activity", label: "Activity", icon: Activity, href: "activity" },
    { id: "nav-inbox", label: "Inbox", icon: Inbox, href: "inbox" },
    { id: "nav-costs", label: "Costs", icon: DollarSign, href: "costs" },
    { id: "nav-budgets", label: "Budgets", icon: Wallet, href: "budgets" },
    { id: "nav-settings", label: "Settings", icon: Settings, href: "settings" },
    { id: "nav-members", label: "Members", icon: Users, href: "members" },
    { id: "nav-secrets", label: "Secrets", icon: KeyRound, href: "secrets" },
    { id: "nav-labels", label: "Labels", icon: Tags, href: "labels" },
    { id: "nav-skills", label: "Skills", icon: Zap, href: "skills" },
    { id: "nav-workspaces", label: "Workspaces", icon: Building2, href: "workspaces" },
    { id: "nav-plugins", label: "Plugins", icon: Puzzle, href: "plugins" },
    { id: "nav-export", label: "Export", icon: Download, href: "export" },
    { id: "nav-import", label: "Import", icon: Upload, href: "import" },
    { id: "nav-org-chart", label: "Org Chart", icon: Building2, href: "org/chart" },
  ];

  const instanceCommands: NavCommand[] = [
    { id: "nav-instance-settings", label: "Instance Settings", description: "Global server configuration", icon: Globe, href: "__instance__settings/general" },
  ];

  // ---------------------------------------------------------------------------
  // Filtered results
  // ---------------------------------------------------------------------------
  const filteredNav = $derived.by(() => {
    if (!query.trim()) return allNavCommands;
    const q = query.toLowerCase().trim();
    const scored = allNavCommands
      .map((cmd) => {
        const label = cmd.label.toLowerCase();
        const desc = (cmd.description ?? "").toLowerCase();
        if (label === q) return { cmd, score: 100 };
        if (label.startsWith(q)) return { cmd, score: 80 };
        if (label.includes(q)) return { cmd, score: 60 };
        if (desc.includes(q)) return { cmd, score: 40 };
        // fuzzy: all chars in order
        let qi = 0;
        for (const ch of label) {
          if (qi < q.length && ch === q[qi]) qi++;
        }
        if (qi === q.length) return { cmd, score: 20 };
        return { cmd, score: 0 };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((s) => s.cmd);
  });

  const filteredInstance = $derived.by(() => {
    if (!query.trim()) return instanceCommands;
    const q = query.toLowerCase().trim();
    return instanceCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        (cmd.description ?? "").toLowerCase().includes(q),
    );
  });

  // Flat list of all actionable items for keyboard navigation
  interface FlatItem {
    kind: "nav" | "instance" | "issue" | "agent";
    data: NavCommand | { id: string; identifier: string; title: string } | { id: string; name: string; description?: string };
  }

  const flatItems = $derived.by((): FlatItem[] => {
    const items: FlatItem[] = [];
    for (const cmd of filteredNav) items.push({ kind: "nav", data: cmd });
    for (const cmd of filteredInstance) items.push({ kind: "instance", data: cmd });
    for (const issue of issueResults) items.push({ kind: "issue", data: issue });
    for (const agent of agentResults) items.push({ kind: "agent", data: agent });
    return items;
  });

  const isSearching = $derived(searchingIssues || searchingAgents);

  // ---------------------------------------------------------------------------
  // Debounced API search
  // ---------------------------------------------------------------------------
  $effect(() => {
    const q = query.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (q.length < 3) {
      issueResults = [];
      agentResults = [];
      searchingIssues = false;
      searchingAgents = false;
      return;
    }

    if (!companyId) return;

    searchingIssues = true;
    searchingAgents = true;

    debounceTimer = setTimeout(() => {
      fetchIssues(q);
      fetchAgents(q);
    }, 300);
  });

  async function fetchIssues(q: string) {
    try {
      const res = await api(
        `/api/companies/${companyId}/issues?q=${encodeURIComponent(q)}&limit=5`,
      );
      if (!res.ok) {
        issueResults = [];
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.issues ?? data.data ?? [];
      issueResults = list.slice(0, 5).map((i: Record<string, unknown>) => ({
        id: String(i.id ?? ""),
        identifier: String(i.identifier ?? i.key ?? ""),
        title: String(i.title ?? i.name ?? ""),
      }));
    } catch {
      issueResults = [];
    } finally {
      searchingIssues = false;
    }
  }

  async function fetchAgents(q: string) {
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      if (!res.ok) {
        agentResults = [];
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.agents ?? data.data ?? [];
      const lower = q.toLowerCase();
      agentResults = list
        .filter(
          (a: Record<string, unknown>) =>
            String(a.name ?? "")
              .toLowerCase()
              .includes(lower) ||
            String(a.description ?? "")
              .toLowerCase()
              .includes(lower),
        )
        .slice(0, 5)
        .map((a: Record<string, unknown>) => ({
          id: String(a.id ?? ""),
          name: String(a.name ?? ""),
          description: a.description ? String(a.description) : undefined,
        }));
    } catch {
      agentResults = [];
    } finally {
      searchingAgents = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Reset selected index when results change
  // ---------------------------------------------------------------------------
  $effect(() => {
    // Access flatItems.length to subscribe to changes
    void flatItems.length;
    selectedIndex = 0;
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function executeItem(item: FlatItem) {
    close();
    switch (item.kind) {
      case "nav": {
        const cmd = item.data as NavCommand;
        goto(`/${prefix}/${cmd.href}`);
        break;
      }
      case "instance": {
        const cmd = item.data as NavCommand;
        goto(`/${cmd.href.replace("__instance__", "")}`);
        break;
      }
      case "issue": {
        const issue = item.data as { id: string; identifier: string; title: string };
        goto(`/${prefix}/issues/${issue.id}`);
        break;
      }
      case "agent": {
        const agent = item.data as { id: string; name: string };
        goto(`/${prefix}/agents/${agent.id}`);
        break;
      }
    }
  }

  function close() {
    open = false;
    query = "";
    selectedIndex = 0;
    issueResults = [];
    agentResults = [];
    if (debounceTimer) clearTimeout(debounceTimer);
  }

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------
  function handleGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (open) {
        close();
      } else {
        open = true;
        // Focus input on next tick
        requestAnimationFrame(() => inputEl?.focus());
      }
    }
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }

  function handleInputKeydown(e: KeyboardEvent) {
    const total = flatItems.length;
    if (total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % total;
      scrollSelectedIntoView();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + total) % total;
      scrollSelectedIntoView();
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) executeItem(item);
    }
  }

  function scrollSelectedIntoView() {
    requestAnimationFrame(() => {
      const el = listEl?.querySelector(`[data-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  // Focus input when opened
  $effect(() => {
    if (open) {
      requestAnimationFrame(() => inputEl?.focus());
    }
  });

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  export function show() {
    open = true;
    query = "";
    requestAnimationFrame(() => inputEl?.focus());
  }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
    onmousedown={close}
    role="presentation"
  ></div>

  <!-- Dialog -->
  <div
    class="fixed top-[18%] left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/50"
    role="dialog"
    aria-label="Command palette"
  >
    <!-- Search input -->
    <div class="flex items-center gap-2 border-b border-white/10 px-4">
      <Search class="size-4 shrink-0 text-zinc-400" />
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={handleInputKeydown}
        placeholder="Type a command or search..."
        class="flex h-12 w-full bg-transparent py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
        spellcheck="false"
        autocomplete="off"
      />
      {#if isSearching}
        <Loader2 class="size-4 shrink-0 animate-spin text-zinc-400" />
      {/if}
      <button
        class="flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
        onclick={close}
        aria-label="Close"
      >
        ESC
      </button>
    </div>

    <!-- Results -->
    <div bind:this={listEl} class="max-h-[360px] overflow-y-auto overscroll-contain p-2">
      {#if flatItems.length === 0 && !isSearching}
        <p class="py-10 text-center text-sm text-zinc-500">
          {query.trim() ? "No results found." : "Start typing to search..."}
        </p>
      {:else}
        <!-- Navigation section -->
        {#if filteredNav.length > 0 || filteredInstance.length > 0}
          <div class="px-2 pb-1 pt-2">
            <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Navigation
            </span>
          </div>
          {#each filteredNav as cmd, i}
            {@const globalIdx = i}
            <button
              data-index={globalIdx}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors {selectedIndex === globalIdx ? 'bg-white/10 text-zinc-100' : 'text-zinc-300 hover:bg-white/5'}"
              onmouseenter={() => (selectedIndex = globalIdx)}
              onclick={() => executeItem(flatItems[globalIdx])}
            >
              <svelte:component this={cmd.icon} class="size-4 shrink-0 text-zinc-400" />
              <span class="flex-1 truncate">{cmd.label}</span>
              {#if cmd.description}
                <span class="truncate text-xs text-zinc-500">{cmd.description}</span>
              {/if}
              <ArrowRight class="size-3 shrink-0 text-zinc-600" />
            </button>
          {/each}
          {#each filteredInstance as cmd, i}
            {@const globalIdx = filteredNav.length + i}
            <button
              data-index={globalIdx}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors {selectedIndex === globalIdx ? 'bg-white/10 text-zinc-100' : 'text-zinc-300 hover:bg-white/5'}"
              onmouseenter={() => (selectedIndex = globalIdx)}
              onclick={() => executeItem(flatItems[globalIdx])}
            >
              <svelte:component this={cmd.icon} class="size-4 shrink-0 text-zinc-400" />
              <span class="flex-1 truncate">{cmd.label}</span>
              {#if cmd.description}
                <span class="truncate text-xs text-zinc-500">{cmd.description}</span>
              {/if}
              <ArrowRight class="size-3 shrink-0 text-zinc-600" />
            </button>
          {/each}
        {/if}

        <!-- Issues section -->
        {#if issueResults.length > 0}
          <div class="mt-2 border-t border-white/5 px-2 pb-1 pt-3">
            <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Issues
            </span>
          </div>
          {#each issueResults as issue, i}
            {@const globalIdx = filteredNav.length + filteredInstance.length + i}
            <button
              data-index={globalIdx}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors {selectedIndex === globalIdx ? 'bg-white/10 text-zinc-100' : 'text-zinc-300 hover:bg-white/5'}"
              onmouseenter={() => (selectedIndex = globalIdx)}
              onclick={() => executeItem(flatItems[globalIdx])}
            >
              <ListTodo class="size-4 shrink-0 text-zinc-400" />
              {#if issue.identifier}
                <span class="shrink-0 rounded bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400">
                  {issue.identifier}
                </span>
              {/if}
              <span class="flex-1 truncate">{issue.title}</span>
              <ArrowRight class="size-3 shrink-0 text-zinc-600" />
            </button>
          {/each}
        {/if}

        <!-- Agents section -->
        {#if agentResults.length > 0}
          <div class="mt-2 border-t border-white/5 px-2 pb-1 pt-3">
            <span class="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Agents
            </span>
          </div>
          {#each agentResults as agent, i}
            {@const globalIdx = filteredNav.length + filteredInstance.length + issueResults.length + i}
            <button
              data-index={globalIdx}
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors {selectedIndex === globalIdx ? 'bg-white/10 text-zinc-100' : 'text-zinc-300 hover:bg-white/5'}"
              onmouseenter={() => (selectedIndex = globalIdx)}
              onclick={() => executeItem(flatItems[globalIdx])}
            >
              <Bot class="size-4 shrink-0 text-zinc-400" />
              <span class="flex-1 truncate">{agent.name}</span>
              {#if agent.description}
                <span class="max-w-[180px] truncate text-xs text-zinc-500">{agent.description}</span>
              {/if}
              <ArrowRight class="size-3 shrink-0 text-zinc-600" />
            </button>
          {/each}
        {/if}

        <!-- Loading indicator for API search -->
        {#if isSearching && issueResults.length === 0 && agentResults.length === 0}
          <div class="flex items-center justify-center gap-2 py-6 text-sm text-zinc-500">
            <Loader2 class="size-4 animate-spin" />
            <span>Searching...</span>
          </div>
        {/if}
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center gap-4 border-t border-white/10 px-4 py-2">
      <span class="flex items-center gap-1 text-[11px] text-zinc-500">
        <kbd class="rounded border border-white/10 px-1 py-0.5 font-mono text-[10px]">&uarr;</kbd>
        <kbd class="rounded border border-white/10 px-1 py-0.5 font-mono text-[10px]">&darr;</kbd>
        <span>navigate</span>
      </span>
      <span class="flex items-center gap-1 text-[11px] text-zinc-500">
        <kbd class="rounded border border-white/10 px-1 py-0.5 font-mono text-[10px]">&crarr;</kbd>
        <span>select</span>
      </span>
      <span class="flex items-center gap-1 text-[11px] text-zinc-500">
        <kbd class="rounded border border-white/10 px-1 py-0.5 font-mono text-[10px]">esc</kbd>
        <span>close</span>
      </span>
    </div>
  </div>
{/if}
