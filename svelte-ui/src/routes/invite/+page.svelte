<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { toastStore } from '$stores/toast.svelte.js';
  import { User, Bot, Copy, Check, ChevronRight } from 'lucide-svelte';

  let token = $derived($page.url.searchParams.get('token') ?? '');
  let invite = $state<any>(null);
  let loading = $state(true);
  let accepting = $state(false);
  let error = $state('');

  // Tab state: "human" or "agent"
  let activeTab = $state<'human' | 'agent'>('human');

  // Agent form fields
  let agentName = $state('');
  let adapterType = $state('claude_local');
  let agentCapabilities = $state('');

  // Success state for agent join
  let agentResult = $state<{ apiKey: string; onboarding?: string } | null>(null);
  let copied = $state(false);

  const adapterOptions = [
    { value: 'claude_local', label: 'Claude (Local)' },
    { value: 'codex_local', label: 'Codex (Local)' },
    { value: 'cursor_local', label: 'Cursor (Local)' },
    { value: 'gemini_local', label: 'Gemini (Local)' },
    { value: 'opencode_local', label: 'OpenCode (Local)' },
    { value: 'pi_local', label: 'Pi (Local)' },
    { value: 'openclaw_gateway', label: 'OpenClaw Gateway' },
  ];

  $effect(() => {
    if (!token) { loading = false; return; }
    api(`/api/access/invites/${token}`)
      .then((r) => r.json())
      .then((d) => { invite = d; })
      .catch(() => { error = 'Invalid or expired invite'; })
      .finally(() => { loading = false; });
  });

  async function acceptHuman() {
    accepting = true;
    error = '';
    try {
      const res = await api(`/api/access/invites/${token}/accept`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      toastStore.push({ title: 'Invite accepted', tone: 'success' });
      goto('/');
    } catch {
      error = 'Failed to accept invite';
    } finally {
      accepting = false;
    }
  }

  async function acceptAgent() {
    if (!agentName.trim()) {
      error = 'Agent name is required';
      return;
    }
    accepting = true;
    error = '';
    try {
      const res = await api(`/api/access/invites/${token}/accept`, {
        method: 'POST',
        body: JSON.stringify({
          requestType: 'agent',
          agentName: agentName.trim(),
          adapterType,
          capabilities: agentCapabilities.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      // Fetch onboarding instructions
      let onboarding: string | undefined;
      try {
        const obRes = await api(`/api/access/invites/${token}/onboarding`);
        if (obRes.ok) {
          const obData = await obRes.json();
          onboarding = obData.instructions ?? obData.text ?? obData.onboarding;
        }
      } catch { /* optional */ }

      agentResult = {
        apiKey: data.apiKey ?? data.token ?? data.key ?? '',
        onboarding,
      };
      toastStore.push({ title: 'Agent joined successfully', tone: 'success' });
    } catch {
      error = 'Failed to register agent';
    } finally {
      accepting = false;
    }
  }

  async function copyKey() {
    if (!agentResult?.apiKey) return;
    try {
      await navigator.clipboard.writeText(agentResult.apiKey);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      toastStore.push({ title: 'Failed to copy', tone: 'error' });
    }
  }
</script>

<div class="invite-page">
  <div class="invite-card">
    <h1 class="invite-title">You're Invited</h1>

    {#if loading}
      <div class="invite-skeleton"></div>
    {:else if agentResult}
      <!-- Agent success state -->
      <div class="invite-success">
        <div class="invite-success-icon">
          <Check size={24} />
        </div>
        <h2 class="invite-success-title">Agent Registered</h2>
        <p class="invite-success-subtitle">Your agent has been added to the company. Save the API key below — it will only be shown once.</p>

        <div class="invite-key-box">
          <label class="invite-key-label">API Key</label>
          <div class="invite-key-row">
            <code class="invite-key-value">{agentResult.apiKey}</code>
            <button class="invite-key-copy" onclick={copyKey} aria-label="Copy API key">
              {#if copied}
                <Check size={14} />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
        </div>

        {#if agentResult.onboarding}
          <div class="invite-onboarding">
            <h3 class="invite-onboarding-title">Onboarding Instructions</h3>
            <div class="invite-onboarding-text">{agentResult.onboarding}</div>
          </div>
        {/if}

        <button class="invite-btn-primary" onclick={() => goto('/')}>
          Go to Dashboard
          <ChevronRight size={14} />
        </button>
      </div>
    {:else if error && !invite}
      <p class="invite-error">{error}</p>
    {:else if invite}
      <p class="invite-company-info">
        You've been invited to join <strong>{invite.companyName ?? 'a company'}</strong>.
      </p>

      <!-- Tabs -->
      <div class="invite-tabs">
        <button
          class="invite-tab"
          class:invite-tab-active={activeTab === 'human'}
          onclick={() => { activeTab = 'human'; error = ''; }}
        >
          <User size={14} />
          Join as Human
        </button>
        <button
          class="invite-tab"
          class:invite-tab-active={activeTab === 'agent'}
          onclick={() => { activeTab = 'agent'; error = ''; }}
        >
          <Bot size={14} />
          Join as Agent
        </button>
      </div>

      {#if error}
        <p class="invite-error">{error}</p>
      {/if}

      {#if activeTab === 'human'}
        <div class="invite-tab-content">
          <p class="invite-tab-desc">Accept this invite to join the company as a human team member with full dashboard access.</p>
          <button
            class="invite-btn-primary invite-btn-full"
            onclick={acceptHuman}
            disabled={accepting}
          >
            {accepting ? 'Accepting...' : 'Accept Invite'}
          </button>
        </div>
      {:else}
        <form class="invite-tab-content" onsubmit={(e) => { e.preventDefault(); acceptAgent(); }}>
          <p class="invite-tab-desc">Register an AI agent to join this company. You'll receive an API key for authentication.</p>

          <div class="invite-field">
            <label for="agent-name">Agent Name</label>
            <input
              id="agent-name"
              bind:value={agentName}
              placeholder="e.g. Claude Worker 1"
              required
            />
          </div>

          <div class="invite-field">
            <label for="adapter-type">Adapter Type</label>
            <select id="adapter-type" bind:value={adapterType}>
              {#each adapterOptions as opt (opt.value)}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>

          <div class="invite-field">
            <label for="agent-capabilities">Capabilities <span class="invite-field-optional">(optional)</span></label>
            <textarea
              id="agent-capabilities"
              bind:value={agentCapabilities}
              placeholder="Describe what this agent can do..."
              rows="3"
            ></textarea>
          </div>

          <button
            type="submit"
            class="invite-btn-primary invite-btn-full"
            disabled={accepting || !agentName.trim()}
          >
            {accepting ? 'Registering...' : 'Register Agent'}
          </button>
        </form>
      {/if}
    {:else}
      <p class="invite-muted">No invite token provided.</p>
    {/if}
  </div>
</div>

<style>
  .invite-page {
    display: flex;
    min-height: 100vh;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: #050508;
  }

  .invite-card {
    width: 100%;
    max-width: 480px;
    padding: 2rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: center;
  }

  .invite-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0 0 1rem;
    letter-spacing: -0.02em;
  }

  .invite-skeleton {
    height: 80px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .invite-error {
    font-size: 0.875rem;
    color: #f87171;
    margin: 0.75rem 0;
  }

  .invite-muted {
    font-size: 0.875rem;
    color: #64748b;
  }

  .invite-company-info {
    font-size: 0.875rem;
    color: #94a3b8;
    margin: 0 0 1.25rem;
  }

  .invite-company-info strong {
    color: #f8fafc;
  }

  /* -- Tabs -- */
  .invite-tabs {
    display: flex;
    gap: 2px;
    margin-bottom: 1.25rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    padding: 3px;
  }

  .invite-tab {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 38px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #64748b;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }

  .invite-tab:hover:not(.invite-tab-active) {
    color: #94a3b8;
  }

  .invite-tab-active {
    background: rgba(255, 255, 255, 0.08);
    color: #f8fafc;
  }

  /* -- Tab content -- */
  .invite-tab-content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: left;
  }

  .invite-tab-desc {
    font-size: 0.8125rem;
    color: #64748b;
    margin: 0;
    text-align: center;
    line-height: 1.5;
  }

  /* -- Fields -- */
  .invite-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .invite-field label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
  }

  .invite-field-optional {
    font-weight: 400;
    color: #475569;
  }

  .invite-field input,
  .invite-field select,
  .invite-field textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
    font-family: inherit;
  }

  .invite-field input { height: 40px; }

  .invite-field select {
    height: 40px;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    padding-right: 2rem;
  }

  .invite-field textarea {
    resize: vertical;
    min-height: 72px;
  }

  .invite-field input::placeholder,
  .invite-field textarea::placeholder {
    color: #475569;
  }

  .invite-field input:focus,
  .invite-field select:focus,
  .invite-field textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  /* -- Buttons -- */
  .invite-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 42px;
    padding: 0 1.25rem;
    border-radius: 10px;
    border: none;
    background: #2563eb;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .invite-btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .invite-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .invite-btn-full {
    width: 100%;
  }

  /* -- Success state -- */
  .invite-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .invite-success-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(34, 197, 94, 0.12);
    color: #4ade80;
  }

  .invite-success-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .invite-success-subtitle {
    font-size: 0.8125rem;
    color: #94a3b8;
    margin: 0;
    line-height: 1.5;
    max-width: 360px;
  }

  /* -- API key box -- */
  .invite-key-box {
    width: 100%;
    margin-top: 0.5rem;
    text-align: left;
  }

  .invite-key-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: #94a3b8;
    margin-bottom: 0.375rem;
  }

  .invite-key-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-radius: 8px;
    border: 1px solid rgba(250, 204, 21, 0.2);
    background: rgba(250, 204, 21, 0.06);
  }

  .invite-key-value {
    flex: 1;
    font-size: 0.8125rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: #fbbf24;
    word-break: break-all;
    line-height: 1.4;
  }

  .invite-key-copy {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }

  .invite-key-copy:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
  }

  /* -- Onboarding -- */
  .invite-onboarding {
    width: 100%;
    margin-top: 0.75rem;
    text-align: left;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
  }

  .invite-onboarding-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #cbd5e1;
    margin: 0 0 0.5rem;
  }

  .invite-onboarding-text {
    font-size: 0.8125rem;
    color: #94a3b8;
    line-height: 1.6;
    white-space: pre-wrap;
  }
</style>
