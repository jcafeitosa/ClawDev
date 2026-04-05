<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { PageLayout } from '$components/layout/index.js';
  import { PageSkeleton, EmptyState } from '$components/index.js';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import PriorityIcon from '$lib/components/priority-icon.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import { Alert, AlertDescription } from '$components/ui/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Issues', href: `/${$page.params.companyPrefix}/issues` }, { label: 'Mine' }]));

  let issues = $state<any[]>([]);
  let loading = $state(true);
  let error = $state('');

  $effect(() => {
    loading = true;
    error = '';
    api('/api/agents/me/inbox-lite')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { issues = Array.isArray(d) ? d : d.issues ?? []; })
      .catch((e) => { issues = []; error = e?.message ?? 'Failed to load issues'; })
      .finally(() => { loading = false; });
  });
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={5} />
  </div>
{:else}
  <PageLayout title="My Issues">
    {#if error}
      <Alert variant="destructive" class="mb-4">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    {/if}

    {#if issues.length === 0 && !error}
      <EmptyState title="No issues assigned" description="No issues are currently assigned to you." icon="📋" />
    {:else}
      <div class="space-y-2">
        {#each issues as issue (issue.id)}
          <a href="/{$page.params.companyPrefix}/issues/{issue.id}" class="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50 cursor-pointer transition-colors">
            <div class="flex items-center gap-3 min-w-0">
              <PriorityIcon priority={issue.priority} />
              <StatusBadge status={issue.status ?? 'open'} />
              <span class="truncate text-sm text-foreground">{issue.title ?? 'Untitled'}</span>
            </div>
            <TimeAgo date={issue.updatedAt ?? issue.createdAt} class="shrink-0 text-xs" />
          </a>
        {/each}
      </div>
    {/if}
  </PageLayout>
{/if}
