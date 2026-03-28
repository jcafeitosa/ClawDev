<script lang="ts">
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  onMount(() => breadcrumbStore.set([{ label: "Approvals" }]));
</script>

<div class="p-6">
  <h1 class="text-xl font-semibold mb-4">Approvals</h1>
  <p class="text-muted-foreground text-sm">Approval queue — migration in progress.</p>
</div>
