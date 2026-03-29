<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  onMount(() => {
    goto("/settings/general", { replaceState: true });
  });
</script>

<div class="p-6">
  <p class="text-sm text-muted-foreground">Redirecting to settings...</p>
</div>
