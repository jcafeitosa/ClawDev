<script lang="ts">
  import { api } from '$lib/api';
  import { authClient } from '$lib/auth-client';
  import { toastStore } from '$lib/stores/toast.svelte';
  import {
    Card, CardHeader, CardTitle, CardContent,
    Badge, Button, Skeleton, Alert, AlertDescription,
  } from '$lib/components/ui/index.js';
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

  const tabs = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];

  $effect(() => {
    loadUsers();
  });

  async function loadUsers() {
    loading = true;
    error = null;
    try {
      const res = await api('/api/admin/users');
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
        ? `/api/admin/users/${userId}/promote-instance-admin`
        : `/api/admin/users/${userId}/demote-instance-admin`;
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
  <div class="flex gap-3 border-b border-border pb-3">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="text-sm transition-colors {tab.href === '/settings/users'
          ? 'font-medium text-primary'
          : 'text-muted-foreground hover:text-foreground'}"
      >{tab.label}</a>
    {/each}
  </div>

  <div>
    <h1 class="text-xl font-bold text-foreground">Instance Users</h1>
    <p class="mt-1 text-sm text-muted-foreground">Manage instance-level user roles and admin access.</p>
  </div>

  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <Skeleton class="h-16 rounded-xl" />
      {/each}
    </div>
  {:else if error}
    <Alert variant="warning">
      <AlertDescription>
        <p>{error}</p>
        <button
          onclick={loadUsers}
          class="mt-2 text-sm font-medium underline hover:no-underline"
        >
          Retry
        </button>
      </AlertDescription>
    </Alert>
  {:else if users.length === 0}
    <Card class="border-border/60">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <User class="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p class="text-sm font-medium text-muted-foreground">No users found</p>
        <p class="mt-1 text-xs text-muted-foreground/60">Users will appear here once they register.</p>
      </CardContent>
    </Card>
  {:else}
    <div class="space-y-2">
      {#each users as user (user.id)}
        {@const isCurrentUser = user.id === currentUserId}
        <Card class="border-border/60 {isCurrentUser ? 'border-primary/30 bg-primary/[0.03]' : ''}">
          <CardContent class="flex items-center justify-between py-4">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {user.isInstanceAdmin
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-accent text-muted-foreground'}"
              >
                {#if user.isInstanceAdmin}
                  <Crown class="h-4 w-4" />
                {:else}
                  <User class="h-4 w-4" />
                {/if}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-medium text-foreground">
                    {user.name || 'Unnamed User'}
                  </p>
                  {#if isCurrentUser}
                    <Badge class="bg-primary/15 text-primary border-primary/30 text-[10px]">You</Badge>
                  {/if}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <p class="truncate text-xs text-muted-foreground">{user.email}</p>
                  {#if user.isInstanceAdmin}
                    <Badge class="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px]">Instance Admin</Badge>
                  {/if}
                </div>
              </div>
            </div>

            <div class="ml-4 shrink-0">
              {#if pendingAction === user.id}
                <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 class="h-3.5 w-3.5 animate-spin" />
                  Processing...
                </div>
              {:else if user.isInstanceAdmin && !isCurrentUser}
                <Button
                  variant="outline"
                  size="xs"
                  onclick={() => requestAction(user.id, 'demote', user.name || user.email)}
                  class="hover:border-red-500/30 hover:text-red-400"
                >
                  <ShieldOff class="h-3.5 w-3.5" />
                  Demote
                </Button>
              {:else if !user.isInstanceAdmin}
                <Button
                  variant="outline"
                  size="xs"
                  onclick={() => requestAction(user.id, 'promote', user.name || user.email)}
                  class="hover:border-primary/30 hover:text-primary"
                >
                  <Shield class="h-3.5 w-3.5" />
                  Promote to Admin
                </Button>
              {:else}
                <span class="text-xs text-muted-foreground/60">Current session</span>
              {/if}
            </div>
          </CardContent>
        </Card>
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
    <Card class="relative z-10 w-full max-w-sm border-border shadow-xl">
      <CardHeader>
        <CardTitle>
          {confirmDialog.action === 'promote' ? 'Promote to Instance Admin' : 'Remove Admin Access'}
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {#if confirmDialog.action === 'promote'}
            Are you sure you want to grant instance admin privileges to <strong class="text-foreground">{confirmDialog.userName}</strong>?
            They will have full control over all companies and settings.
          {:else}
            Are you sure you want to remove instance admin privileges from <strong class="text-foreground">{confirmDialog.userName}</strong>?
            They will lose access to admin-level operations.
          {/if}
        </p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" onclick={cancelAction}>Cancel</Button>
          <Button
            variant={confirmDialog.action === 'promote' ? 'default' : 'destructive'}
            onclick={executeAction}
          >
            {confirmDialog.action === 'promote' ? 'Promote' : 'Demote'}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
{/if}
