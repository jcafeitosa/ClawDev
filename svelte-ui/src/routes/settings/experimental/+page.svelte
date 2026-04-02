<script lang="ts">
  import { api } from '$lib/api';

  let settings = $state({
    enableIsolatedWorkspaces: false,
    autoRestartDevServerWhenIdle: false,
  });
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  const features = [
    {
      key: 'enableIsolatedWorkspaces' as const,
      label: 'Enable Isolated Workspaces',
      desc: 'Show execution workspace controls in project configuration and allow isolated workspace behavior.',
    },
    {
      key: 'autoRestartDevServerWhenIdle' as const,
      label: 'Auto-Restart Dev Server When Idle',
      desc: 'Restart the dev server automatically when all queued and running local runs finish.',
    },
  ];

  $effect(() => {
    api('/api/instance/settings/experimental')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        settings = {
          enableIsolatedWorkspaces: d?.enableIsolatedWorkspaces === true,
          autoRestartDevServerWhenIdle: d?.autoRestartDevServerWhenIdle === true,
        };
      })
      .catch((err: unknown) => {
        error = err instanceof Error ? err.message : 'Failed to load experimental settings';
      })
      .finally(() => {
        loading = false;
      });
  });

  async function toggle(key: keyof typeof settings) {
    const next = { ...settings, [key]: !settings[key] };
    settings = next;
    saving = true;
    error = null;
    try {
      const res = await api('/api/instance/settings/experimental', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to update experimental settings';
    } finally {
      saving = false;
    }
  }
</script>

<div class="mx-auto max-w-2xl space-y-6 p-6">
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    <a href="/settings/general" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">General</a>
    <a href="/settings/experimental" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Experimental</a>
    <a href="/settings/users" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Users</a>
    <a href="/settings/status" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Status</a>
    <a href="/settings/api-keys" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">API Keys</a>
  </div>
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Experimental Features</h1>
  {#if loading}
    <div class="space-y-4">{#each Array(2) as _}<div class="h-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else}
    <div class="space-y-3">
      {#if error}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      {/if}
      {#each features as f}
        <div class="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div>
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.label}</p>
            <p class="text-xs text-zinc-500">{f.desc}</p>
          </div>
          <button
            onclick={() => toggle(f.key)}
            aria-label="Toggle {f.label}"
            disabled={saving}
            class="relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 {settings[f.key] ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}"
          >
            <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings[f.key] ? 'translate-x-5' : ''}"></span>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
