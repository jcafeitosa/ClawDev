<script lang="ts">
  import { api } from '$lib/api';
  import { Activity, ArrowRight, KeyRound, Plug, Shield, Settings2, Server, SlidersHorizontal, Zap } from 'lucide-svelte';

  interface HealthData {
    status: string;
    version: string;
    deploymentMode: string;
    deploymentExposure: string;
    authReady: boolean;
    bootstrapStatus: 'ready' | 'bootstrap_pending';
    bootstrapInviteActive: boolean;
    features: Record<string, boolean>;
    diagnostics?: {
      counts: Record<string, number>;
    };
  }

  let health = $state<HealthData | null>(null);
  let loading = $state(true);
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

  const shortcuts = [
    {
      href: '/settings/general',
      title: 'General',
      description: 'Company defaults, toggles, and instance configuration.',
      icon: Settings2,
    },
    {
      href: '/settings/experimental',
      title: 'Experimental',
      description: 'Beta flags and advanced platform behavior.',
      icon: SlidersHorizontal,
    },
    {
      href: '/settings/heartbeats',
      title: 'Heartbeats',
      description: 'Inspect and control instance scheduler heartbeats.',
      icon: Activity,
    },
    {
      href: '/settings/plugins',
      title: 'Plugins',
      description: 'Install, enable, and inspect instance plugins.',
      icon: Plug,
    },
    {
      href: '/settings/users',
      title: 'Users',
      description: 'Review instance users and permissions.',
      icon: Shield,
    },
    {
      href: '/settings/api-keys',
      title: 'API Keys',
      description: 'Manage application and service credentials.',
      icon: KeyRound,
    },
  ];

  async function fetchHealth() {
    try {
      const response = await api('/api/health');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      health = await response.json();
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to fetch instance status';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    fetchHealth();
  });

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
    return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }

  function countLabel(key: string): string {
    const map: Record<string, string> = {
      companies: 'Companies',
      agents: 'Agents',
      projects: 'Projects',
      issues: 'Issues',
      routines: 'Routines',
      companySkills: 'Company Skills',
      approvals: 'Approvals',
      plugins: 'Plugins',
      pluginJobs: 'Plugin Jobs',
      pluginWebhooks: 'Plugin Webhooks',
      executionWorkspaces: 'Execution Workspaces',
      workspaceOperations: 'Workspace Operations',
      activeHeartbeatRuns: 'Active Heartbeat Runs',
    };
    return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }
</script>

<svelte:head>
  <title>Settings</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 p-6">
  <div class="flex items-center justify-between gap-4 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    <div>
      <p class="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Instance settings</p>
      <h1 class="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Control panel</h1>
      <p class="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        General configuration, experimental flags, heartbeats, plugins, users, status, and API keys live here.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a
        href="/settings/status"
        class="inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <Server class="h-4 w-4" />
        Open status
      </a>
      <a
        href="/settings/general"
        class="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        <ArrowRight class="h-4 w-4" />
        Get started
      </a>
    </div>
  </div>

  <div class="flex gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
    {#each tabs as tab}
      <a
        href={tab.href}
        class="text-sm {tab.href === '/settings/general'
          ? 'font-medium text-indigo-600 dark:text-indigo-400'
          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}"
      >
        {tab.label}
      </a>
    {/each}
  </div>

  {#if loading}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {#each Array(4) as _}
        <div class="h-28 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else if error && !health}
    <div class="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
      {error}
    </div>
  {:else if health}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Status</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{health.status}</p>
          </div>
          <Activity class="h-5 w-5 text-zinc-400" />
        </div>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Version</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{health.version}</p>
          </div>
          <Server class="h-5 w-5 text-zinc-400" />
        </div>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Bootstrap</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {health.bootstrapStatus === 'ready' ? 'Ready' : 'Pending'}
            </p>
          </div>
          <Zap class="h-5 w-5 text-zinc-400" />
        </div>
      </div>
      <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Auth</p>
            <p class="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {health.authReady ? 'Ready' : 'Locked'}
            </p>
          </div>
          <Shield class="h-5 w-5 text-zinc-400" />
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">Settings sections</h2>
            <p class="text-sm text-zinc-500 dark:text-zinc-400">Jump directly to the area you need to manage.</p>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          {#each shortcuts as item}
            <a
              href={item.href}
              class="group rounded-xl border border-zinc-200 p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/50"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <item.icon class="h-4 w-4 text-zinc-400" />
                    <h3 class="font-medium text-zinc-900 dark:text-zinc-50">{item.title}</h3>
                  </div>
                  <p class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{item.description}</p>
                </div>
                <ArrowRight class="mt-1 h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:group-hover:text-zinc-200" />
              </div>
            </a>
          {/each}
        </div>
      </div>

      <div class="space-y-4">
        <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">Feature flags</h2>
          <div class="mt-4 space-y-3">
            {#each Object.entries(health.features).slice(0, 6) as [key, enabled]}
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm text-zinc-600 dark:text-zinc-400">{featureLabel(key)}</span>
                <span class="text-sm font-medium {enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'}">
                  {enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            {/each}
          </div>
        </div>

        <div class="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">Operational counts</h2>
          <div class="mt-4 grid gap-3">
            {#if health.diagnostics?.counts}
              {#each Object.entries(health.diagnostics.counts).slice(0, 6) as [key, value]}
                <div class="flex items-center justify-between gap-4 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                  <span class="text-sm text-zinc-600 dark:text-zinc-400">{countLabel(key)}</span>
                  <span class="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-50">{value}</span>
                </div>
              {/each}
            {:else}
              <p class="text-sm text-zinc-500 dark:text-zinc-400">No diagnostic counts available.</p>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
