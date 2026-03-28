<script lang="ts">
  import { api } from '$lib/api';
  import { Activity, CheckCircle, XCircle, AlertTriangle, ExternalLink, Server, Cpu, Shield } from 'lucide-svelte';

  interface HealthData {
    status: string;
    version: string;
    deploymentMode: string;
    deploymentExposure: string;
    authReady: boolean;
    bootstrapStatus: 'ready' | 'bootstrap_pending';
    bootstrapInviteActive: boolean;
    features: Record<string, boolean>;
    devServer?: {
      status: string;
      pid?: number;
      port?: number;
      uptime?: number;
    };
  }

  let health = $state<HealthData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let refreshTimer = $state<ReturnType<typeof setInterval> | null>(null);

  async function fetchHealth() {
    try {
      const r = await api('/api/health');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      health = await r.json();
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch health data';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, 30_000);
    refreshTimer = timer;
    return () => clearInterval(timer);
  });

  const tabs = [
    { href: '/settings/general', label: 'General' },
    { href: '/settings/experimental', label: 'Experimental' },
    { href: '/settings/users', label: 'Users' },
    { href: '/settings/status', label: 'Status' },
    { href: '/settings/api-keys', label: 'API Keys' },
  ];

  function featureLabel(key: string): string {
    const map: Record<string, string> = {
      companyDeletionEnabled: 'Company Deletion',
      worktrees: 'Git Worktrees',
      plugins: 'Plugin System',
      routines: 'Routines',
      budgets: 'Budget Policies',
      approvals: 'Approval Workflows',
      autoRestartDevServerWhenIdle: 'Auto-restart Dev Server',
    };
    return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }
</script>

<div class="mx-auto max-w-3xl space-y-6 p-6">
  <!-- Tab bar -->
  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="text-sm {tab.href === '/settings/status'
          ? 'font-medium text-indigo-600 dark:text-indigo-400'
          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
      >{tab.label}</a>
    {/each}
  </div>

  <div class="flex items-center gap-3">
    <Server class="h-6 w-6 text-zinc-400" />
    <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Instance Status</h1>
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <div class="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else if error && !health}
    <div class="rounded-lg border border-red-300 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-300">
        <XCircle class="h-5 w-5" />
        <p class="text-sm font-medium">Failed to load instance status</p>
      </div>
      <p class="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
    </div>
  {:else if health}
    <!-- Deployment Info -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div class="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Cpu class="h-4 w-4 text-zinc-400" />
          Deployment Info
        </h2>
      </div>
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        <!-- Status -->
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Status</span>
          {#if health.status === 'ok'}
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <CheckCircle class="h-3 w-3" /> OK
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
              <XCircle class="h-3 w-3" /> Error
            </span>
          {/if}
        </div>
        <!-- Version -->
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Version</span>
          <span class="font-mono text-sm text-zinc-900 dark:text-zinc-100">{health.version}</span>
        </div>
        <!-- Deployment Mode -->
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Deployment Mode</span>
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium
            {health.deploymentMode === 'authenticated'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}">
            {health.deploymentMode}
          </span>
        </div>
        <!-- Deployment Exposure -->
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Deployment Exposure</span>
          <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium
            {health.deploymentExposure === 'private'
              ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
              : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'}">
            {health.deploymentExposure}
          </span>
        </div>
        <!-- Auth Ready -->
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Auth Ready</span>
          {#if health.authReady}
            <span class="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Ready
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
              <span class="h-2 w-2 rounded-full bg-red-500"></span> Not Ready
            </span>
          {/if}
        </div>
        <!-- Bootstrap Status -->
        <div class="flex items-center justify-between px-5 py-3">
          <span class="text-sm text-zinc-600 dark:text-zinc-400">Bootstrap Status</span>
          {#if health.bootstrapStatus === 'ready'}
            <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Ready
            </span>
          {:else}
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <span class="h-2 w-2 rounded-full bg-amber-500"></span> Bootstrap Pending
            </span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Features -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div class="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <Shield class="h-4 w-4 text-zinc-400" />
          Features
        </h2>
      </div>
      <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
        {#each Object.entries(health.features) as [key, enabled]}
          <div class="flex items-center justify-between px-5 py-3">
            <span class="text-sm text-zinc-600 dark:text-zinc-400">{featureLabel(key)}</span>
            {#if enabled}
              <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Enabled
              </span>
            {:else}
              <span class="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 dark:text-zinc-500">
                <span class="h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600"></span> Disabled
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Dev Server (if present) -->
    {#if health.devServer}
      <div class="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div class="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            <Activity class="h-4 w-4 text-zinc-400" />
            Dev Server
          </h2>
        </div>
        <div class="divide-y divide-zinc-100 dark:divide-zinc-800">
          <div class="flex items-center justify-between px-5 py-3">
            <span class="text-sm text-zinc-600 dark:text-zinc-400">Status</span>
            <span class="font-mono text-sm text-zinc-900 dark:text-zinc-100">{health.devServer.status}</span>
          </div>
          {#if health.devServer.pid}
            <div class="flex items-center justify-between px-5 py-3">
              <span class="text-sm text-zinc-600 dark:text-zinc-400">PID</span>
              <span class="font-mono text-sm text-zinc-900 dark:text-zinc-100">{health.devServer.pid}</span>
            </div>
          {/if}
          {#if health.devServer.port}
            <div class="flex items-center justify-between px-5 py-3">
              <span class="text-sm text-zinc-600 dark:text-zinc-400">Port</span>
              <span class="font-mono text-sm text-zinc-900 dark:text-zinc-100">{health.devServer.port}</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div class="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          <ExternalLink class="h-4 w-4 text-zinc-400" />
          Quick Actions
        </h2>
      </div>
      <div class="space-y-2 p-5">
        {#if health.bootstrapStatus === 'bootstrap_pending'}
          <div class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p class="text-sm font-medium text-amber-800 dark:text-amber-200">Bootstrap Pending</p>
              <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                No instance admin has been set up yet.
                {#if health.bootstrapInviteActive}
                  A bootstrap invite is currently active.
                {/if}
              </p>
              <a href="/setup" class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100">
                Go to Setup <ExternalLink class="h-3 w-3" />
              </a>
            </div>
          </div>
        {/if}
        <div class="flex flex-wrap gap-3">
          <a href="/settings/general" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Instance Configuration
          </a>
          <a href="/settings/experimental" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            Feature Flags
          </a>
          <a href="/settings/api-keys" class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            API Keys
          </a>
        </div>
      </div>
    </div>

    <!-- Auto-refresh indicator -->
    <p class="text-center text-xs text-zinc-400 dark:text-zinc-500">
      Auto-refreshes every 30 seconds
      {#if error}
        <span class="text-amber-500"> &middot; Last refresh failed: {error}</span>
      {/if}
    </p>
  {/if}
</div>
