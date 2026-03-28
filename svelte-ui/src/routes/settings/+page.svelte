<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  onMount(() => goto('/settings/general', { replaceState: true }));
</script>

<div class="flex h-full items-center justify-center"><p class="text-sm text-zinc-500">Redirecting...</p></div>
