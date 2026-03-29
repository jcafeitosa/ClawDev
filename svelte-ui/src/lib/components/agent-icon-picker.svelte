<script lang="ts">
  /**
   * AgentIconPicker — popover grid for selecting agent icons from lucide-svelte.
   *
   * Usage:
   *   <AgentIconPicker value={agent.icon} onSelect={(name) => agent.icon = name} />
   */
  import {
    Bot,
    Brain,
    Cpu,
    Zap,
    Shield,
    Rocket,
    Code,
    Terminal,
    Globe,
    Server,
    Database,
    Cloud,
    Lock,
    Key,
    Settings,
    Wrench,
    Hammer,
    Paintbrush,
    Palette,
    Camera,
    Eye,
    Heart,
    Star,
    Crown,
    Award,
    Target,
    Flag,
    Bookmark,
    Bell,
    Mail,
    MessageSquare,
    Users,
    User,
    UserPlus,
    Building,
    Briefcase,
    GraduationCap,
    Music,
    Gamepad,
    Compass,
    Map,
    Navigation,
    Anchor,
    Truck,
    Plane,
    Ship,
    Search,
    X,
  } from "lucide-svelte";
  import type { Component } from "svelte";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    value: string;
    onSelect: (iconName: string) => void;
  }

  let { value, onSelect }: Props = $props();

  // ---------------------------------------------------------------------------
  // Icon registry
  // ---------------------------------------------------------------------------
  interface IconEntry {
    name: string;
    component: Component;
  }

  const ICONS: IconEntry[] = [
    { name: "Bot", component: Bot },
    { name: "Brain", component: Brain },
    { name: "Cpu", component: Cpu },
    { name: "Zap", component: Zap },
    { name: "Shield", component: Shield },
    { name: "Rocket", component: Rocket },
    { name: "Code", component: Code },
    { name: "Terminal", component: Terminal },
    { name: "Globe", component: Globe },
    { name: "Server", component: Server },
    { name: "Database", component: Database },
    { name: "Cloud", component: Cloud },
    { name: "Lock", component: Lock },
    { name: "Key", component: Key },
    { name: "Settings", component: Settings },
    { name: "Wrench", component: Wrench },
    { name: "Hammer", component: Hammer },
    { name: "Paintbrush", component: Paintbrush },
    { name: "Palette", component: Palette },
    { name: "Camera", component: Camera },
    { name: "Eye", component: Eye },
    { name: "Heart", component: Heart },
    { name: "Star", component: Star },
    { name: "Crown", component: Crown },
    { name: "Award", component: Award },
    { name: "Target", component: Target },
    { name: "Flag", component: Flag },
    { name: "Bookmark", component: Bookmark },
    { name: "Bell", component: Bell },
    { name: "Mail", component: Mail },
    { name: "MessageSquare", component: MessageSquare },
    { name: "Users", component: Users },
    { name: "User", component: User },
    { name: "UserPlus", component: UserPlus },
    { name: "Building", component: Building },
    { name: "Briefcase", component: Briefcase },
    { name: "GraduationCap", component: GraduationCap },
    { name: "Music", component: Music },
    { name: "Gamepad", component: Gamepad },
    { name: "Compass", component: Compass },
    { name: "Map", component: Map },
    { name: "Navigation", component: Navigation },
    { name: "Anchor", component: Anchor },
    { name: "Truck", component: Truck },
    { name: "Plane", component: Plane },
    { name: "Ship", component: Ship },
  ];

  // Build a lookup for resolving the current value to a component
  const iconByName = new Map(ICONS.map((i) => [i.name, i.component]));

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let open = $state(false);
  let searchQuery = $state("");
  let searchInputEl = $state<HTMLInputElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);

  const currentIcon = $derived(iconByName.get(value) ?? Bot);

  const filteredIcons = $derived.by(() => {
    if (!searchQuery.trim()) return ICONS;
    const q = searchQuery.trim().toLowerCase();
    return ICONS.filter((icon) => icon.name.toLowerCase().includes(q));
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function toggle() {
    open = !open;
    if (open) {
      searchQuery = "";
      requestAnimationFrame(() => searchInputEl?.focus());
    }
  }

  function select(iconName: string) {
    onSelect(iconName);
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
</script>

<svelte:window onclick={handleWindowClick} />

<div class="relative inline-block">
  <!-- Trigger button -->
  <button
    bind:this={triggerEl}
    type="button"
    class="flex items-center gap-2.5 rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground transition hover:border-border hover:bg-accent/40 focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30"
    onclick={toggle}
    aria-haspopup="true"
    aria-expanded={open}
  >
    <span class="flex h-7 w-7 items-center justify-center rounded-md bg-accent/75">
      <svelte:component this={currentIcon} class="size-4 text-muted-foreground" />
    </span>
    <span class="text-muted-foreground/80">{value || "Bot"}</span>
  </button>

  <!-- Popover -->
  {#if open}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={popoverEl}
      onkeydown={handleKeydown}
      class="absolute left-0 top-full z-50 mt-2 w-[340px] rounded-xl border border-border bg-[#18181B] shadow-2xl shadow-black/50"
      role="dialog"
      aria-label="Icon picker"
    >
      <!-- Search -->
      <div class="flex items-center gap-2 border-b border-border px-3">
        <Search class="size-3.5 shrink-0 text-muted-foreground" />
        <input
          bind:this={searchInputEl}
          bind:value={searchQuery}
          placeholder="Search icons..."
          class="flex h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-[#475569]"
          spellcheck="false"
          autocomplete="off"
        />
        {#if searchQuery}
          <button
            type="button"
            class="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            onclick={() => { searchQuery = ""; searchInputEl?.focus(); }}
            aria-label="Clear search"
          >
            <X class="size-3.5" />
          </button>
        {/if}
      </div>

      <!-- Icon grid -->
      <div class="max-h-[280px] overflow-y-auto overscroll-contain p-2">
        {#if filteredIcons.length === 0}
          <p class="py-8 text-center text-sm text-muted-foreground">No icons match "{searchQuery}"</p>
        {:else}
          <div class="grid grid-cols-8 gap-1">
            {#each filteredIcons as icon (icon.name)}
              <button
                type="button"
                class="group flex h-8 w-8 items-center justify-center rounded-md transition-colors
                  {value === icon.name
                    ? 'bg-[#2563EB]/20 ring-1 ring-[#2563EB]/60 text-[#60A5FA]'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'}"
                title={icon.name}
                onclick={() => select(icon.name)}
              >
                <svelte:component this={icon.component} class="size-4" />
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="border-t border-border/50 px-3 py-2">
        <p class="text-[11px] text-[#475569]">
          {filteredIcons.length} icon{filteredIcons.length === 1 ? "" : "s"} available
        </p>
      </div>
    </div>
  {/if}
</div>
