<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  onMount(() => goto(`/${$page.params.companyPrefix}/org/chart`, { replaceState: true }));
</script>

<div class="p-6"><p class="text-sm text-zinc-500">Redirecting...</p></div>
