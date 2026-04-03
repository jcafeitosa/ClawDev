<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount, onDestroy } from 'svelte';
  import { Skeleton, Badge, Input, Button } from '$lib/components/ui/index.js';
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '$lib/components/ui/index.js';
  import ProviderIcon from '$lib/components/providers/provider-icon.svelte';
  import TimeAgo from '$lib/components/time-ago.svelte';
  import {
    RefreshCw,
    Search,
    Brain,
    Activity,
    Route,
    ScrollText,
    CircleDot,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Clock,
    Loader2,
    Server,
    Zap,
    DollarSign,
    Eye,
    Code,
    MessageSquare,
    Sparkles,
    Save,
    GripVertical,
    ArrowDown,
    ArrowUp,
    ToggleLeft,
    ToggleRight,
    Filter,
    Timer,
    ShieldOff,
    ShieldCheck,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Providers & Models' }]));

  // ── Types ───────────────────────────────────────────────────────────
  interface ProviderSummary {
    adapterType: string;
    displayName: string;
    available: number;
    cooldown: number;
    unavailable: number;
    totalModels: number;
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

  interface ModelPreferences {
    defaultAdapterType: string;
    defaultModelId: string;
    fallbackChain: string[];
    routingStrategy: string;
    allowCrossProviderFallback: boolean;
    preferFreeModels: boolean;
    preferLocalModels: boolean;
  }

  interface RoutingLogEntry {
    timestamp: string;
    agentName: string;
    requestedModel: string;
    resolvedModel: string;
    resolutionType: string;
    fallbackDepth: number;
    reason: string;
  }

  // ── State ───────────────────────────────────────────────────────────
  let loading = $state(true);
  let syncing = $state(false);
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

  // Status tab
  let providerStatuses = $state<ProviderStatus[]>([]);
  let statusLoading = $state(true);

  // Routing tab
  let preferences = $state<ModelPreferences>({
    defaultAdapterType: '',
    defaultModelId: '',
    fallbackChain: [],
    routingStrategy: 'pinned',
    allowCrossProviderFallback: true,
    preferFreeModels: false,
    preferLocalModels: false,
  });
  let preferencesLoading = $state(true);
  let savingPreferences = $state(false);
  let preferencesSaved = $state(false);

  // Routing log tab
  let routingLog = $state<RoutingLogEntry[]>([]);
  let routingLogLoading = $state(true);

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

  // Cooldown control state
  let cooldownFormOpen = $state<string | null>(null); // modelId of open form
  let cooldownDuration = $state(5);
  let cooldownApplying = $state(false);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // ── Derived: filtered models ─────────────────────────────────────
  let filteredModels = $derived.by(() => {
    let result = models;
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

  const HIDDEN_ADAPTERS = ['process', 'http'];
  let uniqueProviders = $derived(
    [...new Set(models.map((m) => m.adapterType))].filter((a) => !HIDDEN_ADAPTERS.includes(a)).sort(),
  );
  let uniqueCapabilities = $derived(
    [...new Set(models.flatMap((m) => m.capabilities ?? []))].sort(),
  );

  // All available model IDs for dropdown
  let allModelIds = $derived(models.map((m) => m.modelId).filter(Boolean));
  let routingProviders = $derived([
    ...new Map(providerSummaries.map((provider) => [provider.adapterType, provider])).values(),
  ]);
  let routingModels = $derived.by(() => {
    const filtered = preferences.defaultAdapterType
      ? models.filter((model) => model.adapterType === preferences.defaultAdapterType)
      : models;
    return [...filtered].sort((a, b) => a.modelId.localeCompare(b.modelId));
  });
  $effect(() => {
    if (!preferences.defaultAdapterType || !preferences.defaultModelId) return;
    const valid = models.some(
      (model) =>
        model.adapterType === preferences.defaultAdapterType &&
        model.modelId === preferences.defaultModelId,
    );
    if (!valid) {
      preferences.defaultModelId = '';
    }
  });

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
        totalModels: p.totalCatalog ?? p.total ?? 0,
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
        status: (m.circuitState && m.circuitState !== 'unknown') ? m.circuitState : (m.status && m.status !== 'unknown') ? m.status : 'available',
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
          status: (m.status && m.status !== 'unknown') ? m.status : (m.circuitState && m.circuitState !== 'unknown') ? m.circuitState : 'available',
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

  async function loadPreferences() {
    if (!companyId) return;
    preferencesLoading = true;
    try {
      const data = await safeFetch<any>(`/api/companies/${companyId}/model-preferences`, null);
      if (data) {
        preferences = {
          defaultAdapterType: data.defaultAdapterType ?? '',
          defaultModelId: data.defaultModelId ?? data.defaultModel ?? '',
          fallbackChain: data.fallbackChain ?? [],
          routingStrategy: data.routingStrategy ?? 'pinned',
          allowCrossProviderFallback: data.allowCrossProviderFallback ?? true,
          preferFreeModels: data.preferFreeModels ?? false,
          preferLocalModels: data.preferLocalModels ?? false,
        };
      }
    } catch {
      // keep defaults
    } finally {
      preferencesLoading = false;
    }
  }

  async function loadRoutingLog() {
    if (!companyId) return;
    routingLogLoading = true;
    try {
      const data = await safeFetch<any>(`/api/companies/${companyId}/model-routing-log`, []);
      const raw = Array.isArray(data) ? data : data?.data ?? data?.entries ?? data?.items ?? [];
      routingLog = raw.map((e: any) => ({
        timestamp: e.timestamp ?? e.createdAt ?? '',
        agentName: e.agentName ?? e.agent ?? '',
        requestedModel: e.requestedModel ?? e.requested ?? '',
        resolvedModel: e.resolvedModel ?? e.resolved ?? '',
        resolutionType: e.resolutionType ?? e.type ?? '',
        fallbackDepth: e.fallbackDepth ?? e.depth ?? 0,
        reason: e.reason ?? '',
      }));
    } catch {
      routingLog = [];
    } finally {
      routingLogLoading = false;
    }
  }

  // ── Load on companyId change ──────────────────────────────────────
  $effect(() => {
    if (!companyId) return;
    loading = true;
    loadProviderSummaries();
    loadModels();
  });

  // ── Tab-driven lazy loading ───────────────────────────────────────
  $effect(() => {
    if (!companyId) return;
    if (activeTab === 'status' && providerStatuses.length === 0) loadProviderStatuses();
    if (activeTab === 'routing') loadPreferences();
    if (activeTab === 'routing-log' && routingLog.length === 0) loadRoutingLog();
  });

  onMount(() => {
    refreshInterval = setInterval(() => {
      if (companyId) {
        loadProviderSummaries();
        if (activeTab === 'models') loadModels();
        if (activeTab === 'status') loadProviderStatuses();
      }
    }, 30_000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
  });

  // ── Actions ───────────────────────────────────────────────────────
  async function syncModels() {
    if (!companyId) return;
    syncing = true;
    try {
      await api(`/api/models/sync`, { method: 'POST' });
      await loadModels();
      await loadProviderSummaries();
    } catch {
      // silently fail
    } finally {
      syncing = false;
    }
  }

  async function savePreferences() {
    if (!companyId) return;
    savingPreferences = true;
    preferencesSaved = false;
    try {
      await api(`/api/companies/${companyId}/model-preferences`, {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });
      preferencesSaved = true;
      setTimeout(() => (preferencesSaved = false), 3000);
    } catch {
      // silently fail
    } finally {
      savingPreferences = false;
    }
  }

  function moveFallback(index: number, direction: 'up' | 'down') {
    const chain = [...preferences.fallbackChain];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= chain.length) return;
    [chain[index], chain[target]] = [chain[target], chain[index]];
    preferences.fallbackChain = chain;
  }

  function removeFallback(index: number) {
    preferences.fallbackChain = preferences.fallbackChain.filter((_, i) => i !== index);
  }

  function addFallback(modelId: string) {
    if (modelId && !preferences.fallbackChain.includes(modelId)) {
      preferences.fallbackChain = [...preferences.fallbackChain, modelId];
    }
  }

  // ── Cooldown controls ──────────────────────────────────────────────
  async function applyCooldown(adapterType: string, modelId: string, durationMinutes: number) {
    cooldownApplying = true;
    try {
      await api(`/api/providers/${adapterType}/models/${encodeURIComponent(modelId)}/cooldown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes }),
      });
      cooldownFormOpen = null;
      cooldownDuration = 5;
      await loadProviderStatuses();
      await loadProviderSummaries();
    } catch {
      // silently fail
    } finally {
      cooldownApplying = false;
    }
  }

  async function clearCooldown(adapterType: string, modelId: string) {
    try {
      await api(`/api/providers/${adapterType}/models/${encodeURIComponent(modelId)}/cooldown`, {
        method: 'DELETE',
      });
      await loadProviderStatuses();
      await loadProviderSummaries();
    } catch {
      // silently fail
    }
  }

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
    unknown: { dot: 'bg-sky-400', bg: 'bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', label: 'Discovered' },
  };

  function getStatusStyle(status: string) {
    return STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
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

  const ROUTING_STRATEGIES = [
    { value: 'pinned', label: 'Pinned', description: 'Always use the default model' },
    { value: 'cost_optimized', label: 'Cost Optimized', description: 'Prefer the cheapest available model' },
    { value: 'performance_optimized', label: 'Performance', description: 'Prefer the fastest available model' },
    { value: 'availability_optimized', label: 'Availability', description: 'Prefer the most reliable model' },
    { value: 'local_preferred', label: 'Local Preferred', description: 'Prefer locally-run models when available' },
  ];

  // ── Billing type inference ─────────────────────────────────────
  type BillingType = 'subscription' | 'api' | 'unknown';

  const BILLING_STYLES: Record<BillingType, { bg: string; text: string; label: string }> = {
    subscription: { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', label: 'Subscription' },
    api: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', label: 'API' },
    unknown: { bg: '', text: '', label: '\u2014' },
  };

  function inferBillingType(adapterType: string, tier: string): BillingType {
    switch (adapterType) {
      case 'copilot_local':
        return 'subscription';
      case 'opencode_local':
        return tier === 'free' ? 'api' : 'subscription';
      case 'pi_local':
        return 'api';
      case 'claude_local':
      case 'codex_local':
      case 'gemini_local':
        return tier === 'free' || tier === 'premium' ? 'subscription' : 'api';
      default:
        if (adapterType.endsWith('_local')) return 'subscription';
        return 'api';
    }
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

  // New fallback model to add
  let newFallbackModel = $state('');
</script>

<div class="providers-root space-y-6 p-6">
  <!-- ── Header ────────────────────────────────────────────────────── -->
  <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Providers & Models</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage AI providers, monitor model availability, and configure routing</p>
    </div>
    <div class="flex items-center gap-2">
      {#if lastRefreshed}
        <span class="text-xs text-muted-foreground">Updated: {lastRefreshed.toLocaleTimeString()}</span>
      {/if}
      <Button
        variant="outline"
        size="sm"
        onclick={() => { if (companyId) { loadProviderSummaries(); loadModels(); } }}
      >
        <RefreshCw class="h-3.5 w-3.5" />
        Refresh
      </Button>
      <Button
        size="sm"
        onclick={syncModels}
        disabled={syncing}
      >
        {#if syncing}
          <Loader2 class="h-3.5 w-3.5 animate-spin" />
          Syncing...
        {:else}
          <RefreshCw class="h-3.5 w-3.5" />
          Sync Models
        {/if}
      </Button>
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
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each providerSummaries as provider (provider.adapterType)}
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
      <TabsTrigger value="routing">
        <Route class="h-4 w-4" />
        Routing
      </TabsTrigger>
      <TabsTrigger value="routing-log">
        <ScrollText class="h-4 w-4" />
        Routing Log
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
                {@const billing = inferBillingType(model.adapterType, model.tier)}
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
        {#each providerStatuses as provider (provider.adapterType)}
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
                      <th class="px-5 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
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
                        <td class="px-5 py-3 text-right">
                          <div class="flex items-center justify-end gap-1.5">
                            {#if model.status === 'cooldown'}
                              <button
                                onclick={() => clearCooldown(model.adapterType, model.modelId)}
                                class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                title="Clear cooldown"
                              >
                                <ShieldCheck class="h-3 w-3" />
                                Clear
                              </button>
                            {:else}
                              {#if cooldownFormOpen === model.modelId}
                                <div class="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="1"
                                    max="1440"
                                    bind:value={cooldownDuration}
                                    class="h-7 w-16 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
                                    placeholder="min"
                                  />
                                  <span class="text-[10px] text-muted-foreground">min</span>
                                  <button
                                    onclick={() => applyCooldown(model.adapterType, model.modelId, cooldownDuration)}
                                    disabled={cooldownApplying}
                                    class="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 px-2 py-1 text-[11px] font-medium text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
                                  >
                                    {#if cooldownApplying}
                                      <Loader2 class="h-3 w-3 animate-spin" />
                                    {:else}
                                      <Timer class="h-3 w-3" />
                                    {/if}
                                    Apply
                                  </button>
                                  <button
                                    onclick={() => { cooldownFormOpen = null; cooldownDuration = 5; }}
                                    class="inline-flex items-center rounded-md px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <XCircle class="h-3 w-3" />
                                  </button>
                                </div>
                              {:else}
                                <button
                                  onclick={() => { cooldownFormOpen = model.modelId; cooldownDuration = 5; }}
                                  class="inline-flex items-center gap-1 rounded-md bg-yellow-500/10 px-2 py-1 text-[11px] font-medium text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                                  title="Set cooldown"
                                >
                                  <ShieldOff class="h-3 w-3" />
                                  Cooldown
                                </button>
                              {/if}
                            {/if}
                          </div>
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

    <!-- ── Tab 3: Routing ──────────────────────────────────────────── -->
    <TabsContent value="routing" class="mt-4 space-y-6">
      {#if preferencesLoading}
        <div class="space-y-4">
          <Skeleton class="h-12 w-full rounded-lg" />
          <Skeleton class="h-40 w-full rounded-lg" />
          <Skeleton class="h-24 w-full rounded-lg" />
        </div>
      {:else}
        <!-- Default Model -->
        <div class="rounded-xl border border-border bg-card p-5">
          <h3 class="text-sm font-semibold text-foreground mb-3">Default Provider & Model</h3>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label for="default-provider" class="mb-1.5 block text-xs font-medium text-muted-foreground">Provider</label>
              <select
                id="default-provider"
                bind:value={preferences.defaultAdapterType}
                class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">-- Use requested provider --</option>
                {#each routingProviders as provider}
                  <option value={provider.adapterType}>{provider.displayName}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="default-model" class="mb-1.5 block text-xs font-medium text-muted-foreground">Model</label>
              <select
                id="default-model"
                bind:value={preferences.defaultModelId}
                class="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">-- Select default model --</option>
                {#each routingModels as model}
                  <option value={model.modelId}>{model.label} ({model.modelId})</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Fallback Chain -->
        <div class="rounded-xl border border-border bg-card p-5">
          <h3 class="text-sm font-semibold text-foreground mb-3">Fallback Chain</h3>
          <p class="text-xs text-muted-foreground mb-4">
            When the default model is unavailable, these models are tried in order.
          </p>

          {#if preferences.fallbackChain.length === 0}
            <p class="text-xs text-muted-foreground italic mb-4">No fallback models configured.</p>
          {:else}
            <div class="space-y-2 mb-4">
              {#each preferences.fallbackChain as modelId, i (modelId + '-' + i)}
                <div class="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <GripVertical class="h-4 w-4 text-muted-foreground shrink-0" />
                  <span class="text-xs font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <span class="text-sm font-mono text-foreground flex-1 truncate">{modelId}</span>
                  <button
                    onclick={() => moveFallback(i, 'up')}
                    disabled={i === 0}
                    class="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp class="h-3.5 w-3.5" />
                  </button>
                  <button
                    onclick={() => moveFallback(i, 'down')}
                    disabled={i === preferences.fallbackChain.length - 1}
                    class="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown class="h-3.5 w-3.5" />
                  </button>
                  <button
                    onclick={() => removeFallback(i)}
                    class="p-1 text-red-500 hover:text-red-600 transition-colors"
                  >
                    <XCircle class="h-3.5 w-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="flex items-center gap-2">
            <select
              bind:value={newFallbackModel}
              class="h-9 flex-1 max-w-sm rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            >
              <option value="">-- Add model to fallback chain --</option>
              {#each allModelIds.filter((id) => !preferences.fallbackChain.includes(id)) as modelId}
                <option value={modelId}>{modelId}</option>
              {/each}
            </select>
            <Button
              variant="outline"
              size="sm"
              onclick={() => { addFallback(newFallbackModel); newFallbackModel = ''; }}
              disabled={!newFallbackModel}
            >
              Add
            </Button>
          </div>
        </div>

        <!-- Routing Strategy -->
        <div class="rounded-xl border border-border bg-card p-5">
          <h3 class="text-sm font-semibold text-foreground mb-3">Routing Strategy</h3>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {#each ROUTING_STRATEGIES as strategy}
              <label
                class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors {preferences.routingStrategy === strategy.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}"
              >
                <input
                  type="radio"
                  name="routing-strategy"
                  value={strategy.value}
                  bind:group={preferences.routingStrategy}
                  class="mt-0.5 accent-primary"
                />
                <div>
                  <span class="text-sm font-medium text-foreground">{strategy.label}</span>
                  <p class="text-xs text-muted-foreground mt-0.5">{strategy.description}</p>
                </div>
              </label>
            {/each}
          </div>
        </div>

        <!-- Toggle Switches -->
        <div class="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 class="text-sm font-semibold text-foreground mb-1">Options</h3>

          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-sm text-foreground">Allow cross-provider fallback</span>
              <p class="text-xs text-muted-foreground">When a model is unavailable, try models from other providers</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.allowCrossProviderFallback}
              aria-label="Allow cross-provider fallback"
              title="Allow cross-provider fallback"
              onclick={() => preferences.allowCrossProviderFallback = !preferences.allowCrossProviderFallback}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {preferences.allowCrossProviderFallback ? 'bg-primary' : 'bg-muted'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 {preferences.allowCrossProviderFallback ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </label>

          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-sm text-foreground">Prefer free models</span>
              <p class="text-xs text-muted-foreground">Prioritize models with no usage cost</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.preferFreeModels}
              aria-label="Prefer free models"
              title="Prefer free models"
              onclick={() => preferences.preferFreeModels = !preferences.preferFreeModels}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {preferences.preferFreeModels ? 'bg-primary' : 'bg-muted'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 {preferences.preferFreeModels ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </label>

          <label class="flex items-center justify-between cursor-pointer">
            <div>
              <span class="text-sm text-foreground">Prefer local models</span>
              <p class="text-xs text-muted-foreground">Prioritize locally-hosted models when available</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.preferLocalModels}
              aria-label="Prefer local models"
              title="Prefer local models"
              onclick={() => preferences.preferLocalModels = !preferences.preferLocalModels}
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {preferences.preferLocalModels ? 'bg-primary' : 'bg-muted'}"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 {preferences.preferLocalModels ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </label>
        </div>

        <!-- Save Button -->
        <div class="flex items-center gap-3">
          <Button onclick={savePreferences} disabled={savingPreferences}>
            {#if savingPreferences}
              <Loader2 class="h-4 w-4 animate-spin" />
              Saving...
            {:else}
              <Save class="h-4 w-4" />
              Save Preferences
            {/if}
          </Button>
          {#if preferencesSaved}
            <span class="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle class="h-3.5 w-3.5" />
              Preferences saved
            </span>
          {/if}
        </div>
      {/if}
    </TabsContent>

    <!-- ── Tab 4: Routing Log ──────────────────────────────────────── -->
      <TabsContent value="routing-log" class="mt-4 space-y-4">
      {#if routingLogLoading}
        <div class="space-y-3">
          {#each Array(5) as _}
            <Skeleton class="h-12 w-full rounded-lg" />
          {/each}
        </div>
      {:else if routingLog.length === 0}
        <div class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <ScrollText class="h-8 w-8 text-muted-foreground mb-3" />
          <p class="text-sm text-muted-foreground">No routing decisions recorded yet.</p>
          <p class="text-xs text-muted-foreground mt-1">Routing log entries appear when agents make model requests.</p>
        </div>
      {:else}
        <div class="overflow-x-auto rounded-xl border border-border bg-card">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-border bg-muted/50">
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Time</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requested</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolved</th>
                <th class="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</th>
                <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Depth</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reason</th>
              </tr>
            </thead>
            <tbody>
              {#each routingLog as entry, i (entry.timestamp + '-' + i)}
                <tr class="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td class="px-4 py-3">
                    <TimeAgo date={entry.timestamp} class="text-xs" />
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-sm font-medium text-foreground">{entry.agentName || '--'}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-mono text-muted-foreground">{entry.requestedModel || '--'}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs font-mono text-foreground">{entry.resolvedModel || '--'}</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    {#if entry.resolutionType}
                      <span class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium {RESOLUTION_STYLES[entry.resolutionType] ?? 'bg-gray-500/10 text-gray-500'}">
                        {entry.resolutionType}
                      </span>
                    {:else}
                      <span class="text-xs text-muted-foreground">--</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-right font-mono text-xs text-foreground">
                    {entry.fallbackDepth}
                  </td>
                  <td class="px-4 py-3">
                    <span class="text-xs text-muted-foreground truncate max-w-[200px] inline-block" title={entry.reason}>
                      {entry.reason || '--'}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <p class="text-xs text-muted-foreground">
          Showing {routingLog.length} recent routing decisions
        </p>
      {/if}
    </TabsContent>
  </Tabs>
</div>

<style>
  .providers-root {
    max-width: 1400px;
    margin: 0 auto;
  }
</style>
