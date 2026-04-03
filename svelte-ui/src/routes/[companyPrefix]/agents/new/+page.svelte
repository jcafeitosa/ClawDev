<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import AgentIconPicker from '$lib/components/agent-icon-picker.svelte';
  import AgentConfigForm from '$lib/components/agent-config-form.svelte';
  import ReportsToPicker from '$lib/components/reports-to-picker.svelte';
  import { AGENT_ADAPTER_OPTIONS } from '$lib/constants/agent-adapters';
  import { Bot, User, Settings, Zap, FileText, ChevronDown } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const ROLES = ['general', 'ceo', 'cto', 'engineer', 'designer', 'marketer', 'custom'];

  // ---------------------------------------------------------------------------
  // State — Identity
  // ---------------------------------------------------------------------------
  let name = $state('');
  let icon = $state('Bot');
  let title = $state('');
  let role = $state('general');
  let description = $state('');
  let reportsTo = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // State — Adapter Configuration
  // ---------------------------------------------------------------------------
  let adapterType = $state('claude_local');
  let adapterConfig = $state<Record<string, any>>({});
  let systemPrompt = $state('');

  // ---------------------------------------------------------------------------
  // State — Skills
  // ---------------------------------------------------------------------------
  let availableSkills = $state<any[]>([]);
  let selectedSkillIds = $state<Set<string>>(new Set());
  let skillsLoading = $state(false);

  // ---------------------------------------------------------------------------
  // State — Existing agents (for first-agent detection)
  // ---------------------------------------------------------------------------
  let existingAgents = $state<any[]>([]);
  let agentsLoaded = $state(false);

  // ---------------------------------------------------------------------------
  // State — Form
  // ---------------------------------------------------------------------------
  let creating = $state(false);
  let error = $state('');

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let isFirstAgent = $derived(agentsLoaded && existingAgents.length === 0);

  // ---------------------------------------------------------------------------
  // CSS helpers
  // ---------------------------------------------------------------------------
  const inputCls =
    'w-full rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-[#475569] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition';
  const selectCls =
    'w-full appearance-none rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-3.5 py-2.5 pr-9 text-sm text-[#F8FAFC] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition cursor-pointer';
  const labelCls = 'block text-sm font-medium text-[#CBD5E1]';
  const helpCls = 'mt-1 text-xs text-[#64748B]';
  const sectionHeadingCls =
    'flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#64748B] border-b border-white/[0.06] pb-2 mb-5';

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadExistingAgents() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      if (!res.ok) return;
      const data = await res.json();
      existingAgents = Array.isArray(data) ? data : data.agents ?? data.data ?? [];
    } catch {
      existingAgents = [];
    } finally {
      agentsLoaded = true;
    }
  }

  async function loadSkills() {
    if (!companyId) return;
    skillsLoading = true;
    try {
      const res = await api(`/api/companies/${companyId}/skills`);
      if (!res.ok) return;
      availableSkills = (await res.json()) ?? [];
    } catch {
      availableSkills = [];
    } finally {
      skillsLoading = false;
    }
  }

  // Auto-set CEO defaults when this is the first agent
  $effect(() => {
    if (isFirstAgent && !name.trim()) {
      role = 'ceo';
      title = 'CEO';
    }
  });

  onMount(() => {
    breadcrumbStore.set([
      { label: 'Agents', href: `/${$page.params.companyPrefix}/agents` },
      { label: 'New' },
    ]);
    loadExistingAgents();
    loadSkills();
  });

  // ---------------------------------------------------------------------------
  // Skill toggle
  // ---------------------------------------------------------------------------
  function toggleSkill(skillId: string) {
    const next = new Set(selectedSkillIds);
    if (next.has(skillId)) {
      next.delete(skillId);
    } else {
      next.add(skillId);
    }
    selectedSkillIds = next;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function create() {
    if (!name.trim()) return;
    creating = true;
    error = '';
    try {
      const payload: Record<string, any> = {
        name: name.trim(),
        role: role || undefined,
        icon: icon || undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        reportsTo: reportsTo || undefined,
        adapterType,
        adapterConfig: Object.keys(adapterConfig).length > 0 ? adapterConfig : undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        skillIds: selectedSkillIds.size > 0 ? Array.from(selectedSkillIds) : undefined,
      };

      const res = await api(`/api/companies/${companyId}/agents`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const agent = await res.json();
      if (!res.ok) throw new Error(agent?.error ?? 'Failed to create agent');
      toastStore.push({ title: 'Agent created', body: `${agent.name} has been created.`, tone: 'success' });
      goto(`/${$page.params.companyPrefix}/agents/${agent.id}`);
    } catch (e: any) {
      error = e.message;
    } finally {
      creating = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl p-6 space-y-8">
  <div>
    <h1 class="text-xl font-bold text-[#F8FAFC]">Create Agent</h1>
    <p class="mt-1 text-sm text-[#64748B]">
      Configure a new agent for your company.
      {#if isFirstAgent}
        <span class="text-amber-400">This will be the first agent — defaulting to CEO role.</span>
      {/if}
    </p>
  </div>

  <form onsubmit={(e) => { e.preventDefault(); create(); }} class="space-y-10">
    <!-- ===================================================================== -->
    <!-- SECTION: Identity                                                      -->
    <!-- ===================================================================== -->
    <section>
      <div class={sectionHeadingCls}>
        <User class="size-3.5" />
        <span>Identity</span>
      </div>

      <div class="space-y-5">
        <!-- Name + Icon row -->
        <div class="flex items-start gap-4">
          <div>
            <div class={labelCls}>Icon</div>
            <div class="mt-1.5">
              <AgentIconPicker value={icon} onSelect={(name) => icon = name} />
            </div>
          </div>
          <div class="flex-1">
            <label for="agent-name" class={labelCls}>
              Name <span class="text-red-400">*</span>
            </label>
            <input
              id="agent-name"
              type="text"
              bind:value={name}
              required
              placeholder="e.g. Atlas, Sentinel, Spark"
              class="{inputCls} mt-1.5"
            />
            <p class={helpCls}>A unique name for this agent within the company.</p>
          </div>
        </div>

        <!-- Title -->
        <div>
          <label for="agent-title" class={labelCls}>Title</label>
          <input
            id="agent-title"
            type="text"
            bind:value={title}
            placeholder="e.g. Senior Engineer, Design Lead"
            class="{inputCls} mt-1.5"
          />
          <p class={helpCls}>A job title or designation for this agent.</p>
        </div>

        <!-- Role -->
        <div>
          <label for="agent-role" class={labelCls}>Role</label>
          <div class="relative mt-1.5">
            <select
              id="agent-role"
              bind:value={role}
              class={selectCls}
            >
              {#each ROLES as r}
                <option value={r} class="bg-[#0f172a] capitalize">{r}</option>
              {/each}
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>The organizational role this agent fulfills.</p>
        </div>

        <!-- Reports To -->
        <div>
          <div class={labelCls}>Reports To</div>
          <div class="mt-1.5">
            {#if companyId}
              <ReportsToPicker
                {companyId}
                value={reportsTo}
                onSelect={(id) => reportsTo = id}
              />
            {:else}
              <p class="text-sm text-[#64748B]">Loading company...</p>
            {/if}
          </div>
          <p class={helpCls}>Select a manager agent, or leave as "None" for a top-level agent.</p>
        </div>

        <!-- Description -->
        <div>
          <label for="agent-description" class={labelCls}>Description</label>
          <textarea
            id="agent-description"
            bind:value={description}
            rows={3}
            placeholder="Describe what this agent does, its responsibilities, and expertise..."
            class="{inputCls} mt-1.5 resize-y"
          ></textarea>
          <p class={helpCls}>A brief description of the agent's purpose and capabilities.</p>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- SECTION: Adapter Configuration                                         -->
    <!-- ===================================================================== -->
    <section>
      <div class={sectionHeadingCls}>
        <Settings class="size-3.5" />
        <span>Adapter Configuration</span>
      </div>

      <div class="space-y-5">
        <!-- Adapter Type -->
        <div>
          <label for="adapter-type" class={labelCls}>Adapter Type</label>
          <div class="relative mt-1.5">
            <select
              id="adapter-type"
              bind:value={adapterType}
              class={selectCls}
            >
              {#each AGENT_ADAPTER_OPTIONS as a}
                <option value={a.value} class="bg-[#0f172a]">{a.label}</option>
              {/each}
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#64748B]" />
          </div>
          <p class={helpCls}>The runtime adapter that powers this agent.</p>
        </div>

        <!-- AgentConfigForm -->
        <AgentConfigForm {adapterType} companyId={companyId} bind:config={adapterConfig} mode="create" />
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- SECTION: Skills                                                        -->
    <!-- ===================================================================== -->
    <section>
      <div class={sectionHeadingCls}>
        <Zap class="size-3.5" />
        <span>Skills</span>
      </div>

      {#if skillsLoading}
        <div class="flex items-center gap-2 text-sm text-[#64748B] py-4">
          <div class="h-4 w-4 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent"></div>
          Loading skills...
        </div>
      {:else if availableSkills.length === 0}
        <p class="text-sm text-[#64748B] py-2">No skills available in this company. You can add skills later.</p>
      {:else}
        <div class="space-y-2">
          {#each availableSkills as skill (skill.id ?? skill.key)}
            <label
              class="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-[#0A0A0F] px-4 py-3 cursor-pointer transition hover:border-white/[0.15] hover:bg-white/[0.03]
                {selectedSkillIds.has(skill.id ?? skill.key) ? 'border-[#2563EB]/40 bg-[#2563EB]/[0.05]' : ''}"
            >
              <input
                type="checkbox"
                checked={selectedSkillIds.has(skill.id ?? skill.key)}
                onchange={() => toggleSkill(skill.id ?? skill.key)}
                class="h-4 w-4 rounded border-white/[0.2] bg-transparent text-[#2563EB] focus:ring-[#2563EB]/30 focus:ring-offset-0"
              />
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-[#F8FAFC]">{skill.name ?? skill.key}</span>
                {#if skill.description}
                  <p class="text-xs text-[#64748B] mt-0.5 truncate">{skill.description}</p>
                {/if}
              </div>
              <span class="text-xs font-mono text-[#475569] shrink-0">{skill.key}</span>
            </label>
          {/each}
        </div>
        <p class={helpCls}>Select the skills this agent should have access to.</p>
      {/if}
    </section>

    <!-- ===================================================================== -->
    <!-- SECTION: System Prompt                                                 -->
    <!-- ===================================================================== -->
    <section>
      <div class={sectionHeadingCls}>
        <FileText class="size-3.5" />
        <span>System Prompt</span>
      </div>

      <div>
        <label for="system-prompt" class={labelCls}>System Prompt</label>
        <textarea
          id="system-prompt"
          bind:value={systemPrompt}
          rows={6}
          placeholder="You are an AI agent that..."
          class="{inputCls} mt-1.5 resize-y font-mono text-xs"
          spellcheck="false"
        ></textarea>
        <p class={helpCls}>
          Optional instructions that define the agent's behavior and persona. Supports
          <code class="rounded bg-white/[0.06] px-1 py-0.5 text-[11px] text-[#94A3B8]">{"{{issue.title}}"}</code>
          placeholders.
        </p>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- Error + Submit                                                         -->
    <!-- ===================================================================== -->
    {#if error}
      <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
        <p class="text-sm text-red-400">{error}</p>
      </div>
    {/if}

    <div class="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
      <a
        href="/{$page.params.companyPrefix}/agents"
        class="rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm font-medium text-[#CBD5E1] transition hover:bg-white/[0.05]"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={creating || !name.trim()}
        class="rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-medium text-white transition hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? 'Creating...' : 'Create Agent'}
      </button>
    </div>
  </form>
</div>
