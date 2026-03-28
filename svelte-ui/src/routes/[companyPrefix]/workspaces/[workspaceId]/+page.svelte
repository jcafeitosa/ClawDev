<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import PageSkeleton from '$lib/components/page-skeleton.svelte';

  let ws = $state<any>(null);
  let loading = $state(true);
  let workspaceId = $derived($page.params.workspaceId);

  onMount(() => breadcrumbStore.set([{ label: 'Workspaces' }, { label: workspaceId ?? '' }]));

  $effect(() => {
    if (!workspaceId) return;
    api(`/api/execution-workspaces/${workspaceId}`).then(r => r.json()).then(d => { ws = d; }).finally(() => { loading = false; });
  });
</script>

<div class="p-6 space-y-6">
  {#if loading}
    <PageSkeleton />
  {:else if !ws}
    <p class="text-red-500">Workspace not found.</p>
  {:else}
    <div>
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Workspace</h1>
      <p class="text-sm text-zinc-500">{ws.cwd ?? ws.id}</p>
    </div>
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p class="text-xs text-zinc-500">Status</p><StatusBadge status={ws.status ?? 'unknown'} /></div>
      <div class="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p class="text-xs text-zinc-500">Agent</p><p class="text-sm text-zinc-900 dark:text-zinc-100">{ws.agentName ?? '—'}</p></div>
      <div class="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p class="text-xs text-zinc-500">Branch</p><p class="text-sm font-mono text-zinc-900 dark:text-zinc-100">{ws.branch ?? '—'}</p></div>
      <div class="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"><p class="text-xs text-zinc-500">Issue</p><p class="text-sm text-zinc-900 dark:text-zinc-100">{ws.issueIdentifier ?? '—'}</p></div>
    </div>
  {/if}
</div>
