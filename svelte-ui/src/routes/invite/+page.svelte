<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  let token = $derived($page.url.searchParams.get('token') ?? '');
  let invite = $state<any>(null);
  let loading = $state(true);
  let accepting = $state(false);
  let error = $state('');

  $effect(() => {
    if (!token) { loading = false; return; }
    api(`/api/access/invites/${token}`).then(r => r.json()).then(d => { invite = d; }).catch(() => { error = 'Invalid invite'; }).finally(() => { loading = false; });
  });

  async function accept() {
    accepting = true;
    try {
      const res = await api(`/api/access/invites/${token}/accept`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      goto('/');
    } catch { error = 'Failed to accept invite'; }
    finally { accepting = false; }
  }
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <div class="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
    <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">You're Invited</h1>
    {#if loading}
      <div class="h-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>
    {:else if error}
      <p class="text-red-500">{error}</p>
    {:else if invite}
      <p class="text-sm text-zinc-500">You've been invited to join <strong class="text-zinc-900 dark:text-zinc-100">{invite.companyName ?? 'a company'}</strong>.</p>
      <button onclick={accept} disabled={accepting} class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">{accepting ? 'Accepting...' : 'Accept Invite'}</button>
    {:else}
      <p class="text-zinc-500">No invite token provided.</p>
    {/if}
  </div>
</div>
