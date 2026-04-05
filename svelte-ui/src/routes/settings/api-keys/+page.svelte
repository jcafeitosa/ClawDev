<script lang="ts">
  import { api } from '$lib/api';
  import {
    Card, CardHeader, CardTitle, CardContent,
    Badge, Button, Skeleton, Alert, AlertTitle, AlertDescription,
  } from '$lib/components/ui/index.js';
  import { Key, Plus, Copy, CheckCircle, Trash2, AlertTriangle, Shield } from 'lucide-svelte';
  import { PageLayout } from '$lib/components/layout/index.js';

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

  const settingsTabs = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];

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
</script>

<PageLayout title="API Keys" description="Board API keys are created through the CLI authentication flow.">
  {#snippet tabs()}
    <div class="flex gap-3 border-b border-border pb-3">
      {#each settingsTabs as tab}
        <a
          href={tab.href}
          class="text-sm transition-colors {tab.href === '/settings/api-keys'
            ? 'font-medium text-primary'
            : 'text-muted-foreground hover:text-foreground'}"
        >{tab.label}</a>
      {/each}
    </div>
  {/snippet}

  <p class="text-sm text-muted-foreground">
    Board API keys are created through the CLI authentication flow. Use <code class="rounded bg-accent px-1.5 py-0.5 font-mono text-xs">claude-cli auth login</code> to create a new key, or revoke your current key below.
  </p>

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <Skeleton class="h-20 rounded-xl" />
      {/each}
    </div>
  {:else if error && !currentAuth}
    <Alert variant="destructive">
      <AlertTriangle class="h-4 w-4" />
      <AlertTitle>Failed to load API key info</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {:else if currentAuth}
    <!-- Current Session Info -->
    <Card class="border-border/60">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-sm">
          <Shield class="h-4 w-4 text-muted-foreground" />
          Current Session
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div class="divide-y divide-border">
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">User ID</span>
            <span class="font-mono text-sm text-foreground">{currentAuth.userId}</span>
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Auth Source</span>
            <Badge variant="secondary" class={
              currentAuth.source === 'board_api_key'
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : currentAuth.source === 'cookie'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : ''
            }>
              {currentAuth.source}
            </Badge>
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Instance Admin</span>
            {#if currentAuth.isInstanceAdmin}
              <Badge class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Yes
              </Badge>
            {:else}
              <Badge variant="secondary">
                <span class="h-2 w-2 rounded-full bg-secondary-foreground/30"></span> No
              </Badge>
            {/if}
          </div>
          {#if currentAuth.companyIds.length > 0}
            <div class="flex items-center justify-between px-6 py-3">
              <span class="text-sm text-muted-foreground">Companies</span>
              <div class="flex flex-wrap gap-1.5">
                {#each currentAuth.companyIds as cid}
                  <Badge variant="secondary" class="font-mono text-xs">{cid}</Badge>
                {/each}
              </div>
            </div>
          {/if}
          {#if currentAuth.keyId}
            <div class="flex items-center justify-between px-6 py-3">
              <span class="text-sm text-muted-foreground">Key ID</span>
              <span class="font-mono text-sm text-foreground">{currentAuth.keyId}</span>
            </div>
          {/if}
        </div>
      </CardContent>
    </Card>

    <!-- Revoke Current Key -->
    {#if currentAuth.source === 'board_api_key' && currentAuth.keyId}
      <Card class="border-border/60">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-sm">
            <Trash2 class="h-4 w-4 text-muted-foreground" />
            Key Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {#if confirmRevoke === currentAuth.keyId}
            <Alert variant="destructive">
              <AlertTriangle class="h-4 w-4" />
              <AlertTitle>Revoke this API key?</AlertTitle>
              <AlertDescription>
                <p>This action cannot be undone. The current CLI session will be invalidated and you will need to re-authenticate.</p>
                <div class="mt-3 flex gap-2">
                  <Button variant="destructive" size="sm" onclick={revokeCurrentKey} disabled={revoking}>
                    {revoking ? 'Revoking...' : 'Confirm Revoke'}
                  </Button>
                  <Button variant="outline" size="sm" onclick={() => { confirmRevoke = null; }}>
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          {:else}
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-foreground">Revoke the current board API key</p>
                <p class="text-xs text-muted-foreground">This will invalidate your current CLI authentication session.</p>
              </div>
              <Button
                variant="outline"
                class="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onclick={() => { confirmRevoke = currentAuth?.keyId ?? null; }}
              >
                Revoke Key
              </Button>
            </div>
          {/if}
        </CardContent>
      </Card>
    {/if}

    <!-- How to create keys -->
    <Card class="border-border/60 bg-accent/30">
      <CardContent class="pt-6">
        <h3 class="text-sm font-medium text-foreground">Creating New API Keys</h3>
        <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
          Board API keys are provisioned through the CLI authentication flow for security. To create a new key:
        </p>
        <ol class="mt-2 list-inside list-decimal space-y-1 text-xs text-muted-foreground">
          <li>Run the CLI auth login command from your terminal</li>
          <li>A challenge will appear in the board for approval</li>
          <li>An instance admin approves the challenge</li>
          <li>The CLI receives a board API key automatically</li>
        </ol>
      </CardContent>
    </Card>
  {:else}
    <!-- Not authenticated -->
    <Card class="border-border/60">
      <CardContent class="flex flex-col items-center justify-center py-16">
        <Key class="h-12 w-12 text-muted-foreground/30" />
        <p class="mt-4 text-sm font-medium text-foreground">No Active Session</p>
        <p class="mt-1 text-xs text-muted-foreground">
          Sign in via the CLI auth flow to manage board API keys.
        </p>
      </CardContent>
    </Card>
  {/if}

  {#if error && currentAuth}
    <Alert variant="warning">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {/if}
</PageLayout>
