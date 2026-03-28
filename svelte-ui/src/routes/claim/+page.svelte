<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';

  let token = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleClaim() {
    if (!token.trim()) return;
    loading = true;
    error = '';
    try {
      const res = await api('/api/access/board-claims', { method: 'POST', body: JSON.stringify({ token: token.trim() }) });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Claim failed');
      goto('/auth');
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center p-4">
  <div class="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
    <div class="text-center">
      <h1 class="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Claim Board</h1>
      <p class="mt-1 text-sm text-zinc-500">Enter your claim token to gain board access.</p>
    </div>
    <form onsubmit={(e) => { e.preventDefault(); handleClaim(); }} class="space-y-4">
      <input bind:value={token} type="text" placeholder="Claim token" class="w-full rounded-lg border border-zinc-300 bg-transparent px-4 py-2.5 text-sm dark:border-zinc-700" />
      {#if error}<p class="text-sm text-red-500">{error}</p>{/if}
      <button type="submit" disabled={loading || !token.trim()} class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? 'Claiming...' : 'Claim Access'}
      </button>
    </form>
  </div>
</div>
