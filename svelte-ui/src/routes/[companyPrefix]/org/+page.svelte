<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { PageLayout } from '$components/layout/index.js';
  onMount(() => goto(`/${$page.params.companyPrefix}/org/chart`, { replaceState: true }));
</script>

<PageLayout title="Organization" description="Redirecting to organization chart." fullWidth>
  <p class="text-sm text-muted-foreground">Redirecting...</p>
</PageLayout>
