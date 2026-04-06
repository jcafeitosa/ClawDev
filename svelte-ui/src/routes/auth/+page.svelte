<script lang="ts">
  import { Bot, Brain, Network, Zap } from "lucide-svelte";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  let mode: "signin" | "signup" = $state("signin");
  let email = $state("");
  let password = $state("");
  let name = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);
  let bootstrapPending = $state(false);
  let ready = $state(false);
  let nextPath = $derived($page.url.searchParams.get("next") ?? "/");

  const session = authClient.useSession();

  onMount(async () => {
    try {
      const res = await fetch("/api/health");
      const health = await res.json();

      if (health.bootstrapStatus === "bootstrap_pending") {
        bootstrapPending = true;
        mode = "signup";
      }
    } catch {
      // If health check fails, show login form anyway
    }
    ready = true;
  });

  $effect(() => {
    if ($session.data) {
      if (bootstrapPending) {
        goto(nextPath || "/onboarding");
      } else {
        goto(nextPath || "/");
      }
    }
  });

  async function handleSubmit() {
    error = null;
    loading = true;
    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          error = result.error.message ?? "Sign in failed";
          return;
        }
      } else {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) {
          error = result.error.message ?? "Sign up failed";
          return;
        }
      }
      goto(bootstrapPending ? (nextPath || "/onboarding") : (nextPath || "/"));
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }

  const features = [
    {
      icon: Bot,
      title: "Multi-Agent Orchestration",
      description: "Agents collaborate autonomously on complex tasks",
    },
    {
      icon: Brain,
      title: "Persistent Memory",
      description: "Soul, memory, and self-evolution for every agent",
    },
    {
      icon: Network,
      title: "Project Management",
      description: "Issues, goals, and routines managed by AI crews",
    },
  ];
</script>

