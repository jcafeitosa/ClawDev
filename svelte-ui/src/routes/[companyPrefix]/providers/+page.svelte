<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Skeleton, Badge, Input, Button } from '$lib/components/ui/index.js';
  import { PageLayout } from '$lib/components/layout/index.js';
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/index.js';
  import ProviderIcon from '$lib/components/providers/provider-icon.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import {
    RefreshCw,
    Search,
    Brain,
    Activity,
    CircleDot,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    Server,
    Eye,
    Timer,
    ShieldOff,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Providers & Models' }]));

  // ── Types ───────────────────────────────────────────────────────────
  interface ProviderSummary {
    adapterType: string;
    displayName: string;
    available: number;
    cooldown: number;
    unavailable: number;
    free: number;
    billingType: 'subscription' | 'paid' | 'unknown';
    authConfigurable: boolean;
    totalModels: number;
    authMethods: Array<'api' | 'oauth' | 'custom'>;
  }

  interface Model {
    id: string;
    modelId: string;
    label: string;
    adapterType: string;
    providerName: string;
    tier: string;
    capabilities: string[];
    contextWindow: number;
    status: string;
    inputPriceMicro: number;
    outputPriceMicro: number;
    isFree: boolean;
    lastProbed: string | null;
    cooldownEndsAt: string | null;
  }

  interface ModelStatus {
    modelId: string;
    modelName: string;
    status: string;
    statusDetail: string | null;
    cooldownEndsAt: string | null;
    cooldownReason: string | null;
    statusChangedAt: string | null;
    adapterType: string;
    avgLatencyMs: number | null;
    errorRate: number | null;
    consecutiveFailures: number;
    lastProbed: string | null;
  }

  interface ProviderStatus {
    adapterType: string;
    displayName: string;
    models: ModelStatus[];
  }

  interface CredentialProviderCard {
    provider: string;
    displayName: string;
    authMethod: 'api' | 'oauth' | 'custom';
    envVars: string[];
    description: string;
    sampleModel: string;
  }

  interface AdapterReadiness {
    adapterType: string;
    installed: boolean;
    upToDate: boolean;
    currentVersion: string | null;
    minimumVersion: string | null;
    needsInstall: boolean;
    needsUpdate: boolean;
    remediation?: {
      kind: 'install' | 'update' | 'manual';
      command?: string | null;
      installCommand?: string | null;
      updateCommand?: string | null;
      reason?: string | null;
    } | null;
  }

  // ── State ───────────────────────────────────────────────────────────
  let loading = $state(true);
  let activeTab = $state('models');

  // Provider summary
  let providerSummaries = $state<ProviderSummary[]>([]);

  // Models tab
  let models = $state<Model[]>([]);
  let modelsLoading = $state(true);
  let modelSearch = $state('');
  let filterProvider = $state('all');
  let filterTier = $state('all');
  let filterCapability = $state('all');
  let hideUnavailable = $state(false);

  // Filtered provider cards — hide providers with zero available models when filter is on
  let visibleProviders = $derived.by(() => {
    if (!hideUnavailable) return providerSummaries;
    return providerSummaries.filter((p) => p.available > 0 || p.cooldown > 0);
  });

  // Status tab
  let providerStatuses = $state<ProviderStatus[]>([]);
  let statusLoading = $state(true);

  // Adapter readiness
  let adapterReadiness = $state<AdapterReadiness[]>([]);
  let readinessLoading = $state(true);

  // Auto-refresh
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let lastRefreshed = $state<Date | null>(null);

  // Tick timer for live cooldown countdowns
  let now = $state(Date.now());
  let tickInterval: ReturnType<typeof setInterval>;
  $effect(() => {
    tickInterval = setInterval(() => { now = Date.now(); }, 1000);
    return () => clearInterval(tickInterval);
  });

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);
  const HIDDEN_ADAPTERS = ['process', 'http', 'openclaw_gateway', 'pi_local', 'openai_compatible_local'];
  const CREDENTIAL_PROVIDER_CARDS: CredentialProviderCard[] = [
    {
      provider: 'groq',
      displayName: 'Groq',
      authMethod: 'api',
      envVars: ['GROQ_API_KEY'],
      description: 'Fast hosted inference with OpenAI-compatible responses.',
      sampleModel: 'groq/qwen-qwq-32b',
    },
    {
      provider: 'xai',
      displayName: 'xAI',
      authMethod: 'api',
      envVars: ['XAI_API_KEY'],
      description: 'Grok models routed through Pi.',
      sampleModel: 'xai/grok-4',
    },
    {
      provider: 'mistral',
      displayName: 'Mistral',
      authMethod: 'api',
      envVars: ['MISTRAL_API_KEY'],
      description: 'Mistral code and chat models bridged by Pi.',
      sampleModel: 'mistral/devstral-medium-latest',
    },
    {
      provider: 'cerebras',
      displayName: 'Cerebras',
      authMethod: 'api',
      envVars: ['CEREBRAS_API_KEY'],
      description: 'High-throughput hosted models for fast loops.',
      sampleModel: 'cerebras/llama-3.1-70b',
    },
    {
      provider: 'openrouter',
      displayName: 'OpenRouter',
      authMethod: 'api',
      envVars: ['OPENROUTER_API_KEY'],
      description: 'Model router with broad provider coverage.',
      sampleModel: 'openrouter/anthropic/claude-3.7-sonnet',
    },
    {
      provider: 'minimax',
      displayName: 'MiniMax',
      authMethod: 'api',
      envVars: ['MINIMAX_API_KEY'],
      description: 'Chinese-language and multimodal model access.',
      sampleModel: 'minimax/abab6.5s',
    },
    {
      provider: 'kimi-coding',
      displayName: 'Kimi Coding',
      authMethod: 'api',
      envVars: ['KIMI_CODING_API_KEY'],
      description: 'Coding-oriented Kimi models via Pi.',
      sampleModel: 'kimi-coding/kimi-k2',
    },
    {
      provider: 'azure',
      displayName: 'Azure OpenAI',
      authMethod: 'api',
      envVars: ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_ENDPOINT'],
      description: 'Azure-hosted OpenAI-compatible deployments.',
      sampleModel: 'azure/gpt-4.1',
    },
  ];

  let providerCards = $derived.by(() => {
    if (providerSummaries.length > 0) {
      return providerSummaries.filter((p) => !HIDDEN_ADAPTERS.includes(p.adapterType));
    }

    const byAdapter = new Map<string, ProviderSummary>();
    for (const model of models) {
      if (HIDDEN_ADAPTERS.includes(model.adapterType)) continue;
      const current = byAdapter.get(model.adapterType);
      const normalizedStatus = normalizeModelStatus(model.status);
      const isAvailable = normalizedStatus === 'available';
      const isCooldown = normalizedStatus === 'cooldown';
      const isUnavailable = normalizedStatus === 'unavailable' || normalizedStatus === 'auth_required' || normalizedStatus === 'quota_exceeded' || normalizedStatus === 'degraded' || normalizedStatus === 'unknown';
      if (!current) {
        byAdapter.set(model.adapterType, {
          adapterType: model.adapterType,
          displayName: model.providerName || model.adapterType,
          available: isAvailable ? 1 : 0,
          cooldown: isCooldown ? 1 : 0,
          unavailable: isUnavailable ? 1 : 0,
          free: model.isFree ? 1 : 0,
          billingType: 'unknown',
          authConfigurable: false,
          totalModels: 1,
          authMethods: [],
        });
        continue;
      }
      current.available += isAvailable ? 1 : 0;
      current.cooldown += isCooldown ? 1 : 0;
      current.unavailable += isUnavailable ? 1 : 0;
      current.free += model.isFree ? 1 : 0;
      current.totalModels += 1;
    }

    return [...byAdapter.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
  });

  let runtimeOverview = $derived.by(() => {
    const providerCount = providerCards.length;
    const modelCount = models.length;
    const availableCount = models.filter((m) => m.status === 'available').length;
    const cooldownCount = models.filter((m) => m.status === 'cooldown').length;
    const unavailableCount = models.filter((m) => m.status === 'unavailable' || m.status === 'unknown').length;
    const freeCount = models.filter((m) => m.isFree).length;
    const authMethods = new Set(providerSummaries.flatMap((p) => p.authMethods ?? []));
    return {
      providerCount,
      modelCount,
      availableCount,
      cooldownCount,
      unavailableCount,
      freeCount,
      authMethods: [...authMethods].sort(),
    };
  });

  // ── Derived: filtered models ─────────────────────────────────────
  let filteredModels = $derived.by(() => {
    let result = models;
    // Hide unavailable models by default
    if (hideUnavailable) {
      result = result.filter((m) => m.status !== 'unavailable');
    }
    if (modelSearch) {
      const q = modelSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.modelId?.toLowerCase().includes(q) ||
          m.label?.toLowerCase().includes(q) ||
          m.providerName?.toLowerCase().includes(q),
      );
    }
    if (filterProvider !== 'all') {
      result = result.filter((m) => m.adapterType === filterProvider);
    }
    if (filterTier !== 'all') {
      result = result.filter((m) => m.tier === filterTier);
    }
    if (filterCapability !== 'all') {
      result = result.filter((m) => m.capabilities?.includes(filterCapability));
    }
    return [...result].sort((a, b) => {
      const scoreDiff = getModelSortScore(b) - getModelSortScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.label.localeCompare(b.label);
    });
  });

  let uniqueProviders = $derived(
    [...new Set(models.map((m) => m.adapterType))].filter((a) => !HIDDEN_ADAPTERS.includes(a)).sort(),
  );
  let uniqueCapabilities = $derived(
    [...new Set(models.flatMap((m) => m.capabilities ?? []))].sort(),
  );

  // ── Safe fetch ────────────────────────────────────────────────────
  async function safeFetch<T>(url: string, fallback: T): Promise<T> {
    try {
      const res = await api(url);
      if (!res.ok) return fallback;
      const json = await res.json();
      return json as T;
    } catch {
      return fallback;
    }
  }

  // ── Data loading ──────────────────────────────────────────────────
  async function loadProviderSummaries() {
    if (!companyId) return;
    try {
      const data = await safeFetch<any>(`/api/providers/summary`, []);
      const raw = Array.isArray(data) ? data : data?.data ?? data?.providers ?? data?.items ?? [];
      const filtered = raw.filter((p: any) => !HIDDEN_ADAPTERS.includes(p.adapterType));

      providerSummaries = filtered.map((p: any) => ({
        adapterType: p.adapterType,
        displayName: p.label ?? p.displayName ?? p.adapterType,
        available: p.available ?? 0,
        cooldown: p.cooldown ?? 0,
        unavailable: p.unavailable ?? 0,
        free: p.free ?? 0,
        billingType: p.billingType ?? 'unknown',
        authConfigurable: p.authConfigurable ?? false,
        totalModels: p.totalCatalog ?? p.total ?? 0,
        authMethods: p.authMethods ?? [],
      }));
      lastRefreshed = new Date();
    } catch {
      providerSummaries = [];
    } finally {
      loading = false;
    }
  }

  async function loadModels() {
    if (!companyId) return;
    modelsLoading = true;
    try {
      const data = await safeFetch<any>(`/api/models`, []);
      const raw = Array.isArray(data) ? data : data?.data ?? data?.models ?? data?.items ?? [];
      models = raw.map((m: any) => ({
        id: m.id ?? m.modelId,
        modelId: m.modelId ?? m.id ?? '',
        label: m.label ?? m.name ?? m.modelId ?? '',
        adapterType: m.adapterType ?? m.adapter ?? m.provider ?? '',
        providerName: m.providerName ?? m.provider ?? m.adapterType ?? m.adapter ?? '',
        tier: m.tier ?? 'paid',
        capabilities: m.capabilities ?? [],
        contextWindow: m.contextWindow ?? m.maxTokens ?? 0,
        status: normalizeModelStatus((m.circuitState && m.circuitState !== 'unknown') ? m.circuitState : (m.status && m.status !== 'unknown') ? m.status : 'unknown'),
        inputPriceMicro: m.inputPriceMicro ?? m.inputCostMicro ?? 0,
        outputPriceMicro: m.outputPriceMicro ?? m.outputCostMicro ?? 0,
        isFree: m.isFree === true,
        lastProbed: m.lastProbeAt ?? m.lastHealthCheck ?? m.lastProbedAt ?? m.lastProbed ?? null,
        cooldownEndsAt: m.cooldownEndsAt ?? null,
      }));
    } catch {
      models = [];
    } finally {
      modelsLoading = false;
    }
  }

  async function loadProviderStatuses() {
    if (!companyId) return;
    statusLoading = true;
    try {
      // Use the providers list to fetch status per provider
      const data = await safeFetch<any>(`/api/providers/summary`, []);
      const raw = Array.isArray(data) ? data : data?.data ?? data?.providers ?? data?.items ?? [];
      const filtered = raw.filter((p: any) => !HIDDEN_ADAPTERS.includes(p.adapterType));

      providerStatuses = filtered.map((p: any) => ({
        adapterType: p.adapterType,
        displayName: p.label ?? p.displayName ?? p.adapterType,
        models: (p.models ?? []).map((m: any) => ({
          modelId: m.modelId ?? m.id ?? '',
          modelName: m.name ?? m.modelId ?? m.id ?? '',
          status: normalizeModelStatus((m.status && m.status !== 'unknown') ? m.status : (m.circuitState && m.circuitState !== 'unknown') ? m.circuitState : 'unknown'),
          statusDetail: m.statusDetail ?? null,
          cooldownEndsAt: m.cooldownEndsAt ?? null,
          cooldownReason: m.cooldownReason ?? m.reason ?? null,
          statusChangedAt: m.statusChangedAt ?? m.stateChangedAt ?? null,
          adapterType: p.adapterType,
          avgLatencyMs: m.avgLatencyMs ?? null,
          errorRate: m.errorRate ?? m.errorRatePercent ?? null,
          consecutiveFailures: m.failureCount ?? m.consecutiveFailures ?? 0,
          lastProbed: m.lastProbed ?? m.lastHealthCheck ?? m.lastProbeAt ?? null,
        })),
      }));
    } catch {
      providerStatuses = [];
    } finally {
      statusLoading = false;
    }
  }

  async function loadAdapterReadiness() {
    if (!companyId) return;
    readinessLoading = true;
    try {
      const data = await safeFetch<any>(`/api/adapters/readiness`, []);
      const raw = Array.isArray(data) ? data : data?.adapters ?? data?.items ?? [];
      adapterReadiness = raw.map((entry: any) => ({
        adapterType: entry.adapterType ?? '',
        installed: entry.installed === true,
        upToDate: entry.upToDate === true,
        currentVersion: entry.currentVersion ?? null,
        minimumVersion: entry.minimumVersion ?? null,
        needsInstall: entry.needsInstall === true,
        needsUpdate: entry.needsUpdate === true,
        remediation: entry.remediation ?? null,
      }));
    } catch {
      adapterReadiness = [];
    } finally {
      readinessLoading = false;
    }
  }

  // ── Load on companyId change ──────────────────────────────────────
  $effect(() => {
    if (!companyId) return;
    loading = true;
    loadProviderSummaries();
    loadModels();
    loadAdapterReadiness();
  });

  onMount(() => {
    refreshInterval = setInterval(() => {
      if (companyId) {
        loadProviderSummaries();
        if (activeTab === 'models') loadModels();
        if (activeTab === 'status') loadProviderStatuses();
        loadAdapterReadiness();
      }
    }, 30_000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  // ── Actions ───────────────────────────────────────────────────────
  function formatCooldownRemaining(cooldownEndsAt: string, currentTime: number): string {
    const remaining = Math.max(0, new Date(cooldownEndsAt).getTime() - currentTime);
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // ── Formatters ────────────────────────────────────────────────────
  function formatContextWindow(n: number): string {
    if (!n || n <= 0) return '--';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return `${n}`;
  }

  function formatPrice(micro: number): string {
    if (!micro || micro <= 0) return '$0.00';
    return `$${(micro / 1_000_000).toFixed(2)}`;
  }

  function formatPricing(model: Model): string {
    if (model.isFree) return 'Free';
    if ((!model.inputPriceMicro || model.inputPriceMicro <= 0) && (!model.outputPriceMicro || model.outputPriceMicro <= 0)) return '\u2014';
    return `${formatPrice(model.inputPriceMicro)}/M in / ${formatPrice(model.outputPriceMicro)}/M out`;
  }

  // ── Status styling ────────────────────────────────────────────────
  const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    available: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Available' },
    CLOSED: { dot: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Available' },
    cooldown: { dot: 'bg-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', label: 'Cooldown' },
    HALF_OPEN: { dot: 'bg-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-600 dark:text-yellow-400', label: 'Cooldown' },
    unavailable: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', label: 'Unavailable' },
    OPEN: { dot: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-600 dark:text-red-400', label: 'Unavailable' },
    auth_required: { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', label: 'Auth required' },
    quota_exceeded: { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', label: 'Quota exceeded' },
    degraded: { dot: 'bg-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400', label: 'Degraded' },
    unknown: { dot: 'bg-sky-400', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', label: 'Discovered' },
  };

  function getStatusStyle(status: string) {
    return STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
  }

  function normalizeModelStatus(status: string | null | undefined) {
    if (!status) return 'unknown';
    if (status === 'cooldown' || status === 'available' || status === 'unavailable' || status === 'degraded' || status === 'auth_required' || status === 'quota_exceeded' || status === 'unknown') {
      return status;
    }
    if (status === 'HALF_OPEN' || status === 'OPEN' || status === 'CLOSED') return status;
    return 'unknown';
  }

  const TIER_STYLES: Record<string, { bg: string; text: string }> = {
    free: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
    budget: { bg: 'bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400' },
    paid: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    premium: { bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
    standard: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
    enterprise: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  };

  function getTierStyle(tier: string) {
    return TIER_STYLES[tier] ?? TIER_STYLES.paid;
  }

  const CAPABILITY_STYLES: Record<string, string> = {
    code: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    chat: 'bg-green-500/10 text-green-600 dark:text-green-400',
    vision: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    thinking: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    tool_use: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    embedding: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  };

  const RESOLUTION_STYLES: Record<string, string> = {
    pinned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    fallback: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
    routed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    local: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    performance_optimized: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    availability_optimized: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  };

  // ── Billing type inference ─────────────────────────────────────
  type BillingType = 'subscription' | 'paid' | 'unknown';

  const BILLING_STYLES: Record<BillingType, { bg: string; text: string; label: string }> = {
    subscription: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', label: 'Subscription' },
    paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'Paid' },
    unknown: { bg: '', text: '', label: '\u2014' },
  };

  function inferBillingType(
    adapterType: string,
    authMethods: Array<'api' | 'oauth' | 'custom'>,
    billingType?: BillingType,
  ): BillingType {
    if (billingType && billingType !== 'unknown') return billingType;
    if (authMethods.includes('oauth')) return 'subscription';
    if (authMethods.includes('api')) return 'paid';
    if (adapterType.endsWith('_local')) return 'subscription';
    return 'paid';
  }

  // ── Tier sort priority (higher = first) ──────────────────────────
  const TIER_PRIORITY: Record<string, number> = {
    premium: 5,
    standard: 4,
    budget: 3,
    paid: 2,
    free: 1,
  };

  function getModelSortScore(model: Model): number {
    const hasEnrichment = (model.capabilities?.length > 0 || model.inputPriceMicro > 0 || model.outputPriceMicro > 0 || model.contextWindow > 0) ? 1000 : 0;
    const tierScore = (TIER_PRIORITY[model.tier] ?? 0) * 100;
    return hasEnrichment + tierScore;
  }

  function getAdapterReadinessStyle(entry: AdapterReadiness) {
    if (entry.needsInstall) return 'border-red-500/40 bg-red-500/5 text-red-600 dark:text-red-400';
    if (entry.needsUpdate) return 'border-yellow-500/40 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400';
    return 'border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400';
  }

  function openCredentialSecretConfig(card: CredentialProviderCard) {
    if (!prefix) return;
    const params = new URLSearchParams({
      name: card.envVars[0] ?? `${card.provider.toUpperCase()}_API_KEY`,
      description: `${card.displayName} credential for provider access`,
    });
    window.location.href = `/${prefix}/secrets?${params.toString()}`;
  }

  const AUTH_STYLES: Record<'api' | 'oauth' | 'custom', string> = {
    api: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    oauth: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    custom: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  };

  // New fallback model to add
  let newFallbackModel = $state('');
</script>

<PageLayout title="Providers" description="Manage AI providers, monitor model availability, and configure routing">
  {#snippet actions()}
    {#if lastRefreshed}
      <span class="text-xs text-muted-foreground">Updated: {lastRefreshed.toLocaleTimeString()}</span>
    {/if}
    <Button
      variant="outline"
      size="sm"
      onclick={() => { if (companyId) { loadProviderSummaries(); loadModels(); loadProviderStatuses(); loadAdapterReadiness(); } }}
    >
      <RefreshCw class="h-3.5 w-3.5" />
      Refresh
    </Button>
  {/snippet}
<div class="providers-root space-y-6">
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div class="rounded-xl border border-border bg-card p-4">
      <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Providers</p>
      <p class="mt-2 text-2xl font-semibold text-foreground">{runtimeOverview.providerCount}</p>
      <p class="text-xs text-muted-foreground">Detected in the live runtime</p>
    </div>
    <div class="rounded-xl border border-border bg-card p-4">
      <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Models</p>
      <p class="mt-2 text-2xl font-semibold text-foreground">{runtimeOverview.modelCount}</p>
      <p class="text-xs text-muted-foreground">Total visible model records</p>
    </div>
    <div class="rounded-xl border border-border bg-card p-4">
      <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Available</p>
      <p class="mt-2 text-2xl font-semibold text-emerald-500">{runtimeOverview.availableCount}</p>
      <p class="text-xs text-muted-foreground">Ready for agents now</p>
    </div>
    <div class="rounded-xl border border-border bg-card p-4">
      <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Free</p>
      <p class="mt-2 text-2xl font-semibold text-sky-500">{runtimeOverview.freeCount}</p>
      <p class="text-xs text-muted-foreground">Catalog models flagged as free</p>
    </div>
    <div class="rounded-xl border border-border bg-card p-4">
      <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cooldown / Unavailable</p>
      <p class="mt-2 text-2xl font-semibold text-foreground">
        {runtimeOverview.cooldownCount}
        <span class="text-muted-foreground">/</span>
        {runtimeOverview.unavailableCount}
      </p>
      <p class="text-xs text-muted-foreground">Temporarily blocked or offline</p>
    </div>
  </div>

  <div class="rounded-xl border border-border bg-card p-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">Integrated adapters</h2>
        <p class="text-xs text-muted-foreground">These adapters stay active as runtime integrations: Claude, Codex, Gemini, Copilot, and OpenCode.</p>
      </div>
      <Badge variant="outline" class="text-[10px] uppercase tracking-[0.18em]">
        CLI adapters
      </Badge>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      {#each ['claude_local', 'codex_local', 'copilot_local', 'cursor', 'gemini_local', 'opencode_local'] as adapterType}
        <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium border-emerald-500/40 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <ProviderIcon adapterType={adapterType} size={16} />
          <span class="capitalize">{adapterType.replaceAll('_', ' ')}</span>
        </span>
      {/each}
    </div>
  </div>

  <div class="rounded-xl border border-border bg-card p-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">Adapter readiness</h2>
        <p class="text-xs text-muted-foreground">Install or update adapters from the declared commands.</p>
      </div>
      {#if readinessLoading}
        <span class="text-xs text-muted-foreground">Refreshing...</span>
      {/if}
    </div>
      <div class="mt-3 flex flex-wrap gap-2">
        {#each adapterReadiness.filter((entry) => !HIDDEN_ADAPTERS.includes(entry.adapterType)) as entry (entry.adapterType)}
          <div class="flex flex-wrap items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium {getAdapterReadinessStyle(entry)}">
            <span class="h-1.5 w-1.5 rounded-full {entry.needsInstall ? 'bg-red-500' : entry.needsUpdate ? 'bg-yellow-500' : 'bg-emerald-500'}"></span>
            <span>{entry.adapterType}</span>
          {#if entry.needsInstall}
            <span>install required</span>
          {:else if entry.needsUpdate}
            <span>update required</span>
          {:else}
            <span>ready</span>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <div class="rounded-xl border border-border bg-card p-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">Provider directory</h2>
        <p class="text-xs text-muted-foreground">Authenticate the provider, then use the `provider/model` format in the runtime.</p>
      </div>
      <Badge variant="outline" class="text-[10px] uppercase tracking-[0.18em]">
        {CREDENTIAL_PROVIDER_CARDS.length} providers
      </Badge>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-xl border border-border bg-muted/30 p-4">
        <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">1. Authenticate</p>
        <p class="mt-2 text-sm text-foreground">Add the API key or sign in with OAuth for the provider.</p>
      </div>
      <div class="rounded-xl border border-border bg-muted/30 p-4">
        <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">2. Select model</p>
        <p class="mt-2 text-sm text-foreground">Pick the model using the provider/model format.</p>
      </div>
      <div class="rounded-xl border border-border bg-muted/30 p-4">
        <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">3. Runtime monitors</p>
        <p class="mt-2 text-sm text-foreground">Only tested models enter the available set.</p>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each CREDENTIAL_PROVIDER_CARDS as provider (provider.provider)}
        <div class="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
          <div class="flex items-start gap-3">
            <div class="shrink-0 rounded-lg bg-muted p-2.5">
              <ProviderIcon adapterType={provider.provider} size={22} />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-foreground truncate">{provider.displayName}</h3>
              <p class="text-xs text-muted-foreground">{provider.provider}</p>
            </div>
            <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide {AUTH_STYLES[provider.authMethod]}">
              {provider.authMethod}
            </span>
          </div>

          <p class="mt-3 text-xs leading-5 text-muted-foreground">{provider.description}</p>

          <div class="mt-3 flex flex-wrap gap-1.5">
            {#each provider.envVars as envVar}
              <span class="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {envVar}
              </span>
            {/each}
          </div>

          <div class="mt-3 rounded-lg border border-border/70 bg-card/80 p-3">
            <p class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Model</p>
            <p class="mt-1 font-mono text-xs text-foreground">{provider.sampleModel}</p>
            <p class="mt-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Credential</p>
            <p class="mt-1 font-mono text-xs text-foreground">{provider.envVars[0]}</p>
          </div>

          <div class="mt-4 flex items-center justify-between gap-2">
            <span class="text-[10px] text-muted-foreground">Add the API key to enable this provider.</span>
            <Button size="sm" variant="outline" onclick={() => openCredentialSecretConfig(provider)}>
              Add API key
            </Button>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- ── Provider Summary Cards ──────────────────────────────────── -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each Array(4) as _}
        <div class="rounded-xl border border-border bg-card p-5">
          <div class="flex items-center gap-3">
            <Skeleton class="h-10 w-10 rounded-lg" />
            <div class="space-y-2">
              <Skeleton class="h-4 w-28" />
              <Skeleton class="h-3 w-20" />
            </div>
          </div>
          <div class="mt-4 space-y-2">
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-2 w-full rounded-full" />
          </div>
        </div>
      {/each}
    </div>
  {:else if providerSummaries.length === 0}
    <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16 px-6 text-center">
      <div class="rounded-2xl bg-blue-500/10 p-4 mb-4">
        <Server class="h-8 w-8 text-blue-500" />
      </div>
      <h2 class="text-lg font-semibold text-foreground mb-1">No providers configured</h2>
      <p class="max-w-md text-sm text-muted-foreground">
        Connect AI providers to enable model inference for your agents.
      </p>
    </div>
  {:else}
    <div class="rounded-xl border border-border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">Adapter readiness</h2>
          <p class="text-xs text-muted-foreground">Install/update status for registered adapters.</p>
        </div>
        {#if readinessLoading}
          <span class="text-xs text-muted-foreground">Refreshing...</span>
        {/if}
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        {#each adapterReadiness as entry (entry.adapterType)}
          <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium {getAdapterReadinessStyle(entry)}">
            <span class="h-1.5 w-1.5 rounded-full {entry.needsInstall ? 'bg-red-500' : entry.needsUpdate ? 'bg-yellow-500' : 'bg-emerald-500'}"></span>
            {entry.adapterType}
            {#if entry.needsInstall}
              install required
            {:else if entry.needsUpdate}
              update required
            {:else}
              ready
            {/if}
          </span>
        {/each}
      </div>
    </div>

    {#if providerCards.length === 0}
      <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16 px-6 text-center">
        <div class="rounded-2xl bg-blue-500/10 p-4 mb-4">
          <Server class="h-8 w-8 text-blue-500" />
        </div>
        <h2 class="text-lg font-semibold text-foreground mb-1">No provider cards available</h2>
        <p class="max-w-md text-sm text-muted-foreground">
          The current runtime has no visible provider summaries for this company.
        </p>
      </div>
    {:else}
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each providerCards as provider (provider.adapterType)}
        {@const total = provider.available + provider.cooldown + provider.unavailable}
        {@const barTotal = total || 1}
        <div class="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md">
            <div class="flex items-center gap-3">
              <div class="shrink-0 rounded-lg bg-muted p-2.5">
                <ProviderIcon adapterType={provider.adapterType} size={22} />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="text-sm font-semibold text-foreground truncate">{provider.displayName}</h3>
                <p class="text-xs text-muted-foreground">{provider.adapterType}</p>
              </div>
            {#if provider.cooldown > 0}
              <span class="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                <Timer class="h-3 w-3" />
                {provider.cooldown} cooldown
              </span>
            {/if}
            </div>

          {#if provider.authMethods?.length}
            <div class="mt-3 flex flex-wrap gap-1.5">
              {#each provider.authMethods as authMethod}
                <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide {AUTH_STYLES[authMethod]}">
                  {authMethod}
                </span>
              {/each}
            </div>
          {/if}
          {#if provider.authConfigurable}
            <p class="mt-2 text-[10px] text-muted-foreground">
              Supports multiple auth modes for this provider.
            </p>
          {/if}

          <!-- Status counts -->
          <div class="mt-4 flex items-center gap-3 text-xs">
            <span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              {provider.available}
            </span>
            <span class="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <span class="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
              {provider.cooldown}
            </span>
            <span class="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
              <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>
              {provider.unavailable}
            </span>
            <span class="ml-auto text-muted-foreground">{provider.totalModels} model{provider.totalModels !== 1 ? 's' : ''}</span>
          </div>

          <!-- Status bar -->
          <div class="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {#if provider.available > 0}
              <div
                class="h-full bg-emerald-500 transition-all duration-500"
                style="width: {(provider.available / barTotal) * 100}%"
              ></div>
            {/if}
            {#if provider.cooldown > 0}
              <div
                class="h-full bg-yellow-500 transition-all duration-500"
                style="width: {(provider.cooldown / barTotal) * 100}%"
              ></div>
            {/if}
            {#if provider.unavailable > 0}
              <div
                class="h-full bg-red-500 transition-all duration-500"
                style="width: {(provider.unavailable / barTotal) * 100}%"
              ></div>
            {/if}
          </div>
        </div>
      {/each}
      </div>
    {/if}
  {/if}

  <!-- ── Tabs Section ────────────────────────────────────────────────── -->
  <Tabs bind:value={activeTab} class="w-full">
    <TabsList class="rounded-lg">
      <TabsTrigger value="models">
        <Brain class="h-4 w-4" />
        Models
      </TabsTrigger>
      <TabsTrigger value="status">
        <Activity class="h-4 w-4" />
        Status
      </TabsTrigger>
    </TabsList>

    <!-- ── Tab 1: Models ───────────────────────────────────────────── -->
    <TabsContent value="models" class="mt-4 space-y-4">
      <!-- Filters -->
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search models..."
            class="pl-9"
            bind:value={modelSearch}
          />
        </div>
        <div class="flex items-center gap-2">
          <select
            bind:value={filterProvider}
            class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All Providers</option>
            {#each uniqueProviders as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
          <select
            bind:value={filterTier}
            class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All Tiers</option>
            <option value="premium">Premium</option>
            <option value="standard">Standard</option>
            <option value="budget">Budget</option>
            <option value="paid">Paid</option>
            <option value="free">Free</option>
          </select>
          <select
            bind:value={filterCapability}
            class="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          >
            <option value="all">All Capabilities</option>
            {#each uniqueCapabilities as cap}
              <option value={cap}>{cap}</option>
            {/each}
          </select>
          <button
            type="button"
            onclick={() => { hideUnavailable = !hideUnavailable; }}
            class="cursor-pointer flex items-center gap-1.5 h-9 rounded-md border px-3 text-xs font-medium transition-colors
              {hideUnavailable
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-input bg-background text-muted-foreground hover:text-foreground'}"
            title={hideUnavailable ? 'Showing only available models' : 'Showing all models including unavailable'}
          >
            {#if hideUnavailable}
              <Eye class="w-3.5 h-3.5" />
              Available only
            {:else}
              <ShieldOff class="w-3.5 h-3.5" />
              Show all
            {/if}
          </button>
        </div>
      </div>

      <!-- Model count -->
      {#if !modelsLoading && models.length > 0}
        <p class="text-xs text-muted-foreground">
          {#if filteredModels.length !== models.length}
            Showing {filteredModels.length} of {models.length} models
          {:else}
            {models.length} models
          {/if}
        </p>
      {/if}

      <!-- Models Table -->
      {#if modelsLoading}
        <div class="space-y-3">
          {#each Array(5) as _}
            <Skeleton class="h-14 w-full rounded-lg" />
          {/each}
        </div>
      {:else if filteredModels.length === 0}
        <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Brain class="h-8 w-8 text-muted-foreground mb-3" />
          <p class="text-sm text-muted-foreground">
            {models.length === 0 ? 'No models found. Try syncing models.' : 'No models match your filters.'}
          </p>
        </div>
      {:else}
        <div class="overflow-x-auto rounded-xl border border-border bg-card">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/50">
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provider</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tier</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Capabilities</th>
                <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Context</th>
                <th class="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pricing</th>
                <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Probed</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredModels as model (model.id)}
                {@const statusStyle = getStatusStyle(model.status)}
                {@const tierStyle = getTierStyle(model.tier)}
                {@const providerSummary = providerSummaries.find((p) => p.adapterType === model.adapterType)}
                {@const billing = inferBillingType(model.adapterType, providerSummary?.authMethods ?? [], providerSummary?.billingType)}
                {@const billingStyle = BILLING_STYLES[billing]}
                <tr class="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td class="px-4 py-3">
                    <div>
                      <span class="font-medium text-foreground">{model.label}</span>
                      <p class="text-xs text-muted-foreground font-mono mt-0.5">{model.modelId}</p>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      <ProviderIcon adapterType={model.adapterType} size={16} />
                      <span class="text-sm text-foreground">{model.providerName}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    {#if billing !== 'unknown'}
                      <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {billingStyle.bg} {billingStyle.text}">
                        {billingStyle.label}
                      </span>
                    {:else}
                      <span class="text-xs text-muted-foreground">{billingStyle.label}</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3">
                    <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium {tierStyle.bg} {tierStyle.text}">
                      {model.tier}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      {#each model.capabilities ?? [] as cap}
                        <span class="inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-medium {CAPABILITY_STYLES[cap] ?? 'bg-gray-500/10 text-gray-500'}">
                          {cap}
                        </span>
                      {/each}
                      {#if !model.capabilities || model.capabilities.length === 0}
                        <span class="text-xs text-muted-foreground">--</span>
                      {/if}
                    </div>
                  </td>
                  <td class="px-4 py-3 text-right font-mono text-xs text-foreground">
                    {formatContextWindow(model.contextWindow)}
                  </td>
                  <td class="px-4 py-3 text-center">
                    {#if model.status === 'cooldown' && model.cooldownEndsAt}
                      {@const remaining = Math.max(0, new Date(model.cooldownEndsAt).getTime() - now)}
                      {#if remaining > 0}
                        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
                          <span class="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
                          Cooldown {formatCooldownRemaining(model.cooldownEndsAt, now)}
                        </span>
                      {:else}
                        <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {statusStyle.bg} {statusStyle.text}">
                          <span class="h-1.5 w-1.5 rounded-full {statusStyle.dot}"></span>
                          {statusStyle.label}
                        </span>
                      {/if}
                    {:else}
                      <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {statusStyle.bg} {statusStyle.text}">
                        <span class="h-1.5 w-1.5 rounded-full {statusStyle.dot}"></span>
                        {statusStyle.label}
                      </span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatPricing(model)}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <TimeAgo date={model.lastProbed} class="text-xs" />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="text-xs text-muted-foreground">
          Showing {filteredModels.length} of {models.length} models
        </p>
      {/if}
    </TabsContent>

    <!-- ── Tab 2: Status ───────────────────────────────────────────── -->
    <TabsContent value="status" class="mt-4 space-y-4">
      {#if statusLoading}
        <div class="space-y-4">
          {#each Array(3) as _}
            <div class="rounded-xl border border-border bg-card p-5">
              <Skeleton class="h-5 w-40 mb-4" />
              <div class="space-y-3">
                {#each Array(3) as __}
                  <Skeleton class="h-10 w-full rounded-lg" />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else if providerStatuses.length === 0}
        <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Activity class="h-8 w-8 text-muted-foreground mb-3" />
          <p class="text-sm text-muted-foreground">No provider status data available.</p>
        </div>
      {:else}
        {#each providerStatuses.filter((p) => !HIDDEN_ADAPTERS.includes(p.adapterType) && (!hideUnavailable || p.models.some((m) => m.status !== 'unavailable'))) as provider (provider.adapterType)}
          <div class="rounded-xl border border-border bg-card overflow-hidden">
            <div class="flex items-center gap-3 px-5 pt-5 pb-3">
              <ProviderIcon adapterType={provider.adapterType} size={20} />
              <h3 class="text-sm font-semibold text-foreground">{provider.displayName}</h3>
              <span class="text-xs text-muted-foreground">{provider.models.length} model{provider.models.length !== 1 ? 's' : ''}</span>
            </div>

            {#if provider.models.length === 0}
              <div class="px-5 pb-5">
                <p class="text-xs text-muted-foreground italic">No models registered for this provider.</p>
              </div>
            {:else}
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-y border-border bg-muted/50">
                      <th class="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th class="px-5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model</th>
                      <th class="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latency</th>
                      <th class="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Error Rate</th>
                      <th class="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Failures</th>
                      <th class="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Last Probed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each provider.models as model (model.modelId)}
                      {@const statusStyle = getStatusStyle(model.status)}
                      <tr class="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                        <td class="px-5 py-3">
                          <span class="inline-flex items-center gap-1.5">
                            <span class="h-2 w-2 rounded-full {statusStyle.dot}"></span>
                            <span class="text-xs font-medium {statusStyle.text}">{statusStyle.label}</span>
                          </span>
                          {#if model.statusDetail?.includes('PONG')}
                            <span class="ml-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/20">
                              <CheckCircle class="w-2.5 h-2.5" />
                              Passed
                            </span>
                          {/if}
                          {#if model.cooldownEndsAt && model.status === 'cooldown'}
                            {@const remaining = Math.max(0, new Date(model.cooldownEndsAt).getTime() - now)}
                            {#if remaining > 0}
                              <p class="text-[10px] text-yellow-600 dark:text-yellow-400 mt-0.5 flex items-center gap-1">
                                <span class="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                {formatCooldownRemaining(model.cooldownEndsAt, now)} remaining
                              </p>
                            {:else}
                              <p class="text-[10px] text-yellow-500 mt-0.5">
                                Cooldown expired
                              </p>
                            {/if}
                            {#if model.cooldownReason}
                              <p class="text-[10px] text-muted-foreground mt-0.5">
                                Reason: <span class="font-mono">{model.cooldownReason}</span>
                              </p>
                            {/if}
                            {#if model.statusChangedAt}
                              <p class="text-[10px] text-muted-foreground mt-0.5">
                                Since: <TimeAgo date={model.statusChangedAt} class="text-[10px]" />
                              </p>
                            {/if}
                          {/if}
                        </td>
                        <td class="px-5 py-3">
                          <span class="font-medium text-foreground">{model.modelName}</span>
                        </td>
                        <td class="px-5 py-3 text-right font-mono text-xs text-foreground">
                          {model.avgLatencyMs != null ? `${model.avgLatencyMs.toFixed(0)}ms` : '--'}
                        </td>
                        <td class="px-5 py-3 text-right font-mono text-xs {(model.errorRate ?? 0) > 0.1 ? 'text-red-500' : 'text-foreground'}">
                          {model.errorRate != null ? `${(model.errorRate * 100).toFixed(1)}%` : '--'}
                        </td>
                        <td class="px-5 py-3 text-right font-mono text-xs {model.consecutiveFailures > 0 ? 'text-red-500' : 'text-foreground'}">
                          {model.consecutiveFailures}
                        </td>
                        <td class="px-5 py-3 text-right">
                          <TimeAgo date={model.lastProbed} class="text-xs" />
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </TabsContent>

    <!-- routing and routing-log sections removed to keep this page runtime-only -->
  </Tabs>
</div>
</PageLayout>

<style>
  .providers-root {
    max-width: 1400px;
    margin: 0 auto;
  }
</style>
