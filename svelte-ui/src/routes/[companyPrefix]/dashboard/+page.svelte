<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  onMount(() => breadcrumbStore.set([{ label: "Dashboard" }]));
</script>

<div class="p-6">
  <h1 class="text-xl font-semibold mb-4">Dashboard</h1>
  <p class="text-muted-foreground text-sm">Dashboard overview — migration in progress.</p>
</div>