{#if !ready}
<div class="auth-page" style="align-items:center;justify-content:center;">
  <p style="color:#64748b;font-size:0.875rem;">Loading…</p>
</div>
{:else}
<div class="auth-page">
  <!-- Left: Hero Panel -->
  <div class="auth-hero">
    <div class="auth-hero-bg"></div>
    <div class="auth-hero-content">
      <span class="auth-badge">
        <span class="auth-badge-dot"></span>
        Open Source &middot; AI Agent Orchestration
      </span>

      <h1 class="auth-brand">ClawDev</h1>
      <p class="auth-tagline">Orchestrate AI Agent Companies</p>
      <p class="auth-description">
        Build, deploy, and manage autonomous agent teams.
        ClawDev turns your AI workforce into a self-organizing company.
      </p>

      <div class="auth-features">
        {#each features as feature}
          <div class="auth-feature-card">
            <div class="auth-feature-icon">
              <feature.icon size={20} />
            </div>
            <div>
              <p class="auth-feature-title">{feature.title}</p>
              <p class="auth-feature-desc">{feature.description}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Right: Auth Panel -->
  <div class="auth-panel">
    <div class="auth-panel-inner">
      <div class="auth-panel-header">
        <div class="auth-panel-logo">
          <Zap size={20} />
          <span>ClawDev</span>
        </div>

        <h2 class="auth-panel-title">
          {mode === "signin" ? "Login" : "Create Account"}
        </h2>
        <p class="auth-panel-subtitle">
          {mode === "signin"
            ? "Welcome back. Sign in to continue."
            : "Get started with ClawDev."}
        </p>
      </div>

      {#if bootstrapPending}
        <div class="auth-bootstrap-banner">
          <span class="auth-bootstrap-dot"></span>
          This is a fresh ClawDev instance. Sign up to become the first admin.
        </div>
      {/if}

      <form class="auth-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        {#if mode === "signup"}
          <div class="auth-field">
            <label for="name">Name</label>
            <input
              id="name"
              type="text"
              bind:value={name}
              required
              placeholder="Your name"
            />
          </div>
        {/if}

        <div class="auth-field">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            placeholder="you@example.com"
          />
        </div>

        <div class="auth-field">
          <label for="password">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            minlength="8"
            placeholder="Enter password"
          />
        </div>

        {#if error}
          <p class="auth-error">{error}</p>
        {/if}

        <button type="submit" class="auth-submit" disabled={loading}>
          {#if loading}
            {mode === "signin" ? "Signing in…" : "Creating account…"}
          {:else}
            {mode === "signin" ? "Login" : "Create Account"} &rarr;
          {/if}
        </button>
      </form>

      <p class="auth-switch">
        {mode === "signin" ? "Don't have an account?" : "Already have an account?"}
        <button
          type="button"
          class="auth-switch-link"
          onclick={() => { mode = mode === "signin" ? "signup" : "signin"; error = null; }}
        >
          {mode === "signin" ? "Register" : "Sign in"}
        </button>
      </p>
    </div>
  </div>
</div>
{/if}

<style>
  .auth-page {
    display: flex;
    height: 100%;
    width: 100%;
    background: #050508;
    overflow: hidden;
  }

  /* ── Hero (Left Panel) ── */
  .auth-hero {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .auth-hero-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37, 99, 235, 0.08) 0%, transparent 70%),
      radial-gradient(ellipse 40% 40% at 30% 70%, rgba(249, 115, 22, 0.04) 0%, transparent 60%);
    pointer-events: none;
  }

  .auth-hero-content {
    position: relative;
    z-index: 1;
    max-width: 440px;
    padding: 2rem;
  }

  .auth-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    font-size: 0.8125rem;
    color: #94a3b8;
    margin-bottom: 1.5rem;
  }

  .auth-badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2563eb;
    box-shadow: 0 0 6px #2563eb;
  }

  .auth-brand {
    font-size: 3rem;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin: 0 0 0.25rem;
  }

  .auth-tagline {
    font-size: 1.375rem;
    font-weight: 500;
    color: #cbd5e1;
    margin: 0 0 1rem;
  }

  .auth-description {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: #64748b;
    margin: 0 0 2rem;
  }

  .auth-features {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .auth-feature-card {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    transition: background 0.2s, border-color 0.2s;
  }

  .auth-feature-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .auth-feature-icon {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
  }

  .auth-feature-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #e2e8f0;
    margin: 0;
  }

  .auth-feature-desc {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0.125rem 0 0;
  }

  /* ── Auth Panel (Right) ── */
  .auth-panel {
    width: 420px;
    min-width: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
    border-left: 1px solid rgba(255, 255, 255, 0.06);
  }

  .auth-panel-inner {
    width: 100%;
    max-width: 320px;
    padding: 2rem 1.5rem;
  }

  .auth-panel-header {
    margin-bottom: 2rem;
  }

  .auth-panel-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 1.5rem;
  }

  .auth-panel-logo :global(svg) {
    color: #2563eb;
  }

  .auth-panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.375rem;
  }

  .auth-panel-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }

  /* ── Bootstrap Banner ── */
  .auth-bootstrap-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    background: rgba(37, 99, 235, 0.08);
    border: 1px solid rgba(37, 99, 235, 0.2);
    color: #93c5fd;
    font-size: 0.8125rem;
    line-height: 1.5;
    margin-bottom: 1.25rem;
  }

  .auth-bootstrap-dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    box-shadow: 0 0 6px #3b82f6;
  }

  /* ── Form ── */
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .auth-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .auth-field label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .auth-field input {
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

  .auth-field input::placeholder {
    color: #475569;
  }

  .auth-field input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .auth-error {
    font-size: 0.8125rem;
    color: #ef4444;
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }

  .auth-submit {
    height: 44px;
    width: 100%;
    border-radius: 10px;
    border: none;
    background: #ffffff;
    color: #0a0a0f;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    margin-top: 0.25rem;
  }

  .auth-submit:hover:not(:disabled) {
    background: #f1f5f9;
  }

  .auth-submit:active:not(:disabled) {
    transform: scale(0.99);
  }

  .auth-submit:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .auth-switch {
    text-align: center;
    font-size: 0.8125rem;
    color: #64748b;
    margin-top: 1.5rem;
  }

  .auth-switch-link {
    background: none;
    border: none;
    color: #f8fafc;
    font-weight: 600;
    font-size: 0.8125rem;
    cursor: pointer;
    text-decoration: none;
    padding: 0;
    margin-left: 0.25rem;
  }

  .auth-switch-link:hover {
    text-decoration: underline;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .auth-page {
      flex-direction: column;
    }

    .auth-hero {
      display: none;
    }

    .auth-panel {
      width: 100%;
      min-width: unset;
      flex: 1;
      border-left: none;
    }

    .auth-panel-inner {
      max-width: 380px;
    }
  }
</style>
