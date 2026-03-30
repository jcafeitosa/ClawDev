<script lang="ts">
  import { ChevronLeft, Check, Rocket, Building2, Settings, Bot, X, ArrowRight, CheckCircle2, Zap } from "lucide-svelte";
  import { authClient } from "$lib/auth-client";
  import { api } from "$lib/api";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import WebcamPixelGrid from "$lib/components/ui/webcam-pixel-grid/WebcamPixelGrid.svelte";

  const TOTAL_STEPS = 4;

  let currentStep = $state(1);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let ready = $state(false);

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
  let createdCompany = $state<{ id: string; slug: string; name: string } | null>(null);

  // Step 2: Agent
  let agentName = $state("");
  let adapterType = $state("claude_local");
  let createdAgent = $state<{ id: string; name: string; role: string } | null>(null);

  // Step 3: Task
  let taskTitle = $state("");
  let taskDescription = $state("");

  const ADAPTER_OPTIONS = [
    { value: "claude_local", label: "Claude (Local)" },
    { value: "codex_local", label: "Codex (Local)" },
    { value: "cursor", label: "Cursor" },
    { value: "gemini_local", label: "Gemini (Local)" },
    { value: "opencode_local", label: "OpenCode (Local)" },
    { value: "pi_local", label: "Pi (Local)" },
    { value: "openclaw_gateway", label: "OpenClaw Gateway" },
  ];

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
    try {
      const res = await fetch("/api/health");
      const health = await res.json();

      // Already has companies — setup is done, go to root
      if (health.hasCompanies) {
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
    if (step < currentStep) {
      currentStep = step;
    }
  }

  function markCompleted(step: number) {
    completedSteps = new Set([...completedSteps, step]);
  }

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
        body: JSON.stringify({ name: companyName, mission: companyMission || undefined }),
      });
      if (!companyRes.ok) {
        const body = await companyRes.json().catch(() => null);
        error = body?.message ?? `Failed to create company (${companyRes.status})`;
        return;
      }
      const company = await companyRes.json();
      createdCompany = company;
      markCompleted(1);
      currentStep = 2;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  async function handleAgentStep() {
    if (!createdCompany) return;
    error = null;
    loading = true;
    try {
      const res = await api(`/api/companies/${createdCompany.id}/agents`, {
        method: "POST",
        body: JSON.stringify({
          name: agentName,
          role: "ceo",
          adapterType,
          title: "Chief Executive Officer",
          status: "idle",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        error = body?.message ?? `Failed to create agent (${res.status})`;
        return;
      }
      const agent = await res.json();
      createdAgent = agent;
      markCompleted(2);
      currentStep = 3;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  async function handleTaskStep() {
    if (!createdCompany) return;
    error = null;
    loading = true;
    try {
      const body: Record<string, unknown> = {
        title: taskTitle,
        description: taskDescription || undefined,
        status: "todo",
      };
      if (createdAgent) {
        body.assigneeAgentId = createdAgent.id;
      }
      const res = await api(`/api/companies/${createdCompany.id}/issues`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => null);
        error = resBody?.message ?? `Failed to create task (${res.status})`;
        return;
      }
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

  function goToDashboard() {
    if (createdCompany) {
      goto(`/${createdCompany.slug ?? createdCompany.id}/dashboard`, { replaceState: true });
    } else {
      goto("/", { replaceState: true });
    }
  }

  function handleClose() {
    if (createdCompany) {
      goto(`/${createdCompany.slug ?? createdCompany.id}/dashboard`, { replaceState: true });
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
<!-- Full-screen overlay matching Paperclip onboarding -->
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
                <label class="text-xs mb-1 block transition-colors {adminName.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Name</label>
                <input class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900" placeholder="Your name" bind:value={adminName} autocomplete="name" />
              </div>
              <div class="group">
                <label class="text-xs mb-1 block transition-colors {adminEmail.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Email</label>
                <input class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900" type="email" placeholder="admin@example.com" bind:value={adminEmail} autocomplete="email" />
              </div>
              <div class="group">
                <label class="text-xs mb-1 block transition-colors {adminPassword.length > 0 ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Password</label>
                <input class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900" type="password" placeholder="Minimum 8 characters" bind:value={adminPassword} minlength="8" autocomplete="new-password" />
              </div>
              <div class="h-px bg-gray-100 my-2"></div>
              <div class="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Company Details</div>
            </div>
          {/if}

          <div class="group">
            <label class="text-xs mb-1 block transition-colors {companyName.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Company name</label>
            <input
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="Acme Corp"
              bind:value={companyName}
              autofocus
            />
          </div>
          <div class="group">
            <label class="text-xs mb-1 block transition-colors {companyMission.trim() ? 'text-gray-900' : 'text-gray-400 group-focus-within:text-gray-900'}">Mission / goal (optional)</label>
            <textarea
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[60px] text-gray-900"
              placeholder="What is this company trying to achieve?"
              bind:value={companyMission}
            ></textarea>
          </div>
        </div>

      <!-- Step 2: Agent -->
      {:else if currentStep === 2}
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

          <div>
            <label class="text-xs text-gray-400 mb-1 block">Agent name</label>
            <input
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="CEO"
              bind:value={agentName}
              autofocus
            />
          </div>

          <div>
            <label class="text-xs text-gray-400 mb-2 block">Adapter type</label>
            <div class="grid grid-cols-2 gap-2">
              {#each ADAPTER_OPTIONS as opt}
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

          <div>
            <label class="text-xs text-gray-400 mb-1 block">Role</label>
            <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-900">
              <Bot class="h-3.5 w-3.5" />
              CEO
            </div>
            <p class="text-[10px] text-gray-400 mt-1">The first agent is always the CEO.</p>
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
            <label class="text-xs text-gray-400 mb-1 block">Task title</label>
            <input
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 text-gray-900"
              placeholder="Set up the project repository"
              bind:value={taskTitle}
              autofocus
            />
          </div>

          <div>
            <label class="text-xs text-gray-400 mb-1 block">Description (optional)</label>
            <textarea
              class="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-300 resize-none min-h-[80px] text-gray-900"
              placeholder="Describe what needs to be done..."
              bind:value={taskDescription}
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
              {createdAgent.name} is standing by as your CEO.
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
                <span class="text-xs text-gray-500">CEO Agent</span>
                <span class="text-sm font-medium text-gray-900 ml-auto">{createdAgent.name}</span>
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
              Go to Dashboard
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
