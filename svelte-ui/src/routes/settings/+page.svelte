<script lang="ts">
  import { api } from '$lib/api';
  import {
    Card, CardHeader, CardTitle, CardDescription, CardContent,
    Badge, Button, Skeleton, Separator, Alert, AlertTitle, AlertDescription,
  } from '$lib/components/ui/index.js';
  import { PageLayout } from '$lib/components/layout/index.js';
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

  const settingsTabs = [
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

<PageLayout title="Control Panel" description="General configuration, experimental flags, heartbeats, plugins, users, status, and API keys live here.">
  {#snippet actions()}
    <Button variant="outline" href="/settings/status">
      <Server class="h-4 w-4" />
      Open status
    </Button>
    <Button href="/settings/general">
      <ArrowRight class="h-4 w-4" />
      Get started
    </Button>
  {/snippet}

  {#snippet tabs()}
    <div class="flex gap-3 border-b border-border pb-3">
      {#each settingsTabs as tab}
        <a
          href={tab.href}
          class="text-sm transition-colors text-muted-foreground hover:text-foreground"
        >
          {tab.label}
        </a>
      {/each}
    </div>
  {/snippet}

  {#if loading}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {#each Array(4) as _}
        <Skeleton class="h-28 rounded-xl" />
      {/each}
    </div>
  {:else if error && !health}
    <Alert variant="warning">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {:else if health}
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-muted-foreground">Status</p>
              <p class="mt-2 text-2xl font-semibold text-foreground">{health.status}</p>
            </div>
            <Activity class="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-muted-foreground">Version</p>
              <p class="mt-2 text-2xl font-semibold text-foreground">{health.version}</p>
            </div>
            <Server class="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-muted-foreground">Bootstrap</p>
              <p class="mt-2 text-2xl font-semibold text-foreground">
                {health.bootstrapStatus === 'ready' ? 'Ready' : 'Pending'}
              </p>
            </div>
            <Zap class="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
      <Card class="border-border/60">
        <CardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-muted-foreground">Auth</p>
              <p class="mt-2 text-2xl font-semibold text-foreground">
                {health.authReady ? 'Ready' : 'Locked'}
              </p>
            </div>
            <Shield class="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <Card class="border-border/60">
        <CardHeader>
          <CardTitle>Settings sections</CardTitle>
          <CardDescription>Jump directly to the area you need to manage.</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid gap-3 sm:grid-cols-2">
            {#each shortcuts as item}
              <a
                href={item.href}
                class="group rounded-xl border border-border/60 p-4 transition-all hover:border-border hover:bg-accent/50"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <item.icon class="h-4 w-4 text-muted-foreground" />
                      <h3 class="font-medium text-foreground">{item.title}</h3>
                    </div>
                    <p class="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ArrowRight class="mt-1 h-4 w-4 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </div>
              </a>
            {/each}
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <Card class="border-border/60">
          <CardHeader>
            <CardTitle>Feature flags</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            {#each Object.entries(health.features).slice(0, 6) as [key, enabled]}
              <div class="flex items-center justify-between gap-4">
                <span class="text-sm text-muted-foreground">{featureLabel(key)}</span>
                <Badge variant={enabled ? 'default' : 'secondary'} class={enabled ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : ''}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            {/each}
          </CardContent>
        </Card>

        <Card class="border-border/60">
          <CardHeader>
            <CardTitle>Operational counts</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            {#if health.diagnostics?.counts}
              {#each Object.entries(health.diagnostics.counts).slice(0, 6) as [key, value]}
                <div class="flex items-center justify-between gap-4 rounded-lg bg-accent/40 px-3 py-2">
                  <span class="text-sm text-muted-foreground">{countLabel(key)}</span>
                  <span class="font-mono text-sm font-medium text-foreground">{value}</span>
                </div>
              {/each}
            {:else}
              <p class="text-sm text-muted-foreground">No diagnostic counts available.</p>
            {/if}
          </CardContent>
        </Card>
      </div>
    </div>
  {/if}
</PageLayout>
