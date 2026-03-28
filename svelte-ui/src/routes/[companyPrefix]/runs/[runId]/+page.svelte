<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import PageSkeleton from '$lib/components/page-skeleton.svelte';

  let run = $state<any>(null);
  let transcript = $state<any[]>([]);
  let loading = $state(true);
  let runId = $derived($page.params.runId);

  onMount(() => breadcrumbStore.set([{ label: 'Runs' }, { label: runId ?? '' }]));

  $effect(() => {
    if (!runId) return;
    Promise.all([
      api(`/api/heartbeat-runs/${runId}`).then(r => r.json()),
      api(`/api/heartbeat-runs/${runId}/transcript`).then(r => r.json()).catch(() => []),
    ]).then(([r, t]) => { run = r; transcript = Array.isArray(t) ? t : t.messages ?? []; }).finally(() => { loading = false; });
  });
</script>

<div class="p-6 space-y-6">
  {#if loading}
    <PageSkeleton showSidebar={false} />
  {:else if !run}
    <p class="text-red-500">Run not found.</p>
  {:else}
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Run {run.identifier ?? runId}</h1>
        <div class="mt-1 flex items-center gap-3">
          <StatusBadge status={run.status ?? 'unknown'} />
          <span class="text-sm text-zinc-500">{run.agentName ?? ''}</span>
          <TimeAgo date={run.startedAt ?? run.createdAt} class="text-xs" />
        </div>
      </div>
    </div>

    <!-- Transcript -->
    <div class="space-y-3">
      <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Transcript</h2>
      {#if transcript.length === 0}
        <p class="text-sm text-zinc-500 py-4 text-center">No transcript available.</p>
      {:else}
        {#each transcript as msg, i}
          <div class="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div class="flex items-center gap-2 mb-1">
              <span class="rounded px-1.5 py-0.5 text-xs font-medium {msg.role === 'assistant' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : msg.role === 'tool' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}">{msg.role ?? 'unknown'}</span>
              {#if msg.toolName}<code class="text-xs text-zinc-500">{msg.toolName}</code>{/if}
            </div>
            <pre class="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}</pre>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>
