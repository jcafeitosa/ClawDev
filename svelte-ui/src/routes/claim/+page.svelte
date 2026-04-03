<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { Zap, CheckCircle, AlertCircle, Clock, Loader2, ShieldCheck } from 'lucide-svelte';

  type ClaimState = 'idle' | 'checking' | 'ready' | 'claiming' | 'success' | 'error' | 'expired' | 'invalid';

  let token = $state('');
  let code = $state('');
  let claimState = $state<ClaimState>('idle');
  let error = $state('');
  let challengeInfo = $state<{ requiresCode?: boolean; status?: string } | null>(null);
  let nextPath = $derived($page.url.searchParams.get('next') ?? '/');

  // Auto-fill token from URL query param
  onMount(() => {
    const urlToken = $page.url.searchParams.get('token');
    if (urlToken) {
      token = urlToken;
      checkToken(urlToken);
    }
  });

  async function checkToken(tokenValue?: string) {
    const t = (tokenValue ?? token).trim();
    if (!t) return;
    token = t;
    claimState = 'checking';
    error = '';
    challengeInfo = null;

    try {
      const res = await api(`/api/access/board-claim/${encodeURIComponent(t)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as Record<string, string>).error ?? '';
        if (res.status === 404 || msg.toLowerCase().includes('not found')) {
          claimState = 'invalid';
          error = 'This claim token was not found. Please check and try again.';
        } else if (res.status === 410 || msg.toLowerCase().includes('expired')) {
          claimState = 'expired';
        } else {
          claimState = 'error';
          error = msg || `Verification failed (HTTP ${res.status})`;
        }
        return;
      }
      const data = await res.json();
      if (data.status === 'expired') {
        claimState = 'expired';
        return;
      }
      if (data.status === 'invalid') {
        claimState = 'invalid';
        error = 'This claim token is not valid.';
        return;
      }
      challengeInfo = data;
      claimState = 'ready';
    } catch (e: unknown) {
      claimState = 'error';
      error = e instanceof Error ? e.message : 'Failed to verify token';
    }
  }

  async function handleClaim() {
    const t = token.trim();
    if (!t) return;
    claimState = 'claiming';
    error = '';

    try {
      const body: Record<string, string> = {};
      if (code.trim()) body.code = code.trim();

      const res = await api(`/api/access/board-claim/${encodeURIComponent(t)}/claim`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as Record<string, string>).error ?? '';
        if (res.status === 410 || msg.toLowerCase().includes('expired')) {
          claimState = 'expired';
        } else {
          claimState = 'error';
          error = msg || `Claim failed (HTTP ${res.status})`;
        }
        return;
      }

      claimState = 'success';
      setTimeout(() => goto(nextPath || '/'), 2000);
    } catch (e: unknown) {
      claimState = 'error';
      error = e instanceof Error ? e.message : 'An unexpected error occurred';
    }
  }

  function reset() {
    claimState = 'idle';
    error = '';
    challengeInfo = null;
    code = '';
  }
</script>

<div class="claim-page">
  <div class="claim-container">
    <!-- Branding -->
    <div class="claim-logo">
      <Zap size={20} />
      <span>ClawDev</span>
    </div>

    <!-- Card -->
    <div class="claim-card">
      {#if claimState === 'success'}
        <!-- Success State -->
        <div class="claim-status-block">
          <div class="claim-status-icon claim-status-icon--success">
            <CheckCircle size={32} />
          </div>
          <h2 class="claim-title">Access Granted!</h2>
          <p class="claim-desc">Board access has been claimed successfully. Redirecting you now...</p>
          <div class="claim-redirect-bar">
            <div class="claim-redirect-bar-fill"></div>
          </div>
        </div>
      {:else if claimState === 'expired'}
        <!-- Expired State -->
        <div class="claim-status-block">
          <div class="claim-status-icon claim-status-icon--expired">
            <Clock size={32} />
          </div>
          <h2 class="claim-title">Token Expired</h2>
          <p class="claim-desc">This claim token has expired. Please generate a new one from the server console.</p>
          <button class="claim-btn claim-btn--secondary" onclick={reset}>
            Try Another Token
          </button>
        </div>
      {:else if claimState === 'invalid'}
        <!-- Invalid State -->
        <div class="claim-status-block">
          <div class="claim-status-icon claim-status-icon--error">
            <AlertCircle size={32} />
          </div>
          <h2 class="claim-title">Invalid Token</h2>
          <p class="claim-desc">{error || 'This claim token was not recognized.'}</p>
          <button class="claim-btn claim-btn--secondary" onclick={reset}>
            Try Again
          </button>
        </div>
      {:else}
        <!-- Header -->
        <div class="claim-header">
          <div class="claim-header-icon">
            <ShieldCheck size={24} />
          </div>
          <h2 class="claim-title">Board Access Claim</h2>
          <p class="claim-desc">Enter the claim token from your server console to gain admin access.</p>
        </div>

        <!-- Form -->
        <form
          class="claim-form"
          onsubmit={(e) => {
            e.preventDefault();
            if (claimState === 'ready') {
              handleClaim();
            } else {
              checkToken();
            }
          }}
        >
          <!-- Token Field -->
          <div class="claim-field">
            <label for="claim-token">Claim Token</label>
            <input
              id="claim-token"
              type="text"
              bind:value={token}
              placeholder="paste-your-token-here"
              disabled={claimState === 'checking' || claimState === 'claiming' || claimState === 'ready'}
              class="claim-input claim-input--mono"
              autocomplete="off"
              spellcheck="false"
            />
          </div>

          <!-- Code Field (shown when challenge requires it or always for ready state) -->
          {#if claimState === 'ready'}
            <div class="claim-field">
              <label for="claim-code">Verification Code</label>
              <p class="claim-field-hint">Enter the 6-digit code shown in your server console.</p>
              <input
                id="claim-code"
                type="text"
                bind:value={code}
                placeholder="000000"
                maxlength="6"
                pattern="[0-9]*"
                inputmode="numeric"
                class="claim-input claim-input--mono claim-input--code"
                autocomplete="one-time-code"
              />
            </div>
          {/if}

          <!-- Error -->
          {#if claimState === 'error' && error}
            <div class="claim-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          {/if}

          <!-- Actions -->
          <div class="claim-actions">
            {#if claimState === 'ready' || claimState === 'claiming'}
              <button type="button" class="claim-btn claim-btn--ghost" onclick={reset}>
                Back
              </button>
              <button
                type="submit"
                class="claim-btn claim-btn--primary"
                disabled={claimState === 'claiming'}
              >
                {#if claimState === 'claiming'}
                  <Loader2 size={16} class="animate-spin" />
                  Claiming...
                {:else}
                  Claim Board Access
                {/if}
              </button>
            {:else}
              <button
                type="submit"
                class="claim-btn claim-btn--primary claim-btn--full"
                disabled={!token.trim() || claimState === 'checking'}
              >
                {#if claimState === 'checking'}
                  <Loader2 size={16} class="animate-spin" />
                  Verifying...
                {:else}
                  Verify Token
                {/if}
              </button>
            {/if}
          </div>
        </form>
      {/if}
    </div>

    <!-- Footer Link -->
    <p class="claim-footer">
      Already have access? <a href={`/auth?next=${encodeURIComponent(nextPath || '/')}`} class="claim-footer-link">Sign in</a>
    </p>
  </div>
</div>

<style>
  .claim-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 1.5rem;
    background: #050508;
    background-image:
      radial-gradient(ellipse 50% 50% at 50% 30%, rgba(37, 99, 235, 0.06) 0%, transparent 70%),
      radial-gradient(ellipse 30% 40% at 70% 70%, rgba(249, 115, 22, 0.03) 0%, transparent 60%);
  }

  .claim-container {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .claim-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 2rem;
  }

  .claim-logo :global(svg) {
    color: #2563eb;
  }

  .claim-card {
    width: 100%;
    padding: 2rem;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: #0a0a0f;
  }

  /* ── Header ── */
  .claim-header {
    text-align: center;
    margin-bottom: 1.75rem;
  }

  .claim-header-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
    margin-bottom: 1rem;
  }

  .claim-title {
    font-size: 1.375rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 0.375rem;
  }

  .claim-desc {
    font-size: 0.875rem;
    line-height: 1.5;
    color: #64748b;
    margin: 0;
  }

  /* ── Form ── */
  .claim-form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .claim-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .claim-field label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .claim-field-hint {
    font-size: 0.75rem;
    color: #475569;
    margin: 0;
  }

  .claim-input {
    height: 44px;
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

  .claim-input::placeholder {
    color: #475569;
  }

  .claim-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .claim-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .claim-input--mono {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.9375rem;
    letter-spacing: 0.02em;
  }

  .claim-input--code {
    text-align: center;
    font-size: 1.5rem;
    letter-spacing: 0.25em;
    height: 52px;
  }

  /* ── Error ── */
  .claim-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
    color: #ef4444;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.15);
  }

  .claim-error :global(svg) {
    flex-shrink: 0;
    margin-top: 1px;
  }

  /* ── Actions ── */
  .claim-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.25rem;
  }

  .claim-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 44px;
    padding: 0 1.25rem;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: background 0.2s, transform 0.1s, opacity 0.2s;
  }

  .claim-btn:active:not(:disabled) {
    transform: scale(0.99);
  }

  .claim-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .claim-btn--primary {
    flex: 1;
    background: #ffffff;
    color: #0a0a0f;
  }

  .claim-btn--primary:hover:not(:disabled) {
    background: #f1f5f9;
  }

  .claim-btn--full {
    width: 100%;
  }

  .claim-btn--secondary {
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    color: #f8fafc;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-top: 1rem;
  }

  .claim-btn--secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
  }

  .claim-btn--ghost {
    background: transparent;
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .claim-btn--ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.04);
    color: #f8fafc;
  }

  /* ── Status Blocks ── */
  .claim-status-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 1rem 0;
  }

  .claim-status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    margin-bottom: 1.25rem;
  }

  .claim-status-icon--success {
    background: rgba(34, 197, 94, 0.1);
    color: #4ade80;
  }

  .claim-status-icon--expired {
    background: rgba(251, 191, 36, 0.1);
    color: #fbbf24;
  }

  .claim-status-icon--error {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
  }

  /* ── Redirect progress bar ── */
  .claim-redirect-bar {
    width: 100%;
    height: 3px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.06);
    margin-top: 1.5rem;
    overflow: hidden;
  }

  .claim-redirect-bar-fill {
    height: 100%;
    border-radius: 2px;
    background: #4ade80;
    animation: redirect-progress 2s linear forwards;
  }

  @keyframes redirect-progress {
    from { width: 0%; }
    to { width: 100%; }
  }

  /* ── Footer ── */
  .claim-footer {
    margin-top: 1.5rem;
    font-size: 0.8125rem;
    color: #64748b;
  }

  .claim-footer-link {
    color: #f8fafc;
    font-weight: 600;
    text-decoration: none;
  }

  .claim-footer-link:hover {
    text-decoration: underline;
  }
</style>
