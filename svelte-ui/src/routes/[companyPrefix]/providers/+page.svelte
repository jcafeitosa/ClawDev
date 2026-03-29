<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Skeleton } from '$lib/components/ui/index.js';
  import ProviderIcon from '$lib/components/providers/provider-icon.svelte';
  import {
    Plug,
    Server,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShieldOff,
    Activity,
    Gauge,
    Settings,
    Play,
    Pause,
    RotateCcw,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronRight,
    Zap,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Unplug,
    WifiOff,
    Wifi,
    CircleDot,
    Save,
    X,
    Plus,
    Brain,
    Bot,
    DollarSign,
    Github,
    Code,
    MousePointer,
    Sparkles,
    Terminal,
    Circle,
    Globe,
    Cpu,
    Hash,
    Loader2,
    RefreshCw,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Providers' }]));

  // ── Types ───────────────────────────────────────────────────────────
  type ConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'rate_limited' | 'unconfigured';
  type CircuitState = 'CLOSED' | 'HALF_OPEN' | 'OPEN';

  interface ProviderQuota {
    label: string;
    used: number;
    limit: number;
    resetsAt: string;
  }

  interface ProviderModel {
    id: string;
    name: string;
    tier: string;
    costPer1kTokens: number;
    circuitState: CircuitState;
    failureCount: number;
    tripCount: number;
    adapter: string;
  }

  interface Provider {
    adapterType: string;
    displayName: string;
    configured: boolean;
    enabled: boolean;
    connectionStatus: ConnectionStatus;
    priority: number;
    authMethod: string | null;
    subscriptionPlan: string | null;
    subscriptionLimitMonthly: number | null;
    subscriptionResetsAt: string | null;
    lastHealthCheck: string | null;
    lastHealthStatus: string | null;
    lastHealthDetail: string | null;
    adapterMeta: any;
    quotaWindows: Array<{ label: string; usedPercent: number | null; resetsAt: string | null; valueLabel: string | null }> | null;
    circuitBreakers: Record<string, { state: string; tripCount: number; failureCount: number }>;
    monthlySpendCents: number;
    models: Array<{ id: string; displayName: string; tier: number }>;
    // Computed helpers
    icon?: string;
    status?: ConnectionStatus;
    quota?: ProviderQuota;
    config?: {
      apiKey?: string;
      subscriptionPlan?: string;
      monthlyLimit?: number;
      resetDate?: string;
    };
  }

  // ── State ───────────────────────────────────────────────────────────
  let loading = $state(true);
  let providers = $state<Provider[]>([]);
  let expandedProviderId = $state<string | null>(null);
  let testingProviderId = $state<string | null>(null);
  let testResult = $state<{ providerId: string; success: boolean; message: string } | null>(null);

  // Config edit state
  let editingConfig = $state<Record<string, any>>({});
  let savingConfig = $state(false);

  // Quota countdown
  let quotaCountdowns = $state<Record<string, string>>({});
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  // Auto-refresh
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let lastRefreshed = $state<Date | null>(null);

  let companyId = $derived(companyStore.selectedCompany?.id);

  // ── Derived aggregations ──────────────────────────────────────────
  let statusCounts = $derived.by(() => {
    const counts: Record<ConnectionStatus, number> = {
      connected: 0,
      degraded: 0,
      disconnected: 0,
      rate_limited: 0,
      unconfigured: 0,
    };
    for (const p of providers) {
      const s = p.connectionStatus ?? p.status ?? 'unconfigured';
      if (s in counts) counts[s as ConnectionStatus] = (counts[s as ConnectionStatus] ?? 0) + 1;
    }
    return counts;
  });

  let summaryText = $derived.by(() => {
    const parts: string[] = [];
    if (statusCounts.connected > 0) parts.push(`${statusCounts.connected} connected`);
    if (statusCounts.degraded > 0) parts.push(`${statusCounts.degraded} degraded`);
    if (statusCounts.disconnected > 0) parts.push(`${statusCounts.disconnected} disconnected`);
    if (statusCounts.rate_limited > 0) parts.push(`${statusCounts.rate_limited} rate limited`);
    if (statusCounts.unconfigured > 0) parts.push(`${statusCounts.unconfigured} unconfigured`);
    return parts.length > 0 ? parts.join(' \u00b7 ') : 'No providers configured';
  });

  let allCircuitBreakers = $derived.by(() => {
    const breakers: (ProviderModel & { providerName: string })[] = [];
    for (const p of providers) {
      if (p.models) {
        for (const m of p.models) {
          breakers.push({ ...m, providerName: p.displayName });
        }
      }
    }
    return breakers;
  });

  let providersWithQuota = $derived(providers.filter((p) => p.quotaWindows && p.quotaWindows.length > 0));

  let hasAnyData = $derived(providers.length > 0);

  // ── Data loading ──────────────────────────────────────────────────
  async function loadProviders() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/providers`);
      const data = await res.json();
      const raw = Array.isArray(data) ? data : data?.data ?? data?.providers ?? data?.items ?? [];
      // Normalize API response to match Provider interface
      providers = raw.map((p: any) => ({
        ...p,
        // Ensure status field maps from connectionStatus
        status: p.connectionStatus ?? p.status ?? 'unconfigured',
        connectionStatus: p.connectionStatus ?? p.status ?? 'unconfigured',
        // Map quota windows to the quota shape expected by the template
        quota: p.quotaWindows && p.quotaWindows.length > 0
          ? { windows: p.quotaWindows, resetsAt: p.quotaWindows.find((w: any) => w.resetsAt)?.resetsAt ?? null }
          : null,
      }));
      lastRefreshed = new Date();
    } catch {
      providers = [];
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (!companyId) return;
    loading = true;
    loadProviders();
  });

  onMount(() => {
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(() => {
      if (companyId) loadProviders();
    }, 30_000);

    // Quota countdown ticker
    countdownInterval = setInterval(updateCountdowns, 1_000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);
  });

  // ── Quota countdown ───────────────────────────────────────────────
  function updateCountdowns() {
    const now = Date.now();
    const next: Record<string, string> = {};
    for (const p of providers) {
      if (p.quota?.resetsAt) {
        const diff = new Date(p.quota.resetsAt).getTime() - now;
        if (diff <= 0) {
          next[p.id] = 'Resetting...';
        } else {
          const hours = Math.floor(diff / 3_600_000);
          const minutes = Math.floor((diff % 3_600_000) / 60_000);
          next[p.id] = `${hours}h ${minutes}m`;
        }
      }
    }
    quotaCountdowns = next;
  }

  // ── Actions ───────────────────────────────────────────────────────
  async function testProvider(providerId: string) {
    if (!companyId) return;
    testingProviderId = providerId;
    testResult = null;
    try {
      const res = await api(`/api/companies/${companyId}/providers/${providerId}/test`, {
        method: 'POST',
      });
      const data = await res.json();
      testResult = {
        providerId,
        success: res.ok && (data.ok ?? data.success ?? true),
        message: data.message ?? (res.ok ? 'Connection successful' : 'Connection failed'),
      };
    } catch {
      testResult = { providerId, success: false, message: 'Network error during test' };
    } finally {
      testingProviderId = null;
    }
  }

  async function toggleProvider(provider: Provider) {
    if (!companyId) return;
    const newEnabled = !provider.enabled;
    try {
      await api(`/api/companies/${companyId}/providers/${provider.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: newEnabled }),
      });
      provider.enabled = newEnabled;
      providers = [...providers]; // trigger reactivity
    } catch {
      // silently fail
    }
  }

  function expandProvider(providerId: string) {
    if (expandedProviderId === providerId) {
      expandedProviderId = null;
    } else {
      expandedProviderId = providerId;
      // Init editing config from provider
      const provider = providers.find((p) => p.id === providerId);
      if (provider?.config) {
        editingConfig = { ...provider.config };
      } else {
        editingConfig = { apiKey: '', subscriptionPlan: 'free', monthlyLimit: 0, resetDate: '' };
      }
    }
  }

  async function saveProviderConfig(providerId: string) {
    if (!companyId || !providerId) return;
    savingConfig = true;
    try {
      await api(`/api/companies/${companyId}/providers/${providerId}/config`, {
        method: 'PUT',
        body: JSON.stringify(editingConfig),
      });
      // Update local state
      const idx = providers.findIndex((p) => p.id === providerId);
      if (idx >= 0) {
        providers[idx].config = { ...editingConfig };
        providers = [...providers];
      }
      expandedProviderId = null;
    } catch {
      // silently fail
    } finally {
      savingConfig = false;
    }
  }

  async function resetCircuitBreaker(providerId: string, modelId: string) {
    if (!companyId) return;
    try {
      await api(`/api/companies/${companyId}/providers/${providerId}/models/${modelId}/reset-breaker`, {
        method: 'POST',
      });
      await loadProviders();
    } catch {
      // silently fail
    }
  }

  // ── Formatters ────────────────────────────────────────────────────
  function formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0.00';
    return `$${value.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatSmallCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return '$0.0000';
    return `$${value.toLocaleString('en', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  }

  function maskApiKey(key: string | undefined): string {
    if (!key) return '••••••••••••';
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  }

  function quotaBarColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
  }

  function quotaBarBgColor(pct: number): string {
    if (pct >= 90) return 'bg-red-500/15';
    if (pct >= 70) return 'bg-yellow-500/15';
    return 'bg-emerald-500/15';
  }

  // ── Status styling ────────────────────────────────────────────────
  const DEFAULT_STATUS = { label: 'Unknown', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-500/10', dotColor: 'bg-gray-400' };
  const STATUS_META: Record<string, { label: string; color: string; bgColor: string; dotColor: string }> = {
    connected: { label: 'Connected', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', dotColor: 'bg-emerald-500' },
    degraded: { label: 'Degraded', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/10', dotColor: 'bg-yellow-500' },
    disconnected: { label: 'Disconnected', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10', dotColor: 'bg-red-500' },
    rate_limited: { label: 'Rate Limited', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10', dotColor: 'bg-blue-500' },
    auth_expired: { label: 'Auth Expired', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10', dotColor: 'bg-orange-500' },
    unconfigured: { label: 'Not Configured', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-500/10', dotColor: 'bg-gray-400' },
  };
  function getStatusMeta(status: string) { return STATUS_META[status] ?? DEFAULT_STATUS; }

  const CIRCUIT_META: Record<CircuitState, { label: string; color: string; bgColor: string }> = {
    CLOSED: { label: 'Closed', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10' },
    HALF_OPEN: { label: 'Half Open', color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/10' },
    OPEN: { label: 'Open', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10' },
  };

  const TIER_COLORS: Record<string, string> = {
    free: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    standard: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    premium: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    enterprise: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  const PLAN_OPTIONS = [
    { value: 'free', label: 'Free' },
    { value: 'pay_as_you_go', label: 'Pay as You Go' },
    { value: 'pro', label: 'Pro' },
    { value: 'team', label: 'Team' },
    { value: 'enterprise', label: 'Enterprise' },
  ];

  // Provider brand colors and icons
  const PROVIDER_BRANDS: Record<string, { icon: any; color: string; emoji?: string }> = {
    claude_local:      { icon: Brain,        color: '#D97757', emoji: '🧠' },  // Anthropic orange
    copilot_local:     { icon: Github,       color: '#6E40C9', emoji: '🐙' },  // GitHub purple
    codex_local:       { icon: Code,         color: '#10A37F', emoji: '💚' },  // OpenAI green
    cursor:            { icon: MousePointer, color: '#00D1FF', emoji: '🖱' },  // Cursor cyan
    gemini_local:      { icon: Sparkles,     color: '#4285F4', emoji: '✨' },  // Google blue
    opencode_local:    { icon: Terminal,     color: '#FF6B35', emoji: '⌨' },   // OpenCode orange
    pi_local:          { icon: Circle,       color: '#8B5CF6', emoji: '🟣' },  // Pi purple
    openclaw_gateway:  { icon: Globe,        color: '#10B981', emoji: '🌐' },  // OpenClaw green
    hermes_local:      { icon: Cpu,          color: '#F59E0B', emoji: '⚡' },  // Hermes amber
    process:           { icon: Server,       color: '#6B7280', emoji: '⚙' },
    http:              { icon: Globe,        color: '#6B7280', emoji: '🌍' },
  };

  function getProviderBrand(adapterType: string) {
    return PROVIDER_BRANDS[adapterType] ?? { icon: Server, color: '#6B7280' };
  }

  // Show/hide api key in config form
  let showApiKey = $state(false);
</script>

<div class="providers-root space-y-6 p-6">
  <!-- ── Header ────────────────────────────────────────────────────── -->
  <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Providers</h1>
      <p class="mt-1 text-sm text-muted-foreground">{summaryText}</p>
    </div>
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      {#if lastRefreshed}
        <span>Last updated: {lastRefreshed.toLocaleTimeString()}</span>
      {/if}
      <button
        onclick={() => { if (companyId) loadProviders(); }}
        class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
      >
        <RefreshCw class="h-3.5 w-3.5" />
        Refresh
      </button>
    </div>
  </div>

  <!-- ── Loading skeleton ──────────────────────────────────────────── -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <div class="h-48 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>

  <!-- ── Empty state ───────────────────────────────────────────────── -->
  {:else if !hasAnyData}
    <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-20 px-6 text-center">
      <div class="rounded-2xl bg-blue-500/10 p-4 mb-5">
        <Plug class="h-10 w-10 text-blue-500" />
      </div>
      <h2 class="text-xl font-semibold text-foreground mb-2">No providers configured</h2>
      <p class="max-w-md text-sm text-muted-foreground mb-6">
        Connect AI providers to enable model inference for your agents. Configure API keys,
        manage quotas, and monitor circuit breaker health from one place.
      </p>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        <Plus class="h-4 w-4" />
        Configure your first provider
      </button>
    </div>

  {:else}
    <!-- ── Status Bar ────────────────────────────────────────────────── -->
    <div class="flex flex-wrap gap-2">
      {#each Object.entries(statusCounts) as [status, count]}
        {#if count > 0}
          {@const meta = getStatusMeta(status)}
          <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium {meta.bgColor} {meta.color}">
            <span class="h-1.5 w-1.5 rounded-full {meta.dotColor}"></span>
            {count} {meta.label}
          </span>
        {/if}
      {/each}
    </div>

    <!-- ── Provider Cards Grid ───────────────────────────────────────── -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each providers as provider (provider.adapterType)}
        {@const meta = getStatusMeta(provider.connectionStatus)}
        {@const isExpanded = expandedProviderId === provider.id}
        {@const brand = getProviderBrand(provider.adapterType)}
        {@const ProviderIcon = brand.icon}
        <div
          class="rounded-xl border border-border bg-card transition-all duration-200 hover:shadow-md {isExpanded ? 'col-span-1 sm:col-span-2 lg:col-span-3 ring-1 ring-blue-500/30' : ''}"
        >
          <!-- Card header (always visible) -->
          <button
            onclick={() => expandProvider(provider.id)}
            class="w-full text-left p-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <div class="rounded-lg p-2.5 shrink-0" style="background-color: {brand.color}15">
                  <ProviderIcon adapterType={provider.adapterType} size={22} />
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-foreground truncate">{provider.displayName}</h3>
                  <p class="text-xs text-muted-foreground mt-0.5">{provider.name}</p>
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium {meta.bgColor} {meta.color}">
                  <span class="h-1.5 w-1.5 rounded-full {meta.dotColor}"></span>
                  {meta.label}
                </span>
                {#if isExpanded}
                  <ChevronDown class="h-4 w-4 text-muted-foreground" />
                {:else}
                  <ChevronRight class="h-4 w-4 text-muted-foreground" />
                {/if}
              </div>
            </div>

            <!-- Stats row -->
            <div class="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1">
                <Brain class="h-3.5 w-3.5" />
                {provider.models?.length ?? 0} model{(provider.models?.length ?? 0) !== 1 ? 's' : ''}
              </span>
              <span class="inline-flex items-center gap-1">
                <DollarSign class="h-3.5 w-3.5" />
                {formatCurrency((provider.monthlySpendCents ?? 0) / 100)} this month
              </span>
              <span class="inline-flex items-center gap-1">
                <Shield class="h-3.5 w-3.5" />
                {provider.authMethod}
              </span>
            </div>
          </button>

          <!-- Quick actions -->
          <div class="flex items-center gap-2 border-t border-border px-5 py-3">
            <button
              onclick={(e) => { e.stopPropagation(); testProvider(provider.id); }}
              disabled={testingProviderId === provider.id}
              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {#if testingProviderId === provider.id}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
                Testing...
              {:else}
                <Activity class="h-3.5 w-3.5" />
                Test
              {/if}
            </button>
            <button
              onclick={(e) => { e.stopPropagation(); expandProvider(provider.id); }}
              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Settings class="h-3.5 w-3.5" />
              Configure
            </button>
            <button
              onclick={(e) => { e.stopPropagation(); toggleProvider(provider); }}
              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors {provider.enabled ? 'text-foreground hover:bg-muted' : 'text-muted-foreground hover:bg-muted'}"
            >
              {#if provider.enabled}
                <Pause class="h-3.5 w-3.5" />
                Disable
              {:else}
                <Play class="h-3.5 w-3.5" />
                Enable
              {/if}
            </button>

            <!-- Test result toast (inline) -->
            {#if testResult && testResult.providerId === provider.id}
              <span class="ml-auto inline-flex items-center gap-1.5 text-xs font-medium {testResult.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}">
                {#if testResult.success}
                  <CheckCircle class="h-3.5 w-3.5" />
                {:else}
                  <XCircle class="h-3.5 w-3.5" />
                {/if}
                {testResult.message}
              </span>
            {/if}
          </div>

          <!-- ── Expanded Detail Panel ─────────────────────────────── -->
          {#if isExpanded}
            <div class="border-t border-border bg-muted/30 p-5 space-y-6">
              <!-- Config form -->
              <div>
                <h4 class="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Settings class="h-4 w-4 text-muted-foreground" />
                  Configuration
                </h4>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <!-- API Key -->
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">API Key</label>
                    <div class="relative">
                      {#if showApiKey}
                        <input
                          type="text"
                          bind:value={editingConfig.apiKey}
                          placeholder="sk-..."
                          class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-9"
                        />
                      {:else}
                        <input
                          type="password"
                          bind:value={editingConfig.apiKey}
                          placeholder="sk-..."
                          class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 pr-9"
                        />
                      {/if}
                      <button
                        onclick={() => showApiKey = !showApiKey}
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {#if showApiKey}
                          <EyeOff class="h-4 w-4" />
                        {:else}
                          <Eye class="h-4 w-4" />
                        {/if}
                      </button>
                    </div>
                  </div>

                  <!-- Subscription Plan -->
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">Subscription Plan</label>
                    <select
                      bind:value={editingConfig.subscriptionPlan}
                      class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40 appearance-none"
                    >
                      {#each PLAN_OPTIONS as plan}
                        <option value={plan.value}>{plan.label}</option>
                      {/each}
                    </select>
                  </div>

                  <!-- Monthly Limit -->
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">Monthly Limit ($)</label>
                    <input
                      type="number"
                      bind:value={editingConfig.monthlyLimit}
                      min="0"
                      step="10"
                      placeholder="0 = unlimited"
                      class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <!-- Reset Date -->
                  <div>
                    <label class="block text-xs font-medium text-muted-foreground mb-1.5">Billing Reset Date</label>
                    <input
                      type="date"
                      bind:value={editingConfig.resetDate}
                      class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>
                </div>

                <!-- Save/Cancel -->
                <div class="flex items-center gap-2 mt-4">
                  <button
                    onclick={() => saveProviderConfig(provider.id)}
                    disabled={savingConfig}
                    class="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {#if savingConfig}
                      <Loader2 class="h-4 w-4 animate-spin" />
                      Saving...
                    {:else}
                      <Save class="h-4 w-4" />
                      Save Configuration
                    {/if}
                  </button>
                  <button
                    onclick={() => expandedProviderId = null}
                    class="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <X class="h-4 w-4" />
                    Cancel
                  </button>
                </div>
              </div>

              <!-- Models table -->
              {#if provider.models && provider.models.length > 0}
                <div>
                  <h4 class="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Brain class="h-4 w-4 text-muted-foreground" />
                    Models ({provider.models.length})
                  </h4>
                  <div class="overflow-x-auto rounded-lg border border-border">
                    <table class="w-full text-sm">
                      <thead>
                        <tr class="border-b border-border bg-muted/50">
                          <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
                          <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier</th>
                          <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost/1K Tokens</th>
                          <th class="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Circuit State</th>
                          <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each provider.models as model (model.id)}
                          {@const circuitMeta = CIRCUIT_META[model.circuitState] ?? CIRCUIT_META.CLOSED}
                          <tr class="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                            <td class="px-4 py-3">
                              <span class="font-medium text-foreground">{model.name}</span>
                              <span class="ml-2 text-xs text-muted-foreground">{model.adapter}</span>
                            </td>
                            <td class="px-4 py-3">
                              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {TIER_COLORS[model.tier] ?? TIER_COLORS.standard}">
                                {model.tier}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-right font-mono text-xs text-foreground">
                              {formatSmallCurrency(model.costPer1kTokens)}
                            </td>
                            <td class="px-4 py-3 text-center">
                              <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {circuitMeta.bgColor} {circuitMeta.color}">
                                {circuitMeta.label}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-right text-xs text-muted-foreground">
                              {model.failureCount}
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- ── Quotas Section ────────────────────────────────────────────── -->
    {#if providersWithQuota.length > 0}
      <div class="rounded-xl border border-border bg-card p-5">
        <h2 class="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
          <Gauge class="h-5 w-5 text-muted-foreground" />
          Quotas & Rate Limits
        </h2>
        <div class="space-y-4">
          {#each providersWithQuota as provider (provider.adapterType)}
            {#if provider.quotaWindows}
              {#each provider.quotaWindows as window}
                {@const pct = window.usedPercent ?? 0}
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <ProviderIcon adapterType={provider.adapterType} size={14} />
                      <span class="text-sm font-medium text-foreground">{provider.displayName}</span>
                      <span class="text-xs text-muted-foreground">{window.label}</span>
                    </div>
                    <div class="flex items-center gap-3 text-xs text-muted-foreground">
                      {#if window.valueLabel}
                        <span class="font-mono">{window.valueLabel}</span>
                      {/if}
                      {#if window.usedPercent != null}
                        <span class="font-medium {pct >= 90 ? 'text-red-500' : pct >= 70 ? 'text-yellow-500' : 'text-emerald-500'}">{pct.toFixed(0)}%</span>
                      {/if}
                      {#if window.resetsAt}
                        <span class="inline-flex items-center gap-1">
                          <Clock class="h-3 w-3" />
                          {window.resetsAt}
                        </span>
                      {/if}
                    </div>
                  </div>
                  {#if window.usedPercent != null}
                    <div class="h-2 w-full rounded-full {quotaBarBgColor(pct)} overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-500 {quotaBarColor(pct)}"
                        style="width: {pct}%"
                      ></div>
                    </div>
                  {/if}
                  {#if window.detail}
                    <p class="text-[11px] text-muted-foreground">{window.detail}</p>
                  {/if}
                </div>
              {/each}
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Circuit Breakers Section ──────────────────────────────────── -->
    {#if allCircuitBreakers.length > 0}
      <div class="rounded-xl border border-border bg-card overflow-hidden">
        <div class="px-5 pt-5 pb-3">
          <h2 class="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldAlert class="h-5 w-5 text-muted-foreground" />
            Circuit Breakers
          </h2>
          <p class="mt-1 text-xs text-muted-foreground">Per-model circuit breaker state across all providers</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-y border-border bg-muted/50">
                <th class="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
                <th class="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provider</th>
                <th class="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Adapter</th>
                <th class="px-5 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">State</th>
                <th class="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failures</th>
                <th class="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trips</th>
                <th class="px-5 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {#each allCircuitBreakers as breaker (breaker.id)}
                {@const circuitMeta = CIRCUIT_META[breaker.circuitState] ?? CIRCUIT_META.CLOSED}
                <tr class="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td class="px-5 py-3">
                    <span class="font-medium text-foreground">{breaker.name}</span>
                  </td>
                  <td class="px-5 py-3 text-muted-foreground">{breaker.providerName}</td>
                  <td class="px-5 py-3">
                    <span class="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">{breaker.adapter}</span>
                  </td>
                  <td class="px-5 py-3 text-center">
                    <span class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium {circuitMeta.bgColor} {circuitMeta.color}">
                      {circuitMeta.label}
                    </span>
                  </td>
                  <td class="px-5 py-3 text-right font-mono text-xs text-foreground">{breaker.failureCount}</td>
                  <td class="px-5 py-3 text-right font-mono text-xs text-foreground">{breaker.tripCount}</td>
                  <td class="px-5 py-3 text-right">
                    {#if breaker.circuitState !== 'CLOSED'}
                      <button
                        onclick={() => {
                          const provider = providers.find((p) => p.displayName === breaker.providerName);
                          if (provider) resetCircuitBreaker(provider.id, breaker.id);
                        }}
                        class="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        <RotateCcw class="h-3 w-3" />
                        Reset
                      </button>
                    {:else}
                      <span class="text-xs text-muted-foreground">---</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .providers-root {
    max-width: 1400px;
    margin: 0 auto;
  }
</style>
