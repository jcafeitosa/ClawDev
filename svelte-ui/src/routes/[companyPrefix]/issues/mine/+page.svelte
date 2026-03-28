<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import PriorityIcon from '$lib/components/priority-icon.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Issues', href: `/${$page.params.companyPrefix}/issues` }, { label: 'Mine' }]));

  let issues = $state<any[]>([]);
  let loading = $state(true);

  $effect(() => {
    api('/api/agents/me/inbox-lite').then(r => r.json()).then(d => { issues = Array.isArray(d) ? d : d.issues ?? []; }).finally(() => { loading = false; });
  });
</script>

<div class="p-6 space-y-4">
  <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">My Issues</h1>
  {#if loading}
    <div class="space-y-2">{#each Array(5) as _}<div class="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else if issues.length === 0}
    <p class="text-sm text-zinc-500 py-8 text-center">No issues assigned to you.</p>
  {:else}
    <div class="space-y-2">
      {#each issues as issue (issue.id)}
        <a href="/{$page.params.companyPrefix}/issues/{issue.id}" class="flex items-center justify-between rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
          <div class="flex items-center gap-3 min-w-0">
            <PriorityIcon priority={issue.priority} />
            <StatusBadge status={issue.status ?? 'open'} />
            <span class="truncate text-sm text-zinc-900 dark:text-zinc-100">{issue.title ?? 'Untitled'}</span>
          </div>
          <TimeAgo date={issue.updatedAt ?? issue.createdAt} class="shrink-0 text-xs" />
        </a>
      {/each}
    </div>
  {/if}
</div>
