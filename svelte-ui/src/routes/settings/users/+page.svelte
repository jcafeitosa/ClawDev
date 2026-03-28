<script lang="ts">
  import { api } from '$lib/api';
  import { authClient } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast.svelte';
  import { Shield, ShieldOff, User, Crown, Loader2 } from 'lucide-svelte';

  interface InstanceUser {
    id: string;
    name: string;
    email: string;
    isInstanceAdmin: boolean;
    createdAt: string;
  }

  const session = authClient.useSession();

  let users = $state<InstanceUser[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let pendingAction = $state<string | null>(null);
  let confirmDialog = $state<{ userId: string; action: 'promote' | 'demote'; userName: string } | null>(null);

  $effect(() => {
    loadUsers();
  });

  async function loadUsers() {
    loading = true;
    error = null;
    try {
      const res = await api('/api/access/admin/users');
      if (!res.ok) {
        if (res.status === 403) {
          error = 'You do not have permission to manage instance users. Instance admin access is required.';
        } else if (res.status === 404) {
          error = 'Instance user management API is not available on this server version.';
        } else {
          const body = await res.json().catch(() => ({}));
          error = (body as Record<string, string>).error ?? `Failed to load users (HTTP ${res.status})`;
        }
        return;
      }
      users = await res.json();
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : 'Failed to load users';
    } finally {
      loading = false;
    }
  }

  function requestAction(userId: string, action: 'promote' | 'demote', userName: string) {
    confirmDialog = { userId, action, userName };
  }

  function cancelAction() {
    confirmDialog = null;
  }

  async function executeAction() {
    if (!confirmDialog) return;
    const { userId, action } = confirmDialog;
    confirmDialog = null;
    pendingAction = userId;

    try {
      const endpoint = action === 'promote'
        ? `/api/access/admin/users/${userId}/promote-instance-admin`
        : `/api/access/admin/users/${userId}/demote-instance-admin`;
      const res = await api(endpoint, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error ?? `Failed to ${action} user`);
      }
      toastStore.push({
        title: action === 'promote' ? 'User promoted to admin' : 'Admin access removed',
        tone: 'success',
      });
      await loadUsers();
    } catch (e: unknown) {
      toastStore.push({
        title: `Failed to ${action} user`,
        body: e instanceof Error ? e.message : 'Unknown error',
        tone: 'error',
      });
    } finally {
      pendingAction = null;
    }
  }

  let currentUserId = $derived($session.data?.user?.id ?? null);
</script>

<div class="mx-auto max-w-2xl space-y-6 p-6">
  <!-- Settings Tab Bar -->
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    <a href="/settings/general" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">General</a>
    <a href="/settings/experimental" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Experimental</a>
    <a href="/settings/users" class="text-sm font-medium text-indigo-600 dark:text-indigo-400">Users</a>
    <a href="/settings/status" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Status</a>
    <a href="/settings/api-keys" class="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">API Keys</a>
  </div>

  <div>
    <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Instance Users</h1>
    <p class="mt-1 text-sm text-zinc-500">Manage instance-level user roles and admin access.</p>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <div class="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else if error}
    <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-900/20">
      <p class="text-sm text-amber-800 dark:text-amber-200">{error}</p>
      <button
        onclick={loadUsers}
        class="mt-2 text-sm font-medium text-amber-700 underline hover:no-underline dark:text-amber-300"
      >
        Retry
      </button>
    </div>
  {:else if users.length === 0}
    <div class="flex flex-col items-center justify-center rounded-lg border border-zinc-200 py-12 dark:border-zinc-800">
      <User class="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
      <p class="text-sm font-medium text-zinc-500 dark:text-zinc-400">No users found</p>
      <p class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Users will appear here once they register.</p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each users as user (user.id)}
        {@const isCurrentUser = user.id === currentUserId}
        <div
          class="flex items-center justify-between rounded-lg border p-4 transition-colors {isCurrentUser
            ? 'border-indigo-200 bg-indigo-50/50 dark:border-indigo-800/50 dark:bg-indigo-900/10'
            : 'border-zinc-200 dark:border-zinc-800'}"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {user.isInstanceAdmin
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}"
            >
              {#if user.isInstanceAdmin}
                <Crown class="h-4 w-4" />
              {:else}
                <User class="h-4 w-4" />
              {/if}
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <p class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {user.name || 'Unnamed User'}
                </p>
                {#if isCurrentUser}
                  <span class="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    You
                  </span>
                {/if}
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <p class="truncate text-xs text-zinc-500">{user.email}</p>
                {#if user.isInstanceAdmin}
                  <span class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    Instance Admin
                  </span>
                {/if}
              </div>
            </div>
          </div>

          <div class="ml-4 shrink-0">
            {#if pendingAction === user.id}
              <div class="flex items-center gap-1.5 text-xs text-zinc-400">
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
                Processing...
              </div>
            {:else if user.isInstanceAdmin && !isCurrentUser}
              <button
                onclick={() => requestAction(user.id, 'demote', user.name || user.email)}
                class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-red-800 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <ShieldOff class="h-3.5 w-3.5" />
                Demote
              </button>
            {:else if !user.isInstanceAdmin}
              <button
                onclick={() => requestAction(user.id, 'promote', user.name || user.email)}
                class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-800 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
              >
                <Shield class="h-3.5 w-3.5" />
                Promote to Admin
              </button>
            {:else}
              <!-- Current user who is admin — no action available -->
              <span class="text-xs text-zinc-400 dark:text-zinc-500">Current session</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Confirmation Dialog -->
{#if confirmDialog}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <button
      class="absolute inset-0 bg-black/50 backdrop-blur-sm"
      onclick={cancelAction}
      aria-label="Cancel"
    ></button>
    <!-- Dialog -->
    <div class="relative z-10 w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <h3 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {confirmDialog.action === 'promote' ? 'Promote to Instance Admin' : 'Remove Admin Access'}
      </h3>
      <p class="mt-2 text-sm text-zinc-500">
        {#if confirmDialog.action === 'promote'}
          Are you sure you want to grant instance admin privileges to <strong class="text-zinc-700 dark:text-zinc-300">{confirmDialog.userName}</strong>?
          They will have full control over all companies and settings.
        {:else}
          Are you sure you want to remove instance admin privileges from <strong class="text-zinc-700 dark:text-zinc-300">{confirmDialog.userName}</strong>?
          They will lose access to admin-level operations.
        {/if}
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <button
          onclick={cancelAction}
          class="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onclick={executeAction}
          class="rounded-lg px-4 py-2 text-sm font-medium text-white {confirmDialog.action === 'promote'
            ? 'bg-indigo-600 hover:bg-indigo-700'
            : 'bg-red-600 hover:bg-red-700'}"
        >
          {confirmDialog.action === 'promote' ? 'Promote' : 'Demote'}
        </button>
      </div>
    </div>
  </div>
{/if}
