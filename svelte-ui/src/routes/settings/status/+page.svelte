<script lang="ts">
  import { api } from '$lib/api';
  import {
    Card, CardHeader, CardTitle, CardContent,
    Badge, Button, Skeleton, Separator, Alert, AlertTitle, AlertDescription,
  } from '$lib/components/ui/index.js';
  import { Activity, CheckCircle, XCircle, AlertTriangle, ExternalLink, Server, Cpu, Shield } from 'lucide-svelte';
  import { PageLayout } from '$lib/components/layout/index.js';

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
      routeGroups: Array<{
        key: string;
        label: string;
        modules: string[];
      }>;
      counts: Record<string, number>;
    };
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
    { href: '/settings/heartbeats', label: 'Heartbeats' },
    { href: '/settings/plugins', label: 'Plugins' },
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

  function countLabel(key: string): string {
    const map: Record<string, string> = {
      companies: "Companies",
      agents: "Agents",
      projects: "Projects",
      issues: "Issues",
      routines: "Routines",
      companySkills: "Company Skills",
      approvals: "Approvals",
      plugins: "Plugins",
      pluginJobs: "Plugin Jobs",
      pluginWebhooks: "Plugin Webhooks",
      executionWorkspaces: "Execution Workspaces",
      workspaceOperations: "Workspace Operations",
      activeHeartbeatRuns: "Active Heartbeat Runs",
    };
    return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }
</script>

