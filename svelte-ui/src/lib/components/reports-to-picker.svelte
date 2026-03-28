<script lang="ts">
  /**
   * ReportsToPicker — popover for selecting the agent's manager (reportsTo).
   *
   * Fetches the agent list for the company and lets the user pick a parent
   * agent or clear the selection to make the agent top-level.
   *
   * Usage:
   *   <ReportsToPicker
   *     companyId={company.id}
   *     value={agent.reportsTo}
   *     excludeId={agent.id}
   *     onSelect={(id) => agent.reportsTo = id}
   *   />
   */
  import { api } from "$lib/api";
  import {
    Bot,
    ChevronDown,
    Search,
    X,
    Loader2,
    MinusCircle,
  } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    companyId: string;
    value: string | null;
    excludeId?: string;
    onSelect: (agentId: string | null) => void;
  }

  let { companyId, value, excludeId, onSelect }: Props = $props();

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Agent {
    id: string;
    name: string;
    slug?: string;
    role: string;
    status: string;
    icon?: string;
    adapterType?: string;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let open = $state(false);
  let agents = $state<Agent[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");
  let searchInputEl = $state<HTMLInputElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  const availableAgents = $derived.by(() => {
    let list = agents.filter((a) => a.id !== excludeId);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q),
      );
    }
    return list;
  });

  const selectedAgent = $derived(
    value ? agents.find((a) => a.id === value) ?? null : null,
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchAgents(): Promise<void> {
    if (!companyId) return;
    loading = true;
    error = null;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.agents ?? data.data ?? [];
      agents = list.map((a: Record<string, unknown>) => ({
        id: String(a.id ?? ""),
        name: String(a.name ?? ""),
        slug: a.slug ? String(a.slug) : undefined,
        role: String(a.role ?? "general"),
        status: String(a.status ?? "idle"),
        icon: a.icon ? String(a.icon) : undefined,
        adapterType: a.adapterType ? String(a.adapterType) : undefined,
      }));
    } catch (e: any) {
      error = e.message ?? "Failed to load agents";
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function toggle() {
    open = !open;
    if (open) {
      searchQuery = "";
      fetchAgents();
      requestAnimationFrame(() => searchInputEl?.focus());
    }
  }

  function select(agentId: string | null) {
    onSelect(agentId);
    open = false;
    searchQuery = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      open = false;
      triggerEl?.focus();
    }
  }

  // Close on outside click
  function handleWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target as Node;
    if (popoverEl?.contains(target) || triggerEl?.contains(target)) return;
    open = false;
    searchQuery = "";
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const STATUS_COLORS: Record<string, string> = {
    idle: "bg-emerald-500",
    running: "bg-blue-500",
    paused: "bg-yellow-500",
    error: "bg-red-500",
    terminated: "bg-zinc-500",
    pending_approval: "bg-amber-400",
  };

  function statusDotClass(status: string): string {
    return STATUS_COLORS[status] ?? "bg-zinc-500";
  }

  function roleBadgeColor(role: string): string {
    const colors: Record<string, string> = {
      ceo: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      manager: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      general: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
      lead: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return colors[role] ?? "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="relative inline-block w-full">
  <!-- Trigger button -->
  <button
    bind:this={triggerEl}
    type="button"
    class="flex w-full items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-3.5 py-2.5 text-sm text-[#F8FAFC] transition hover:border-white/[0.15] hover:bg-white/[0.03] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30"
    onclick={toggle}
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="flex items-center gap-2.5 min-w-0">
      {#if selectedAgent}
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
          <Bot class="size-3.5 text-[#94A3B8]" />
        </span>
        <span class="truncate text-[#CBD5E1]">{selectedAgent.name}</span>
        <span class="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {roleBadgeColor(selectedAgent.role)}">
          {selectedAgent.role}
        </span>
      {:else}
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
          <MinusCircle class="size-3.5 text-[#64748B]" />
        </span>
        <span class="text-[#64748B]">None - Top Level</span>
      {/if}
    </span>
    <ChevronDown class="size-4 shrink-0 text-[#64748B] transition-transform {open ? 'rotate-180' : ''}" />
  </button>

  <!-- Popover -->
  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={popoverEl}
      onkeydown={handleKeydown}
      class="absolute left-0 top-full z-50 mt-2 w-full min-w-[320px] rounded-xl border border-white/[0.1] bg-[#18181B] shadow-2xl shadow-black/50"
      role="listbox"
      aria-label="Select manager agent"
    >
      <!-- Search -->
      <div class="flex items-center gap-2 border-b border-white/[0.08] px-3">
        <Search class="size-3.5 shrink-0 text-[#64748B]" />
        <input
          bind:this={searchInputEl}
          bind:value={searchQuery}
          placeholder="Search agents..."
          class="flex h-10 w-full bg-transparent text-sm text-[#F8FAFC] outline-none placeholder:text-[#475569]"
          spellcheck="false"
          autocomplete="off"
        />
        {#if searchQuery}
          <button
            type="button"
            class="shrink-0 rounded p-0.5 text-[#64748B] hover:text-[#F8FAFC] transition-colors"
            onclick={() => { searchQuery = ""; searchInputEl?.focus(); }}
            aria-label="Clear search"
          >
            <X class="size-3.5" />
          </button>
        {/if}
      </div>

      <!-- List -->
      <div class="max-h-[300px] overflow-y-auto overscroll-contain p-1.5">
        <!-- None / Top Level option -->
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
            {value === null
              ? 'bg-[#2563EB]/10 text-[#60A5FA]'
              : 'text-[#94A3B8] hover:bg-white/[0.05] hover:text-[#F8FAFC]'}"
          onclick={() => select(null)}
          role="option"
          aria-selected={value === null}
        >
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
            <MinusCircle class="size-4 {value === null ? 'text-[#60A5FA]' : 'text-[#64748B]'}" />
          </span>
          <div class="flex-1 min-w-0">
            <span class="font-medium">None (Top Level)</span>
            <p class="text-xs text-[#64748B] mt-0.5">This agent has no manager.</p>
          </div>
        </button>

        <!-- Separator -->
        {#if !loading && availableAgents.length > 0}
          <div class="my-1.5 border-t border-white/[0.06]"></div>
        {/if}

        <!-- Loading -->
        {#if loading}
          <div class="flex items-center justify-center gap-2 py-8 text-sm text-[#64748B]">
            <Loader2 class="size-4 animate-spin" />
            <span>Loading agents...</span>
          </div>

        <!-- Error -->
        {:else if error}
          <div class="py-6 text-center">
            <p class="text-sm text-red-400">{error}</p>
            <button
              type="button"
              class="mt-2 text-xs text-[#2563EB] hover:underline"
              onclick={() => fetchAgents()}
            >
              Retry
            </button>
          </div>

        <!-- Empty filtered -->
        {:else if availableAgents.length === 0 && agents.length > 0}
          <p class="py-6 text-center text-sm text-[#64748B]">
            No agents match "{searchQuery}"
          </p>

        <!-- Empty company -->
        {:else if availableAgents.length === 0}
          <p class="py-6 text-center text-sm text-[#64748B]">
            No other agents in this company.
          </p>

        <!-- Agent list -->
        {:else}
          {#each availableAgents as agent (agent.id)}
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors
                {value === agent.id
                  ? 'bg-[#2563EB]/10 text-[#60A5FA]'
                  : 'text-[#CBD5E1] hover:bg-white/[0.05] hover:text-[#F8FAFC]'}"
              onclick={() => select(agent.id)}
              role="option"
              aria-selected={value === agent.id}
            >
              <!-- Icon / Avatar -->
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/[0.06]">
                <Bot class="size-4 {value === agent.id ? 'text-[#60A5FA]' : 'text-[#94A3B8]'}" />
              </span>

              <!-- Name & role -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate font-medium">{agent.name}</span>
                  <span class="inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {roleBadgeColor(agent.role)}">
                    {agent.role}
                  </span>
                </div>
              </div>

              <!-- Status dot -->
              <span class="h-2 w-2 shrink-0 rounded-full {statusDotClass(agent.status)}"></span>
            </button>
          {/each}
        {/if}
      </div>

      <!-- Footer -->
      {#if !loading && !error}
        <div class="border-t border-white/[0.06] px-3 py-2">
          <p class="text-[11px] text-[#475569]">
            {availableAgents.length} agent{availableAgents.length === 1 ? "" : "s"} available
          </p>
        </div>
      {/if}
    </div>
  {/if}
</div>
