<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import { Menu } from "lucide-svelte";
  import { cn } from "$utils/index.js";

  const crumbs = $derived(breadcrumbStore.items);
</script>

<header
  data-slot="breadcrumb-bar"
  class="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--clawdev-bg-surface-border)] px-4 bg-[var(--clawdev-bg-base)]"
>
  {#if sidebarStore.isMobile}
    <button
      class="p-1 -ml-1 rounded-md text-[var(--clawdev-text-muted)] hover:text-[var(--clawdev-text-primary)] hover:bg-[rgba(255,255,255,0.1)]"
      onclick={() => sidebarStore.toggle()}
      aria-label="Toggle sidebar"
    >
      <Menu class="size-5" />
    </button>
  {/if}

  {#if crumbs.length === 0}
    <div></div>
  {:else if crumbs.length === 1}
    <h1 class="text-sm font-semibold truncate text-[var(--clawdev-text-primary)]">{crumbs[0].label}</h1>
  {:else}
    <nav class="flex items-center gap-1.5 text-sm text-[var(--clawdev-text-muted)] truncate">
      {#each crumbs as crumb, i}
        {#if i > 0}
          <span class="text-[var(--clawdev-text-muted)]/40">/</span>
        {/if}
        {#if i < crumbs.length - 1 && crumb.href}
          <a href={crumb.href} class="hover:text-[var(--clawdev-text-primary)] transition-colors truncate max-w-[120px]">{crumb.label}</a>
        {:else}
          <span class={cn(i === crumbs.length - 1 && "text-[var(--clawdev-text-primary)] font-medium", "truncate max-w-[200px]")}>{crumb.label}</span>
        {/if}
      {/each}
    </nav>
  {/if}
</header>
