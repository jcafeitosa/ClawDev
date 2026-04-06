<script lang="ts">
  /**
   * AgentConfigForm — comprehensive agent configuration form that adapts
   * its fields based on the selected adapter type.
   *
   * Usage:
   *   <AgentConfigForm adapterType="claude_local" bind:config mode="create" />
   */
  import {
    FolderOpen,
    ChevronDown,
    Info,
    Terminal,
    Settings,
    ShieldAlert,
    Loader2,
    Search,
    AlertTriangle,
    CheckCircle2,
    XCircle,
  } from "lucide-svelte";
  import { api } from "$lib/api";
  import type {
    AdapterEnvironmentTestResult,
  } from "@clawdev/shared";

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------
  interface Props {
    adapterType: string;
    companyId?: string | null;
    config: Record<string, any>;
    mode: "create" | "edit";
    showModelControls?: boolean;
  }

  interface AdapterModel {
    id: string;
    label: string;
    status?: string;
    statusDetail?: string;
    provider?: string;
    probedAt?: string;
  }

  let { adapterType, companyId = null, config = $bindable({}), mode, showModelControls = true }: Props = $props();

  // ---------------------------------------------------------------------------
  // Adapter metadata
  // ---------------------------------------------------------------------------
  const LOCAL_ADAPTERS = [
    "claude_local",
    "codex_local",
    "copilot_local",
    "cursor",
    "gemini_local",
    "pi_local",
    "opencode_local",
  ];

  const isLocal = $derived(LOCAL_ADAPTERS.includes(adapterType));
  const MODEL_DISCOVERY_ADAPTERS = new Set([
    "claude_local",
    "codex_local",
    "copilot_local",
    "cursor",
    "gemini_local",
    "opencode_local",
    "pi_local",
  ]);
  const TESTABLE_ADAPTERS = new Set([
    "claude_local",
    "codex_local",
    "copilot_local",
    "cursor",
    "gemini_local",
    "opencode_local",
    "pi_local",
    "openclaw_gateway",
    "process",
    "http",
  ]);
  const MODEL_FILTERS: Partial<Record<string, { providers?: string[]; idPrefix?: string }>> = {
    claude_local: { providers: ["anthropic"] },
    codex_local: { providers: ["openai"] },
    gemini_local: { providers: ["google"] },
    opencode_local: { idPrefix: "opencode/" },
    // copilot_local: no filter — supports all providers (anthropic, openai, google)
    // cursor: no filter — supports all providers
    // pi_local: no filter — user specifies provider/model format
  };
  const MODEL_PROVIDER_LABELS: Record<string, string> = {
    claude_local: "Anthropic",
    codex_local: "OpenAI",
    gemini_local: "Google",
    opencode_local: "OpenCode",
    copilot_local: "All Providers",
    cursor: "All Providers",
    pi_local: "Pi",
  };
  const isModelDiscoveryAdapter = $derived(Boolean(companyId) && MODEL_DISCOVERY_ADAPTERS.has(adapterType));
  const isEnvironmentTestableAdapter = $derived(Boolean(companyId) && TESTABLE_ADAPTERS.has(adapterType));

  let adapterModels = $state<AdapterModel[]>([]);
  let adapterModelsLoading = $state(false);
  let adapterModelsError = $state<string | null>(null);
  let modelSearch = $state("");
  let adapterEnvResult = $state<AdapterEnvironmentTestResult | null>(null);
  let adapterEnvError = $state<string | null>(null);
  let adapterEnvLoading = $state(false);
  let unsetAnthropicLoading = $state(false);

  const filteredModels = $derived(
    adapterModels.filter((entry) => {
      const query = modelSearch.trim().toLowerCase();
      if (!query) return true;
      return (
        entry.id.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query) ||
        (entry.provider ?? "").toLowerCase().includes(query)
      );
    }),
  );
  const selectedModel = $derived(
    adapterModels.find((entry) => entry.id === (typeof config.model === "string" ? config.model : "")) ?? null,
  );
  const shouldSuggestUnsetAnthropicApiKey = $derived(
    adapterType === "claude_local" &&
      adapterEnvResult?.status === "fail" &&
      (adapterEnvResult?.checks.some((check) => check.code === "claude_anthropic_api_key_overrides_subscription") ?? false),
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function ensure(key: string, fallback: any = ""): void {
    if (config[key] === undefined) config[key] = fallback;
  }

  function normalizeClaudeModel(model: unknown): string {
    if (typeof model !== "string") return "claude-sonnet-4-6";
    const trimmed = model.trim();
    return trimmed && trimmed !== "auto" ? trimmed : "claude-sonnet-4-6";
  }

  function setField(key: string, value: any): void {
    config[key] = value;
    config = config; // trigger reactivity
  }

  function toggleField(key: string): void {
    config[key] = !config[key];
    config = config;
  }

  function filterAdapterModels(models: AdapterModel[]): AdapterModel[] {
    const filter = MODEL_FILTERS[adapterType];
    if (!filter) return models;
    return models.filter((model) => {
      if (filter.providers && filter.providers.length > 0) {
        const provider = (model.provider ?? "").toLowerCase();
        if (!filter.providers.includes(provider)) return false;
      }
      if (filter.idPrefix && !model.id.toLowerCase().startsWith(filter.idPrefix.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  function getAdapterModelSourceLabel() {
    return MODEL_PROVIDER_LABELS[adapterType] ?? adapterType;
  }

  // Initialize defaults when adapter changes
  $effect(() => {
    void adapterType;
    initDefaults();
  });

  function initDefaults(): void {
    switch (adapterType) {
      case "claude_local":
        ensure("cwd");
        config.model = normalizeClaudeModel(config.model);
        ensure("effort", "medium");
        ensure("maxTurnsPerRun", 25);
        ensure("dangerouslySkipPermissions", false);
        ensure("instructionsFilePath");
        break;
      case "codex_local":
        ensure("cwd");
        ensure("model", "gpt-5.4-mini");
        ensure("modelReasoningEffort", "medium");
        ensure("search", false);
        ensure("dangerouslyBypassApprovalsAndSandbox", false);
        ensure("skipGitRepoCheck", true);
        break;
      case "copilot_local":
        ensure("cwd");
        ensure("model");
        ensure("effort", "medium");
        ensure("command", "copilot");
        ensure("configDir");
        break;
      case "cursor":
        ensure("cwd");
        ensure("model", "auto");
        ensure("mode", "plan");
        break;
      case "gemini_local":
        ensure("cwd");
        ensure("model", "gemini-2.5-pro");
        ensure("sandbox", false);
        break;
      case "pi_local":
        ensure("cwd");
        ensure("model");
        ensure("thinking", "medium");
        break;
      case "opencode_local":
        ensure("cwd");
        break;
      case "openclaw_gateway":
        ensure("url", "wss://");
        ensure("authToken");
        ensure("sessionKeyStrategy", "issue");
        break;
      case "process":
        ensure("command");
        ensure("args", "");
        ensure("cwd");
        break;
      case "http":
        ensure("url", "https://");
        ensure("method", "POST");
        ensure("headers", "{}");
        break;
    }

    // Common fields for local adapters
    if (isLocal) {
      ensure("instructionsFilePath");
      ensure("promptTemplate");
    }
  }

  async function loadAdapterModels(): Promise<void> {
    if (!showModelControls || !companyId || !isModelDiscoveryAdapter) {
      adapterModels = [];
      adapterModelsError = null;
      adapterModelsLoading = false;
      return;
    }
    adapterModelsLoading = true;
    adapterModelsError = null;
    try {
      const res = await api(`/api/companies/${companyId}/adapters/${adapterType}/models`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Failed to load ${adapterType} models (${res.status})`);
      }
      const data = await res.json();
      const rawModels = Array.isArray(data) ? data : data.models ?? [];
      adapterModels = filterAdapterModels(Array.isArray(rawModels) ? rawModels : []);
    } catch (err) {
      adapterModels = [];
      adapterModelsError = err instanceof Error ? err.message : "Failed to load adapter models";
    } finally {
      adapterModelsLoading = false;
    }
  }

  async function detectAdapterModel(): Promise<void> {
    if (!showModelControls || !companyId || !isModelDiscoveryAdapter) return;
    adapterModelsLoading = true;
    adapterModelsError = null;
    try {
      const res = await api(`/api/companies/${companyId}/adapters/${adapterType}/detect-model`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Failed to detect ${adapterType} model (${res.status})`);
      }
      const text = await res.text();
      const detected = text ? JSON.parse(text) : null;
      if (detected?.model) {
        setField("model", detected.model);
      } else {
        adapterModelsError = "No model detected — adapter may not support auto-detection.";
      }
    } catch (err) {
      adapterModelsError = err instanceof Error ? err.message : "Failed to detect model";
    } finally {
      adapterModelsLoading = false;
    }
  }

  async function runAdapterEnvironmentTest(adapterConfigOverride?: Record<string, unknown>): Promise<AdapterEnvironmentTestResult | null> {
    if (!companyId || !isEnvironmentTestableAdapter) {
      adapterEnvError = "Create or select a company before testing the adapter environment.";
      return null;
    }
    adapterEnvLoading = true;
    adapterEnvError = null;
    try {
      const res = await api(`/api/companies/${companyId}/adapters/${adapterType}/test-environment`, {
        method: "POST",
        body: JSON.stringify({ adapterConfig: adapterConfigOverride ?? config }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Adapter environment test failed (${res.status})`);
      }
      const result = (await res.json()) as AdapterEnvironmentTestResult;
      adapterEnvResult = result;
      return result;
    } catch (err) {
      adapterEnvError = err instanceof Error ? err.message : "Adapter environment test failed";
      return null;
    } finally {
      adapterEnvLoading = false;
    }
  }

  async function handleUnsetAnthropicApiKey(): Promise<void> {
    if (unsetAnthropicLoading) return;
    unsetAnthropicLoading = true;
    try {
      const env =
        typeof config.env === "object" &&
        config.env !== null &&
        !Array.isArray(config.env)
          ? { ...(config.env as Record<string, unknown>) }
          : {};
      env.ANTHROPIC_API_KEY = { type: "plain", value: "" };
      setField("env", env);
      await runAdapterEnvironmentTest({ ...config, env });
    } finally {
      unsetAnthropicLoading = false;
    }
  }

  $effect(() => {
    void companyId;
    void adapterType;
    void isModelDiscoveryAdapter;
    void isEnvironmentTestableAdapter;
    void showModelControls;
    adapterEnvResult = null;
    adapterEnvError = null;
    if (!companyId) {
      adapterModels = [];
      adapterModelsError = null;
      adapterModelsLoading = false;
      return;
    }
    if (showModelControls && isModelDiscoveryAdapter) {
      void loadAdapterModels();
    } else {
      adapterModels = [];
      adapterModelsError = null;
      adapterModelsLoading = false;
    }
  });

  // ---------------------------------------------------------------------------
  // Auto-test on model change (debounced)
  // ---------------------------------------------------------------------------
  let autoTestTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let lastTestedModel = $state<string | null>(null);

  function handleModelChangeWithAutoTest(model: string): void {
    setField("model", model);
    // Debounce auto-test: wait 800ms after model change
    if (autoTestTimer) clearTimeout(autoTestTimer);
    if (!companyId || !isEnvironmentTestableAdapter) return;
    autoTestTimer = setTimeout(() => {
      if (model && model !== lastTestedModel) {
        lastTestedModel = model;
        void runAdapterEnvironmentTest();
      }
    }, 800);
  }

  // ---------------------------------------------------------------------------
  // CSS helpers
  // ---------------------------------------------------------------------------
  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-[#475569] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition";
  const selectCls =
    "w-full appearance-none rounded-lg border border-border bg-background px-3.5 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition cursor-pointer";
  const labelCls = "block text-sm font-medium text-muted-foreground/80";
  const helpCls = "mt-1 text-xs text-muted-foreground";
  const sectionHeadingCls =
    "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2 mb-4";
</script>

<div class="space-y-8">
  <!-- ===================================================================== -->
  <!-- SECTION: Adapter Settings                                              -->
  <!-- ===================================================================== -->
  <section>
    <div class={sectionHeadingCls}>
      <Terminal class="size-3.5" />
      <span>Adapter Settings</span>
    </div>

    <div class="space-y-5">
      <!-- claude_local -->
      {#if adapterType === "claude_local"}
        {#if showModelControls}
          <div>
            <div class="flex items-center gap-2">
              <label for="cfg-model" class={labelCls}>Model</label>
              {#if adapterEnvLoading}
                <Loader2 size={14} class="animate-spin text-muted-foreground" />
              {:else if adapterEnvResult}
                {#if adapterEnvResult.status === 'pass'}
                  <span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={12} /> Passed</span>
                {:else if adapterEnvResult.status === 'warn'}
                  <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"><AlertTriangle size={12} /> Warning</span>
                {:else}
                  <span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600"><XCircle size={12} /> Failed</span>
                {/if}
              {/if}
            </div>
            <div class="relative mt-1.5">
              <select
                id="cfg-model"
                class={selectCls}
                value={normalizeClaudeModel(config.model)}
                onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
              >
                {#if adapterModels.length > 0}
                  {#each adapterModels as m (m.id)}
                    <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>{m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}{m.provider ? ` (${m.provider})` : ''}</option>
                  {/each}
                {:else}
                  <option value="claude-opus-4-6">Claude Opus 4.6</option>
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="claude-haiku-4-5">Claude Haiku 4.5</option>
                {/if}
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p class={helpCls}>
              {#if adapterModelsLoading}Loading models...{:else}The Anthropic model to use. {adapterModels.length} models available.{/if}
            </p>
          </div>
        {/if}

        <div>
          <label for="cfg-effort" class={labelCls}>Effort</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-effort"
              class={selectCls}
              value={config.effort ?? "medium"}
              onchange={(e) => setField("effort", e.currentTarget.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p class={helpCls}>Controls reasoning depth. Higher effort uses more tokens.</p>
        </div>

        <div>
          <label for="cfg-maxTurns" class={labelCls}>Max Turns Per Run</label>
          <input
            id="cfg-maxTurns"
            type="number"
            min="1"
            max="500"
            class="{inputCls} mt-1.5"
            value={config.maxTurnsPerRun ?? 25}
            oninput={(e) => setField("maxTurnsPerRun", parseInt(e.currentTarget.value) || 25)}
          />
          <p class={helpCls}>Maximum number of tool-use turns before the agent stops.</p>
        </div>

      <!-- codex_local -->
      {:else if adapterType === "codex_local"}
        {#if showModelControls}
          <div>
            <div class="flex items-center gap-2">
              <label for="cfg-model" class={labelCls}>Model</label>
              {#if adapterEnvLoading}<Loader2 size={14} class="animate-spin text-muted-foreground" />{:else if adapterEnvResult}{#if adapterEnvResult.status === 'pass'}<span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={12} /> Passed</span>{:else if adapterEnvResult.status === 'warn'}<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"><AlertTriangle size={12} /> Warning</span>{:else}<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600"><XCircle size={12} /> Failed</span>{/if}{/if}
            </div>
            <div class="relative mt-1.5">
              <select
                id="cfg-model"
                class={selectCls}
                value={config.model ?? ""}
                onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
              >
                {#if adapterModels.length > 0}
                  {#each adapterModels as m (m.id)}
                    <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>{m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}{m.provider ? ` (${m.provider})` : ''}</option>
                  {/each}
                {:else}
                  <option value="">Select model...</option>
                {/if}
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p class={helpCls}>{adapterModelsLoading ? 'Loading models...' : `${adapterModels.length} models available.`}</p>
          </div>
        {/if}

      <!-- copilot_local -->
      {:else if adapterType === "copilot_local"}
        {#if showModelControls}
          <div>
            <div class="flex items-center gap-2">
              <label for="cfg-model" class={labelCls}>Model</label>
              {#if adapterEnvLoading}<Loader2 size={14} class="animate-spin text-muted-foreground" />{:else if adapterEnvResult}{#if adapterEnvResult.status === 'pass'}<span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={12} /> Passed</span>{:else if adapterEnvResult.status === 'warn'}<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"><AlertTriangle size={12} /> Warning</span>{:else}<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600"><XCircle size={12} /> Failed</span>{/if}{/if}
            </div>
            <div class="relative mt-1.5">
              {#if adapterModels.length > 0}
                {@const grouped = Object.entries(adapterModels.reduce((acc, m) => { const p = m.provider ?? "other"; (acc[p] ??= []).push(m); return acc; }, {} as Record<string, typeof adapterModels>))}
                <select
                  id="cfg-model"
                  class={selectCls}
                  value={config.model ?? ""}
                  onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
                >
                  <option value="">Select model...</option>
                  {#each grouped as [provider, models]}
                    <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {#each models as m (m.id)}
                        <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>{m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}</option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              {:else}
                <input
                  id="cfg-model"
                  type="text"
                  class={inputCls}
                  value={config.model ?? ""}
                  oninput={(e) => setField("model", e.currentTarget.value)}
                  placeholder="gpt-5.4-mini"
                />
              {/if}
              {#if adapterModels.length > 0}
                <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              {/if}
            </div>
            <p class={helpCls}>
              {#if adapterModelsLoading}
                Loading Copilot models...
              {:else if adapterModels.length > 0}
                Select from the models exposed by the Copilot CLI.
              {:else}
                Model id with optional effort suffix. Leave empty to use Copilot defaults.
              {/if}
            </p>
          </div>
        {/if}

        <div>
          <label for="cfg-effort" class={labelCls}>Effort</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-effort"
              class={selectCls}
              value={config.effort ?? "medium"}
              onchange={(e) => setField("effort", e.currentTarget.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="xhigh">Extra High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p class={helpCls}>Reasoning effort for Copilot runs.</p>
        </div>

        <div>
          <label for="cfg-command" class={labelCls}>Command</label>
          <input
            id="cfg-command"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.command ?? "copilot"}
            oninput={(e) => setField("command", e.currentTarget.value)}
            placeholder="copilot"
          />
          <p class={helpCls}>Command used to launch GitHub Copilot locally.</p>
        </div>

        <div>
          <label for="cfg-configDir" class={labelCls}>Config Directory</label>
          <input
            id="cfg-configDir"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.configDir ?? ""}
            oninput={(e) => setField("configDir", e.currentTarget.value)}
            placeholder="~/.config/copilot"
          />
          <p class={helpCls}>Optional Copilot config directory override.</p>
        </div>

      <div>
        <label for="cfg-reasoning" class={labelCls}>Model Reasoning Effort</label>
        <div class="relative mt-1.5">
          <select
            id="cfg-reasoning"
              class={selectCls}
              value={config.modelReasoningEffort ?? "medium"}
              onchange={(e) => setField("modelReasoningEffort", e.currentTarget.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p class={helpCls}>Controls how much reasoning the model applies.</p>
        </div>

        <div class="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
          <div>
            <span class="text-sm font-medium text-muted-foreground/80">Web Search</span>
            <p class="text-xs text-muted-foreground mt-0.5">Allow the agent to search the web for context.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.search ?? false}
            aria-label="Enable web search"
            title="Enable web search"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.search ? 'bg-[#2563EB]' : 'bg-accent'}"
            onclick={() => toggleField("search")}
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.search ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>

      <!-- cursor -->
      {:else if adapterType === "cursor"}
        {#if showModelControls}
          <div>
            <div class="flex items-center gap-2">
              <label for="cfg-model" class={labelCls}>Model</label>
              {#if adapterEnvLoading}<Loader2 size={14} class="animate-spin text-muted-foreground" />{:else if adapterEnvResult}{#if adapterEnvResult.status === 'pass'}<span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={12} /> Passed</span>{:else if adapterEnvResult.status === 'warn'}<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"><AlertTriangle size={12} /> Warning</span>{:else}<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600"><XCircle size={12} /> Failed</span>{/if}{/if}
            </div>
            <div class="relative mt-1.5">
              {#if adapterModels.length > 0}
                {@const cursorGrouped = Object.entries(adapterModels.reduce((acc, m) => { const p = m.provider ?? "other"; (acc[p] ??= []).push(m); return acc; }, {} as Record<string, typeof adapterModels>))}
                <select
                  id="cfg-model"
                  class={selectCls}
                  value={config.model ?? "auto"}
                  onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
                >
                  <option value="auto">Auto (default)</option>
                  {#each cursorGrouped as [provider, models]}
                    <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {#each models as m (m.id)}
                        <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>{m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}</option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
                <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              {:else}
                <input id="cfg-model" type="text" class={inputCls} value={config.model ?? "auto"} oninput={(e) => setField("model", e.currentTarget.value)} placeholder="auto" />
              {/if}
            </div>
            <p class={helpCls}>{adapterModelsLoading ? "Loading models..." : `${adapterModels.length} models available. Use "auto" for default.`}</p>
          </div>
        {/if}

        <div>
          <label for="cfg-mode" class={labelCls}>Mode</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-mode"
              class={selectCls}
              value={config.mode ?? "plan"}
              onchange={(e) => setField("mode", e.currentTarget.value)}
            >
              <option value="plan">Plan</option>
              <option value="ask">Ask</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p class={helpCls}>Plan mode generates a plan before executing; Ask mode is conversational.</p>
        </div>

      <!-- gemini_local -->
      {:else if adapterType === "gemini_local"}
        {#if showModelControls}
          <div>
            <div class="flex items-center gap-2">
              <label for="cfg-model" class={labelCls}>Model</label>
              {#if adapterEnvLoading}<Loader2 size={14} class="animate-spin text-muted-foreground" />{:else if adapterEnvResult}{#if adapterEnvResult.status === 'pass'}<span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={12} /> Passed</span>{:else if adapterEnvResult.status === 'warn'}<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"><AlertTriangle size={12} /> Warning</span>{:else}<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600"><XCircle size={12} /> Failed</span>{/if}{/if}
            </div>
            <div class="relative mt-1.5">
              <select
                id="cfg-model"
                class={selectCls}
                value={config.model ?? ""}
                onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
              >
                {#if adapterModels.length > 0}
                  {#each adapterModels as m (m.id)}
                    <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>{m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}{m.provider ? ` (${m.provider})` : ''}</option>
                  {/each}
                {:else}
                  <option value="">Select model...</option>
                {/if}
              </select>
              <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p class={helpCls}>{adapterModelsLoading ? 'Loading models...' : `${adapterModels.length} models available.`}</p>
          </div>
        {/if}

        <div class="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
          <div>
            <span class="text-sm font-medium text-muted-foreground/80">Sandbox</span>
            <p class="text-xs text-muted-foreground mt-0.5">Run in an isolated sandbox environment.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.sandbox ?? false}
            aria-label="Enable sandbox"
            title="Enable sandbox"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.sandbox ? 'bg-[#2563EB]' : 'bg-accent'}"
            onclick={() => toggleField("sandbox")}
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.sandbox ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>

      <!-- pi_local -->
      {:else if adapterType === "pi_local"}
        {#if showModelControls}
          <div>
            <div class="flex items-center gap-2">
              <label for="cfg-model" class={labelCls}>
                Model
                <span class="ml-1 text-red-400">*</span>
              </label>
              {#if adapterEnvLoading}<Loader2 size={14} class="animate-spin text-muted-foreground" />{:else if adapterEnvResult}{#if adapterEnvResult.status === 'pass'}<span class="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-600"><CheckCircle2 size={12} /> Passed</span>{:else if adapterEnvResult.status === 'warn'}<span class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600"><AlertTriangle size={12} /> Warning</span>{:else}<span class="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-600"><XCircle size={12} /> Failed</span>{/if}{/if}
            </div>
            <div class="relative mt-1.5">
              {#if adapterModels.length > 0}
                {@const piGrouped = Object.entries(adapterModels.reduce((acc, m) => { const p = m.provider ?? m.id.split('/')[0] ?? "other"; (acc[p] ??= []).push(m); return acc; }, {} as Record<string, typeof adapterModels>))}
                <select
                  id="cfg-model"
                  class={selectCls}
                  value={config.model ?? ""}
                  onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
                >
                  <option value="">Select model...</option>
                  {#each piGrouped as [provider, models]}
                    <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                      {#each models as m (m.id)}
                        <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>{m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}</option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
                <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              {:else}
                <input id="cfg-model" type="text" class={inputCls} value={config.model ?? ""} oninput={(e) => setField("model", e.currentTarget.value)} placeholder="provider/model (e.g. openai/gpt-5.4)" required />
              {/if}
            </div>
            <p class={helpCls}>{adapterModelsLoading ? "Discovering models via pi --list-models..." : adapterModels.length > 0 ? `${adapterModels.length} models from ${new Set(adapterModels.map(m => m.provider ?? 'unknown')).size} providers.` : "Run 'pi --list-models' to discover. Format: provider/model."}</p>
          </div>
        {/if}

        <div>
          <label for="cfg-thinking" class={labelCls}>Thinking Level</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-thinking"
              class={selectCls}
              value={config.thinking ?? "medium"}
              onchange={(e) => setField("thinking", e.currentTarget.value)}
            >
              <option value="off">Off</option>
              <option value="minimal">Minimal</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="xhigh">Extra High</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p class={helpCls}>Controls the depth of chain-of-thought reasoning.</p>
        </div>

      <!-- openclaw_gateway -->
      {:else if adapterType === "openclaw_gateway"}
        <div>
          <label for="cfg-url" class={labelCls}>Gateway URL</label>
          <input
            id="cfg-url"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.url ?? "wss://"}
            oninput={(e) => setField("url", e.currentTarget.value)}
            placeholder="wss://gateway.example.com"
          />
          <p class={helpCls}>WebSocket URL (ws:// or wss://) of the OpenClaw gateway.</p>
        </div>

        <div>
          <label for="cfg-authToken" class={labelCls}>Auth Token</label>
          <input
            id="cfg-authToken"
            type="password"
            class="{inputCls} mt-1.5"
            value={config.authToken ?? ""}
            oninput={(e) => setField("authToken", e.currentTarget.value)}
            placeholder="Bearer token or API key"
            autocomplete="off"
          />
          <p class={helpCls}>Authentication token for the gateway connection.</p>
        </div>

        <div>
          <label for="cfg-sessionKey" class={labelCls}>Session Key Strategy</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-sessionKey"
              class={selectCls}
              value={config.sessionKeyStrategy ?? "issue"}
              onchange={(e) => setField("sessionKeyStrategy", e.currentTarget.value)}
            >
              <option value="issue">Per Issue</option>
              <option value="fixed">Fixed</option>
              <option value="run">Per Run</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <p class={helpCls}>How session keys are generated: per issue, fixed, or per run.</p>
        </div>

      <!-- process -->
      {:else if adapterType === "process"}
        <div>
          <label for="cfg-command" class={labelCls}>Command</label>
          <input
            id="cfg-command"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.command ?? ""}
            oninput={(e) => setField("command", e.currentTarget.value)}
            placeholder="e.g. /usr/bin/python3"
          />
          <p class={helpCls}>Executable path or command to run.</p>
        </div>

        <div>
          <label for="cfg-args" class={labelCls}>Arguments</label>
          <input
            id="cfg-args"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.args ?? ""}
            oninput={(e) => setField("args", e.currentTarget.value)}
            placeholder="arg1, arg2, --flag"
          />
          <p class={helpCls}>Comma-separated list of command arguments.</p>
        </div>

        <div>
          <label for="cfg-cwd-process" class={labelCls}>Working Directory</label>
          <div class="relative mt-1.5">
            <FolderOpen class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="cfg-cwd-process"
              type="text"
              class="{inputCls} pl-9"
              value={config.cwd ?? ""}
              oninput={(e) => setField("cwd", e.currentTarget.value)}
              placeholder="/path/to/workspace"
            />
          </div>
          <p class={helpCls}>The directory where the process will execute.</p>
        </div>

      <!-- http -->
      {:else if adapterType === "http"}
        <div>
          <label for="cfg-url" class={labelCls}>Endpoint URL</label>
          <input
            id="cfg-url"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.url ?? "https://"}
            oninput={(e) => setField("url", e.currentTarget.value)}
            placeholder="https://api.example.com/agent"
          />
          <p class={helpCls}>The HTTP endpoint the agent will call.</p>
        </div>

        <div>
          <label for="cfg-method" class={labelCls}>HTTP Method</label>
          <div class="relative mt-1.5">
            <select
              id="cfg-method"
              class={selectCls}
              value={config.method ?? "POST"}
              onchange={(e) => setField("method", e.currentTarget.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div>
          <label for="cfg-headers" class={labelCls}>Headers (JSON)</label>
          <textarea
            id="cfg-headers"
            rows={4}
            class="{inputCls} mt-1.5 font-mono text-xs"
            value={config.headers ?? "{}"}
            oninput={(e) => setField("headers", e.currentTarget.value)}
            placeholder={"{\u0022Authorization\u0022: \u0022Bearer ...\u0022}"}
            spellcheck="false"
          ></textarea>
          <p class={helpCls}>Custom HTTP headers as a JSON object.</p>
        </div>
      {/if}
    </div>
  </section>

  {#if showModelControls && companyId && isModelDiscoveryAdapter}
    <section>
      <div class={sectionHeadingCls}>
        <Search class="size-3.5" />
        <span>Model Discovery</span>
      </div>

      <div class="space-y-4 rounded-lg border border-border bg-background p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-muted-foreground/80">
              {adapterModels.length} models from {new Set(adapterModels.map(m => m.provider ?? 'unknown')).size} provider{new Set(adapterModels.map(m => m.provider ?? 'unknown')).size > 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent/50"
            onclick={() => void loadAdapterModels()}
            disabled={adapterModelsLoading}
          >
            {adapterModelsLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {#if adapterModelsError}
          <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {adapterModelsError}
          </div>
        {:else if adapterModelsLoading}
          <div class="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 class="size-4 animate-spin" />
            Discovering models...
          </div>
        {:else if adapterModels.length === 0}
          <div class="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            <AlertTriangle class="size-4 shrink-0 mt-0.5" />
            <span>No models discovered. Verify the adapter is authenticated.</span>
          </div>
        {:else}
          {@const discoveryGrouped = Object.entries(
            adapterModels.reduce((acc, m) => {
              const p = m.provider ?? m.id.split('/')[0] ?? "other";
              (acc[p] ??= []).push(m);
              return acc;
            }, {} as Record<string, typeof adapterModels>)
          ).sort(([a], [b]) => a.localeCompare(b))}
          {@const dAvailable = adapterModels.filter(m => m.status === 'available').length}
          {@const dQuota = adapterModels.filter(m => m.status === 'quota_exceeded').length}
          {@const dUnavail = adapterModels.filter(m => m.status === 'unavailable' || m.status === 'error').length}
          <div class="relative">
            <select
              id="cfg-discovery-model"
              class={selectCls}
              value={typeof config.model === 'string' ? config.model : ''}
              onchange={(e) => handleModelChangeWithAutoTest(e.currentTarget.value)}
            >
              <option value="">Select model...</option>
              {#each discoveryGrouped as [provider, models]}
                <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                  {#each models as m (m.id)}
                    <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>
                      {m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}
                    </option>
                  {/each}
                </optgroup>
              {/each}
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>✅ {dAvailable} available</span>
            {#if dQuota > 0}<span>⏳ {dQuota} cooldown</span>{/if}
            {#if dUnavail > 0}<span>❌ {dUnavail} unavailable</span>{/if}
          </div>
          {#if selectedModel}
            <p class="mt-1.5 text-xs text-muted-foreground">
              Selected: <span class="font-medium text-foreground">{selectedModel.id}</span>
              {#if selectedModel.statusDetail}
                — {selectedModel.statusDetail}
              {/if}
            </p>
          {/if}
        {/if}
      </div>
    </section>
  {/if}

  {#if companyId && isEnvironmentTestableAdapter}
    <section>
      <div class={sectionHeadingCls}>
        <Settings class="size-3.5" />
        <span>Environment Check</span>
      </div>

      <div class="space-y-4 rounded-lg border border-border bg-background p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-muted-foreground/80">Adapter environment check</p>
            <p class="text-xs text-muted-foreground mt-0.5">Runs a live probe using the current adapter settings.</p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent/50"
            onclick={() => void runAdapterEnvironmentTest()}
            disabled={adapterEnvLoading}
          >
            {adapterEnvLoading ? "Testing..." : "Test now"}
          </button>
        </div>

        {#if adapterEnvError}
          <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {adapterEnvError}
          </div>
        {/if}

        {#if adapterEnvResult}
          <div class="rounded-lg border px-4 py-3 text-sm {adapterEnvResult.status === 'pass' ? 'border-green-300 bg-green-50 text-green-700' : adapterEnvResult.status === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-red-300 bg-red-50 text-red-700'}">
            <div class="flex items-center justify-between gap-3">
              <div class="font-medium uppercase tracking-wide">{adapterEnvResult.status === 'pass' ? 'Passed' : adapterEnvResult.status === 'warn' ? 'Warnings' : 'Failed'}</div>
              <div class="text-[11px] opacity-80">{new Date(adapterEnvResult.testedAt).toLocaleTimeString()}</div>
            </div>
            <div class="mt-3 space-y-2 text-xs">
              {#each adapterEnvResult.checks as check, idx}
                <div class="rounded-md border border-current/10 bg-white/60 px-2.5 py-2">
                  <div class="font-semibold uppercase tracking-wide opacity-80">{check.level}</div>
                  <div class="mt-1 leading-relaxed">{check.message}</div>
                  {#if check.detail}
                    <div class="mt-1 break-all opacity-80">{check.detail}</div>
                  {/if}
                  {#if check.hint}
                    <div class="mt-1 opacity-90">Hint: {check.hint}</div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if shouldSuggestUnsetAnthropicApiKey}
          <div class="rounded-lg border border-amber-300/60 bg-amber-50/50 px-4 py-3 space-y-2">
            <p class="text-sm text-amber-900/90 leading-relaxed">
              Claude failed while <span class="font-mono">ANTHROPIC_API_KEY</span> is set. You can clear it in this config and retry the probe.
            </p>
            <button
              type="button"
              class="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
              onclick={() => void handleUnsetAnthropicApiKey()}
              disabled={adapterEnvLoading || unsetAnthropicLoading}
            >
              {unsetAnthropicLoading ? 'Retrying...' : 'Unset ANTHROPIC_API_KEY'}
            </button>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- ===================================================================== -->
  <!-- SECTION: Execution (local adapters only)                               -->
  <!-- ===================================================================== -->
  {#if isLocal}
    <section>
      <div class={sectionHeadingCls}>
        <Settings class="size-3.5" />
        <span>Execution</span>
      </div>

      <div class="space-y-5">
        <div>
          <label for="cfg-cwd" class={labelCls}>Working Directory</label>
          <div class="relative mt-1.5">
            <FolderOpen class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="cfg-cwd"
              type="text"
              class="{inputCls} pl-9"
              value={config.cwd ?? ""}
              oninput={(e) => setField("cwd", e.currentTarget.value)}
              placeholder="/path/to/project"
            />
          </div>
          <p class={helpCls}>Absolute path to the project directory where the agent will operate.</p>
        </div>

        <div>
          <label for="cfg-instructions" class={labelCls}>Instructions File Path</label>
          <input
            id="cfg-instructions"
            type="text"
            class="{inputCls} mt-1.5"
            value={config.instructionsFilePath ?? ""}
            oninput={(e) => setField("instructionsFilePath", e.currentTarget.value)}
            placeholder=".clawdev/instructions.md"
          />
          <p class={helpCls}>Relative path to a file containing additional agent instructions.</p>
        </div>

        <div>
          <label for="cfg-prompt" class={labelCls}>Prompt Template</label>
          <textarea
            id="cfg-prompt"
            rows={5}
            class="{inputCls} mt-1.5 font-mono text-xs"
            value={config.promptTemplate ?? ""}
            oninput={(e) => setField("promptTemplate", e.currentTarget.value)}
            placeholder="You are an agent working on the assigned issue..."
            spellcheck="false"
          ></textarea>
          <p class={helpCls}>
            Template for the prompt sent to the agent. Supports
            <code class="rounded bg-accent/75 px-1 py-0.5 text-[11px] text-muted-foreground">{"{{"}issue.title{"}}"}</code>
            placeholders.
          </p>
        </div>
      </div>
    </section>
  {/if}

  <!-- ===================================================================== -->
  <!-- SECTION: Advanced (danger zone toggles)                                -->
  <!-- ===================================================================== -->
  {#if adapterType === "claude_local" || adapterType === "codex_local"}
    <section>
      <div class={sectionHeadingCls}>
        <ShieldAlert class="size-3.5 text-amber-500" />
        <span class="text-amber-500/80">Advanced</span>
      </div>

      <div class="space-y-4">
        {#if adapterType === "claude_local"}
          <div class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
            <div>
              <span class="text-sm font-medium text-muted-foreground/80">Skip Permissions</span>
              <p class="text-xs text-muted-foreground mt-0.5">
                Dangerously skip all permission prompts. Use with extreme caution.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.dangerouslySkipPermissions ?? false}
              aria-label="Skip permissions"
              title="Skip permissions"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.dangerouslySkipPermissions ? 'bg-amber-500' : 'bg-accent'}"
              onclick={() => toggleField("dangerouslySkipPermissions")}
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.dangerouslySkipPermissions ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        {/if}

        {#if adapterType === "codex_local"}
          <div class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
            <div>
              <span class="text-sm font-medium text-muted-foreground/80">Skip Git Repo Check</span>
              <p class="text-xs text-muted-foreground mt-0.5">
                Allow Codex to run from ClawDev-managed worktrees and temporary directories.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.skipGitRepoCheck ?? true}
              aria-label="Skip Git repo check"
              title="Skip Git repo check"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {(config.skipGitRepoCheck ?? true) ? 'bg-amber-500' : 'bg-accent'}"
              onclick={() => toggleField("skipGitRepoCheck")}
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {(config.skipGitRepoCheck ?? true) ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>

          <div class="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
            <div>
              <span class="text-sm font-medium text-muted-foreground/80">Bypass Approvals & Sandbox</span>
              <p class="text-xs text-muted-foreground mt-0.5">
                Dangerously bypass all approval gates and sandbox restrictions.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.dangerouslyBypassApprovalsAndSandbox ?? false}
              aria-label="Bypass approvals and sandbox"
              title="Bypass approvals and sandbox"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 {config.dangerouslyBypassApprovalsAndSandbox ? 'bg-amber-500' : 'bg-accent'}"
              onclick={() => toggleField("dangerouslyBypassApprovalsAndSandbox")}
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 {config.dangerouslyBypassApprovalsAndSandbox ? 'translate-x-5' : 'translate-x-0'}"
              ></span>
            </button>
          </div>
        {/if}

        <div class="flex items-start gap-2 rounded-lg border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
          <Info class="size-4 shrink-0 text-amber-500/70 mt-0.5" />
          <p class="text-xs text-amber-500/60 leading-relaxed">
            These settings disable safety mechanisms. Only enable them in trusted, isolated environments
            where the agent has been thoroughly tested.
          </p>
        </div>
      </div>
    </section>
  {/if}
</div>
