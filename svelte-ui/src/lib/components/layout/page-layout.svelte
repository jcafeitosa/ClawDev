<script lang="ts">
  /**
   * PageLayout — Standard page wrapper (UUPM.cc / Glassmorphism style).
   * Every page MUST use this for consistent header, spacing, and container.
   */
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description?: string;
    actions?: Snippet;
    tabs?: Snippet;
    children: Snippet;
    class?: string;
    fullWidth?: boolean;
  }

  let { title, description, actions, tabs, children, class: className = "", fullWidth = false }: Props = $props();
</script>

<div class="flex flex-col gap-8 pb-10 {fullWidth ? '' : 'max-w-7xl'} {className}">
  <!-- Page Header -->
  <div class="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
    <div class="min-w-0">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {#if description}
        <p class="mt-0.5 text-sm text-muted-foreground/70">{description}</p>
      {/if}
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-2">
        {@render actions()}
      </div>
    {/if}
  </div>

  <!-- Optional Tabs -->
  {#if tabs}
    <div class="-mt-3">
      {@render tabs()}
    </div>
  {/if}

  <!-- Content -->
  <div class="flex flex-col gap-6">
    {@render children()}
  </div>
</div>
