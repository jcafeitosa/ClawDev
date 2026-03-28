<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  onMount(() => breadcrumbStore.set([{ label: "Routines" }]));
</script>

<div class="p-6">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-xl font-semibold">Routines</h1>
  </div>
  <p class="text-muted-foreground text-sm">Scheduled routines — migration in progress.</p>
</div>
