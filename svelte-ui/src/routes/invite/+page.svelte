<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { toastStore } from '$stores/toast.svelte.js';
  import { User, Bot, Copy, Check, ChevronRight } from 'lucide-svelte';
  import { Card, CardContent } from '$components/ui/index.js';
  import { AGENT_ADAPTER_OPTIONS } from '$lib/constants/agent-adapters';

  let token = $derived($page.url.searchParams.get('token') ?? '');
  let invite = $state<any>(null);
  let loading = $state(true);
  let accepting = $state(false);
  let error = $state('');
  let nextPath = $derived($page.url.searchParams.get('next') ?? '/');

  // Tab state: "human" or "agent"
  let activeTab = $state<'human' | 'agent'>('human');

  // Agent form fields
  let agentName = $state('');
  let adapterType = $state('claude_local');
  let agentCapabilities = $state('');

  // Success state for agent join
  let agentResult = $state<{ apiKey: string; onboarding?: string } | null>(null);
  let copied = $state(false);

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
      goto(nextPath || '/');
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

<div class="flex min-h-screen items-center justify-center bg-[#050508] p-6">
  <Card class="w-full max-w-[480px] p-0">
    <div class="p-8 text-center">
      <h1 class="mb-4 text-2xl font-bold tracking-tight text-[#f8fafc]">You're Invited</h1>

    {#if loading}
      <div class="h-20 animate-pulse rounded-[10px] bg-white/4"></div>
    {:else if agentResult}
      <!-- Agent success state -->
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/12 text-green-400">
          <Check size={24} />
        </div>
        <h2 class="text-lg font-semibold text-[#f8fafc]">Agent Registered</h2>
        <p class="max-w-[360px] text-[0.8125rem] leading-relaxed text-[#94a3b8]">
          Your agent has been added to the company. Save the API key below — it will only be shown once.
        </p>

        <div class="mt-2 w-full text-left">
          <span class="mb-1.5 block text-xs font-medium text-[#94a3b8]">API Key</span>
          <div class="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/6 px-3.5 py-2.5">
            <code class="flex-1 break-all font-mono text-[0.8125rem] leading-snug text-amber-400">{agentResult.apiKey}</code>
            <button
              class="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-white/8 text-[#94a3b8] transition-colors hover:bg-white/12 hover:text-[#f8fafc] cursor-pointer"
              onclick={copyKey}
              aria-label="Copy API key"
            >
              {#if copied}
                <Check size={14} />
              {:else}
                <Copy size={14} />
              {/if}
            </button>
          </div>
        </div>

        {#if agentResult.onboarding}
        <Card class="mt-3 w-full p-0 text-left">
          <CardContent class="p-4">
            <h3 class="mb-2 text-[0.8125rem] font-semibold text-[#cbd5e1]">Onboarding Instructions</h3>
            <div class="whitespace-pre-wrap text-[0.8125rem] leading-relaxed text-[#94a3b8]">{agentResult.onboarding}</div>
          </CardContent>
        </Card>
        {/if}

        <button
          class="mt-2 inline-flex h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#2563eb] px-5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] cursor-pointer"
          onclick={() => goto(nextPath || '/')}
        >
          Go to Dashboard
          <ChevronRight size={14} />
        </button>
      </div>
    {:else if error && !invite}
      <p class="my-3 text-sm text-red-400">{error}</p>
    {:else if invite}
      <p class="mb-5 text-sm text-[#94a3b8]">
        You've been invited to join <strong class="text-[#f8fafc]">{invite.companyName ?? 'a company'}</strong>.
      </p>

        <!-- Tabs -->
        <div class="mb-5 flex gap-0.5 rounded-[10px] bg-white/4 p-[3px]">
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-lg border-none py-2.5 text-[0.8125rem] font-medium transition-colors cursor-pointer
              {activeTab === 'human' ? 'bg-white/8 text-[#f8fafc]' : 'text-[#64748b] hover:text-[#94a3b8]'}"
            onclick={() => { activeTab = 'human'; error = ''; }}
          >
            <User size={14} />
            Join as Human
          </button>
          <button
            class="flex flex-1 items-center justify-center gap-2 rounded-lg border-none py-2.5 text-[0.8125rem] font-medium transition-colors cursor-pointer
              {activeTab === 'agent' ? 'bg-white/8 text-[#f8fafc]' : 'text-[#64748b] hover:text-[#94a3b8]'}"
            onclick={() => { activeTab = 'agent'; error = ''; }}
          >
            <Bot size={14} />
            Join as Agent
          </button>
        </div>

        {#if error}
          <p class="mb-3 text-sm text-red-400">{error}</p>
        {/if}

        {#if activeTab === 'human'}
          <div class="flex flex-col gap-4 text-left">
            <p class="text-center text-[0.8125rem] leading-relaxed text-[#64748b]">
              Accept this invite to join the company as a human team member with full dashboard access.
            </p>
            <button
              class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#2563eb] text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              onclick={acceptHuman}
              disabled={accepting}
            >
              {accepting ? 'Accepting...' : 'Accept Invite'}
            </button>
          </div>
        {:else}
          <form class="flex flex-col gap-4 text-left" onsubmit={(e) => { e.preventDefault(); acceptAgent(); }}>
            <p class="text-center text-[0.8125rem] leading-relaxed text-[#64748b]">
              Register an AI agent to join this company. You'll receive an API key for authentication.
            </p>

            <div class="flex flex-col gap-1.5">
              <label for="agent-name" class="text-[0.8125rem] font-medium text-[#cbd5e1]">Agent Name</label>
              <input
                id="agent-name"
                bind:value={agentName}
                placeholder="e.g. Claude Worker 1"
                required
                class="h-10 w-full rounded-lg border border-white/8 bg-[#11111a] px-3 text-sm text-[#f8fafc] outline-none transition-all placeholder:text-[#475569] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="adapter-type" class="text-[0.8125rem] font-medium text-[#cbd5e1]">Adapter Type</label>
              <select
                id="adapter-type"
                bind:value={adapterType}
                class="h-10 w-full appearance-none rounded-lg border border-white/8 bg-[#11111a] bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2712%27%20height=%2712%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27%2364748b%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27m6%209%206%206%206-6%27/%3E%3C/svg%3E')] bg-[position:right_0.75rem_center] bg-no-repeat px-3 pr-8 text-sm text-[#f8fafc] outline-none transition-all focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              >
                {#each AGENT_ADAPTER_OPTIONS as opt (opt.value)}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="agent-capabilities" class="text-[0.8125rem] font-medium text-[#cbd5e1]">
                Capabilities <span class="font-normal text-[#475569]">(optional)</span>
              </label>
              <textarea
                id="agent-capabilities"
                bind:value={agentCapabilities}
                placeholder="Describe what this agent can do..."
                rows="3"
                class="min-h-[72px] w-full resize-y rounded-lg border border-white/8 bg-[#11111a] px-3 py-2 font-[inherit] text-sm text-[#f8fafc] outline-none transition-all placeholder:text-[#475569] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15"
              ></textarea>
            </div>

            <button
              type="submit"
              class="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#2563eb] text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              disabled={accepting || !agentName.trim()}
            >
              {accepting ? 'Registering...' : 'Register Agent'}
            </button>
          </form>
        {/if}
    {:else}
      <p class="text-sm text-[#64748b]">No invite token provided.</p>
    {/if}
    </div>
  </Card>
</div>
