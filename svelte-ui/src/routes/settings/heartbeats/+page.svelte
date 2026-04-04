<script lang="ts">
  import { api } from '$lib/api';
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

  function statusTone(item: SchedulerHeartbeat): string {
    if (!item.heartbeatEnabled) return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    if (item.schedulerActive) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
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
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="text-sm {tab.href === '/settings/heartbeats'
          ? 'font-medium text-indigo-600 dark:text-indigo-400'
          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
      >{tab.label}</a>
    {/each}
  </div>

  <div class="flex items-start justify-between gap-4">
    <div class="space-y-1">
      <div class="flex items-center gap-2">
        <Server class="h-6 w-6 text-zinc-400" />
        <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Instance Heartbeats</h1>
      </div>
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        Manage scheduler heartbeats for agents across every company.
      </p>
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => loadHeartbeats({ silent: true })}
        disabled={loading || refreshing}
        class="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <RefreshCcw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
        Refresh
      </button>
      <button
        type="button"
        onclick={disableAllHeartbeats}
        disabled={disableAllBusy || heartbeats.filter((item) => item.heartbeatEnabled).length === 0}
        class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ToggleLeft class="h-4 w-4" />
        {disableAllBusy ? 'Disabling...' : 'Disable All'}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="grid gap-4 md:grid-cols-4">
      {#each Array(4) as _}
        <div class="h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else}
    <div class="grid gap-4 md:grid-cols-4">
      <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p class="text-xs uppercase tracking-wide text-zinc-500">Total agents</p>
        <p class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{summary.total}</p>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p class="text-xs uppercase tracking-wide text-zinc-500">Scheduled</p>
        <p class="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{summary.schedulerActive}</p>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p class="text-xs uppercase tracking-wide text-zinc-500">Enabled</p>
        <p class="mt-2 text-2xl font-semibold text-indigo-600 dark:text-indigo-400">{summary.active}</p>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p class="text-xs uppercase tracking-wide text-zinc-500">Companies</p>
        <p class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{summary.companies}</p>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
      {error}
    </div>
  {/if}

  {#if actionError}
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
      {actionError}
    </div>
  {/if}

  {#if !loading && groupedHeartbeats.length === 0}
    <div class="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <Clock3 class="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-600" />
      <h2 class="mt-3 text-base font-semibold text-zinc-900 dark:text-zinc-50">No scheduler heartbeats</h2>
      <p class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        There are no active agent heartbeats to manage yet.
      </p>
    </div>
  {/if}

  <div class="space-y-4">
    {#each groupedHeartbeats as group}
      <section class="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div class="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <Building2 class="h-4 w-4" />
            </div>
            <div>
              <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{group.companyName}</h2>
              <p class="text-xs text-zinc-500 dark:text-zinc-400">
                {group.items.length} agent{group.items.length === 1 ? '' : 's'} with heartbeat configuration
              </p>
            </div>
          </div>
          <span class="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
            {group.items.filter((item) => item.schedulerActive).length} scheduled
          </span>
        </div>

        <div class="divide-y divide-zinc-200 dark:divide-zinc-800">
          {#each group.items as item}
            <div class="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-2">
                  <p class="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.agentName}</p>
                  {#if item.title}
                    <span class="truncate text-xs text-zinc-500 dark:text-zinc-400">{item.title}</span>
                  {/if}
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span class="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {item.adapterType}
                  </span>
                  <span>{item.role}</span>
                  <span>•</span>
                  <span>Interval {formatInterval(item.intervalSec)}</span>
                  <span>•</span>
                  <span>Last heartbeat {formatLastHeartbeat(item.lastHeartbeatAt)}</span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone(item)}`}>
                  {statusLabel(item)}
                </span>
                <button
                  type="button"
                  onclick={() => setHeartbeatEnabled(item.id, !item.heartbeatEnabled)}
                  disabled={busyById[item.id]}
                  class="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {#if busyById[item.id]}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    Saving...
                  {:else if item.heartbeatEnabled}
                    <ToggleRight class="h-4 w-4 text-emerald-500" />
                    Disable
                  {:else}
                    <ToggleLeft class="h-4 w-4 text-zinc-400" />
                    Enable
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>
