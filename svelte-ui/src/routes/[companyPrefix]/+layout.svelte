<script lang="ts">
  import { Sidebar } from "$components/layout/index.js";
  import { BreadcrumbBar } from "$components/layout/index.js";
  import { ToastViewport } from "$components/layout/index.js";
  import { sidebarStore } from "$stores/sidebar.svelte.js";
  import { themeStore } from "$stores/theme.svelte.js";
  import { onMount } from "svelte";

  let { children } = $props();

  onMount(() => {
    themeStore.init();
    sidebarStore.init();
  });
</script>

<div class="flex h-full overflow-hidden">
  <!-- Sidebar -->
  {#if sidebarStore.open || !sidebarStore.isMobile}
    <Sidebar />
  {/if}

  <!-- Main content -->
  <div class="flex flex-1 flex-col min-w-0 overflow-hidden">
    <BreadcrumbBar />
    <main class="flex-1 overflow-y-auto">
      {@render children()}
    </main>
  </div>
</div>

<ToastViewport />
