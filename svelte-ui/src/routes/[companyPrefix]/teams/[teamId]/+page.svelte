<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    Users, Crown, UserPlus, UserMinus, MessageSquare, ListTodo,
    Send, CheckCircle2, Circle, Clock, AlertCircle, Plus, Trash2,
    ArrowRightLeft, Bot
  } from 'lucide-svelte';
  import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, Skeleton, Separator } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    isLevelCAgentRole,
    type HierarchyPreset,
  } from '@clawdev/shared';

  let teamId = $derived($page.params.teamId);
  let prefix = $derived($page.params.companyPrefix);
  let companyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let selectedHierarchyPreset = $derived<HierarchyPreset | null>(
    (companyStore.selectedCompany?.hierarchyPreset as HierarchyPreset | undefined) ?? null
  );
  let hierarchyPresetDefinition = $derived(
    selectedHierarchyPreset ? getHierarchyPresetDefinition(selectedHierarchyPreset) : null
  );
  let hierarchyPresetDepartments = $derived(
    selectedHierarchyPreset ? getHierarchyPresetDepartments(selectedHierarchyPreset) : []
  );
  let hierarchyPresetOperatingRules = $derived(
    selectedHierarchyPreset ? getHierarchyPresetOperatingRules(selectedHierarchyPreset) : []
  );

  let loading = $state(true);
  let team = $state<any>(null);
  let tasks = $state<any[]>([]);
  let teamMessages = $state<any[]>([]);
  let agents = $state<any[]>([]);

  // Tab state
  let activeTab = $state<'members' | 'tasks' | 'messages'>('members');

  // Forms
  let showAddMember = $state(false);
  let selectedAgentId = $state('');
  let showNewTask = $state(false);
  let newTaskTitle = $state('');
  let newTaskDesc = $state('');
  let showSendMessage = $state(false);
  let messageBody = $state('');

  $effect(() => {
    if (!teamId) return;
    loading = true;
    Promise.all([
      api(`/api/agent-teams/${teamId}`).then(r => r.json()),
      api(`/api/agent-teams/${teamId}/tasks`).then(r => r.json()).catch(() => []),
      api(`/api/agent-teams/${teamId}/messages?limit=50`).then(r => r.json()).catch(() => []),
    ]).then(([teamData, taskData, msgData]) => {
      team = teamData;
      tasks = Array.isArray(taskData) ? taskData : [];
      teamMessages = Array.isArray(msgData) ? msgData : [];
      breadcrumbStore.set([
        { label: 'Teams', href: `/${prefix}/teams` },
        { label: teamData?.name ?? 'Team' },
      ]);
    }).catch(console.error).finally(() => (loading = false));
  });

  // Load available agents for add member
  $effect(() => {
    if (!companyId || !showAddMember) return;
    api(`/api/companies/${companyId}/agents`)
      .then(r => r.json())
      .then(d => { agents = Array.isArray(d) ? d : d.agents ?? []; })
      .catch(() => {});
  });

  async function addMember() {
    if (!selectedAgentId || !teamId) return;
    try {
      await api(`/api/agent-teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ agentId: selectedAgentId, role: 'member' }),
      });
      // Refresh team
      const res = await api(`/api/agent-teams/${teamId}`);
      team = await res.json();
      showAddMember = false;
      selectedAgentId = '';
    } catch (e) { console.error(e); }
  }

  async function removeMember(agentId: string) {
    if (!teamId) return;
    try {
      await api(`/api/agent-teams/${teamId}/members/${agentId}`, { method: 'DELETE' });
      const res = await api(`/api/agent-teams/${teamId}`);
      team = await res.json();
    } catch (e) { console.error(e); }
  }

  async function createTask() {
    if (!newTaskTitle.trim() || !teamId || !team) return;
    try {
      const res = await api(`/api/agent-teams/${teamId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim() || undefined,
          createdByAgentId: team.leadAgentId ?? team.members?.[0]?.agentId,
        }),
      });
      const task = await res.json();
      tasks = [task, ...tasks];
      newTaskTitle = '';
      newTaskDesc = '';
      showNewTask = false;
    } catch (e) { console.error(e); }
  }

  async function sendMessage() {
    if (!messageBody.trim() || !teamId || !team) return;
    try {
      const fromAgentId = team.leadAgentId ?? team.members?.[0]?.agentId;
      if (!fromAgentId) return;
      await api(`/api/agents/${fromAgentId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          companyId: team.companyId,
          toTeamId: teamId,
          messageType: 'chat',
          body: messageBody.trim(),
        }),
      });
      // Refresh messages
      const res = await api(`/api/agent-teams/${teamId}/messages?limit=50`);
      teamMessages = await res.json();
      messageBody = '';
      showSendMessage = false;
    } catch (e) { console.error(e); }
  }

  const TASK_STATUS_ICONS: Record<string, { icon: any; color: string }> = {
    pending: { icon: Circle, color: '#94a3b8' },
    claimed: { icon: Clock, color: '#f97316' },
    in_progress: { icon: Clock, color: '#3b82f6' },
    completed: { icon: CheckCircle2, color: '#10b981' },
    blocked: { icon: AlertCircle, color: '#ef4444' },
    cancelled: { icon: Trash2, color: '#6b7280' },
  };

  function formatTime(d: string) {
    return new Date(d).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const memberIds = $derived(new Set((team?.members ?? []).map((m: any) => m.agentId)));
  const availableAgents = $derived(agents.filter(a => !memberIds.has(a.id)));
  function memberLayer(role: string | null | undefined) {
    return isLevelCAgentRole(role) ? 'Level C' : 'Execution';
  }
</script>

{#if loading}
  <PageLayout title="Loading...">
    <div class="space-y-4">
      <Skeleton class="h-20 rounded-xl" />
      <Skeleton class="h-60 rounded-xl" />
    </div>
  </PageLayout>
{:else if !team}
  <PageLayout title="Team Not Found">
    <Card>
      <CardContent class="p-12 text-center">
        <p class="text-sm text-muted-foreground">This team does not exist or was dissolved.</p>
      </CardContent>
    </Card>
  </PageLayout>
{:else}
  <PageLayout title={team.name} description={team.description ?? 'Agent collaboration team'}>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <Badge variant="outline" class="text-xs">
          <Users class="h-3 w-3 mr-1" />
          {team.members?.length ?? 0} members
        </Badge>
        {#if team.status === 'active'}
          <Badge class="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Active</Badge>
        {:else}
          <Badge variant="secondary" class="text-xs">{team.status}</Badge>
        {/if}
      </div>
    {/snippet}

    {#if hierarchyPresetDefinition}
      <Card class="border-border/60 mb-4">
        <CardContent class="pt-5">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="max-w-3xl">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hierarchy preset</p>
              <h2 class="mt-1 text-lg font-semibold text-foreground">{hierarchyPresetDefinition.label}</h2>
              <p class="mt-1 text-sm text-muted-foreground">{hierarchyPresetDefinition.description}</p>
            </div>
            <div class="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
              <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Organizing principle</p>
              <p class="mt-1 text-sm text-foreground">{hierarchyPresetDefinition.fit}</p>
            </div>
          </div>

          <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {#each hierarchyPresetDepartments as department}
              <div class="rounded-xl border border-border/60 bg-background/60 p-3">
                <p class="text-sm font-medium text-foreground">{department.label}</p>
                <p class="mt-1 text-xs text-muted-foreground">{department.description}</p>
                <p class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {department.level.toUpperCase().replace('_', ' ')}
                </p>
              </div>
            {/each}
          </div>

          <div class="mt-4 space-y-2">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Operating rules</p>
            <div class="grid gap-2 lg:grid-cols-3">
              {#each hierarchyPresetOperatingRules as rule}
                <div class="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p class="text-sm font-medium text-foreground">{rule.title}</p>
                  <p class="mt-1 text-xs text-muted-foreground">{rule.description}</p>
                </div>
              {/each}
            </div>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Tabs -->
    <div class="flex items-center border-b border-border mb-4">
      {#each [
        { key: 'members', label: 'Members', icon: Users },
        { key: 'tasks', label: 'Tasks', icon: ListTodo },
        { key: 'messages', label: 'Messages', icon: MessageSquare },
      ] as tab}
        <button
          class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
            {activeTab === tab.key
              ? 'border-b-2 border-blue-500 text-foreground'
              : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
          onclick={() => (activeTab = tab.key as any)}
        >
          <tab.icon class="h-4 w-4" />
          {tab.label}
          {#if tab.key === 'tasks'}
            <span class="text-xs text-muted-foreground/60">({tasks.length})</span>
          {/if}
          {#if tab.key === 'messages'}
            <span class="text-xs text-muted-foreground/60">({teamMessages.length})</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- Members Tab -->
    {#if activeTab === 'members'}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">Team Members</h3>
          <Button size="sm" onclick={() => (showAddMember = !showAddMember)}>
            <UserPlus class="h-3.5 w-3.5" />
            Add Member
          </Button>
        </div>

        {#if showAddMember}
          <Card>
            <CardContent class="pt-4">
              <div class="flex items-end gap-3">
                <div class="flex-1">
                  <label for="agent-select" class="block text-xs font-medium text-muted-foreground mb-1">Select Agent</label>
                  <select
                    id="agent-select"
                    bind:value={selectedAgentId}
                    class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">Choose an agent...</option>
                    {#each availableAgents as agent}
                      <option value={agent.id}>{agent.name} ({agent.role})</option>
                    {/each}
                  </select>
                </div>
                <Button size="sm" onclick={addMember} disabled={!selectedAgentId}>Add</Button>
                <Button size="sm" variant="outline" onclick={() => (showAddMember = false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        {/if}

        <div class="glass-card overflow-hidden">
          {#each (team.members ?? []) as member (member.id)}
            <div class="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0">
              <div class="rounded-lg p-1.5 bg-blue-500/10">
                <Bot class="h-4 w-4 text-blue-500" />
              </div>
              <div class="flex-1 min-w-0">
                <a href="/{prefix}/agents/{member.agentId}" class="font-medium text-sm text-foreground hover:text-blue-500 transition-colors">
                  {member.agentName}
                </a>
                <span class="text-xs text-muted-foreground/60 ml-2">{member.agentRole}</span>
              </div>
              <div class="flex items-center gap-2">
                {#if member.role === 'lead'}
                  <Badge class="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                    <Crown class="h-3 w-3 mr-0.5" /> Lead
                  </Badge>
                {:else}
                  <Badge variant="outline" class="text-[10px]">{member.role}</Badge>
                {/if}
                <Badge variant="outline" class="text-[10px] uppercase tracking-wider">{memberLayer(member.agentRole)}</Badge>
                <span class="inline-flex h-2 w-2 rounded-full {member.agentStatus === 'idle' || member.agentStatus === 'running' ? 'bg-emerald-500' : 'bg-gray-400'}"></span>
                {#if member.role !== 'lead'}
                  <button
                    class="text-muted-foreground/40 hover:text-red-500 transition-colors p-1"
                    onclick={() => removeMember(member.agentId)}
                    title="Remove member"
                  >
                    <UserMinus class="h-3.5 w-3.5" />
                  </button>
                {/if}
              </div>
            </div>
          {/each}
          {#if (team.members ?? []).length === 0}
            <div class="p-8 text-center">
              <p class="text-xs text-muted-foreground/60">No members. Add agents to this team.</p>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Tasks Tab -->
    {#if activeTab === 'tasks'}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">Shared Task List</h3>
          <Button size="sm" onclick={() => (showNewTask = !showNewTask)}>
            <Plus class="h-3.5 w-3.5" />
            New Task
          </Button>
        </div>

        {#if showNewTask}
          <Card>
            <CardContent class="pt-4">
              <form onsubmit={(e) => { e.preventDefault(); createTask(); }} class="space-y-3">
                <Input bind:value={newTaskTitle} placeholder="Task title" />
                <textarea
                  bind:value={newTaskDesc}
                  placeholder="Description (optional)"
                  rows="2"
                  class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none resize-none"
                ></textarea>
                <div class="flex gap-2">
                  <Button size="sm" type="submit" disabled={!newTaskTitle.trim()}>Create Task</Button>
                  <Button size="sm" variant="outline" type="button" onclick={() => (showNewTask = false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        {/if}

        <div class="glass-card overflow-hidden">
          {#if tasks.length === 0}
            <div class="p-8 text-center">
              <ListTodo class="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
              <p class="text-xs text-muted-foreground/60">No tasks yet. Create one to start collaborating.</p>
            </div>
          {:else}
            {#each tasks as task (task.id)}
              {@const statusInfo = TASK_STATUS_ICONS[task.status] ?? TASK_STATUS_ICONS.pending}
              <div class="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-b-0">
                <statusInfo.icon class="h-4 w-4 shrink-0" style="color: {statusInfo.color}" />
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium text-foreground block truncate">{task.title}</span>
                  {#if task.description}
                    <span class="text-xs text-muted-foreground/60 truncate block">{task.description}</span>
                  {/if}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  {#if task.claimedByAgentName}
                    <Badge variant="outline" class="text-[10px]">{task.claimedByAgentName}</Badge>
                  {:else if task.assignedAgentName}
                    <Badge variant="outline" class="text-[10px]">{task.assignedAgentName}</Badge>
                  {/if}
                  <span
                    class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                    style="background-color: {statusInfo.color}"
                  >{task.status.replace(/_/g, ' ')}</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}

    <!-- Messages Tab -->
    {#if activeTab === 'messages'}
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-foreground">Team Messages</h3>
          <Button size="sm" onclick={() => (showSendMessage = !showSendMessage)}>
            <Send class="h-3.5 w-3.5" />
            Send Message
          </Button>
        </div>

        {#if showSendMessage}
          <Card>
            <CardContent class="pt-4">
              <form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="space-y-3">
                <textarea
                  bind:value={messageBody}
                  placeholder="Type a message to the team..."
                  rows="3"
                  class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none resize-none"
                ></textarea>
                <div class="flex gap-2">
                  <Button size="sm" type="submit" disabled={!messageBody.trim()}>Send</Button>
                  <Button size="sm" variant="outline" type="button" onclick={() => (showSendMessage = false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        {/if}

        <div class="glass-card overflow-hidden">
          {#if teamMessages.length === 0}
            <div class="p-8 text-center">
              <MessageSquare class="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
              <p class="text-xs text-muted-foreground/60">No messages yet.</p>
            </div>
          {:else}
            {#each teamMessages as msg (msg.id ?? msg.message?.id)}
              {@const m = msg.message ?? msg}
              <div class="flex gap-3 px-4 py-3 border-b border-border/30 last:border-b-0">
                <div class="rounded-lg p-1.5 bg-purple-500/10 shrink-0 mt-0.5">
                  <Bot class="h-3.5 w-3.5 text-purple-500" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-sm font-medium text-foreground">{msg.fromAgentName ?? 'Agent'}</span>
                    {#if m.messageType && m.messageType !== 'chat'}
                      <Badge variant="outline" class="text-[9px]">{m.messageType}</Badge>
                    {/if}
                    <span class="text-[10px] text-muted-foreground/50 ml-auto">{formatTime(m.createdAt)}</span>
                  </div>
                  <p class="text-sm text-muted-foreground whitespace-pre-wrap">{m.body}</p>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </PageLayout>
{/if}
