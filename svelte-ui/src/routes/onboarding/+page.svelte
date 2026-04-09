<script lang="ts">
  import { ChevronLeft, Check, Rocket, Building2, Settings, Bot, X, ArrowRight, CheckCircle2, Zap, FolderKanban, CircleDot } from "lucide-svelte";
  import { authClient } from "$lib/auth-client";
  import { api } from "$lib/api";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { companyStore } from "$stores/company.svelte.js";
  import WebcamPixelGrid from "$lib/components/ui/webcam-pixel-grid/WebcamPixelGrid.svelte";
  import AgentConfigForm from "$lib/components/agent-config-form.svelte";
  import { AGENT_ADAPTER_OPTIONS } from "$lib/constants/agent-adapters";
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    listHierarchyPresetDefinitions,
    type HierarchyPreset,
  } from "@clawdev/shared";

  const TOTAL_STEPS = 4;

  let currentStep = $state(1);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let ready = $state(false);
  let routeOnboardingContext = $state(false);
  let nextPath = $state<string | null>(null);

  // Auto-detected state
  let hasSession = $state(false);
  let publicUrl = $state("");

  // Admin account (shown inline if no session)
  let adminName = $state("");
  let adminEmail = $state("");
  let adminPassword = $state("");
  let needsAdmin = $state(false);

  // Step 1: Company
  let companyName = $state("");
  let companyMission = $state("");
  let hierarchyPreset = $state<HierarchyPreset>("research_lab");
  let createdCompany = $state<{ id: string; slug?: string; issuePrefix?: string; name: string } | null>(null);
  let createdCompanyId = $state<string | null>(null);
  let createdCompanyPrefix = $state<string | null>(null);

  // Step 2: Agent
  let agentName = $state("CEO");
  let adapterType = $state("claude_local");
  let createdAgent = $state<{ id: string; name: string; role: string } | null>(null);
  let createdAgentTitle = $state<string | null>(null);
  let adapterConfig = $state<Record<string, any>>({});
  const hierarchyPresetOptions = listHierarchyPresetDefinitions();
  const MODEL_DISCOVERY_ADAPTERS = new Set([
    "claude_local",
    "codex_local",
    "copilot_local",
    "cursor",
    "gemini_local",
    "opencode_local",
    "pi_local",
    "openai_compatible_local",
  ]);
  const MODEL_FILTERS: Partial<Record<string, { providers?: string[]; idPrefix?: string }>> = {
    claude_local: { providers: ["anthropic"] },
    codex_local: { providers: ["openai"] },
    gemini_local: { providers: ["google"] },
    opencode_local: { idPrefix: "opencode/" },
    openai_compatible_local: { providers: ["openai"] },
  };
  const MODEL_PROVIDER_LABELS: Record<string, string> = {
    claude_local: "Anthropic",
    codex_local: "OpenAI",
    gemini_local: "Google",
    opencode_local: "OpenCode",
    openai_compatible_local: "OpenAI-Compatible Local",
    copilot_local: "Copilot",
    cursor: "Cursor",
    pi_local: "Pi",
  };
  interface AdapterModel {
    id: string;
    label: string;
    provider?: string;
    status?: string;
    statusDetail?: string;
  }
  let selectedProviderModels = $state<AdapterModel[]>([]);
  let selectedProviderModelsLoading = $state(false);
  let selectedProviderModelsError = $state<string | null>(null);
  let selectedProviderModelsRequestId = 0;

  // Step 3: Task
  let taskTitle = $state("Hire the first team according to the selected hierarchy");
  let taskDescription = $state("Use SDD to turn the company plan into action.\n\n- confirm the selected hierarchy and acceptance criteria\n- break the hiring roadmap into concrete workstreams\n- delegate execution to the right department and validate the result");
  let taskSpec = $state("Define the first actionable work item for the company launch plan and make it clear enough to execute.");
  let taskDesign = $state("Map the work into a single-owner execution slice that can be completed without cross-team ambiguity.");
  let taskRisk = $state("The main risk is startup scope drift, so keep the task narrow and verify ownership before execution.");
  let taskRollout = $state("Roll out the task as one controlled execution slice and confirm the first checkpoint before expanding.");
  let taskRollback = $state("If the task becomes unsafe, pause execution, revert the change, and reopen the work for review.");
  let taskValidation = $state("Confirm the work is scoped, assigned, and ready for the first execution pass.");
  let adminNameId = "setup-admin-name";
  let adminEmailId = "setup-admin-email";
  let adminPasswordId = "setup-admin-password";
  let companyNameId = "setup-company-name";
  let companyMissionId = "setup-company-mission";
  let agentNameId = "setup-agent-name";
  let taskTitleId = "setup-task-title";
  let taskDescriptionId = "setup-task-description";
  let taskSpecId = "setup-task-spec";
  let taskDesignId = "setup-task-design";
  let taskRiskId = "setup-task-risk";
  let taskRolloutId = "setup-task-rollout";
  let taskRollbackId = "setup-task-rollback";
  let taskValidationId = "setup-task-validation";

  const stepMeta: Array<{ label: string }> = [
    { label: "Company" },
    { label: "Agent" },
    { label: "Task" },
    { label: "Launch" },
  ];

  // Track which steps have been completed
  let completedSteps = $state(new Set<number>());

  const session = authClient.useSession();

  onMount(async () => {
    const searchParams = new URLSearchParams(window.location.search);
    const requestedStep = (() => {
      const parsed = Number.parseInt(searchParams.get("step") ?? "", 10);
      return parsed === 2 || parsed === 3 || parsed === 4 ? parsed : 1;
    })();
    const requestedCompanyId = searchParams.get("companyId")?.trim() || null;
    const requestedCompanyPrefix = searchParams.get("companyPrefix")?.trim() || null;
    nextPath = searchParams.get("next")?.trim() || null;

    try {
      const res = await fetch("/api/health");
      const health = await res.json();

      // Already has companies — setup is done, go to root
      const routeAwareOnboardingRequested = Boolean(requestedCompanyId) && requestedStep > 1;
      if (health.hasCompanies && !routeAwareOnboardingRequested) {
        goto("/", { replaceState: true });
        return;
      }

      // In local_trusted mode, no admin account needed
      if (health.deploymentMode !== "authenticated") {
        hasSession = true;
        needsAdmin = false;
      } else if (health.bootstrapStatus !== "bootstrap_pending" && health.hasCompanies) {
        goto("/", { replaceState: true });
        return;
      }
    } catch {
      goto("/", { replaceState: true });
      return;
    }

    publicUrl = window.location.origin;

    if (requestedCompanyId) {
      routeOnboardingContext = true;
      createdCompanyId = requestedCompanyId;
      const matchedCompany = companyStore.companies.find((company) => company.id === requestedCompanyId);
      createdCompanyPrefix =
        requestedCompanyPrefix ??
        matchedCompany?.slug ??
        matchedCompany?.issuePrefix ??
        requestedCompanyId;
      companyStore.select(requestedCompanyId, "route_sync");
      currentStep = requestedStep > 1 ? requestedStep : 2;
      completedSteps = new Set(
        Array.from({ length: Math.max(currentStep - 1, 0) }, (_, index) => index + 1)
      );
      createdCompany = matchedCompany
        ? {
            id: matchedCompany.id,
            slug: matchedCompany.slug,
            issuePrefix: matchedCompany.issuePrefix,
            name: matchedCompany.name
          }
        : {
            id: requestedCompanyId,
            slug: createdCompanyPrefix,
            issuePrefix: createdCompanyPrefix,
            name: createdCompanyPrefix
          };
    }

    // Check if we already have a session (authenticated mode)
    if (!hasSession) {
      if ($session.data) {
        hasSession = true;
        needsAdmin = false;
      } else {
        needsAdmin = true;
      }
    }

    ready = true;
  });

  $effect(() => {
    if ($session.data) {
      hasSession = true;
      needsAdmin = false;
    }
  });

  function goToStep(step: number) {
    // Allow going backwards to completed steps
    if (routeOnboardingContext && step === 1) {
      return;
    }
    if (step < currentStep) {
      currentStep = step;
    }
  }

  function markCompleted(step: number) {
    completedSteps = new Set([...completedSteps, step]);
  }

  function setAdapterConfigField(key: string, value: unknown) {
    adapterConfig = { ...adapterConfig, [key]: value };
  }

  function selectedHierarchyPresetDefinition() {
    return getHierarchyPresetDefinition(hierarchyPreset) ?? hierarchyPresetOptions[0] ?? null;
  }

  function selectedHierarchyPresetDepartments() {
    return getHierarchyPresetDepartments(hierarchyPreset);
  }

  function selectedHierarchyPresetOperatingRules() {
    return getHierarchyPresetOperatingRules(hierarchyPreset);
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

  function normalizeAdapterModels(data: unknown): AdapterModel[] {
    const raw = Array.isArray(data)
      ? data
      : typeof data === "object" && data !== null
        ? ((data as { models?: unknown }).models ?? (data as { items?: unknown }).items ?? [])
        : [];

    if (!Array.isArray(raw)) return [];

    const normalized: AdapterModel[] = [];
    for (const entry of raw) {
      if (typeof entry !== "object" || entry === null) continue;
      const id = String((entry as { id?: unknown }).id ?? (entry as { modelId?: unknown }).modelId ?? "").trim();
      if (!id) continue;
      const label = String(
        (entry as { label?: unknown }).label ??
          (entry as { name?: unknown }).name ??
          (entry as { modelId?: unknown }).modelId ??
          id,
      ).trim() || id;
      normalized.push({
        id,
        label,
        provider:
          typeof (entry as { provider?: unknown }).provider === "string"
            ? (entry as { provider?: string }).provider
            : undefined,
        status:
          typeof (entry as { status?: unknown }).status === "string"
            ? (entry as { status?: string }).status
            : undefined,
        statusDetail:
          typeof (entry as { statusDetail?: unknown }).statusDetail === "string"
            ? (entry as { statusDetail?: string }).statusDetail
            : undefined,
      });
    }

    return normalized;
  }

  async function loadSelectedProviderModels() {
    if (!createdCompanyId || !MODEL_DISCOVERY_ADAPTERS.has(adapterType)) {
      selectedProviderModels = [];
      selectedProviderModelsError = null;
      selectedProviderModelsLoading = false;
      return;
    }

    const requestId = ++selectedProviderModelsRequestId;
    selectedProviderModelsLoading = true;
    selectedProviderModelsError = null;

    try {
      const res = await api(`/api/models?adapterType=${encodeURIComponent(adapterType)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Failed to load ${adapterType} models (${res.status})`);
      }
      const data = await res.json();
      const raw = Array.isArray(data?.models) ? data.models : [];
      const models = filterAdapterModels(
        normalizeAdapterModels(raw).filter(
          (model) =>
            model.status === "available" ||
            model.status === "cooldown" ||
            model.status === "unknown",
        ),
      );
      if (requestId !== selectedProviderModelsRequestId) return;
      selectedProviderModels = models;
      const currentModel = typeof adapterConfig.model === "string" ? adapterConfig.model.trim() : "";
      if (models.length > 0 && (!currentModel || !models.some((model) => model.id === currentModel))) {
        setAdapterConfigField("model", models[0]!.id);
      }
    } catch (err) {
      if (requestId !== selectedProviderModelsRequestId) return;
      selectedProviderModels = [];
      selectedProviderModelsError = err instanceof Error ? err.message : "Failed to load provider models";
    } finally {
      if (requestId === selectedProviderModelsRequestId) {
        selectedProviderModelsLoading = false;
      }
    }
  }

  $effect(() => {
    void currentStep;
    void createdCompanyId;
    void adapterType;
    if (currentStep !== 2 || !createdCompanyId || !MODEL_DISCOVERY_ADAPTERS.has(adapterType)) {
      selectedProviderModels = [];
      selectedProviderModelsError = null;
      selectedProviderModelsLoading = false;
      return;
    }
    void loadSelectedProviderModels();
  });

  async function ensureAdmin(): Promise<boolean> {
    if (hasSession) return true;
    // Need to create admin first
    try {
      const result = await authClient.signUp.email({
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      });
      if (result.error) {
        error = result.error.message ?? "Failed to create admin account";
        return false;
      }
      hasSession = true;
      needsAdmin = false;
      return true;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
      return false;
    }
  }

  async function handleCompanyStep() {
    if (loading || createdCompany) return;
    error = null;
    loading = true;
    try {
      // If we need admin, create it first
      if (needsAdmin) {
        const ok = await ensureAdmin();
        if (!ok) return;
      }

      // Create company
      const companyRes = await api("/api/companies", {
        method: "POST",
        body: JSON.stringify({
          name: companyName,
          description: companyMission || undefined,
          hierarchyPreset,
        }),
      });
      if (!companyRes.ok) {
        const body = await companyRes.json().catch(() => null);
        error = body?.message ?? `Failed to create company (${companyRes.status})`;
        return;
      }
      const company = await companyRes.json();
      createdCompany = company;
      createdCompanyId = company.id;
      createdCompanyPrefix = company.slug ?? company.issuePrefix ?? company.id;
      companyStore.select(company.id, "manual");
      markCompleted(1);
      currentStep = 2;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  async function handleAgentStep() {
    if (!createdCompany || loading) return;
    // If agent already created, just advance to step 3
    if (createdAgent) {
      markCompleted(2);
      currentStep = 3;
      return;
    }
    error = null;
    loading = true;
    try {
      const companyId = createdCompany.id;

      // 1. Create the CEO agent
      const res = await api(`/api/companies/${companyId}/agents`, {
        method: "POST",
        body: JSON.stringify({
          name: agentName,
          role: "ceo",
          adapterType,
          adapterConfig,
          title: selectedHierarchyPresetDefinition()?.rootTitle ?? "Chief Executive Officer",
          status: "idle",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        error = body?.message ?? `Failed to create agent (${res.status})`;
        return;
      }
      const ceoAgent = await res.json();
      createdAgent = ceoAgent;
      createdAgentTitle = selectedHierarchyPresetDefinition()?.rootTitle ?? "Chief Executive Officer";

      markCompleted(2);
      currentStep = 3;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  // Store created entities for launch summary
  let createdGoalId = $state<string | null>(null);
  let createdProjectId = $state<string | null>(null);
  let createdIssue = $state<{ id: string; identifier?: string } | null>(null);

  async function handleTaskStep() {
    if (!createdCompany || loading) return;
    error = null;
    loading = true;
    try {
      const companyId = createdCompany.id;

      // 1. Create goal from company mission (if provided)
      if (companyMission && !createdGoalId) {
        const goalRes = await api(`/api/companies/${companyId}/goals`, {
          method: "POST",
          body: JSON.stringify({
            title: companyMission.split("\n")[0]?.trim() || companyMission,
            description: companyMission.split("\n").slice(1).join("\n").trim() || undefined,
            level: "company",
            status: "active",
          }),
        });
        if (goalRes.ok) {
          const goal = await goalRes.json();
          createdGoalId = goal.id;
        }
      }

      // 2. Create "Onboarding" project linked to goal
      if (!createdProjectId) {
        const projectPayload: Record<string, unknown> = {
          name: "Onboarding",
          status: "in_progress",
          description: companyMission || undefined,
          sddSpec: `Establish the first operational project for ${companyName || "the company"}.`,
          sddDesign: `Use the ${selectedHierarchyPresetDefinition()?.label ?? "selected"} hierarchy to organize the onboarding work into a safe delivery path.`,
          sddRisk: "The main risk is onboarding drift, so keep the first project narrow and verify the setup path before execution.",
          sddRollout: "Roll out onboarding in one controlled project slice, then add agents and tasks only after the launch path is stable.",
          sddRollback: "If onboarding fails validation, pause the launch, revert the incomplete setup, and retry from the beginning.",
          sddValidation: "Confirm the onboarding project can support agent setup, task intake, and launch readiness.",
        };
        if (createdGoalId) {
          projectPayload.goalIds = [createdGoalId];
        }
        const projectRes = await api(`/api/companies/${companyId}/projects`, {
          method: "POST",
          body: JSON.stringify(projectPayload),
        });
        if (projectRes.ok) {
          const project = await projectRes.json();
          createdProjectId = project.id;
        }
      }

      // 3. Create issue linked to project + goal + assigned to agent
      const issueBody: Record<string, unknown> = {
        title: taskTitle,
        description: taskDescription || undefined,
        sddSpec: taskSpec,
        sddDesign: taskDesign,
        sddRisk: taskRisk,
        sddRollout: taskRollout,
        sddRollback: taskRollback,
        sddValidation: taskValidation,
        status: "todo",
      };
      if (createdAgent) issueBody.assigneeAgentId = createdAgent.id;
      if (createdProjectId) issueBody.projectId = createdProjectId;
      if (createdGoalId) issueBody.goalId = createdGoalId;

      const res = await api(`/api/companies/${companyId}/issues`, {
        method: "POST",
        body: JSON.stringify(issueBody),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => null);
        error = resBody?.message ?? `Failed to create task (${res.status})`;
        return;
      }
      const issue = await res.json();
      createdIssue = { id: issue.id, identifier: issue.identifier };
      markCompleted(3);
      currentStep = 4;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  function skipTask() {
    markCompleted(3);
    currentStep = 4;
  }

  function companyPrefix(): string {
    return createdCompanyPrefix ?? createdCompany?.slug ?? createdCompany?.issuePrefix ?? createdCompany?.id ?? "";
  }

  function goToDashboard() {
    // Navigate to created issue if available (like Paperclip), else dashboard
    if (createdIssue?.identifier && createdCompany) {
      goto(`/${companyPrefix()}/issues/${createdIssue.identifier}`, { replaceState: true });
      return;
    }
    const target = nextPath || (createdCompany ? `/${companyPrefix()}/dashboard` : "/");
    goto(target || "/", { replaceState: true });
  }

  function handleClose() {
    const target = nextPath || (createdCompany ? `/${companyPrefix()}/dashboard` : "/");
    if (target) {
      goto(target, { replaceState: true });
    } else {
      goto("/", { replaceState: true });
    }
  }
</script>

{#if !ready}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-white">
  <p class="text-sm text-gray-400">Loading...</p>
</div>
{:else}
<!-- Full-screen onboarding overlay -->
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
    class="w-full flex flex-col overflow-y-auto transition-[width] duration-500 ease-in-out {currentStep === 1 ? 'md:w-1/2' : 'md:w-full'}"
  >
    <div class="w-full max-w-md mx-auto my-auto px-8 py-12 shrink-0">
      <!-- Progress tabs -->
      <div class="flex items-center gap-0 mb-8 border-b border-gray-200">
        {#each stepMeta as meta, i}
          {@const stepNum = i + 1}
          <button
            type="button"
            onclick={() => goToStep(stepNum)}
            class="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors cursor-pointer
              {stepNum === currentStep
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'}"
          >
            {#if meta.label === "Company"}
              <Building2 class="h-3.5 w-3.5" />
            {:else if meta.label === "Agent"}
              <Bot class="h-3.5 w-3.5" />
            {:else if meta.label === "Task"}
              <Settings class="h-3.5 w-3.5" />
            {:else if meta.label === "Launch"}
              <Rocket class="h-3.5 w-3.5" />
            {/if}
            {meta.label}
          </button>
        {/each}
      </div>

      <!-- Step 1: Company -->
      {#if currentStep === 1}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <Building2 class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Name your company</h3>
              <p class="text-xs text-gray-500">This is the organization your agents will work for.</p>
            </div>
          </div>

          {#if needsAdmin}
            <div class="space-y-4">
              <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Admin Account</div>
              <div class="group">
                <label for={adminNameId} class="text-xs mb-1 block transition-colors {adminName.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Name</label>
                <input id={adminNameId} class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900" placeholder="Your name" bind:value={adminName} autocomplete="name" />
              </div>
              <div class="group">
                <label for={adminEmailId} class="text-xs mb-1 block transition-colors {adminEmail.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Email</label>
                <input id={adminEmailId} class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900" type="email" placeholder="admin@example.com" bind:value={adminEmail} autocomplete="email" />
              </div>
              <div class="group">
                <label for={adminPasswordId} class="text-xs mb-1 block transition-colors {adminPassword.length > 0 ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Password</label>
                <input id={adminPasswordId} class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900" type="password" placeholder="Minimum 8 characters" bind:value={adminPassword} minlength="8" autocomplete="new-password" />
              </div>
              <div class="h-px bg-gray-100 my-2"></div>
              <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Company Details</div>
            </div>
          {/if}

          <div class="group">
            <label for={companyNameId} class="text-xs mb-1 block transition-colors {companyName.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Company name</label>
            <input
              id={companyNameId}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="Acme Corp"
              bind:value={companyName}
            />
          </div>
          <div class="group">
            <label for={companyMissionId} class="text-xs mb-1 block transition-colors {companyMission.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Mission / goal (optional)</label>
            <textarea
              id={companyMissionId}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[60px] text-gray-900"
              placeholder="What is this company trying to achieve?"
              bind:value={companyMission}
            ></textarea>
          </div>

          <div class="group">
            <label for="hierarchy-preset" class="text-xs mb-1 block transition-colors text-gray-400 group-focus-within:text-gray-900">Hierarchy preset</label>
            <select
              id="hierarchy-preset"
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 text-gray-900"
              bind:value={hierarchyPreset}
            >
              {#each hierarchyPresetOptions as preset}
                <option value={preset.id}>
                  {preset.label}
                </option>
              {/each}
            </select>
            {#if selectedHierarchyPresetDefinition()}
              <p class="text-[10px] text-gray-400 mt-1">
                {selectedHierarchyPresetDefinition()?.fit}
              </p>
            {/if}
          </div>

          {#if selectedHierarchyPresetDefinition()}
            {@const hierarchyPresetDefinition = selectedHierarchyPresetDefinition()}
            <div class="rounded-lg border border-gray-200 bg-white/80 p-4">
              <div class="mb-2">
                <h4 class="text-sm font-medium text-gray-900">{hierarchyPresetDefinition.label}</h4>
                <p class="text-xs text-gray-500">{hierarchyPresetDefinition.description}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-700">
                  {hierarchyPresetDefinition.rootSubtitle}
                </span>
                {#each hierarchyPresetDefinition.seedAgents.slice(0, 4) as seed}
                  <span class="inline-flex items-center rounded-full border border-gray-200 px-2 py-1 text-[10px] text-gray-600">
                    {seed.level.toUpperCase()}:
                    {seed.title}
                  </span>
                {/each}
              </div>
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Departments</p>
                  <div class="flex flex-wrap gap-1.5">
                    {#each selectedHierarchyPresetDepartments() as department}
                      <span class="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[10px] text-gray-700">
                        {department.label}
                        <span class="text-gray-400">·</span>
                        {department.level.toUpperCase().replace("_", " ")}
                      </span>
                    {/each}
                  </div>
                </div>
                <div>
                  <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Operating rules</p>
                  <ul class="space-y-1 text-[10px] text-gray-600">
                    {#each selectedHierarchyPresetOperatingRules() as rule}
                      <li class="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
                        <span class="font-medium text-gray-700">{rule.title}:</span> {rule.description}
                      </li>
                    {/each}
                  </ul>
                </div>
              </div>
            </div>
          {/if}
        </div>

      <!-- Step 2: Agent -->
      {:else if currentStep === 2}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <Bot class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Create your CEO</h3>
              <p class="text-xs text-gray-500">The CEO will wake up first and hire the rest of the hierarchy later.</p>
            </div>
          </div>

          <div>
            <label for={agentNameId} class="text-xs text-gray-400 mb-1 block">Agent name</label>
            <input
              id={agentNameId}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="CEO"
              bind:value={agentName}
            />
          </div>

          <div>
            <div class="text-xs text-gray-400 mb-2 block">Adapter type</div>
            <div class="grid grid-cols-2 gap-2">
              {#each AGENT_ADAPTER_OPTIONS as opt}
                <button
                  class="flex flex-col items-center gap-1.5 rounded-md border p-3 text-xs transition-colors cursor-pointer
                    {adapterType === opt.value
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:bg-gray-50'}"
                  onclick={() => (adapterType = opt.value)}
                >
                  <Bot class="h-4 w-4 text-gray-700" />
                  <span class="font-medium text-gray-900">{opt.label}</span>
                </button>
              {/each}
            </div>
          </div>

          {#if createdCompanyId && MODEL_DISCOVERY_ADAPTERS.has(adapterType)}
            <div class="rounded-lg border border-gray-200 bg-white/80 p-4">
            <div class="mb-3">
                <h4 class="text-sm font-medium text-gray-900">Model selector</h4>
                <p class="text-xs text-gray-500">Pick the model from {getAdapterModelSourceLabel()}.</p>
              </div>

              {#if selectedProviderModelsLoading}
                <div class="flex items-center gap-2 text-xs text-gray-500">
                  <span class="h-3 w-3 animate-spin rounded-full border border-gray-300 border-t-gray-900"></span>
                  Loading models...
                </div>
              {:else if selectedProviderModelsError}
                <div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {selectedProviderModelsError}
                </div>
              {:else if selectedProviderModels.length === 0}
                <div class="space-y-2">
                  <label for="provider-model" class="text-xs text-gray-400 mb-1 block">Model</label>
                  <div class="relative">
                    <select
                      id="provider-model"
                      class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 text-gray-900"
                      value={typeof adapterConfig.model === "string" && adapterConfig.model.trim() ? adapterConfig.model : "auto"}
                      onchange={(e) => setAdapterConfigField("model", e.currentTarget.value)}
                    >
                      <option value="auto">Auto (managed)</option>
                    </select>
                  </div>
                  <p class="text-[10px] text-gray-400">
                    No models were discovered for this provider. Auto routing will pick a compatible model when available.
                  </p>
                </div>
              {:else}
                <div class="space-y-2">
                  <label for="provider-model" class="text-xs text-gray-400 mb-1 block">Model</label>
                  <div class="relative">
                    <select
                      id="provider-model"
                      class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 text-gray-900"
                      value={typeof adapterConfig.model === "string" && adapterConfig.model.trim() ? adapterConfig.model : "auto"}
                      onchange={(e) => setAdapterConfigField("model", e.currentTarget.value)}
                    >
                      <option value="auto">Auto (managed)</option>
                      {#each selectedProviderModels as model}
                        <option value={model.id}>
                          {model.label}{model.provider ? ` (${model.provider})` : ""}
                        </option>
                      {/each}
                    </select>
                  </div>
                  <p class="text-[10px] text-gray-400">
                    {#if typeof adapterConfig.model === "string" && adapterConfig.model}
                      Selected: {adapterConfig.model}
                    {:else}
                      A model will be selected automatically.
                    {/if}
                  </p>
                </div>
              {/if}
            </div>
          {/if}

          <div>
            <div class="text-xs text-gray-400 mb-1 block">Role</div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-900">
              <Bot class="h-3.5 w-3.5" />
              {selectedHierarchyPresetDefinition()?.rootTitle ?? "Chief Executive Officer"}
            </div>
            <p class="text-[10px] text-gray-400 mt-1">
              This bootstrap step creates only the CEO. The rest of the hierarchy is hired later by the CEO.
            </p>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white/80 p-4">
            <div class="mb-3">
              <h4 class="text-sm font-medium text-gray-900">Connector settings</h4>
              <p class="text-xs text-gray-500">Refine the adapter configuration before launching the first agent.</p>
            </div>
            <AgentConfigForm {adapterType} companyId={createdCompanyId} bind:config={adapterConfig} mode="create" showModelControls={false} />
          </div>
        </div>

      <!-- Step 3: Task -->
      {:else if currentStep === 3}
        <div class="space-y-5">
          <div class="flex items-center gap-3 mb-1">
            <div class="bg-gray-100 p-2 rounded">
              <Rocket class="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Create your first task</h3>
              <p class="text-xs text-gray-500">
                Give {createdAgent?.name ?? "your agent"} something to work on.
              </p>
            </div>
          </div>

          <div>
            <label for={taskTitleId} class="text-xs text-gray-400 mb-1 block">Task title</label>
            <input
              id={taskTitleId}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="Set up the project repository"
              bind:value={taskTitle}
            />
          </div>

          <div>
            <label for={taskDescriptionId} class="text-xs text-gray-400 mb-1 block">Description (optional)</label>
            <textarea
              id={taskDescriptionId}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[80px] text-gray-900"
              placeholder="Describe what needs to be done..."
              bind:value={taskDescription}
            ></textarea>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <div>
              <label for={taskSpecId} class="text-xs text-gray-400 mb-1 block">Spec *</label>
              <textarea
                id={taskSpecId}
                class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[110px] text-gray-900"
                placeholder="State the problem and acceptance criteria..."
                bind:value={taskSpec}
              ></textarea>
            </div>
            <div>
              <label for={taskDesignId} class="text-xs text-gray-400 mb-1 block">Design *</label>
              <textarea
                id={taskDesignId}
                class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[110px] text-gray-900"
                placeholder="Map the delivery path and ownership..."
                bind:value={taskDesign}
              ></textarea>
            </div>
          </div>
          <div class="grid gap-4 lg:grid-cols-3">
            <div>
              <label for={taskRiskId} class="text-xs text-gray-400 mb-1 block">Risk *</label>
              <textarea
                id={taskRiskId}
                class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[110px] text-gray-900"
                placeholder="Describe the main delivery risks and mitigations."
                bind:value={taskRisk}
              ></textarea>
            </div>
            <div>
              <label for={taskRolloutId} class="text-xs text-gray-400 mb-1 block">Rollout *</label>
              <textarea
                id={taskRolloutId}
                class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[110px] text-gray-900"
                placeholder="Describe the safe rollout path."
                bind:value={taskRollout}
              ></textarea>
            </div>
            <div>
              <label for={taskRollbackId} class="text-xs text-gray-400 mb-1 block">Rollback *</label>
              <textarea
                id={taskRollbackId}
                class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[110px] text-gray-900"
                placeholder="Describe how to reverse the change safely."
                bind:value={taskRollback}
              ></textarea>
            </div>
          </div>
          <div>
            <label for={taskValidationId} class="text-xs text-gray-400 mb-1 block">Validation *</label>
            <textarea
              id={taskValidationId}
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[80px] text-gray-900"
              placeholder="How will we confirm the result is safe and correct?"
              bind:value={taskValidation}
            ></textarea>
          </div>
        </div>

      <!-- Step 4: Launch -->
      {:else if currentStep === 4}
        <div class="space-y-5 text-center">
          <div class="flex justify-center mb-4">
            <div class="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 class="h-8 w-8 text-green-500" />
            </div>
          </div>

          <h3 class="font-medium text-gray-900 text-lg">Your company is ready!</h3>
          <p class="text-sm text-gray-500">
            {createdCompany?.name ?? "Your company"} is set up and ready to go.
            {#if createdAgent}
              {createdAgent.name} is standing by as your CEO and will hire the rest of the hierarchy after wakeup.
            {/if}
            {#if createdIssue?.identifier}
              Your first task <strong>{createdIssue.identifier}</strong> is assigned and the agent is being woken up.
            {/if}
          </p>

          <div class="text-left border border-gray-100 rounded-lg divide-y divide-gray-100 mt-6">
            {#if createdCompany}
              <div class="flex items-center gap-3 px-4 py-3">
                <Building2 class="h-4 w-4 text-gray-400" />
                <span class="text-xs text-gray-500">Company</span>
                <span class="text-sm font-medium text-gray-900 ml-auto">{createdCompany.name}</span>
                <Check class="h-4 w-4 text-green-500" />
              </div>
            {/if}
            {#if createdAgent}
              <div class="flex items-center gap-3 px-4 py-3">
                <Bot class="h-4 w-4 text-gray-400" />
                <span class="text-xs text-gray-500">Founder Agent</span>
                <span class="text-sm font-medium text-gray-900 ml-auto">
                  {createdAgent.name}
                  {#if createdAgentTitle}
                    <span class="text-xs text-gray-500"> · {createdAgentTitle}</span>
                  {/if}
                </span>
                <Check class="h-4 w-4 text-green-500" />
              </div>
            {/if}
            {#if createdProjectId}
              <div class="flex items-center gap-3 px-4 py-3">
                <FolderKanban class="h-4 w-4 text-gray-400" />
                <span class="text-xs text-gray-500">Project</span>
                <span class="text-sm font-medium text-gray-900 ml-auto">Onboarding</span>
                <Check class="h-4 w-4 text-green-500" />
              </div>
            {/if}
            {#if createdIssue}
              <div class="flex items-center gap-3 px-4 py-3">
                <CircleDot class="h-4 w-4 text-gray-400" />
                <span class="text-xs text-gray-500">Task</span>
                <span class="text-sm font-medium text-gray-900 ml-auto">{createdIssue.identifier ?? "Created"}</span>
                <Check class="h-4 w-4 text-green-500" />
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if error}
        <div class="mt-4 p-3 rounded-md bg-red-50 border border-red-200">
          <p class="text-sm text-red-700">{error}</p>
        </div>
      {/if}

      <!-- Footer navigation -->
      <div class="flex items-center justify-between mt-8">
        <div>
          {#if currentStep > 1}
            <button
              class="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              onclick={() => goToStep(currentStep - 1)}
            >
              <ChevronLeft class="h-3.5 w-3.5" />
              Back
            </button>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if currentStep === 3}
            <button
              class="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 rounded-md transition-colors cursor-pointer"
              onclick={skipTask}
            >
              Skip
            </button>
          {/if}

          {#if currentStep === 1}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!companyName.trim() || loading}
              onclick={handleCompanyStep}
            >
              {#if loading}
                Creating...
              {:else}
                <ArrowRight class="h-3.5 w-3.5" />
                Next
              {/if}
            </button>
          {:else if currentStep === 2}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!agentName.trim() || loading}
              onclick={handleAgentStep}
            >
              {#if loading}
                Creating...
              {:else}
                <ArrowRight class="h-3.5 w-3.5" />
                Next
              {/if}
            </button>
          {:else if currentStep === 3}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={!taskTitle.trim() || loading}
              onclick={handleTaskStep}
            >
              <ArrowRight class="h-3.5 w-3.5" />
              Next
            </button>
          {:else if currentStep === 4}
            <button
              class="inline-flex items-center gap-1 px-4 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={loading}
              onclick={goToDashboard}
            >
              <Rocket class="h-3.5 w-3.5" />
              {createdIssue?.identifier ? `Open ${createdIssue.identifier}` : "Go to Dashboard"}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Right side — WebcamPixelGrid (only shown on step 1, hidden on mobile) -->
  <div
    class="hidden md:flex overflow-hidden transition-[width,opacity] duration-500 ease-in-out items-center justify-center
      {currentStep === 1 ? 'w-1/2 opacity-100' : 'w-0 opacity-0'}"
    style="background: #030303;"
  >
    <div class="relative w-full h-full">
      <!-- Pixel grid background -->
      <div class="absolute inset-0">
        <WebcamPixelGrid
          gridCols={60}
          gridRows={40}
          maxElevation={50}
          motionSensitivity={0.25}
          elevationSmoothing={0.2}
          colorMode="webcam"
          backgroundColor="#030303"
          mirror={true}
          gapRatio={0.05}
          invertColors={false}
          darken={0.6}
          borderColor="#ffffff"
          borderOpacity={0.06}
          className="w-full h-full"
        />
      </div>

      <!-- Gradient overlay for text readability -->
      <div class="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 pointer-events-none"></div>

      <!-- Centered branding text -->
      <div class="relative z-10 flex h-full items-center justify-center">
        <div class="text-center px-8">
          <div class="flex items-center justify-center mb-4">
            <div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Zap class="h-8 w-8 text-white/80" />
            </div>
          </div>
          <h2 class="text-2xl font-semibold text-white/90 mb-2">Welcome to ClawDev</h2>
          <p class="text-sm text-white/50 max-w-xs mx-auto leading-relaxed">
            Set up your AI-powered engineering organization in under a minute. Create a company, assign an agent, and watch it work.
          </p>
        </div>
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  /* Minimal styles for the full-screen onboarding — mostly Tailwind classes inline */
</style>
