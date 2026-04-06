<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { PageLayout } from '$components/layout/index.js';

  let prefix = $derived($page.params.companyPrefix);
  let runId = $derived($page.params.runId);

  onMount(() => {
    console.log('[run-redirect] prefix:', prefix, 'runId:', runId);
    goto(`/${prefix}/runs/${runId}`, { replaceState: true });
  });
</script>

<PageLayout title="Run Redirect" description="Redirecting to the run detail page." fullWidth>
  <p class="text-sm text-muted-foreground">Redirecting to run detail...</p>
</PageLayout>
