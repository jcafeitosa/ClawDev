<script lang="ts">
  import { Zap, ChevronLeft, Check, Rocket, Building2, User, Settings, PartyPopper } from "lucide-svelte";
  import { authClient } from "$lib/auth-client";
  import { api } from "$lib/api";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  const TOTAL_STEPS = 5;

  let currentStep = $state(1);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let ready = $state(false);

  // Step 2: Admin account
  let adminName = $state("");
  let adminEmail = $state("");
  let adminPassword = $state("");
  let hasSession = $state(false);

  // Step 3: Instance config
  let instanceName = $state("ClawDev");
  let publicUrl = $state("");

  // Step 4: Company
  let companyName = $state("");
  let createdCompany = $state<{ id: string; slug: string; name: string } | null>(null);

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
    ready = true;
  });

  $effect(() => {
    if ($session.data) {
      hasSession = true;
      // If user is already signed in and we're on step 2, auto-advance
      if (currentStep === 2) {
        currentStep = 3;
      }
    }
  });

  function nextStep() {
    error = null;
    if (currentStep < TOTAL_STEPS) {
      currentStep++;
      // Skip step 2 if already signed in
      if (currentStep === 2 && hasSession) {
        currentStep = 3;
      }
    }
  }

  function prevStep() {
    error = null;
    if (currentStep > 1) {
      currentStep--;
      // Skip step 2 going back if already signed in
      if (currentStep === 2 && hasSession) {
        currentStep = 1;
      }
    }
  }

  async function handleCreateAdmin() {
    error = null;
    loading = true;
    try {
      const result = await authClient.signUp.email({
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      });
      if (result.error) {
        error = result.error.message ?? "Failed to create admin account";
        return;
      }
      hasSession = true;
      nextStep();
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  async function handleSaveInstance() {
    error = null;
    loading = true;
    try {
      const res = await api("/api/instance-settings", {
        method: "PATCH",
        body: JSON.stringify({ instanceName, publicUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        error = body?.message ?? `Failed to save instance settings (${res.status})`;
        return;
      }
      nextStep();
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  async function handleCreateCompany() {
    error = null;
    loading = true;
    try {
      const res = await api("/api/companies", {
        method: "POST",
        body: JSON.stringify({ name: companyName }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        error = body?.message ?? `Failed to create company (${res.status})`;
        return;
      }
      const company = await res.json();
      createdCompany = company;
      nextStep();
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    } finally {
      loading = false;
    }
  }

  function goToDashboard() {
    if (createdCompany) {
      goto(`/${createdCompany.slug ?? createdCompany.id}/dashboard`, { replaceState: true });
    } else {
      goto("/", { replaceState: true });
    }
  }

  const stepMeta: Array<{ icon: typeof Zap; label: string }> = [
    { icon: Rocket, label: "Welcome" },
    { icon: User, label: "Admin" },
    { icon: Settings, label: "Instance" },
    { icon: Building2, label: "Company" },
    { icon: PartyPopper, label: "Done" },
  ];
</script>

{#if !ready}
<div class="setup-page">
  <p class="setup-loading">Loading…</p>
</div>
{:else}
<div class="setup-page">
  <div class="setup-card">
    <!-- Step Indicator -->
    <div class="step-indicator">
      {#each stepMeta as meta, i}
        {@const stepNum = i + 1}
        <div class="step-dot-group">
          <div
            class="step-dot"
            class:active={stepNum === currentStep}
            class:completed={stepNum < currentStep}
          >
            {#if stepNum < currentStep}
              <Check size={14} />
            {:else}
              <span class="step-number">{stepNum}</span>
            {/if}
          </div>
          <span
            class="step-label"
            class:active={stepNum === currentStep}
            class:completed={stepNum < currentStep}
          >{meta.label}</span>
        </div>
        {#if i < TOTAL_STEPS - 1}
          <div class="step-line" class:completed={stepNum < currentStep}></div>
        {/if}
      {/each}
    </div>

    <!-- Logo -->
    <div class="setup-logo">
      <Zap size={20} />
      <span>ClawDev</span>
    </div>

    <!-- Step 1: Welcome -->
    {#if currentStep === 1}
      <div class="step-content">
        <h1 class="setup-title">Welcome to ClawDev</h1>
        <p class="setup-subtitle">
          Let's set up your instance. This takes about 2 minutes.
        </p>
        <p class="setup-description">
          You'll create an admin account, configure your instance, and set up your first
          AI agent company — all in a few quick steps.
        </p>
        <div class="setup-actions">
          <button class="setup-btn-primary" onclick={nextStep}>
            Get Started &rarr;
          </button>
        </div>
      </div>

    <!-- Step 2: Create Admin Account -->
    {:else if currentStep === 2}
      <div class="step-content">
        <h1 class="setup-title">Create Admin Account</h1>
        <p class="setup-subtitle">
          This will be the first user and instance administrator.
        </p>

        <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleCreateAdmin(); }}>
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

          {#if error}
            <p class="setup-error">{error}</p>
          {/if}

          <div class="setup-actions">
            <button type="button" class="setup-btn-secondary" onclick={prevStep}>
              <ChevronLeft size={16} /> Back
            </button>
            <button type="submit" class="setup-btn-primary" disabled={loading}>
              {loading ? "Creating account…" : "Create Account"} &rarr;
            </button>
          </div>
        </form>
      </div>

    <!-- Step 3: Instance Configuration -->
    {:else if currentStep === 3}
      <div class="step-content">
        <h1 class="setup-title">Instance Configuration</h1>
        <p class="setup-subtitle">
          Configure the basic settings for your ClawDev instance.
        </p>

        <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleSaveInstance(); }}>
          <div class="setup-field">
            <label for="instance-name">Instance Name</label>
            <input
              id="instance-name"
              type="text"
              bind:value={instanceName}
              required
              placeholder="ClawDev"
            />
          </div>

          <div class="setup-field">
            <label for="public-url">Public URL</label>
            <input
              id="public-url"
              type="url"
              bind:value={publicUrl}
              required
              placeholder="https://clawdev.example.com"
            />
            <span class="setup-field-hint">Auto-detected from your browser. Change if behind a reverse proxy.</span>
          </div>

          {#if error}
            <p class="setup-error">{error}</p>
          {/if}

          <div class="setup-actions">
            <button type="button" class="setup-btn-secondary" onclick={prevStep}>
              <ChevronLeft size={16} /> Back
            </button>
            <button type="submit" class="setup-btn-primary" disabled={loading}>
              {loading ? "Saving…" : "Save & Continue"} &rarr;
            </button>
          </div>
        </form>
      </div>

    <!-- Step 4: Create First Company -->
    {:else if currentStep === 4}
      <div class="step-content">
        <h1 class="setup-title">Create Your First Company</h1>
        <p class="setup-subtitle">
          A company is a workspace where your AI agents collaborate on projects and tasks.
        </p>

        <form class="setup-form" onsubmit={(e) => { e.preventDefault(); handleCreateCompany(); }}>
          <div class="setup-field">
            <label for="company-name">Company Name</label>
            <input
              id="company-name"
              type="text"
              bind:value={companyName}
              required
              placeholder="My AI Company"
            />
          </div>

          {#if error}
            <p class="setup-error">{error}</p>
          {/if}

          <div class="setup-actions">
            <button type="button" class="setup-btn-secondary" onclick={prevStep}>
              <ChevronLeft size={16} /> Back
            </button>
            <button type="submit" class="setup-btn-primary" disabled={loading}>
              {loading ? "Creating…" : "Create Company"} &rarr;
            </button>
          </div>
        </form>
      </div>

    <!-- Step 5: Done -->
    {:else if currentStep === 5}
      <div class="step-content step-done">
        <div class="done-icon">
          <PartyPopper size={48} />
        </div>
        <h1 class="setup-title">You're All Set!</h1>
        <p class="setup-subtitle">
          Your ClawDev instance is ready. Time to create your first AI agent and start
          building your autonomous workforce.
        </p>

        <div class="done-summary">
          <div class="done-summary-row">
            <span class="done-summary-label">Instance</span>
            <span class="done-summary-value">{instanceName}</span>
          </div>
          {#if createdCompany}
            <div class="done-summary-row">
              <span class="done-summary-label">Company</span>
              <span class="done-summary-value">{createdCompany.name}</span>
            </div>
          {/if}
        </div>

        <div class="setup-actions" style="justify-content: center;">
          <button class="setup-btn-primary" onclick={goToDashboard}>
            Go to Dashboard &rarr;
          </button>
        </div>
      </div>
    {/if}
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
    padding: 2rem;
  }

  .setup-loading {
    color: #64748b;
    font-size: 0.875rem;
  }

  .setup-card {
    width: 100%;
    max-width: 520px;
    background: #0a0a0f;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 16px;
    padding: 2.5rem 2rem;
  }

  /* ── Step Indicator ── */
  .step-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 2rem;
  }

  .step-dot-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
  }

  .step-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.1);
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    color: #475569;
  }

  .step-dot.active {
    border-color: #2563eb;
    background: rgba(37, 99, 235, 0.15);
    color: #60a5fa;
    box-shadow: 0 0 12px rgba(37, 99, 235, 0.2);
  }

  .step-dot.completed {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
  }

  .step-number {
    font-size: 0.75rem;
    font-weight: 600;
  }

  .step-label {
    font-size: 0.6875rem;
    color: #475569;
    font-weight: 500;
    transition: color 0.3s ease;
  }

  .step-label.active {
    color: #60a5fa;
  }

  .step-label.completed {
    color: #4ade80;
  }

  .step-line {
    width: 40px;
    height: 2px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0 0.5rem;
    margin-bottom: 1.25rem;
    border-radius: 1px;
    transition: background 0.3s ease;
  }

  .step-line.completed {
    background: rgba(34, 197, 94, 0.4);
  }

  /* ── Logo ── */
  .setup-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
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
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .setup-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.375rem;
  }

  .setup-subtitle {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  .setup-description {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0 0 2rem;
    line-height: 1.6;
  }

  /* ── Form ── */
  .setup-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 0.5rem;
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

  .setup-field input {
    height: 42px;
    width: 100%;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .setup-field input::placeholder {
    color: #475569;
  }

  .setup-field input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .setup-field-hint {
    font-size: 0.75rem;
    color: #475569;
    margin-top: 0.125rem;
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
    margin-top: 0.5rem;
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
    gap: 0.25rem;
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

  /* ── Step 5: Done ── */
  .step-done {
    text-align: center;
  }

  .done-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
    margin-bottom: 1.5rem;
    animation: popIn 0.4s ease;
  }

  @keyframes popIn {
    0% { transform: scale(0.5); opacity: 0; }
    70% { transform: scale(1.1); }
    100% { transform: scale(1); opacity: 1; }
  }

  .done-summary {
    margin: 1.5rem 0;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: left;
  }

  .done-summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0;
  }

  .done-summary-row + .done-summary-row {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .done-summary-label {
    font-size: 0.8125rem;
    color: #64748b;
  }

  .done-summary-value {
    font-size: 0.875rem;
    font-weight: 500;
    color: #f8fafc;
  }

  /* ── Responsive ── */
  @media (max-width: 580px) {
    .setup-card {
      padding: 1.5rem 1.25rem;
    }

    .step-line {
      width: 20px;
    }

    .step-label {
      display: none;
    }
  }
</style>
