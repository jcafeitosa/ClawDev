<script lang="ts">
  import { api } from '$lib/api';
  import { Key, Plus, Copy, CheckCircle, Trash2, AlertTriangle, Shield } from 'lucide-svelte';

  interface BoardApiKey {
    id: string;
    name: string;
    userId: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
  }

  interface CliAuthMe {
    userId: string;
    isInstanceAdmin: boolean;
    companyIds: string[];
    source: string;
    keyId: string | null;
  }

  let currentAuth = $state<CliAuthMe | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Create key form state
  let showCreateForm = $state(false);
  let newKeyName = $state('');
  let creating = $state(false);
  let createdKeyValue = $state<string | null>(null);
  let copied = $state(false);

  // Revoke state
  let revoking = $state(false);
  let confirmRevoke = $state<string | null>(null);

  async function fetchAuth() {
    try {
      const r = await api('/api/cli-auth/me');
      if (r.ok) {
        currentAuth = await r.json();
      } else if (r.status === 401) {
        currentAuth = null;
      } else {
        throw new Error(`HTTP ${r.status}`);
      }
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load authentication info';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchAuth();
  });

  async function revokeCurrentKey() {
    revoking = true;
    try {
      const r = await api('/api/cli-auth/revoke-current', { method: 'POST' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${r.status}`);
      }
      confirmRevoke = null;
      await fetchAuth();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to revoke key';
    } finally {
      revoking = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const tabs = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];
</script>

<div class="mx-auto max-w-3xl space-y-6 p-6">
  <!-- Tab bar -->
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="text-sm {tab.href === '/settings/api-keys'
          ? 'font-medium text-indigo-600 dark:text-indigo-400'
          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
      >{tab.label}</a>
    {/each}
  </div>

  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <Key class="h-6 w-6 text-zinc-400" />
      <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Board API Keys</h1>
    </div>
  </div>

  <p class="text-sm text-zinc-500 dark:text-zinc-400">
    Board API keys are created through the CLI authentication flow. Use <code class="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">claude-cli auth login</code> to create a new key, or revoke your current key below.
  </p>

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <div class="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else if error && !currentAuth}
    <div class="rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-300">
        <AlertTriangle class="h-5 w-5" />
        <p class="text-sm font-medium">Failed to load API key info</p>
      </div>
      <p class="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
    </div>
  {:else if currentAuth}
    <!-- Current Session Info -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div class="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Shield class="h-4 w-4 text-zinc-400" />
          Current Session
        </h2>
      </div>
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">User ID</span>
          <span class="font-mono text-sm text-zinc-900 dark:text-zinc-100">{currentAuth.userId}</span>
        </div>
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Auth Source</span>
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium
            {currentAuth.source === 'board_api_key'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : currentAuth.source === 'cookie'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}">
            {currentAuth.source}
          </span>
        </div>
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Instance Admin</span>
          {#if currentAuth.isInstanceAdmin}
            <span class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Yes
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
              <span class="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600"></span> No
            </span>
          {/if}
        </div>
        {#if currentAuth.companyIds.length > 0}
          <div class="flex items-center justify-between px-5 py-3">
            <span class="text-sm text-zinc-600 dark:text-zinc-400">Companies</span>
            <div class="flex flex-wrap gap-1.5">
              {#each currentAuth.companyIds as cid}
                <span class="inline-flex rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{cid}</span>
              {/each}
            </div>
          </div>
        {/if}
        {#if currentAuth.keyId}
          <div class="flex items-center justify-between px-5 py-3">
            <span class="text-sm text-zinc-600 dark:text-zinc-400">Key ID</span>
            <span class="font-mono text-sm text-zinc-900 dark:text-zinc-100">{currentAuth.keyId}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Revoke Current Key -->
    {#if currentAuth.source === 'board_api_key' && currentAuth.keyId}
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div class="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Trash2 class="h-4 w-4 text-zinc-400" />
            Key Management
          </h2>
        </div>
        <div class="p-5">
          {#if confirmRevoke === currentAuth.keyId}
            <div class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
              <div class="flex items-start gap-3">
                <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                <div class="flex-1">
                  <p class="text-sm font-medium text-red-800 dark:text-red-200">Revoke this API key?</p>
                  <p class="mt-1 text-xs text-red-700 dark:text-red-300">
                    This action cannot be undone. The current CLI session will be invalidated and you will need to re-authenticate.
                  </p>
                  <div class="mt-3 flex gap-2">
                    <button
                      onclick={revokeCurrentKey}
                      disabled={revoking}
                      class="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {revoking ? 'Revoking...' : 'Confirm Revoke'}
                    </button>
                    <button
                      onclick={() => { confirmRevoke = null; }}
                      class="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-zinc-700 dark:text-zinc-300">Revoke the current board API key</p>
                <p class="text-xs text-zinc-500">This will invalidate your current CLI authentication session.</p>
              </div>
              <button
                onclick={() => { confirmRevoke = currentAuth?.keyId ?? null; }}
                class="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              >
                Revoke Key
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- How to create keys -->
    <div class="rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 class="text-sm font-medium text-zinc-800 dark:text-zinc-200">Creating New API Keys</h3>
      <p class="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
        Board API keys are provisioned through the CLI authentication flow for security. To create a new key:
      </p>
      <ol class="mt-2 list-inside list-decimal space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <li>Run the CLI auth login command from your terminal</li>
        <li>A challenge will appear in the board for approval</li>
        <li>An instance admin approves the challenge</li>
        <li>The CLI receives a board API key automatically</li>
      </ol>
    </div>
  {:else}
    <!-- Not authenticated -->
    <div class="flex flex-col items-center justify-center rounded-lg border border-zinc-200 py-16 dark:border-zinc-800">
      <Key class="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
      <p class="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">No Active Session</p>
      <p class="mt-1 text-xs text-zinc-500">
        Sign in via the CLI auth flow to manage board API keys.
      </p>
    </div>
  {/if}

  {#if error && currentAuth}
    <div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <p class="text-xs text-amber-700 dark:text-amber-300">{error}</p>
    </div>
  {/if}
</div>
