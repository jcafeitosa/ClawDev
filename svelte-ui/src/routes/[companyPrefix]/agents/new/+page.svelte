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
  import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label, Alert, AlertDescription, Badge, Skeleton, Separator } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    getHierarchyPresetSeedAgents,
    type HierarchyPreset,
  } from '@clawdev/shared';

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
  let selectedHierarchyPreset = $derived<HierarchyPreset | null>(
    (companyStore.selectedCompany?.hierarchyPreset as HierarchyPreset | undefined) ?? null
  );
  let hierarchyPresetDefinition = $derived(
    selectedHierarchyPreset ? getHierarchyPresetDefinition(selectedHierarchyPreset) : null
  );
  let hierarchyPresetDepartments = $derived(
    selectedHierarchyPreset ? getHierarchyPresetDepartments(selectedHierarchyPreset) : []
  );
  let hierarchyPresetRules = $derived(
    selectedHierarchyPreset ? getHierarchyPresetOperatingRules(selectedHierarchyPreset) : []
  );
  let hierarchyPresetSeedAgents = $derived(
    selectedHierarchyPreset ? getHierarchyPresetSeedAgents(selectedHierarchyPreset) : []
  );
  let routeAdapterType = $derived($page.url.searchParams.get('adapterType') ?? '');
  let routeModel = $derived($page.url.searchParams.get('model') ?? '');
  let routeProvider = $derived($page.url.searchParams.get('provider') ?? '');
  let routeBaseUrl = $derived($page.url.searchParams.get('baseUrl') ?? '');
  let routeApiKey = $derived($page.url.searchParams.get('apiKey') ?? '');

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
  const chipCls = 'inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-[#CBD5E1]';

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

  $effect(() => {
    if (!routeAdapterType) return;
    if (AGENT_ADAPTER_OPTIONS.some((option) => option.value === routeAdapterType)) {
      adapterType = routeAdapterType;
      if (routeModel && !adapterConfig.model) {
        adapterConfig = {
          ...adapterConfig,
          model: routeModel,
        };
      }
      if (routeProvider && !adapterConfig.provider) {
        adapterConfig = {
          ...adapterConfig,
          provider: routeProvider,
        };
      }
      if (routeBaseUrl && !adapterConfig.baseUrl) {
        adapterConfig = {
          ...adapterConfig,
          baseUrl: routeBaseUrl,
        };
      }
      if (routeApiKey && !adapterConfig.apiKey) {
        adapterConfig = {
          ...adapterConfig,
          apiKey: routeApiKey,
        };
      }
      if (routeAdapterType === 'openai_compatible_local' && !adapterConfig.baseUrl) {
        adapterConfig = {
          ...adapterConfig,
          baseUrl: 'http://localhost:11434/v1',
        };
      }
      if (routeAdapterType === 'pi_local' && !adapterConfig.provider) {
        adapterConfig = {
          ...adapterConfig,
          provider: 'groq',
        };
      }
    }
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

<PageLayout title="Create Agent" description="Configure a new agent for your company." fullWidth>
  <Card class="border-border/60 backdrop-blur-sm">
    <CardHeader>
      <CardTitle class="text-xl">Create Agent</CardTitle>
      <p class="text-sm text-muted-foreground">
        Configure a new agent for your company.
        {#if isFirstAgent}
          <Badge variant="ghost" class="ml-1 text-amber-400 bg-amber-500/10">First agent — defaults to CEO</Badge>
        {/if}
      </p>
    </CardHeader>
    <CardContent>

  {#if hierarchyPresetDefinition}
    <Card class="mb-8 border-white/[0.08] bg-white/[0.02]">
      <CardHeader class="pb-4">
        <CardTitle class="text-base">Company hierarchy blueprint</CardTitle>
        <p class="text-sm text-muted-foreground">
          This company uses the <span class="font-medium text-foreground">{hierarchyPresetDefinition.label}</span> preset.
          The departments and operating rules below shape how new agents should be staffed and delegated.
        </p>
      </CardHeader>
      <CardContent class="space-y-6">
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Root model</p>
            <p class="mt-2 text-sm font-medium text-foreground">{hierarchyPresetDefinition.rootTitle}</p>
            <p class="mt-1 text-xs text-muted-foreground">{hierarchyPresetDefinition.rootSubtitle}</p>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Departments</p>
            <p class="mt-2 text-sm font-medium text-foreground">{hierarchyPresetDepartments.length} active lanes</p>
            <p class="mt-1 text-xs text-muted-foreground">Use these to keep ownership explicit and non-overlapping.</p>
          </div>
          <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Operating rules</p>
            <p class="mt-2 text-sm font-medium text-foreground">{hierarchyPresetRules.length} guardrails</p>
            <p class="mt-1 text-xs text-muted-foreground">SDD, delegation, approvals, and collaboration stay visible.</p>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div>
            <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Departments</p>
            <div class="flex flex-wrap gap-2">
              {#each hierarchyPresetDepartments as department}
                <span class={chipCls}>
                  {department.label}
                  <span class="text-[#64748B]">({department.level.toUpperCase().replace('_', ' ')})</span>
                </span>
              {/each}
            </div>
          </div>

          <div>
            <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Seed leadership</p>
            <div class="space-y-2">
              {#each hierarchyPresetSeedAgents.slice(0, 5) as seed}
                <div class="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div>
                    <p class="text-sm font-medium text-foreground">{seed.name}</p>
                    <p class="text-xs text-muted-foreground">{seed.title} · reports to {seed.reportsToKey}</p>
                  </div>
                  <Badge variant="ghost" class="text-[11px]">{seed.level.toUpperCase()}</Badge>
                </div>
              {/each}
            </div>
          </div>
        </div>

        <div>
          <p class="mb-3 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Operating rules</p>
          <div class="grid gap-2 md:grid-cols-2">
            {#each hierarchyPresetRules as rule}
              <div class="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p class="text-sm font-medium text-foreground">{rule.title}</p>
                <p class="mt-1 text-xs text-muted-foreground">{rule.description}</p>
              </div>
            {/each}
          </div>
        </div>
      </CardContent>
    </Card>
  {/if}

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
            <Label>Icon</Label>
            <div class="mt-1.5">
              <AgentIconPicker value={icon} onSelect={(name) => icon = name} />
            </div>
          </div>
          <div class="flex-1">
            <Label for="agent-name">
              Name <span class="text-red-400">*</span>
            </Label>
            <Input
              id="agent-name"
              type="text"
              bind:value={name}
              required
              placeholder="e.g. Atlas, Sentinel, Spark"
              class="mt-1.5"
            />
            <p class={helpCls}>A unique name for this agent within the company.</p>
          </div>
        </div>

        <!-- Title -->
        <div>
          <Label for="agent-title">Title</Label>
          <Input
            id="agent-title"
            type="text"
            bind:value={title}
            placeholder="e.g. Senior Engineer, Design Lead"
            class="mt-1.5"
          />
          <p class={helpCls}>A job title or designation for this agent.</p>
        </div>

        <!-- Role -->
        <div>
          <Label for="agent-role">Role</Label>
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
          <Label>Reports To</Label>
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
          <Label for="agent-description">Description</Label>
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
          <Label for="adapter-type">Adapter Type</Label>
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
        <div class="space-y-2 py-2">
          {#each Array(3) as _}
            <Skeleton class="h-12 w-full rounded-lg" />
          {/each}
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
        <Label for="system-prompt">System Prompt</Label>
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
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    {/if}

    <Separator />

    <div class="flex items-center justify-end gap-3">
      <Button variant="outline" href="/{$page.params.companyPrefix}/agents" class="cursor-pointer">
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={creating || !name.trim()}
        class="cursor-pointer"
      >
        {creating ? 'Creating...' : 'Create Agent'}
      </Button>
    </div>
  </form>
    </CardContent>
  </Card>
</PageLayout>
