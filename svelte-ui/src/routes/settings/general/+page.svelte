<script lang="ts">
  import { api } from '$lib/api';
  import {
    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
    Button, Skeleton, Alert, AlertDescription,
  } from '$lib/components/ui/index.js';
  import { PageLayout } from '$lib/components/layout/index.js';

  let censorUsernameInLogs = $state(false);
  let loading = $state(true);
  let saving = $state(false);
  let saved = $state(false);
  let error = $state<string | null>(null);

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

<PageLayout title="General Settings">
  {#snippet tabs()}
    <div class="flex gap-3 border-b border-border pb-3">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="text-sm transition-colors {tab.href === '/settings/general'
            ? 'font-medium text-primary'
            : 'text-muted-foreground hover:text-foreground'}"
        >{tab.label}</a>
      {/each}
    </div>
  {/snippet}

  {#if loading}
    <Skeleton class="h-20 rounded-xl" />
  {:else}
    {#if error}
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    {/if}

    <Card class="border-border/60">
      <CardContent class="pt-6">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1.5">
            <p class="text-sm font-medium text-foreground">Censor username in logs</p>
            <p class="text-sm text-muted-foreground">
              Hide the username segment in home-directory paths and similar operator-visible log output.
            </p>
          </div>
          <button
            type="button"
            aria-label="Toggle username log censoring"
            disabled={saving}
            onclick={() => (censorUsernameInLogs = !censorUsernameInLogs)}
            class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 {censorUsernameInLogs ? 'bg-primary' : 'bg-accent'}"
          >
            <span class="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform {censorUsernameInLogs ? 'translate-x-4.5' : 'translate-x-0.5'}"></span>
          </button>
        </div>
      </CardContent>
      <CardFooter>
        <Button onclick={save} disabled={saving}>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </Button>
      </CardFooter>
    </Card>
  {/if}
</PageLayout>
