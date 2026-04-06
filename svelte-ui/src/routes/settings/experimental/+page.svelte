<script lang="ts">
  import { api } from '$lib/api';
  import {
    Card, CardContent, Skeleton, Alert, AlertDescription,
  } from '$lib/components/ui/index.js';
  import { PageLayout } from '$lib/components/layout/index.js';

  let settings = $state({
    enableIsolatedWorkspaces: false,
    autoRestartDevServerWhenIdle: false,
  });
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  const tabLinks = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];

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

<PageLayout title="Experimental Features" description="Beta flags and advanced platform behavior.">
  {#snippet tabs()}
    <div class="flex gap-3 border-b border-border pb-3">
      {#each tabLinks as tab}
        <a
          href={tab.href}
          class="text-sm transition-colors {tab.href === '/settings/experimental'
            ? 'font-medium text-primary'
            : 'text-muted-foreground hover:text-foreground'}"
        >{tab.label}</a>
      {/each}
    </div>
  {/snippet}

  {#if loading}
    <div class="space-y-3">
      {#each Array(2) as _}
        <Skeleton class="h-16 rounded-xl" />
      {/each}
    </div>
  {:else}
    {#if error}
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    {/if}

    <div class="space-y-3">
      {#each features as f}
        <Card class="border-border/60">
          <CardContent class="pt-6">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-foreground">{f.label}</p>
                <p class="text-xs text-muted-foreground">{f.desc}</p>
              </div>
              <button
                onclick={() => toggle(f.key)}
                aria-label="Toggle {f.label}"
                disabled={saving}
                class="relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 {settings[f.key] ? 'bg-primary' : 'bg-accent'}"
              >
                <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform {settings[f.key] ? 'translate-x-5' : ''}"></span>
              </button>
            </div>
          </CardContent>
        </Card>
      {/each}
    </div>
  {/if}
</PageLayout>
