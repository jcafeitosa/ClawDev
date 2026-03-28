<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  onMount(() => breadcrumbStore.set([{ label: "Settings" }]));
</script>

<div class="p-6">
  <h1 class="text-xl font-semibold mb-4">Company Settings</h1>
  <p class="text-muted-foreground text-sm">Company settings — migration in progress.</p>
</div>
