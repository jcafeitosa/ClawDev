<script lang="ts">
  import { Zap, ChevronLeft, Check, Rocket, Building2, User, Settings, PartyPopper, Bot, X, ArrowRight, CheckCircle2, Sparkles } from "lucide-svelte";
  import { authClient } from "$lib/auth-client";
  import { api } from "$lib/api";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

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
      if (health.bootstrapStatus !== "bootstrap_pending") {
        goto("/", { replaceState: true });
        return;
      }
    } catch {
      goto("/", { replaceState: true });
      return;
    }

    publicUrl = window.location.origin;

    // Check if we already have a session
    if ($session.data) {
      hasSession = true;
      needsAdmin = false;
    } else {
      needsAdmin = true;
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
    // Only allow going backwards to completed steps, or staying on current
    if (step < currentStep && completedSteps.has(step)) {
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

      // Save instance settings silently
      const instanceRes = await api("/api/instance-settings", {
        method: "PATCH",
        body: JSON.stringify({ instanceName: companyName || "ClawDev", publicUrl }),
      });
      if (!instanceRes.ok) {
        const body = await instanceRes.json().catch(() => null);
        error = body?.message ?? `Failed to save settings (${instanceRes.status})`;
        return;
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
<div class="setup-page">
  <p class="setup-loading">Loading...</p>
</div>
{:else}
<div class="setup-page">
  <div class="setup-container">
    <!-- Close button -->
    <button class="close-btn" onclick={handleClose} aria-label="Close setup">
      <X size={20} />
    </button>

    <!-- Left panel: Form -->
    <div class="form-panel">
      <!-- Tab navigation -->
      <nav class="step-tabs">
        {#each stepMeta as meta, i}
          {@const stepNum = i + 1}
          <button
            class="step-tab"
            class:active={stepNum === currentStep}
            class:completed={completedSteps.has(stepNum)}
            class:clickable={stepNum < currentStep && completedSteps.has(stepNum)}
            disabled={stepNum > currentStep || (stepNum < currentStep && !completedSteps.has(stepNum))}
            onclick={() => goToStep(stepNum)}
          >
            <span class="tab-number">
              {#if completedSteps.has(stepNum) && stepNum !== currentStep}
                <Check size={14} />
              {:else}
                {stepNum}
              {/if}
            </span>
            {meta.label}
          </button>
        {/each}
      </nav>

      <!-- Logo -->
      <div class="setup-logo">
        <Zap size={18} />
        <span>ClawDev</span>
      </div>

      <!-- Step 1: Company -->
      {#if currentStep === 1}
        <div class="step-content">
          <div class="step-header">
            <div class="step-icon">
              <Building2 size={24} />
            </div>
            <h1 class="step-title">Name your company</h1>
            <p class="step-subtitle">
              A company is a workspace where your AI agents collaborate on projects and tasks.
            </p>
          </div>

          {#if needsAdmin}
            <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleCompanyStep(); }}>
              <div class="form-section-label">Admin Account</div>
              <div class="setup-field">
                <label for="admin-name">Name</label>
                <input
                  id="admin-name"
                  type="text"
                  bind:value={adminName}
                  required
                  placeholder="Your name"
                  autocomplete="name"
                />
              </div>
              <div class="setup-field">
                <label for="admin-email">Email</label>
                <input
                  id="admin-email"
                  type="email"
                  bind:value={adminEmail}
                  required
                  placeholder="admin@example.com"
                  autocomplete="email"
                />
              </div>
              <div class="setup-field">
                <label for="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  bind:value={adminPassword}
                  required
                  minlength="8"
                  placeholder="Minimum 8 characters"
                  autocomplete="new-password"
                />
              </div>

              <div class="form-divider"></div>
              <div class="form-section-label">Company Details</div>

              <div class="setup-field">
                <label for="company-name">Company name</label>
                <input
                  id="company-name"
                  type="text"
                  bind:value={companyName}
                  required
                  placeholder="Acme Corp"
                />
              </div>
              <div class="setup-field">
                <label for="company-mission">Mission / goal <span class="optional">(optional)</span></label>
                <textarea
                  id="company-mission"
                  bind:value={companyMission}
                  placeholder="Build the best AI-powered products..."
                  rows="3"
                ></textarea>
              </div>

              {#if error}
                <p class="setup-error">{error}</p>
              {/if}

              <div class="setup-actions">
                <button type="submit" class="setup-btn-primary" disabled={loading}>
                  {loading ? "Setting up..." : "Next"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          {:else}
            <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleCompanyStep(); }}>
              <div class="setup-field">
                <label for="company-name">Company name</label>
                <input
                  id="company-name"
                  type="text"
                  bind:value={companyName}
                  required
                  placeholder="Acme Corp"
                  autofocus
                />
              </div>
              <div class="setup-field">
                <label for="company-mission">Mission / goal <span class="optional">(optional)</span></label>
                <textarea
                  id="company-mission"
                  bind:value={companyMission}
                  placeholder="Build the best AI-powered products..."
                  rows="3"
                ></textarea>
              </div>

              {#if error}
                <p class="setup-error">{error}</p>
              {/if}

              <div class="setup-actions">
                <button type="submit" class="setup-btn-primary" disabled={loading}>
                  {loading ? "Creating..." : "Next"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          {/if}
        </div>

      <!-- Step 2: Agent -->
      {:else if currentStep === 2}
        <div class="step-content">
          <div class="step-header">
            <div class="step-icon">
              <Bot size={24} />
            </div>
            <h1 class="step-title">Create your first agent</h1>
            <p class="step-subtitle">
              This will be the CEO of {createdCompany?.name ?? "your company"} -- the first AI agent to lead the workforce.
            </p>
          </div>

          <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleAgentStep(); }}>
            <div class="setup-field">
              <label for="agent-name">Agent name</label>
              <input
                id="agent-name"
                type="text"
                bind:value={agentName}
                required
                placeholder="Atlas"
                autofocus
              />
            </div>

            <div class="setup-field">
              <label for="adapter-type">Adapter</label>
              <div class="select-wrapper">
                <select id="adapter-type" bind:value={adapterType}>
                  {#each ADAPTER_OPTIONS as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <span class="field-hint">The AI backbone powering this agent.</span>
            </div>

            <div class="setup-field">
              <label>Role</label>
              <div class="role-badge">
                <Bot size={14} />
                CEO
              </div>
              <span class="field-hint">The first agent is always the CEO.</span>
            </div>

            {#if error}
              <p class="setup-error">{error}</p>
            {/if}

            <div class="setup-actions">
              <button type="button" class="setup-btn-secondary" onclick={() => goToStep(1)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button type="submit" class="setup-btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Next"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>

      <!-- Step 3: Task -->
      {:else if currentStep === 3}
        <div class="step-content">
          <div class="step-header">
            <div class="step-icon">
              <Rocket size={24} />
            </div>
            <h1 class="step-title">Create your first task</h1>
            <p class="step-subtitle">
              Give {createdAgent?.name ?? "your agent"} something to work on.
              {#if createdAgent}
                This task will be assigned to {createdAgent.name} automatically.
              {/if}
            </p>
          </div>

          <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleTaskStep(); }}>
            <div class="setup-field">
              <label for="task-title">Task title</label>
              <input
                id="task-title"
                type="text"
                bind:value={taskTitle}
                required
                placeholder="Set up the project repository"
                autofocus
              />
            </div>

            <div class="setup-field">
              <label for="task-desc">Description <span class="optional">(optional)</span></label>
              <textarea
                id="task-desc"
                bind:value={taskDescription}
                placeholder="Describe what needs to be done..."
                rows="4"
              ></textarea>
            </div>

            {#if error}
              <p class="setup-error">{error}</p>
            {/if}

            <div class="setup-actions">
              <button type="button" class="setup-btn-secondary" onclick={() => goToStep(2)}>
                <ChevronLeft size={16} /> Back
              </button>
              <button type="button" class="setup-btn-ghost" onclick={skipTask}>
                Skip
              </button>
              <button type="submit" class="setup-btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Next"}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>

      <!-- Step 4: Launch -->
      {:else if currentStep === 4}
        <div class="step-content step-launch">
          <div class="launch-icon">
            <div class="launch-icon-inner">
              <CheckCircle2 size={48} />
            </div>
            <div class="launch-sparkles">
              <Sparkles size={20} />
            </div>
          </div>

          <h1 class="step-title center">Your company is ready!</h1>
          <p class="step-subtitle center">
            {createdCompany?.name ?? "Your company"} is set up and ready to go.
            {#if createdAgent}
              {createdAgent.name} is standing by as your CEO.
            {/if}
          </p>

          <div class="launch-summary">
            {#if createdCompany}
              <div class="summary-row">
                <Building2 size={16} />
                <span class="summary-label">Company</span>
                <span class="summary-value">{createdCompany.name}</span>
              </div>
            {/if}
            {#if createdAgent}
              <div class="summary-row">
                <Bot size={16} />
                <span class="summary-label">CEO Agent</span>
                <span class="summary-value">{createdAgent.name}</span>
              </div>
            {/if}
          </div>

          <div class="setup-actions center">
            <button class="setup-btn-primary launch-btn" onclick={goToDashboard}>
              Go to Dashboard
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Right panel: Dark gradient -->
    <div class="preview-panel">
      <div class="preview-content">
        {#if currentStep === 1}
          <div class="preview-visual">
            <div class="preview-glow glow-blue"></div>
            <Building2 size={64} strokeWidth={1} />
            <h2 class="preview-heading">Your AI Company</h2>
            <p class="preview-text">
              Create a workspace where autonomous agents collaborate, execute tasks, and ship results.
            </p>
          </div>
        {:else if currentStep === 2}
          <div class="preview-visual">
            <div class="preview-glow glow-purple"></div>
            <Bot size={64} strokeWidth={1} />
            <h2 class="preview-heading">Meet your CEO</h2>
            <p class="preview-text">
              The first agent leads the company. It can hire other agents, delegate tasks, and make strategic decisions.
            </p>
          </div>
        {:else if currentStep === 3}
          <div class="preview-visual">
            <div class="preview-glow glow-orange"></div>
            <Rocket size={64} strokeWidth={1} />
            <h2 class="preview-heading">First Mission</h2>
            <p class="preview-text">
              Tasks are how agents know what to work on. They'll pick up the task and start executing autonomously.
            </p>
          </div>
        {:else if currentStep === 4}
          <div class="preview-visual">
            <div class="preview-glow glow-green"></div>
            <Sparkles size={64} strokeWidth={1} />
            <h2 class="preview-heading">Ready to Launch</h2>
            <p class="preview-text">
              Everything is configured. Your autonomous workforce is ready to start building.
            </p>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
{/if}

<style>
  .setup-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    width: 100%;
    background: #050508;
    padding: 1.5rem;
  }

  .setup-loading {
    color: #64748b;
    font-size: 0.875rem;
  }

  .setup-container {
    position: relative;
    display: flex;
    width: 100%;
    max-width: 960px;
    min-height: 600px;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
  }

  /* ── Close button ── */
  .close-btn {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 10;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
    border-color: rgba(255, 255, 255, 0.15);
  }

  /* ── Form panel (left) ── */
  .form-panel {
    flex: 0 0 58%;
    background: #0a0a0f;
    padding: 3rem 2.5rem 2.5rem;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  /* ── Preview panel (right) ── */
  .preview-panel {
    flex: 1;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #172554 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    position: relative;
    overflow: hidden;
  }

  .preview-content {
    position: relative;
    z-index: 1;
    text-align: center;
    max-width: 280px;
  }

  .preview-visual {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    color: rgba(255, 255, 255, 0.5);
    animation: fadeIn 0.4s ease;
  }

  .preview-glow {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.3;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  .glow-blue { background: #2563eb; }
  .glow-purple { background: #7c3aed; }
  .glow-orange { background: #f97316; }
  .glow-green { background: #10b981; }

  .preview-heading {
    font-size: 1.25rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .preview-text {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.6;
    margin: 0;
  }

  /* ── Tab navigation ── */
  .step-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding-left: 2.5rem;
  }

  .step-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 1.25rem 0.875rem;
    border: none;
    background: none;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #475569;
    cursor: default;
    position: relative;
    transition: color 0.2s;
    white-space: nowrap;
  }

  .step-tab.active {
    color: #f8fafc;
  }

  .step-tab.active::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: #2563eb;
    border-radius: 1px 1px 0 0;
  }

  .step-tab.completed:not(.active) {
    color: #4ade80;
  }

  .step-tab.clickable {
    cursor: pointer;
  }

  .step-tab.clickable:hover {
    color: #94a3b8;
  }

  .tab-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 0.6875rem;
    font-weight: 600;
    border: 1.5px solid currentColor;
    flex-shrink: 0;
  }

  .step-tab.completed .tab-number {
    border-color: #4ade80;
    color: #4ade80;
  }

  .step-tab.active .tab-number {
    border-color: #2563eb;
    background: rgba(37, 99, 235, 0.15);
    color: #60a5fa;
  }

  /* ── Logo ── */
  .setup-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 1.5rem;
  }

  .setup-logo :global(svg) {
    color: #2563eb;
  }

  /* ── Step Content ── */
  .step-content {
    animation: fadeIn 0.25s ease;
    flex: 1;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .step-header {
    margin-bottom: 1.5rem;
  }

  .step-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
    margin-bottom: 1rem;
  }

  .step-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.375rem;
  }

  .step-title.center {
    text-align: center;
  }

  .step-subtitle {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
  }

  .step-subtitle.center {
    text-align: center;
  }

  /* ── Form ── */
  .setup-form {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .form-section-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
  }

  .form-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 0.25rem 0;
  }

  .setup-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .setup-field label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .optional {
    color: #475569;
    font-weight: 400;
  }

  .setup-field input,
  .setup-field textarea {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    resize: vertical;
  }

  .setup-field input {
    height: 42px;
  }

  .setup-field textarea {
    min-height: 72px;
  }

  .setup-field input::placeholder,
  .setup-field textarea::placeholder {
    color: #475569;
  }

  .setup-field input:focus,
  .setup-field textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .field-hint {
    font-size: 0.75rem;
    color: #475569;
    margin-top: 0.125rem;
  }

  .select-wrapper {
    position: relative;
  }

  .select-wrapper select {
    width: 100%;
    height: 42px;
    padding: 0 2rem 0 0.875rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    appearance: none;
    cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
  }

  .select-wrapper select:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    border-radius: 8px;
    background: rgba(37, 99, 235, 0.1);
    border: 1px solid rgba(37, 99, 235, 0.2);
    color: #60a5fa;
    font-size: 0.8125rem;
    font-weight: 600;
    width: fit-content;
  }

  .setup-error {
    font-size: 0.8125rem;
    color: #ef4444;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }

  /* ── Actions ── */
  .setup-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.75rem;
  }

  .setup-actions.center {
    justify-content: center;
  }

  .setup-btn-primary {
    height: 44px;
    padding: 0 1.5rem;
    border-radius: 10px;
    border: none;
    background: #ffffff;
    color: #0a0a0f;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .setup-btn-primary:hover:not(:disabled) {
    background: #f1f5f9;
  }

  .setup-btn-primary:active:not(:disabled) {
    transform: scale(0.99);
  }

  .setup-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .setup-btn-secondary {
    height: 44px;
    padding: 0 1.25rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, color 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .setup-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
    color: #cbd5e1;
  }

  .setup-btn-ghost {
    height: 44px;
    padding: 0 1rem;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }

  .setup-btn-ghost:hover {
    color: #94a3b8;
  }

  /* ── Step 4: Launch ── */
  .step-launch {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding-top: 2rem;
  }

  .launch-icon {
    position: relative;
    margin-bottom: 1.5rem;
  }

  .launch-icon-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 88px;
    border-radius: 50%;
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
    animation: popIn 0.5s ease;
  }

  .launch-sparkles {
    position: absolute;
    top: -4px;
    right: -4px;
    color: #fbbf24;
    animation: sparkle 1.5s ease infinite;
  }

  @keyframes popIn {
    0% { transform: scale(0.5); opacity: 0; }
    70% { transform: scale(1.08); }
    100% { transform: scale(1); opacity: 1; }
  }

  @keyframes sparkle {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8) rotate(15deg); }
  }

  .launch-summary {
    margin: 1.5rem 0;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: left;
    width: 100%;
    max-width: 320px;
  }

  .summary-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0;
    color: #64748b;
  }

  .summary-row + .summary-row {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .summary-label {
    font-size: 0.8125rem;
    color: #64748b;
    flex-shrink: 0;
  }

  .summary-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #f8fafc;
    margin-left: auto;
  }

  .launch-btn {
    height: 48px;
    padding: 0 2rem;
    font-size: 1rem;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .setup-container {
      flex-direction: column;
      min-height: auto;
    }

    .form-panel {
      flex: none;
      padding: 2rem 1.5rem;
    }

    .preview-panel {
      display: none;
    }

    .step-tabs {
      padding-left: 0;
      overflow-x: auto;
    }

    .step-tab {
      padding: 0 0.875rem 0.75rem;
      font-size: 0.75rem;
    }
  }
</style>
