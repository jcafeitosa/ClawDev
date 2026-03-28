<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api';

  let code = $derived($page.url.searchParams.get('code') ?? '');
  let status = $state<'pending' | 'approved' | 'denied' | 'error'>('pending');
  let loading = $state(false);

  async function respond(approve: boolean) {
    loading = true;
    try {
      const res = await api('/api/access/cli-auth/respond', { method: 'POST', body: JSON.stringify({ code, approved: approve }) });
      if (!res.ok) throw new Error('Failed');
      status = approve ? 'approved' : 'denied';
    } catch { status = 'error'; }
    finally { loading = false; }
  }
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <div class="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
    <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">CLI Authentication</h1>
    {#if !code}
      <p class="text-sm text-red-500">No auth code provided.</p>
    {:else if status === 'pending'}
      <p class="text-sm text-zinc-500">A CLI session is requesting access with code:</p>
      <code class="block rounded bg-zinc-100 px-4 py-2 font-mono text-lg dark:bg-zinc-800">{code}</code>
      <div class="flex gap-3">
        <button onclick={() => respond(true)} disabled={loading} class="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">Approve</button>
        <button onclick={() => respond(false)} disabled={loading} class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">Deny</button>
      </div>
    {:else if status === 'approved'}
      <p class="text-green-600 dark:text-green-400">CLI session approved. You can close this tab.</p>
    {:else if status === 'denied'}
      <p class="text-zinc-500">CLI session denied.</p>
    {:else}
      <p class="text-red-500">An error occurred.</p>
    {/if}
  </div>
</div>
