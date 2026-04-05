<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  onMount(() => {
    const prefix = $page.params.companyPrefix;
    goto(`/${prefix}/dashboard`, { replaceState: true });
  });
</script>

<div class="flex min-h-screen items-center justify-center bg-[#050508]">
  <div class="flex flex-col items-center gap-3">
    <div class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70"></div>
    <p class="text-sm text-[#64748b]">Redirecting...</p>
  </div>
</div>
