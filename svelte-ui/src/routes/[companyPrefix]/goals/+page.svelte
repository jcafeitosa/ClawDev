<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  onMount(() => breadcrumbStore.set([{ label: "Goals" }]));
</script>

<div class="p-6">
  <h1 class="text-xl font-semibold mb-4">Goals</h1>
  <p class="text-muted-foreground text-sm">Goals management — migration in progress.</p>
</div>
