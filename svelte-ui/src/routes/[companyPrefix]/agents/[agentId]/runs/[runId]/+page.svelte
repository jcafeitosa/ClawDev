<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let prefix = $derived($page.params.companyPrefix);
  let runId = $derived($page.params.runId);

  onMount(() => {
    console.log('[run-redirect] prefix:', prefix, 'runId:', runId);
    goto(`/${prefix}/runs/${runId}`, { replaceState: true });
  });
</script>

<p style="color: white;">Redirecting to run detail...</p>