<PageLayout title="System Status">
  {#snippet tabs()}
    <div class="flex gap-3 border-b border-border pb-3">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="text-sm transition-colors {tab.href === '/settings/status'
            ? 'font-medium text-primary'
            : 'text-muted-foreground hover:text-foreground'}"
        >{tab.label}</a>
      {/each}
    </div>
  {/snippet}

  {#if loading}
    <div class="space-y-4">
      {#each Array(3) as _}
        <Skeleton class="h-40 rounded-xl" />
      {/each}
    </div>
  {:else if error && !health}
    <Alert variant="destructive">
      <XCircle class="h-4 w-4" />
      <AlertTitle>Failed to load instance status</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {:else if health}
    <!-- Deployment Info -->
    <Card class="border-border/60">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-sm">
          <Cpu class="h-4 w-4 text-muted-foreground" />
          Deployment Info
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div class="divide-y divide-border">
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Status</span>
            {#if health.status === 'ok'}
              <Badge class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <CheckCircle class="h-3 w-3" /> OK
              </Badge>
            {:else}
              <Badge variant="destructive">
                <XCircle class="h-3 w-3" /> Error
              </Badge>
            {/if}
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Version</span>
            <span class="font-mono text-sm text-foreground">{health.version}</span>
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Deployment Mode</span>
            <Badge variant="secondary" class={health.deploymentMode === 'authenticated'
              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'}>
              {health.deploymentMode}
            </Badge>
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Deployment Exposure</span>
            <Badge variant="secondary" class={health.deploymentExposure === 'private'
              ? ''
              : 'bg-violet-500/15 text-violet-400 border-violet-500/30'}>
              {health.deploymentExposure}
            </Badge>
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Auth Ready</span>
            {#if health.authReady}
              <Badge class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Ready
              </Badge>
            {:else}
              <Badge variant="destructive">
                <span class="h-2 w-2 rounded-full bg-red-500"></span> Not Ready
              </Badge>
            {/if}
          </div>
          <div class="flex items-center justify-between px-6 py-3">
            <span class="text-sm text-muted-foreground">Bootstrap Status</span>
            {#if health.bootstrapStatus === 'ready'}
              <Badge class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Ready
              </Badge>
            {:else}
              <Badge class="bg-amber-500/15 text-amber-400 border-amber-500/30">
                <span class="h-2 w-2 rounded-full bg-amber-500"></span> Bootstrap Pending
              </Badge>
            {/if}
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Features -->
    <Card class="border-border/60">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-sm">
          <Shield class="h-4 w-4 text-muted-foreground" />
          Features
        </CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <div class="divide-y divide-border">
          {#each Object.entries(health.features) as [key, enabled]}
            <div class="flex items-center justify-between px-6 py-3">
              <span class="text-sm text-muted-foreground">{featureLabel(key)}</span>
              {#if enabled}
                <Badge class="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                  <span class="h-2 w-2 rounded-full bg-emerald-500"></span> Enabled
                </Badge>
              {:else}
                <Badge variant="secondary">
                  <span class="h-2 w-2 rounded-full bg-secondary-foreground/30"></span> Disabled
                </Badge>
              {/if}
            </div>
          {/each}
        </div>
      </CardContent>
    </Card>

    {#if health.diagnostics}
      <Card class="border-border/60">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-sm">
            <Activity class="h-4 w-4 text-muted-foreground" />
            Surface Inventory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-lg border border-border/60 bg-accent/30 p-4">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Route Groups</h3>
              <div class="mt-3 space-y-3">
                {#each health.diagnostics.routeGroups as group}
                  <Card class="border-border/60">
                    <CardContent class="p-3">
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-sm font-medium text-foreground">{group.label}</p>
                        <Badge variant="secondary" class="text-[10px]">{group.modules.length} modules</Badge>
                      </div>
                      <p class="mt-2 text-xs leading-5 text-muted-foreground">{group.modules.join(', ')}</p>
                    </CardContent>
                  </Card>
                {/each}
              </div>
            </div>

            <div class="rounded-lg border border-border/60 bg-accent/30 p-4">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Entity Counts</h3>
              <div class="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border/60">
                {#each Object.entries(health.diagnostics.counts) as [key, value]}
                  <div class="flex items-center justify-between bg-card px-3 py-2">
                    <span class="text-sm text-muted-foreground">{countLabel(key)}</span>
                    <span class="font-mono text-sm text-foreground">{value}</span>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Dev Server (if present) -->
    {#if health.devServer}
      <Card class="border-border/60">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-sm">
            <Activity class="h-4 w-4 text-muted-foreground" />
            Dev Server
          </CardTitle>
        </CardHeader>
        <CardContent class="p-0">
          <div class="divide-y divide-border">
            <div class="flex items-center justify-between px-6 py-3">
              <span class="text-sm text-muted-foreground">Status</span>
              <span class="font-mono text-sm text-foreground">{health.devServer.status}</span>
            </div>
            {#if health.devServer.pid}
              <div class="flex items-center justify-between px-6 py-3">
                <span class="text-sm text-muted-foreground">PID</span>
                <span class="font-mono text-sm text-foreground">{health.devServer.pid}</span>
              </div>
            {/if}
            {#if health.devServer.port}
              <div class="flex items-center justify-between px-6 py-3">
                <span class="text-sm text-muted-foreground">Port</span>
                <span class="font-mono text-sm text-foreground">{health.devServer.port}</span>
              </div>
            {/if}
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Quick Actions -->
    <Card class="border-border/60">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-sm">
          <ExternalLink class="h-4 w-4 text-muted-foreground" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        {#if health.bootstrapStatus === 'bootstrap_pending'}
          <Alert variant="warning">
            <AlertTriangle class="h-4 w-4" />
            <AlertTitle>Bootstrap Pending</AlertTitle>
            <AlertDescription>
              <p>
                No instance admin has been set up yet.
                {#if health.bootstrapInviteActive}
                  A bootstrap invite is currently active.
                {/if}
              </p>
              <a href="/onboarding" class="mt-2 inline-flex items-center gap-1 text-xs font-medium underline hover:no-underline">
                Go to Setup <ExternalLink class="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        {/if}
        <div class="flex flex-wrap gap-3">
          <Button variant="outline" href="/settings/general">Instance Configuration</Button>
          <Button variant="outline" href="/settings/experimental">Feature Flags</Button>
          <Button variant="outline" href="/settings/api-keys">API Keys</Button>
        </div>
      </CardContent>
    </Card>

    <!-- Auto-refresh indicator -->
    <p class="text-center text-xs text-muted-foreground/60">
      Auto-refreshes every 30 seconds
      {#if error}
        <span class="text-amber-500"> -- Last refresh failed: {error}</span>
      {/if}
    </p>
  {/if}
</PageLayout>
