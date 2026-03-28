<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  onMount(() => breadcrumbStore.set([{ label: "Costs" }]));
</script>

<div class="p-6">
  <h1 class="text-xl font-semibold mb-4">Costs</h1>
  <p class="text-muted-foreground text-sm">Cost tracking — migration in progress.</p>
</div>
