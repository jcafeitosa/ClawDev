<script lang="ts">
  import { page } from '$app/stores';
  import { Terminal, ShieldAlert, CheckCircle2, XCircle, AlertTriangle } from 'lucide-svelte';

  let code = $derived($page.url.searchParams.get('code') ?? '');
  let status = $state<'pending' | 'approved' | 'denied' | 'error'>('pending');
  let errorMessage = $state<string | null>(null);
  let loading = $state(false);

  /** Characters spaced out for prominent display */
  let displayCode = $derived(code ? code.split('').join(' ') : '');

  async function respond(action: 'approve' | 'deny') {
    loading = true;
    errorMessage = null;
    try {
      const res = await fetch('/api/access/cli-auth/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Request failed (${res.status})`);
      }
      status = action === 'approve' ? 'approved' : 'denied';
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      status = 'error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="cli-auth-page">
  <!-- Subtle background glow -->
  <div class="cli-auth-bg"></div>

  <div class="cli-auth-card">
    {#if !code}
      <!-- No code state -->
      <div class="cli-auth-icon cli-auth-icon--warning">
        <AlertTriangle size={28} />
      </div>
      <h1 class="cli-auth-title">No Authentication Code</h1>
      <p class="cli-auth-desc">
        No authentication code was provided. Please open this page from your CLI terminal.
      </p>

    {:else if status === 'pending'}
      <!-- Pending: show code + actions -->
      <div class="cli-auth-icon cli-auth-icon--primary">
        <Terminal size={28} />
      </div>
      <h1 class="cli-auth-title">CLI Authentication Request</h1>
      <p class="cli-auth-desc">
        A CLI session is requesting access to your ClawDev instance.
      </p>

      <!-- Auth code display -->
      <div class="cli-auth-code-box">
        <span class="cli-auth-code-label">Authentication Code</span>
        <code class="cli-auth-code">{displayCode}</code>
      </div>

      <!-- Warning -->
      <div class="cli-auth-warning">
        <ShieldAlert size={16} />
        <span>Only approve this request if you initiated it from your terminal.</span>
      </div>

      <!-- Action buttons -->
      <div class="cli-auth-actions">
        <button
          class="cli-auth-btn cli-auth-btn--approve"
          onclick={() => respond('approve')}
          disabled={loading}
        >
          <CheckCircle2 size={18} />
          {loading ? 'Processing...' : 'Approve'}
        </button>
        <button
          class="cli-auth-btn cli-auth-btn--deny"
          onclick={() => respond('deny')}
          disabled={loading}
        >
          <XCircle size={18} />
          {loading ? 'Processing...' : 'Deny'}
        </button>
      </div>

    {:else if status === 'approved'}
      <!-- Success state -->
      <div class="cli-auth-icon cli-auth-icon--success">
        <CheckCircle2 size={28} />
      </div>
      <h1 class="cli-auth-title">Session Approved</h1>
      <p class="cli-auth-desc cli-auth-desc--success">
        CLI session has been approved successfully. You can close this tab.
      </p>

    {:else if status === 'denied'}
      <!-- Denied state -->
      <div class="cli-auth-icon cli-auth-icon--warning">
        <XCircle size={28} />
      </div>
      <h1 class="cli-auth-title">Session Denied</h1>
      <p class="cli-auth-desc cli-auth-desc--warning">
        CLI session access has been denied.
      </p>

    {:else if status === 'error'}
      <!-- Error state -->
      <div class="cli-auth-icon cli-auth-icon--error">
        <AlertTriangle size={28} />
      </div>
      <h1 class="cli-auth-title">Authentication Error</h1>
      <p class="cli-auth-desc cli-auth-desc--error">
        {errorMessage ?? 'An unexpected error occurred while processing the request.'}
      </p>
      <button
        class="cli-auth-btn cli-auth-btn--retry"
        onclick={() => { status = 'pending'; errorMessage = null; }}
      >
        Try Again
      </button>
    {/if}
  </div>
</div>

<style>
  .cli-auth-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1.5rem;
    background: #050508;
    position: relative;
    overflow: hidden;
  }

  .cli-auth-bg {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 40% at 50% 45%, rgba(37, 99, 235, 0.06) 0%, transparent 70%),
      radial-gradient(ellipse 30% 30% at 60% 60%, rgba(249, 115, 22, 0.03) 0%, transparent 60%);
    pointer-events: none;
  }

  .cli-auth-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    padding: 2.5rem 2rem;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: #0a0a0f;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  /* ── Icon ── */
  .cli-auth-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    margin-bottom: 0.25rem;
  }

  .cli-auth-icon--primary {
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
  }

  .cli-auth-icon--success {
    background: rgba(34, 197, 94, 0.1);
    color: #4ade80;
  }

  .cli-auth-icon--warning {
    background: rgba(245, 158, 11, 0.1);
    color: #fbbf24;
  }

  .cli-auth-icon--error {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  /* ── Title & Description ── */
  .cli-auth-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .cli-auth-desc {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #64748b;
    margin: 0;
    max-width: 340px;
  }

  .cli-auth-desc--success {
    color: #4ade80;
  }

  .cli-auth-desc--warning {
    color: #fbbf24;
  }

  .cli-auth-desc--error {
    color: #f87171;
    padding: 0.625rem 1rem;
    border-radius: 10px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.12);
  }

  /* ── Code Box ── */
  .cli-auth-code-box {
    width: 100%;
    padding: 1.25rem 1rem;
    border-radius: 12px;
    border: 1px solid rgba(37, 99, 235, 0.2);
    background: rgba(37, 99, 235, 0.04);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
    margin-top: 0.25rem;
  }

  .cli-auth-code-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #64748b;
  }

  .cli-auth-code {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
    font-size: 1.75rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: #f8fafc;
    user-select: all;
    line-height: 1;
  }

  /* ── Warning ── */
  .cli-auth-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.15);
    background: rgba(245, 158, 11, 0.04);
    color: #fbbf24;
    font-size: 0.8125rem;
    line-height: 1.4;
    text-align: left;
    width: 100%;
  }

  .cli-auth-warning :global(svg) {
    flex-shrink: 0;
  }

  /* ── Buttons ── */
  .cli-auth-actions {
    display: flex;
    gap: 0.75rem;
    width: 100%;
    margin-top: 0.5rem;
  }

  .cli-auth-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 48px;
    border-radius: 12px;
    border: none;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, opacity 0.2s;
  }

  .cli-auth-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .cli-auth-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .cli-auth-btn--approve {
    background: #16a34a;
    color: #ffffff;
  }

  .cli-auth-btn--approve:hover:not(:disabled) {
    background: #15803d;
  }

  .cli-auth-btn--deny {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .cli-auth-btn--deny:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.18);
  }

  .cli-auth-btn--retry {
    flex: unset;
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    color: #f8fafc;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .cli-auth-btn--retry:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .cli-auth-card {
      padding: 2rem 1.25rem;
    }

    .cli-auth-code {
      font-size: 1.375rem;
    }

    .cli-auth-actions {
      flex-direction: column;
    }
  }
</style>
