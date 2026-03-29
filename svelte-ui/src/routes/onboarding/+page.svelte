<script lang="ts">
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { companyStore } from '$stores/company.svelte.js';
  import {
    Building2,
    Bot,
    Code,
    Gem,
    ListTodo,
    Rocket,
    ArrowLeft,
    ArrowRight,
    Terminal,
    Sparkles,
    MousePointer2,
    Check,
    Loader2,
    ChevronDown,
    X
  } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  type Step = 1 | 2 | 3 | 4;
  type AdapterType =
    | 'claude_local'
    | 'codex_local'
    | 'gemini_local'
    | 'opencode_local'
    | 'pi_local'
    | 'cursor'
    | 'http'
    | 'openclaw_gateway';

  interface AdapterModel {
    id: string;
    label: string;
  }

  interface AdapterEnvCheck {
    code: string;
    level: string;
    message: string;
    detail?: string;
    hint?: string;
  }

  interface AdapterEnvResult {
    status: 'pass' | 'warn' | 'fail';
    testedAt: string;
    checks: AdapterEnvCheck[];
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const DEFAULT_CODEX_LOCAL_MODEL = 'gpt-5.3-codex';
  const DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = true;
  const DEFAULT_CURSOR_LOCAL_MODEL = 'auto';
  const DEFAULT_GEMINI_LOCAL_MODEL = 'auto';

  const DEFAULT_TASK_DESCRIPTION = `You are the CEO. You set the direction for the company.

- hire a founding engineer
- write a hiring plan
- break the roadmap into concrete tasks and start delegating work`;

  const ADAPTER_LABELS: Record<string, string> = {
    claude_local: 'Claude Code (Local)',
    codex_local: 'Codex (Local)',
    gemini_local: 'Gemini CLI (Local)',
    opencode_local: 'OpenCode (Local)',
    pi_local: 'Pi (Local)',
    cursor: 'Cursor (Local)',
    http: 'HTTP Webhook',
    openclaw_gateway: 'OpenClaw Gateway'
  };

  // ---------------------------------------------------------------------------
  // Helper utilities (ported from React codebase)
  // ---------------------------------------------------------------------------
  function extractProviderIdWithFallback(modelId: string, fallback = 'other'): string {
    const trimmed = modelId.trim();
    if (!trimmed.includes('/')) return fallback;
    const provider = trimmed.slice(0, trimmed.indexOf('/')).trim();
    return provider || fallback;
  }

  function extractModelName(modelId: string): string {
    const trimmed = modelId.trim();
    if (!trimmed.includes('/')) return trimmed;
    return trimmed.slice(trimmed.indexOf('/') + 1).trim();
  }

  function parseOnboardingGoalInput(raw: string): { title: string; description: string | null } {
    const trimmed = raw.trim();
    if (!trimmed) return { title: '', description: null };
    const [firstLine, ...restLines] = trimmed.split(/\r?\n/);
    const title = (firstLine ?? '').trim();
    const description = restLines.join('\n').trim();
    return { title, description: description.length > 0 ? description : null };
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let step = $state<Step>(1);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let modelOpen = $state(false);
  let modelSearch = $state('');

  // Step 1 — Company
  let companyName = $state('');
  let companyGoal = $state('');

  // Step 2 — Agent
  let agentName = $state('CEO');
  let adapterType = $state<AdapterType>('claude_local');
  let model = $state('');
  let command = $state('');
  let args = $state('');
  let url = $state('');
  let adapterEnvResult = $state<AdapterEnvResult | null>(null);
  let adapterEnvError = $state<string | null>(null);
  let adapterEnvLoading = $state(false);
  let forceUnsetAnthropicApiKey = $state(false);
  let unsetAnthropicLoading = $state(false);
  let showMoreAdapters = $state(false);
  let adapterModels = $state<AdapterModel[]>([]);
  let adapterModelsLoading = $state(false);
  let adapterModelsError = $state<string | null>(null);

  // Step 3 — Task
  let taskTitle = $state('Hire your first engineer and create a hiring plan');
  let taskDescription = $state(DEFAULT_TASK_DESCRIPTION);

  // Created entity IDs
  let createdCompanyId = $state<string | null>(null);
  let createdCompanyPrefix = $state<string | null>(null);
  let createdCompanyGoalId = $state<string | null>(null);
  let createdAgentId = $state<string | null>(null);
  let createdProjectId = $state<string | null>(null);
  let createdIssueRef = $state<string | null>(null);

  // Textarea ref for auto-resize
  let textareaEl: HTMLTextAreaElement | undefined = $state();

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let isLocalAdapter = $derived(
    adapterType === 'claude_local' ||
      adapterType === 'codex_local' ||
      adapterType === 'gemini_local' ||
      adapterType === 'opencode_local' ||
      adapterType === 'pi_local' ||
      adapterType === 'cursor'
  );

  let effectiveAdapterCommand = $derived(
    command.trim() ||
      (adapterType === 'codex_local'
        ? 'codex'
        : adapterType === 'gemini_local'
          ? 'gemini'
          : adapterType === 'pi_local'
            ? 'pi'
            : adapterType === 'cursor'
              ? 'agent'
              : adapterType === 'opencode_local'
                ? 'opencode'
                : 'claude')
  );

  let selectedModel = $derived((adapterModels ?? []).find((m) => m.id === model));

  let hasAnthropicApiKeyOverrideCheck = $derived(
    adapterEnvResult?.checks.some(
      (check) => check.code === 'claude_anthropic_api_key_overrides_subscription'
    ) ?? false
  );

  let shouldSuggestUnsetAnthropicApiKey = $derived(
    adapterType === 'claude_local' &&
      adapterEnvResult?.status === 'fail' &&
      hasAnthropicApiKeyOverrideCheck
  );

  let filteredModels = $derived.by(() => {
    const query = modelSearch.trim().toLowerCase();
    return (adapterModels ?? []).filter((entry) => {
      if (!query) return true;
      const provider = extractProviderIdWithFallback(entry.id, '');
      return (
        entry.id.toLowerCase().includes(query) ||
        entry.label.toLowerCase().includes(query) ||
        provider.toLowerCase().includes(query)
      );
    });
  });

  let groupedModels = $derived.by(() => {
    if (adapterType !== 'opencode_local') {
      return [
        {
          provider: 'models',
          entries: [...filteredModels].sort((a, b) => a.id.localeCompare(b.id))
        }
      ];
    }
    const groups = new Map<string, AdapterModel[]>();
    for (const entry of filteredModels) {
      const provider = extractProviderIdWithFallback(entry.id);
      const bucket = groups.get(provider) ?? [];
      bucket.push(entry);
      groups.set(provider, bucket);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([provider, entries]) => ({
        provider,
        entries: [...entries].sort((a, b) => a.id.localeCompare(b.id))
      }));
  });

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Reset env result when adapter config changes
  $effect(() => {
    // Track dependencies
    void adapterType;
    void model;
    void command;
    void args;
    void url;
    if (step === 2) {
      adapterEnvResult = null;
      adapterEnvError = null;
    }
  });

  // Auto-resize textarea on step 3
  $effect(() => {
    if (step === 3 && textareaEl) {
      void taskDescription;
      textareaEl.style.height = 'auto';
      textareaEl.style.height = textareaEl.scrollHeight + 'px';
    }
  });

  // Fetch adapter models when on step 2 and we have a company
  $effect(() => {
    if (step === 2 && createdCompanyId) {
      void adapterType;
      fetchAdapterModels();
    }
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function fetchAdapterModels() {
    if (!createdCompanyId) return;
    adapterModelsLoading = true;
    adapterModelsError = null;
    try {
      const res = await api(
        `/api/companies/${createdCompanyId}/adapters/${adapterType}/models`
      );
      if (!res.ok) throw new Error(`Failed to fetch models: ${res.statusText}`);
      const data = await res.json();
      adapterModels = Array.isArray(data) ? data : data.models ?? [];
    } catch (err) {
      adapterModelsError = err instanceof Error ? err.message : 'Failed to load models';
      adapterModels = [];
    } finally {
      adapterModelsLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Adapter config builder
  // ---------------------------------------------------------------------------
  function buildAdapterConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {
      adapterType,
      model:
        adapterType === 'codex_local'
          ? model || DEFAULT_CODEX_LOCAL_MODEL
          : adapterType === 'gemini_local'
            ? model || DEFAULT_GEMINI_LOCAL_MODEL
            : adapterType === 'cursor'
              ? model || DEFAULT_CURSOR_LOCAL_MODEL
              : model,
      command: command || undefined,
      args: args || undefined,
      url: url || undefined,
      dangerouslySkipPermissions:
        adapterType === 'claude_local' || adapterType === 'opencode_local',
      dangerouslyBypassSandbox:
        adapterType === 'codex_local' ? DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX : false,
      workspaceStrategyType: 'project_primary',
      maxTurnsPerRun: 300
    };

    if (adapterType === 'claude_local' && forceUnsetAnthropicApiKey) {
      config.env = { ANTHROPIC_API_KEY: { type: 'plain', value: '' } };
    }

    return config;
  }

  // ---------------------------------------------------------------------------
  // Adapter environment test
  // ---------------------------------------------------------------------------
  async function runAdapterEnvironmentTest(
    adapterConfigOverride?: Record<string, unknown>
  ): Promise<AdapterEnvResult | null> {
    if (!createdCompanyId) {
      adapterEnvError = 'Create or select a company before testing adapter environment.';
      return null;
    }
    adapterEnvLoading = true;
    adapterEnvError = null;
    try {
      const res = await api(
        `/api/companies/${createdCompanyId}/adapters/${adapterType}/test-environment`,
        {
          method: 'POST',
          body: JSON.stringify({
            adapterConfig: adapterConfigOverride ?? buildAdapterConfig()
          })
        }
      );
      if (!res.ok) throw new Error(`Test failed: ${res.statusText}`);
      const result: AdapterEnvResult = await res.json();
      adapterEnvResult = result;
      return result;
    } catch (err) {
      adapterEnvError =
        err instanceof Error ? err.message : 'Adapter environment test failed';
      return null;
    } finally {
      adapterEnvLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------
  async function handleStep1Next() {
    loading = true;
    error = null;
    try {
      const res = await api('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ name: companyName.trim() })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message ?? `Failed to create company: ${res.statusText}`);
      }
      const company = await res.json();
      createdCompanyId = company.id;
      createdCompanyPrefix = company.issuePrefix ?? company.slug ?? null;
      companyStore.select(company.id, 'manual');

      // Refresh company list in store
      try {
        const companiesRes = await api('/api/companies');
        if (companiesRes.ok) {
          const list = await companiesRes.json();
          companyStore.setCompanies(Array.isArray(list) ? list : list.companies ?? []);
        }
      } catch {
        // Non-critical
      }

      // Create optional goal
      if (companyGoal.trim()) {
        const parsedGoal = parseOnboardingGoalInput(companyGoal);
        const goalRes = await api(`/api/companies/${company.id}/goals`, {
          method: 'POST',
          body: JSON.stringify({
            title: parsedGoal.title,
            ...(parsedGoal.description ? { description: parsedGoal.description } : {}),
            level: 'company',
            status: 'active'
          })
        });
        if (goalRes.ok) {
          const goal = await goalRes.json();
          createdCompanyGoalId = goal.id;
        }
      } else {
        createdCompanyGoalId = null;
      }

      step = 2;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create company';
    } finally {
      loading = false;
    }
  }

  async function handleStep2Next() {
    if (!createdCompanyId) return;
    loading = true;
    error = null;
    try {
      // OpenCode validation
      if (adapterType === 'opencode_local') {
        const selectedModelId = model.trim();
        if (!selectedModelId) {
          error = 'OpenCode requires an explicit model in provider/model format.';
          return;
        }
        if (adapterModelsError) {
          error = adapterModelsError;
          return;
        }
        if (adapterModelsLoading) {
          error = 'OpenCode models are still loading. Please wait and try again.';
          return;
        }
        if (!adapterModels.some((entry) => entry.id === selectedModelId)) {
          error =
            adapterModels.length === 0
              ? 'No OpenCode models discovered. Run `opencode models` and authenticate providers.'
              : `Configured OpenCode model is unavailable: ${selectedModelId}`;
          return;
        }
      }

      // Run env test for local adapters if not already done
      if (isLocalAdapter) {
        const result = adapterEnvResult ?? (await runAdapterEnvironmentTest());
        if (!result) return;
      }

      // Create agent
      const res = await api(`/api/companies/${createdCompanyId}/agents`, {
        method: 'POST',
        body: JSON.stringify({
          name: agentName.trim(),
          role: 'ceo',
          adapterType,
          adapterConfig: buildAdapterConfig(),
          runtimeConfig: {
            heartbeat: {
              enabled: true,
              intervalSec: 3600,
              wakeOnDemand: true,
              cooldownSec: 10,
              maxConcurrentRuns: 1
            }
          }
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message ?? `Failed to create agent: ${res.statusText}`);
      }
      const agent = await res.json();
      createdAgentId = agent.id;
      step = 3;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create agent';
    } finally {
      loading = false;
    }
  }

  async function handleUnsetAnthropicApiKey() {
    if (!createdCompanyId || unsetAnthropicLoading) return;
    unsetAnthropicLoading = true;
    error = null;
    adapterEnvError = null;
    forceUnsetAnthropicApiKey = true;

    const configWithUnset = buildAdapterConfig();
    configWithUnset.env = { ANTHROPIC_API_KEY: { type: 'plain', value: '' } };

    try {
      if (createdAgentId) {
        await api(`/api/companies/${createdCompanyId}/agents/${createdAgentId}`, {
          method: 'PATCH',
          body: JSON.stringify({ adapterConfig: configWithUnset })
        });
      }

      const result = await runAdapterEnvironmentTest(configWithUnset);
      if (result?.status === 'fail') {
        error =
          'Retried with ANTHROPIC_API_KEY unset in adapter config, but the environment test is still failing.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to unset ANTHROPIC_API_KEY and retry.';
    } finally {
      unsetAnthropicLoading = false;
    }
  }

  function handleStep3Next() {
    if (!createdCompanyId || !createdAgentId) return;
    error = null;
    step = 4;
  }

  async function handleLaunch() {
    if (!createdCompanyId || !createdAgentId) return;
    loading = true;
    error = null;
    try {
      // Resolve goal
      let goalId = createdCompanyGoalId;
      if (!goalId) {
        try {
          const goalsRes = await api(`/api/companies/${createdCompanyId}/goals`);
          if (goalsRes.ok) {
            const goals = await goalsRes.json();
            const goalsArr = Array.isArray(goals) ? goals : goals.goals ?? [];
            const companyGoals = goalsArr.filter((g: any) => g.level === 'company');
            const rootGoals = companyGoals.filter((g: any) => !g.parentId);
            const activeRootGoals = rootGoals.filter((g: any) => g.status === 'active');
            const pickEarliest = (arr: any[]) =>
              arr.sort(
                (a: any, b: any) =>
                  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              )[0] ?? null;
            goalId =
              pickEarliest(activeRootGoals)?.id ??
              pickEarliest(rootGoals)?.id ??
              pickEarliest(companyGoals)?.id ??
              null;
          }
        } catch {
          // Non-critical
        }
        createdCompanyGoalId = goalId;
      }

      // Create project
      let projectId = createdProjectId;
      if (!projectId) {
        const projectRes = await api(`/api/companies/${createdCompanyId}/projects`, {
          method: 'POST',
          body: JSON.stringify({
            name: 'Onboarding',
            status: 'in_progress',
            ...(goalId ? { goalIds: [goalId] } : {})
          })
        });
        if (projectRes.ok) {
          const project = await projectRes.json();
          projectId = project.id;
          createdProjectId = projectId;
        } else {
          throw new Error('Failed to create project');
        }
      }

      // Create issue
      let issueRef = createdIssueRef;
      if (!issueRef && projectId) {
        const title = taskTitle.trim();
        const description = taskDescription.trim();
        const issueRes = await api(`/api/companies/${createdCompanyId}/issues`, {
          method: 'POST',
          body: JSON.stringify({
            title,
            ...(description ? { description } : {}),
            assigneeAgentId: createdAgentId,
            projectId,
            ...(goalId ? { goalId } : {}),
            status: 'todo'
          })
        });
        if (issueRes.ok) {
          const issue = await issueRes.json();
          issueRef = issue.identifier ?? issue.id;
          createdIssueRef = issueRef;
        } else {
          throw new Error('Failed to create issue');
        }
      }

      companyStore.select(createdCompanyId!, 'manual');

      const prefix = createdCompanyPrefix;
      if (prefix && issueRef) {
        goto(`/${prefix}/issues/${issueRef}`);
      } else if (prefix) {
        goto(`/${prefix}/dashboard`);
      } else {
        goto('/');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create task';
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Close / navigate away
  // ---------------------------------------------------------------------------
  function handleClose() {
    const prefix =
      createdCompanyPrefix ??
      companyStore.selectedCompany?.slug ??
      companyStore.companies[0]?.slug;
    if (prefix) {
      goto(`/${prefix}/dashboard`);
    } else {
      goto('/');
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Cmd/Ctrl+Enter advances
  // ---------------------------------------------------------------------------
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (step === 1 && companyName.trim()) handleStep1Next();
      else if (step === 2 && agentName.trim()) handleStep2Next();
      else if (step === 3 && taskTitle.trim()) handleStep3Next();
      else if (step === 4) handleLaunch();
    }
  }

  // ---------------------------------------------------------------------------
  // Adapter type selection helpers
  // ---------------------------------------------------------------------------
  function selectAdapter(type: AdapterType) {
    adapterType = type;
    if (type === 'codex_local' && !model) {
      model = DEFAULT_CODEX_LOCAL_MODEL;
    } else if (type === 'gemini_local' && !model) {
      model = DEFAULT_GEMINI_LOCAL_MODEL;
    } else if (type === 'cursor' && !model) {
      model = DEFAULT_CURSOR_LOCAL_MODEL;
    } else if (type === 'opencode_local') {
      if (!model.includes('/')) model = '';
    } else if (type !== 'codex_local') {
      model = '';
    }
  }

  function selectModel(id: string) {
    model = id;
    modelOpen = false;
    modelSearch = '';
  }

  // ---------------------------------------------------------------------------
  // Step tab definitions
  // ---------------------------------------------------------------------------
  const stepTabs: Array<{ step: Step; label: string; icon: typeof Building2 }> = [
    { step: 1, label: 'Company', icon: Building2 },
    { step: 2, label: 'Agent', icon: Bot },
    { step: 3, label: 'Task', icon: ListTodo },
    { step: 4, label: 'Launch', icon: Rocket }
  ];

  // Primary adapter cards
  const primaryAdapters: Array<{
    value: AdapterType;
    label: string;
    icon: typeof Sparkles;
    desc: string;
    recommended?: boolean;
  }> = [
    {
      value: 'claude_local',
      label: 'Claude Code',
      icon: Sparkles,
      desc: 'Local Claude agent',
      recommended: true
    },
    {
      value: 'codex_local',
      label: 'Codex',
      icon: Code,
      desc: 'Local Codex agent',
      recommended: true
    }
  ];

  // Extra adapter cards
  const extraAdapters: Array<{
    value: AdapterType;
    label: string;
    icon: typeof Terminal;
    desc: string;
    comingSoon?: boolean;
    disabledLabel?: string;
  }> = [
    { value: 'gemini_local', label: 'Gemini CLI', icon: Gem, desc: 'Local Gemini agent' },
    { value: 'opencode_local', label: 'OpenCode', icon: Terminal, desc: 'Local multi-provider agent' },
    { value: 'pi_local', label: 'Pi', icon: Terminal, desc: 'Local Pi agent' },
    { value: 'cursor', label: 'Cursor', icon: MousePointer2, desc: 'Local Cursor agent' },
    {
      value: 'openclaw_gateway',
      label: 'OpenClaw Gateway',
      icon: Bot,
      desc: 'Invoke OpenClaw via gateway protocol',
      comingSoon: true,
      disabledLabel: 'Configure OpenClaw within the App'
    }
  ];

  // Manual debug command for failed env tests
  function getDebugCommand(): string {
    if (adapterType === 'cursor')
      return `${effectiveAdapterCommand} -p --mode ask --output-format json "Respond with hello."`;
    if (adapterType === 'codex_local') return `${effectiveAdapterCommand} exec --json -`;
    if (adapterType === 'gemini_local')
      return `${effectiveAdapterCommand} --output-format json "Respond with hello."`;
    if (adapterType === 'opencode_local')
      return `${effectiveAdapterCommand} run --format json "Respond with hello."`;
    return `${effectiveAdapterCommand} --print - --output-format stream-json --verbose`;
  }

  function getDebugAuthHint(): string {
    if (adapterType === 'cursor') return 'CURSOR_API_KEY or run `agent login`';
    if (adapterType === 'codex_local') return 'OPENAI_API_KEY or run `codex login`';
    if (adapterType === 'gemini_local') return 'GEMINI_API_KEY or run `gemini auth`';
    if (adapterType === 'opencode_local') return 'OPENAI_API_KEY or run `opencode auth login`';
    return '`claude login`';
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- Full-screen overlay -->
<div class="fixed inset-0 z-50 flex bg-white">
  <!-- Close button -->
  <button
    onclick={handleClose}
    class="absolute top-4 left-4 z-10 rounded-sm p-1.5 text-gray-400 hover:text-gray-900 transition-colors cursor-pointer"
  >
    <X class="h-5 w-5" />
    <span class="sr-only">Close</span>
  </button>

  <!-- Left side — form content -->
  <div
    class="w-full flex flex-col overflow-y-auto transition-[width] duration-500 ease-in-out {step ===
    1
      ? 'md:w-1/2'
      : 'md:w-full'}"
  >
    <div class="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0">
      <!-- Progress tabs -->
      <div class="flex items-center gap-0 mb-8 border-b border-gray-200">
        {#each stepTabs as tab}
          <button
            type="button"
            onclick={() => (step = tab.step)}
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer
              {tab.step === step
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'}"
          >
            <tab.icon class="h-3.5 w-3.5" />
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Step 1: Company -->
      {#if step === 1}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <Building2 class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Name your company</h3>
              <p class="text-xs text-gray-500">
                This is the organization your agents will work for.
              </p>
            </div>
          </div>
          <div class="mt-3 group">
            <label
              class="text-xs mb-1 block transition-colors {companyName.trim()
                ? 'text-gray-900'
                : 'text-gray-400 group-focus-within:text-gray-900'}"
            >
              Company name
            </label>
            <input
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="Acme Corp"
              bind:value={companyName}
              autofocus
            />
          </div>
          <div class="group">
            <label
              class="text-xs mb-1 block transition-colors {companyGoal.trim()
                ? 'text-gray-900'
                : 'text-gray-400 group-focus-within:text-gray-900'}"
            >
              Mission / goal (optional)
            </label>
            <textarea
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[60px] text-gray-900"
              placeholder="What is this company trying to achieve?"
              bind:value={companyGoal}
            ></textarea>
          </div>
        </div>
      {/if}

      <!-- Step 2: Agent -->
      {#if step === 2}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <Bot class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Create your first agent</h3>
              <p class="text-xs text-gray-500">Choose how this agent will run tasks.</p>
            </div>
          </div>

          <!-- Agent name -->
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Agent name</label>
            <input
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="CEO"
              bind:value={agentName}
              autofocus
            />
          </div>

          <!-- Adapter type radio cards -->
          <div>
            <label class="text-xs text-gray-400 mb-2 block">Adapter type</label>
            <div class="grid grid-cols-2 gap-2">
              {#each primaryAdapters as opt}
                <button
                  class="flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors relative cursor-pointer
                    {adapterType === opt.value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:bg-gray-50'}"
                  onclick={() => selectAdapter(opt.value)}
                >
                  {#if opt.recommended}
                    <span
                      class="absolute -top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                      >Recommended</span
                    >
                  {/if}
                  <opt.icon class="h-4 w-4 text-gray-700" />
                  <span class="font-medium text-gray-900">{opt.label}</span>
                  <span class="text-gray-400 text-[10px]">{opt.desc}</span>
                </button>
              {/each}
            </div>

            <!-- More Adapters toggle -->
            <button
              class="flex items-center gap-1.5 mt-3 text-xs text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
              onclick={() => (showMoreAdapters = !showMoreAdapters)}
            >
              <ChevronDown
                class="h-3 w-3 transition-transform {showMoreAdapters
                  ? 'rotate-0'
                  : '-rotate-90'}"
              />
              More Agent Adapter Types
            </button>

            {#if showMoreAdapters}
              <div class="grid grid-cols-2 gap-2 mt-2">
                {#each extraAdapters as opt}
                  <button
                    disabled={!!opt.comingSoon}
                    class="flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors relative
                      {opt.comingSoon
                      ? 'border-gray-200 opacity-40 cursor-not-allowed'
                      : adapterType === opt.value
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:bg-gray-50 cursor-pointer'}"
                    onclick={() => {
                      if (!opt.comingSoon) selectAdapter(opt.value);
                    }}
                  >
                    <opt.icon class="h-4 w-4 text-gray-700" />
                    <span class="font-medium text-gray-900">{opt.label}</span>
                    <span class="text-gray-400 text-[10px]">
                      {opt.comingSoon ? (opt.disabledLabel ?? 'Coming soon') : opt.desc}
                    </span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Model selector (for local adapters) -->
          {#if isLocalAdapter}
            <div class="space-y-3">
              <div>
                <label class="text-xs text-gray-400 mb-1 block">Model</label>
                <div class="relative">
                  <button
                    class="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50 transition-colors w-full justify-between cursor-pointer text-gray-900"
                    onclick={() => {
                      modelOpen = !modelOpen;
                      if (!modelOpen) modelSearch = '';
                    }}
                  >
                    <span class={!model ? 'text-gray-400' : ''}>
                      {selectedModel
                        ? selectedModel.label
                        : model ||
                          (adapterType === 'opencode_local'
                            ? 'Select model (required)'
                            : 'Default')}
                    </span>
                    <ChevronDown class="h-3 w-3 text-gray-400" />
                  </button>

                  {#if modelOpen}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="absolute top-full left-0 right-0 z-20 mt-1 rounded-md border border-gray-200 bg-white shadow-lg p-1"
                      onclick={(e) => e.stopPropagation()}
                    >
                      <input
                        class="w-full px-2 py-1.5 text-xs bg-transparent outline-none border-b border-gray-200 mb-1 placeholder:text-gray-300 text-gray-900"
                        placeholder="Search models..."
                        bind:value={modelSearch}
                        autofocus
                      />
                      {#if adapterType !== 'opencode_local'}
                        <button
                          class="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer
                            {!model ? 'bg-gray-100' : ''} text-gray-900"
                          onclick={() => selectModel('')}
                        >
                          Default
                        </button>
                      {/if}
                      <div class="max-h-[240px] overflow-y-auto">
                        {#each groupedModels as group}
                          <div class="mb-1 last:mb-0">
                            {#if adapterType === 'opencode_local'}
                              <div
                                class="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400"
                              >
                                {group.provider} ({group.entries.length})
                              </div>
                            {/if}
                            {#each group.entries as m}
                              <button
                                class="flex items-center w-full px-2 py-1.5 text-sm rounded hover:bg-gray-100 cursor-pointer
                                  {m.id === model ? 'bg-gray-100' : ''} text-gray-900"
                                onclick={() => selectModel(m.id)}
                              >
                                <span class="block w-full text-left truncate" title={m.id}>
                                  {adapterType === 'opencode_local'
                                    ? extractModelName(m.id)
                                    : m.label}
                                </span>
                              </button>
                            {/each}
                          </div>
                        {/each}
                      </div>
                      {#if filteredModels.length === 0}
                        <p class="px-2 py-1.5 text-xs text-gray-400">No models discovered.</p>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            <!-- Adapter environment check -->
            <div class="space-y-2 rounded-md border border-gray-200 p-3">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="text-xs font-medium text-gray-900">Adapter environment check</p>
                  <p class="text-[11px] text-gray-400">
                    Runs a live probe that asks the adapter CLI to respond with hello.
                  </p>
                </div>
                <button
                  class="h-7 px-2.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-gray-700"
                  disabled={adapterEnvLoading}
                  onclick={() => runAdapterEnvironmentTest()}
                >
                  {adapterEnvLoading ? 'Testing...' : 'Test now'}
                </button>
              </div>

              {#if adapterEnvError}
                <div
                  class="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700"
                >
                  {adapterEnvError}
                </div>
              {/if}

              {#if adapterEnvResult?.status === 'pass'}
                <div
                  class="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-700"
                >
                  <Check class="h-3.5 w-3.5 shrink-0" />
                  <span class="font-medium">Passed</span>
                </div>
              {:else if adapterEnvResult}
                <!-- Adapter env result details -->
                {@const statusLabel =
                  adapterEnvResult.status === 'warn' ? 'Warnings' : 'Failed'}
                {@const statusClass =
                  adapterEnvResult.status === 'warn'
                    ? 'text-amber-700 border-amber-300 bg-amber-50'
                    : 'text-red-700 border-red-300 bg-red-50'}
                <div class="rounded-md border px-2.5 py-2 text-[11px] {statusClass}">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium">{statusLabel}</span>
                    <span class="opacity-80">
                      {new Date(adapterEnvResult.testedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div class="mt-1.5 space-y-1">
                    {#each adapterEnvResult.checks as check, idx}
                      <div class="leading-relaxed break-words">
                        <span class="font-medium uppercase tracking-wide opacity-80"
                          >{check.level}</span
                        >
                        <span class="mx-1 opacity-60">&middot;</span>
                        <span>{check.message}</span>
                        {#if check.detail}
                          <span class="block opacity-75 break-all">({check.detail})</span>
                        {/if}
                        {#if check.hint}
                          <span class="block opacity-90 break-words">Hint: {check.hint}</span>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              {#if shouldSuggestUnsetAnthropicApiKey}
                <div class="rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-2 space-y-2">
                  <p class="text-[11px] text-amber-800 leading-relaxed">
                    Claude failed while <span class="font-mono">ANTHROPIC_API_KEY</span> is set. You
                    can clear it in this CEO adapter config and retry the probe.
                  </p>
                  <button
                    class="h-7 px-2.5 text-xs rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-gray-700"
                    disabled={adapterEnvLoading || unsetAnthropicLoading}
                    onclick={() => handleUnsetAnthropicApiKey()}
                  >
                    {unsetAnthropicLoading ? 'Retrying...' : 'Unset ANTHROPIC_API_KEY'}
                  </button>
                </div>
              {/if}

              {#if adapterEnvResult?.status === 'fail'}
                <div
                  class="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] space-y-1.5"
                >
                  <p class="font-medium text-gray-900">Manual debug</p>
                  <p class="text-gray-500 font-mono break-all">
                    {getDebugCommand()}
                  </p>
                  <p class="text-gray-500">
                    Prompt: <span class="font-mono">Respond with hello.</span>
                  </p>
                  <p class="text-gray-500">
                    If auth fails, set {getDebugAuthHint()}.
                  </p>
                </div>
              {/if}
            </div>
          {/if}

          <!-- HTTP / OpenClaw Gateway URL field -->
          {#if adapterType === 'http' || adapterType === 'openclaw_gateway'}
            <div>
              <label class="text-xs text-gray-400 mb-1 block">
                {adapterType === 'openclaw_gateway' ? 'Gateway URL' : 'Webhook URL'}
              </label>
              <input
                class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm font-mono outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
                placeholder={adapterType === 'openclaw_gateway'
                  ? 'ws://127.0.0.1:18789'
                  : 'https://...'}
                bind:value={url}
              />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Step 3: Task -->
      {#if step === 3}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <ListTodo class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Give it something to do</h3>
              <p class="text-xs text-gray-500">
                Give your agent a small task to start with — a bug fix, a research question, writing
                a script.
              </p>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Task title</label>
            <input
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="e.g. Research competitor pricing"
              bind:value={taskTitle}
              autofocus
            />
          </div>
          <div>
            <label class="text-xs text-gray-400 mb-1 block">Description (optional)</label>
            <textarea
              bind:this={textareaEl}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[120px] max-h-[300px] overflow-y-auto text-gray-900"
              placeholder="Add more detail about what the agent should do..."
              bind:value={taskDescription}
            ></textarea>
          </div>
        </div>
      {/if}

      <!-- Step 4: Launch -->
      {#if step === 4}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <Rocket class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Ready to launch</h3>
              <p class="text-xs text-gray-500">
                Everything is set up. Launching now will create the starter task, wake the agent, and
                open the issue.
              </p>
            </div>
          </div>
          <div class="border border-gray-200 divide-y divide-gray-200 rounded-md">
            <div class="flex items-center gap-3 px-3 py-2.5">
              <Building2 class="h-4 w-4 text-gray-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{companyName}</p>
                <p class="text-xs text-gray-400">Company</p>
              </div>
              <Check class="h-4 w-4 text-green-500 shrink-0" />
            </div>
            <div class="flex items-center gap-3 px-3 py-2.5">
              <Bot class="h-4 w-4 text-gray-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{agentName}</p>
                <p class="text-xs text-gray-400">{ADAPTER_LABELS[adapterType] ?? adapterType}</p>
              </div>
              <Check class="h-4 w-4 text-green-500 shrink-0" />
            </div>
            <div class="flex items-center gap-3 px-3 py-2.5">
              <ListTodo class="h-4 w-4 text-gray-400 shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{taskTitle}</p>
                <p class="text-xs text-gray-400">Task</p>
              </div>
              <Check class="h-4 w-4 text-green-500 shrink-0" />
            </div>
          </div>
        </div>
      {/if}

      <!-- Error display -->
      {#if error}
        <div class="mt-3">
          <p class="text-xs text-red-600">{error}</p>
        </div>
      {/if}

      <!-- Footer navigation -->
      <div class="flex items-center justify-between mt-8">
        <div>
          {#if step > 1}
            <button
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 cursor-pointer"
              onclick={() => (step = (step - 1) as Step)}
              disabled={loading}
            >
              <ArrowLeft class="h-3.5 w-3.5" />
              Back
            </button>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if step === 1}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!companyName.trim() || loading}
              onclick={handleStep1Next}
            >
              {#if loading}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
                Creating...
              {:else}
                <ArrowRight class="h-3.5 w-3.5" />
                Next
              {/if}
            </button>
          {/if}
          {#if step === 2}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!agentName.trim() || loading || adapterEnvLoading}
              onclick={handleStep2Next}
            >
              {#if loading}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
                Creating...
              {:else}
                <ArrowRight class="h-3.5 w-3.5" />
                Next
              {/if}
            </button>
          {/if}
          {#if step === 3}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!taskTitle.trim() || loading}
              onclick={handleStep3Next}
            >
              <ArrowRight class="h-3.5 w-3.5" />
              Next
            </button>
          {/if}
          {#if step === 4}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={loading}
              onclick={handleLaunch}
            >
              {#if loading}
                <Loader2 class="h-3.5 w-3.5 animate-spin" />
                Creating...
              {:else}
                <Rocket class="h-3.5 w-3.5" />
                Create & Open Issue
              {/if}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Right side — decorative panel (only shown on step 1, hidden on mobile) -->
  <div
    class="hidden md:flex overflow-hidden transition-[width,opacity] duration-500 ease-in-out items-center justify-center
      {step === 1 ? 'w-1/2 opacity-100' : 'w-0 opacity-0'}"
    style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);"
  >
    <div class="relative w-full h-full flex items-center justify-center overflow-hidden">
      <!-- Dot pattern overlay -->
      <div
        class="absolute inset-0 opacity-20"
        style="background-image: radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px); background-size: 20px 20px;"
      ></div>
      <!-- Centered branding -->
      <div class="relative z-10 text-center px-8">
        <div class="flex items-center justify-center mb-4">
          <div
            class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10"
          >
            <Sparkles class="h-8 w-8 text-white/80" />
          </div>
        </div>
        <h2 class="text-2xl font-semibold text-white/90 mb-2">Welcome to ClawDev</h2>
        <p class="text-sm text-white/50 max-w-xs mx-auto leading-relaxed">
          Set up your AI-powered engineering organization in under a minute. Create a company, assign
          an agent, and watch it work.
        </p>
        <!-- Decorative animated dots -->
        <div class="flex items-center justify-center gap-2 mt-8">
          {#each Array(4) as _, i}
            <div
              class="w-2 h-2 rounded-full bg-white/30"
              style="animation: pulse 2s ease-in-out {i * 0.3}s infinite;"
            ></div>
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Click-outside handler to close model dropdown -->
{#if modelOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-40" onclick={() => (modelOpen = false)}></div>
{/if}

<style>
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.3;
      transform: scale(1);
    }
    50% {
      opacity: 0.8;
      transform: scale(1.3);
    }
  }
</style>
