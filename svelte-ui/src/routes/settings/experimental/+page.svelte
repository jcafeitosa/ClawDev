<script lang="ts">
  import { api } from '$lib/api';

  let settings = $state<Record<string, boolean>>({});
  let loading = $state(true);
  let saving = $state(false);

  const features = [
    { key: 'worktrees', label: 'Git Worktrees', desc: 'Enable workspace isolation via git worktrees' },
    { key: 'plugins', label: 'Plugin System', desc: 'Enable the plugin runtime and UI' },
    { key: 'routines', label: 'Routines', desc: 'Enable scheduled agent routines' },
    { key: 'budgets', label: 'Budget Policies', desc: 'Enable cost budgets and enforcement' },
    { key: 'approvals', label: 'Approval Workflows', desc: 'Require human approval for agent actions' },
    { key: 'autoRestartDevServerWhenIdle', label: 'Auto-restart Dev Server', desc: 'Restart dev server when idle' },
  ];

  $effect(() => {
    api('/api/instance-settings/experimental').then(r => r.json()).then(d => { settings = d ?? {}; }).finally(() => { loading = false; });
  });

  async function toggle(key: string) {
    settings = { ...settings, [key]: !settings[key] };
    saving = true;
    await api('/api/instance-settings/experimental', { method: 'PATCH', body: JSON.stringify(settings) });
    saving = false;
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
    <div class="space-y-4">{#each Array(5) as _}<div class="h-16 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>{/each}</div>
  {:else}
    <div class="space-y-3">
      {#each features as f}
        <div class="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div><p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{f.label}</p><p class="text-xs text-zinc-500">{f.desc}</p></div>
          <button onclick={() => toggle(f.key)} aria-label="Toggle {f.label}" class="relative h-6 w-11 rounded-full transition-colors {settings[f.key] ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'}">
            <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings[f.key] ? 'translate-x-5' : ''}"></span>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
