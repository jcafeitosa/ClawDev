<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  onMount(() => {
    const query = window.location.search ?? "";
    void goto(`/onboarding${query}`, { replaceState: true });
  });
</script>

<div class="flex h-full items-center justify-center">
  <div class="text-sm text-muted-foreground">Redirecting…</div>
</div>
