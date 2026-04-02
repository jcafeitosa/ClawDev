<script lang="ts">
  import { api } from '$lib/api';

  let censorUsernameInLogs = $state(false);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    api('/api/instance/settings/general')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        censorUsernameInLogs = d?.censorUsernameInLogs === true;
      })
      .catch((err: unknown) => {
        error = err instanceof Error ? err.message : 'Failed to load general settings';
      })
      .finally(() => {
        loading = false;
      });
  });

  async function save() {
    saving = true;
    saved = false;
    error = null;
    try {
      const res = await api('/api/instance/settings/general', {
        method: 'PATCH',
        body: JSON.stringify({ censorUsernameInLogs }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      saved = true;
      setTimeout(() => {
        saved = false;
      }, 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to save general settings';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl space-y-6 p-6">
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    <a href="/settings/general" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">General</a>
    <a href="/settings/experimental" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Experimental</a>
    <a href="/settings/users" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Users</a>
    <a href="/settings/status" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Status</a>
    <a href="/settings/api-keys" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">API Keys</a>
  </div>
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">General Settings</h1>
  {#if loading}
    <div class="space-y-4">{#each Array(1) as _}<div class="h-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else}
    <div class="space-y-4">
      {#if error}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      {/if}
      <div class="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Censor username in logs</p>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">
              Hide the username segment in home-directory paths and similar operator-visible log output.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle username log censoring"
            disabled={saving}
            onclick={() => (censorUsernameInLogs = !censorUsernameInLogs)}
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 {censorUsernameInLogs ? 'bg-green-600' : 'bg-zinc-300 dark:bg-zinc-700'}"
          >
            <span class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform {censorUsernameInLogs ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          onclick={save}
          disabled={saving}
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>
    </div>
  {/if}
</div>
