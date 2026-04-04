<script lang="ts">
  import { api } from '$lib/api';
  import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
    Badge, Button, Skeleton, Separator, Alert, AlertDescription,
  } from '$lib/components/ui/index.js';
  import {
    Building2,
    Clock3,
    Loader2,
    RefreshCcw,
    Server,
    ToggleLeft,
    ToggleRight,
  } from 'lucide-svelte';

  interface SchedulerHeartbeat {
    id: string;
    companyId: string;
    companyName: string;
    agentName: string;
    role: string;
    title: string | null;
    status: string;
    adapterType: string;
    intervalSec: number;
    heartbeatEnabled: boolean;
    schedulerActive: boolean;
    lastHeartbeatAt: string | null;
  }

  interface HeartbeatGroup {
    companyId: string;
    companyName: string;
    items: SchedulerHeartbeat[];
  }

  let heartbeats = $state<SchedulerHeartbeat[]>([]);
  let loading = $state(true);
  let refreshing = $state(false);
  let disableAllBusy = $state(false);
  let busyById = $state<Record<string, boolean>>({});
  let error = $state<string | null>(null);
  let actionError = $state<string | null>(null);

  const tabs = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];

  function normalizeItems(rows: unknown): SchedulerHeartbeat[] {
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row): row is SchedulerHeartbeat => !!row && typeof row === 'object')
      .map((row) => ({
        id: String(row.id ?? ''),
        companyId: String(row.companyId ?? ''),
        companyName: String(row.companyName ?? 'Unknown Company'),
        agentName: String(row.agentName ?? 'Agent'),
        role: String(row.role ?? 'unknown'),
        title: typeof row.title === 'string' ? row.title : null,
        status: String(row.status ?? 'idle'),
        adapterType: String(row.adapterType ?? 'unknown'),
        intervalSec: Math.max(0, Number(row.intervalSec ?? 0)),
        heartbeatEnabled: row.heartbeatEnabled === true,
        schedulerActive: row.schedulerActive === true,
        lastHeartbeatAt: typeof row.lastHeartbeatAt === 'string' ? row.lastHeartbeatAt : null,
      }))
      .filter((row) => row.id.length > 0);
  }

  async function loadHeartbeats(options: { silent?: boolean } = {}) {
    if (!options.silent) {
      loading = heartbeats.length === 0;
      refreshing = heartbeats.length > 0;
    }
    actionError = null;
    error = null;
    try {
      const res = await api('/api/instance/scheduler-heartbeats');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      heartbeats = normalizeItems(await res.json());
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load scheduler heartbeats';
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  async function setHeartbeatEnabled(agentId: string, enabled: boolean) {
    busyById = { ...busyById, [agentId]: true };
    actionError = null;
    try {
      const res = await api(`/api/agents/${agentId}/heartbeat-settings`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }

      heartbeats = heartbeats.map((item) =>
        item.id === agentId
          ? {
              ...item,
              heartbeatEnabled: enabled,
              schedulerActive: enabled && item.intervalSec > 0,
            }
          : item,
      );
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Failed to update heartbeat scheduling';
      await loadHeartbeats({ silent: true });
    } finally {
      const { [agentId]: _removed, ...rest } = busyById;
      busyById = rest;
    }
  }

  async function disableAllHeartbeats() {
    const activeItems = heartbeats.filter((item) => item.heartbeatEnabled && !busyById[item.id]);
    if (activeItems.length === 0) return;
    disableAllBusy = true;
    actionError = null;
    try {
      for (const item of activeItems) {
        await setHeartbeatEnabled(item.id, false);
      }
      await loadHeartbeats({ silent: true });
    } catch (err) {
      actionError = err instanceof Error ? err.message : 'Failed to disable all heartbeats';
    } finally {
      disableAllBusy = false;
    }
  }

  const groupedHeartbeats = $derived.by<HeartbeatGroup[]>(() => {
    const groups = new Map<string, HeartbeatGroup>();
    for (const item of heartbeats) {
      const key = item.companyId || item.companyName;
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, {
          companyId: item.companyId,
          companyName: item.companyName,
          items: [item],
        });
      }
    }
    return [...groups.values()];
  });

  const summary = $derived.by(() => {
    const active = heartbeats.filter((item) => item.heartbeatEnabled).length;
    const schedulerActive = heartbeats.filter((item) => item.schedulerActive).length;
    const disabled = heartbeats.length - active;
    const companies = new Set(heartbeats.map((item) => item.companyId)).size;
    return { total: heartbeats.length, active, schedulerActive, disabled, companies };
  });

  function formatInterval(seconds: number): string {
    if (seconds <= 0) return 'Disabled';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    if (minutes < 60) return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  function formatLastHeartbeat(value: string | null): string {
    if (!value) return 'Never';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function statusVariant(item: SchedulerHeartbeat): string {
    if (!item.heartbeatEnabled) return 'bg-secondary/80 text-secondary-foreground';
    if (item.schedulerActive) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }

  function statusLabel(item: SchedulerHeartbeat): string {
    if (!item.heartbeatEnabled) return 'Disabled';
    if (item.schedulerActive) return 'Scheduled';
    return 'Enabled but idle';
  }

  $effect(() => {
    loadHeartbeats();
    const timer = setInterval(() => loadHeartbeats({ silent: true }), 30_000);
    return () => clearInterval(timer);
  });
</script>

<div class="mx-auto max-w-5xl space-y-6 p-6">
  <div class="flex gap-3 border-b border-border pb-3">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="text-sm transition-colors {tab.href === '/settings/heartbeats'
          ? 'font-medium text-primary'
          : 'text-muted-foreground hover:text-foreground'}"
      >{tab.label}</a>
    {/each}
  </div>

  <div class="flex items-start justify-between gap-4">
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <Server class="h-6 w-6 text-muted-foreground" />
        <h1 class="text-xl font-bold text-foreground">Instance Heartbeats</h1>
      </div>
      <p class="text-sm text-muted-foreground">
        Manage scheduler heartbeats for agents across every company.
      </p>
    </div>

    <div class="flex items-center gap-2">
      <Button variant="outline" onclick={() => loadHeartbeats({ silent: true })} disabled={loading || refreshing}>
        <RefreshCcw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
        Refresh
      </Button>
      <Button onclick={disableAllHeartbeats} disabled={disableAllBusy || heartbeats.filter((item) => item.heartbeatEnabled).length === 0}>
        <ToggleLeft class="h-4 w-4" />
        {disableAllBusy ? 'Disabling...' : 'Disable All'}
      </Button>
    </div>
  </div>

  {#if loading}
    <div class="grid gap-4 md:grid-cols-4">
      {#each Array(4) as _}
        <Skeleton class="h-24 rounded-xl" />
      {/each}
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-4">
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Total agents</p>
          <p class="mt-2 text-2xl font-semibold text-foreground">{summary.total}</p>
        </CardContent>
      </Card>
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Scheduled</p>
          <p class="mt-2 text-2xl font-semibold text-emerald-400">{summary.schedulerActive}</p>
        </CardContent>
      </Card>
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Enabled</p>
          <p class="mt-2 text-2xl font-semibold text-primary">{summary.active}</p>
        </CardContent>
      </Card>
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <p class="text-xs uppercase tracking-wide text-muted-foreground">Companies</p>
          <p class="mt-2 text-2xl font-semibold text-foreground">{summary.companies}</p>
        </CardContent>
      </Card>
    </div>
  {/if}

  {#if error}
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {/if}

  {#if actionError}
    <Alert variant="warning">
      <AlertDescription>{actionError}</AlertDescription>
    </Alert>
  {/if}

  {#if !loading && groupedHeartbeats.length === 0}
    <Card class="border-border/60">
      <CardContent class="flex flex-col items-center justify-center py-12">
        <Clock3 class="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 class="mt-3 text-base font-semibold text-foreground">No scheduler heartbeats</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          There are no active agent heartbeats to manage yet.
        </p>
      </CardContent>
    </Card>
  {/if}

  <div class="space-y-4">
    {#each groupedHeartbeats as group}
      <Card class="border-border/60 overflow-hidden">
        <CardHeader>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-muted-foreground">
                <Building2 class="h-4 w-4" />
              </div>
              <div>
                <CardTitle class="text-sm">{group.companyName}</CardTitle>
                <CardDescription>
                  {group.items.length} agent{group.items.length === 1 ? '' : 's'} with heartbeat configuration
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary">
              {group.items.filter((item) => item.schedulerActive).length} scheduled
            </Badge>
          </div>
        </CardHeader>

        <CardContent class="p-0">
          <div class="divide-y divide-border">
            {#each group.items as item}
              <div class="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0 space-y-1">
                  <div class="flex items-center gap-2">
                    <p class="truncate text-sm font-semibold text-foreground">{item.agentName}</p>
                    {#if item.title}
                      <span class="truncate text-xs text-muted-foreground">{item.title}</span>
                    {/if}
                  </div>
                  <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" class="text-[10px] font-mono uppercase tracking-wide">
                      {item.adapterType}
                    </Badge>
                    <span>{item.role}</span>
                    <span class="text-muted-foreground/40">--</span>
                    <span>Interval {formatInterval(item.intervalSec)}</span>
                    <span class="text-muted-foreground/40">--</span>
                    <span>Last heartbeat {formatLastHeartbeat(item.lastHeartbeatAt)}</span>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <Badge class={statusVariant(item)}>
                    {statusLabel(item)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => setHeartbeatEnabled(item.id, !item.heartbeatEnabled)}
                    disabled={busyById[item.id]}
                  >
                    {#if busyById[item.id]}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Saving...
                    {:else if item.heartbeatEnabled}
                      <ToggleRight class="h-4 w-4 text-emerald-500" />
                      Disable
                    {:else}
                      <ToggleLeft class="h-4 w-4 text-muted-foreground" />
                      Enable
                    {/if}
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        </CardContent>
      </Card>
    {/each}
  </div>
</div>
