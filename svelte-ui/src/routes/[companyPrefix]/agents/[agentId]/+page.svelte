<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
  import { onMount } from "svelte";
  import { Bot, Settings, Shield, DollarSign, Play, Pause, Zap, Key, FileText, Link2, ChevronRight, Pencil, Trash2, Copy, Eye, EyeOff, Plus, X, Save, RotateCcw } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let agent = $state<Record<string, any> | null>(null);
  let heartbeats = $state<any[]>([]);
  let skills = $state<any[]>([]);
  let issues = $state<any[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("overview");

  // Action state
  let actionLoading = $state<string | null>(null);
  let confirmingDelete = $state(false);

  // Edit form state
  let editMode = $state(false);
  let editForm = $state({ name: "", title: "", role: "", status: "", systemPrompt: "" });
  let editSaving = $state(false);

  // API Keys state
  let apiKeys = $state<any[]>([]);
  let apiKeysLoading = $state(false);
  let newKeyName = $state("");
  let newKeyCreating = $state(false);
  let revealedKey = $state<string | null>(null);
  let revokingKeyId = $state<string | null>(null);
  let confirmRevokeId = $state<string | null>(null);

  const ROLES = ["general", "ceo", "cto", "engineer", "designer", "marketer", "custom"];
  const STATUSES = ["idle", "waiting", "running", "paused", "error"];

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let agentId = $derived($page.params.agentId);
  let companyId = $derived(companyStore.selectedCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  let budgetFormatted = $derived(agent?.budgetMonthlyCents ? `$${(agent.budgetMonthlyCents / 100).toFixed(2)}` : "No budget");
  let spentFormatted = $derived(agent?.spentMonthlyCents ? `$${(agent.spentMonthlyCents / 100).toFixed(2)}` : "$0.00");
  let budgetPct = $derived(
    agent?.budgetMonthlyCents && agent.budgetMonthlyCents > 0
      ? Math.min(100, Math.round((agent.spentMonthlyCents ?? 0) / agent.budgetMonthlyCents * 100))
      : 0
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadAgent() {
    if (!agentId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/agents/${agentId}${companyId ? `?companyId=${companyId}` : ''}`);
      if (res.status === 404) { notFound = true; return; }
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      agent = await res.json();
      breadcrumbStore.set([
        { label: "Agents", href: `/${prefix}/agents` },
        { label: agent!.name },
      ]);
    } catch (err: any) {
      if (err?.message?.includes("not found")) {
        notFound = true;
      } else {
        toastStore.push({ title: "Failed to load agent", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadHeartbeats() {
    if (!agentId || !companyId) return;
    try {
      const res = await api(`/api/agents/${agentId}/heartbeat-runs?limit=20${companyId ? `&companyId=${companyId}` : ''}`);
      if (!res.ok) return;
      heartbeats = await res.json() ?? [];
    } catch { heartbeats = []; }
  }

  async function loadSkills() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/skills`);
      if (!res.ok) return;
      skills = await res.json() ?? [];
    } catch { skills = []; }
  }

  async function loadAgentIssues() {
    if (!agentId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/issues?assigneeAgentId=${agent?.id ?? agentId}`);
      if (!res.ok) return;
      const data = await res.json();
      issues = Array.isArray(data) ? data : data.issues ?? [];
    } catch { issues = []; }
  }

  onMount(() => {
    loadAgent();
    loadHeartbeats();
    loadSkills();
  });

  // Load issues after agent is loaded (need agent.id for UUID-based lookup)
  $effect(() => {
    if (agent?.id && companyId) loadAgentIssues();
  });

  // ---------------------------------------------------------------------------
  // Agent Actions
  // ---------------------------------------------------------------------------
  async function wakeAgent() {
    if (!agentId) return;
    actionLoading = "wake";
    try {
      const res = await api(`/api/agents/${agentId}/wakeup`, {
        method: "POST",
        body: JSON.stringify({ source: "on_demand" }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Agent woken", body: "Wake signal sent successfully.", tone: "success" });
      await loadAgent();
      await loadHeartbeats();
    } catch (err: any) {
      toastStore.push({ title: "Wake failed", body: err?.message, tone: "error" });
    } finally {
      actionLoading = null;
    }
  }

  async function togglePause() {
    if (!agentId || !agent) return;
    const isPaused = agent.status === "paused";
    const endpoint = isPaused ? "resume" : "pause";
    actionLoading = "pause";
    try {
      const res = await api(`/api/agents/${agentId}/${endpoint}`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({
        title: isPaused ? "Agent resumed" : "Agent paused",
        body: isPaused ? "The agent is now active." : "The agent has been paused.",
        tone: "success",
      });
      await loadAgent();
    } catch (err: any) {
      toastStore.push({ title: `${isPaused ? "Resume" : "Pause"} failed`, body: err?.message, tone: "error" });
    } finally {
      actionLoading = null;
    }
  }

  async function deleteAgent() {
    if (!agentId) return;
    actionLoading = "delete";
    try {
      const res = await api(`/api/agents/${agentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Agent deleted", body: "The agent has been permanently removed.", tone: "success" });
      goto(`/${prefix}/agents`);
    } catch (err: any) {
      toastStore.push({ title: "Delete failed", body: err?.message, tone: "error" });
    } finally {
      actionLoading = null;
      confirmingDelete = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Edit Form
  // ---------------------------------------------------------------------------
  function openEditForm() {
    if (!agent) return;
    editForm = {
      name: agent.name ?? "",
      title: agent.title ?? "",
      role: agent.role ?? "general",
      status: agent.status ?? "idle",
      systemPrompt: agent.systemPrompt ?? agent.adapterConfig?.systemPrompt ?? "",
    };
    editMode = true;
  }

  function cancelEdit() {
    editMode = false;
  }

  async function saveEdit() {
    if (!agentId || !agent) return;
    editSaving = true;
    try {
      const payload: Record<string, any> = {};
      if (editForm.name !== (agent.name ?? "")) payload.name = editForm.name;
      if (editForm.title !== (agent.title ?? "")) payload.title = editForm.title;
      if (editForm.role !== (agent.role ?? "general")) payload.role = editForm.role;
      if (editForm.status !== (agent.status ?? "idle")) payload.status = editForm.status;
      if (editForm.systemPrompt !== (agent.systemPrompt ?? agent.adapterConfig?.systemPrompt ?? "")) {
        payload.systemPrompt = editForm.systemPrompt;
      }

      if (Object.keys(payload).length === 0) {
        toastStore.push({ title: "No changes", body: "Nothing was modified.", tone: "info" });
        editMode = false;
        return;
      }

      const res = await api(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Agent updated", body: "Changes saved successfully.", tone: "success" });
      editMode = false;
      await loadAgent();
    } catch (err: any) {
      toastStore.push({ title: "Save failed", body: err?.message, tone: "error" });
    } finally {
      editSaving = false;
    }
  }

  // ---------------------------------------------------------------------------
  // API Keys
  // ---------------------------------------------------------------------------
  async function loadApiKeys() {
    if (!agentId) return;
    apiKeysLoading = true;
    try {
      const res = await api(`/api/agents/${agentId}/keys`);
      if (!res.ok) return;
      apiKeys = await res.json() ?? [];
    } catch {
      apiKeys = [];
    } finally {
      apiKeysLoading = false;
    }
  }

  async function createApiKey() {
    if (!agentId || !newKeyName.trim()) return;
    newKeyCreating = true;
    try {
      const res = await api(`/api/agents/${agentId}/keys`, {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      revealedKey = data.key ?? data.apiKey ?? data.token ?? null;
      newKeyName = "";
      toastStore.push({ title: "API key created", body: "Copy the key now — it won't be shown again.", tone: "success" });
      await loadApiKeys();
    } catch (err: any) {
      toastStore.push({ title: "Failed to create key", body: err?.message, tone: "error" });
    } finally {
      newKeyCreating = false;
    }
  }

  async function revokeApiKey(keyId: string) {
    if (!agentId) return;
    revokingKeyId = keyId;
    try {
      const res = await api(`/api/agents/${agentId}/keys/${keyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Key revoked", body: "The API key has been permanently revoked.", tone: "success" });
      confirmRevokeId = null;
      await loadApiKeys();
    } catch (err: any) {
      toastStore.push({ title: "Revoke failed", body: err?.message, tone: "error" });
    } finally {
      revokingKeyId = null;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toastStore.push({ title: "Copied", body: "Key copied to clipboard.", tone: "success" });
    });
  }

  // Load API keys when switching to the keys tab
  $effect(() => {
    if (activeTab === "keys" && agentId) loadApiKeys();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const ADAPTER_LABELS: Record<string, string> = {
    claude_local: "Claude (Local)", codex_local: "Codex (Local)", cursor: "Cursor",
    opencode_local: "OpenCode (Local)", pi_local: "Pi (Local)", hermes_local: "Hermes (Local)",
    openclaw_gateway: "OpenClaw Gateway", process: "Process", http: "HTTP",
  };
  function adapterLabel(type: string): string { return ADAPTER_LABELS[type] ?? type; }
  function formatCents(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }
</script>

{#if loading}
  <div class="p-6"><PageSkeleton lines={8} /></div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Agent not found" description="The agent doesn't exist or you don't have access." icon="🤖">
      <a href="/{prefix}/agents" class="text-sm text-[#2563EB] hover:underline">Back to agents</a>
    </EmptyState>
  </div>
{:else if agent}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#60a5fa] shrink-0">
            <Bot size={20} />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl font-semibold truncate">{agent.name}</h1>
              <StatusBadge status={agent.status} />
              {#if agent.role}<Badge variant="outline" class="capitalize">{agent.role}</Badge>{/if}
            </div>
            {#if agent.title}
              <p class="text-sm text-[#94A3B8]">{agent.title}</p>
            {/if}
          </div>
        </div>
        {#if agent.pauseReason}
          <div class="mt-2 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <Pause size={14} />
            Paused: {agent.pauseReason}
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" href="/{prefix}/agents">Back</Button>
        <Button variant="outline" size="sm" onclick={openEditForm} disabled={editMode}>
          <Pencil size={14} class="mr-1" /> Edit
        </Button>
        <Button variant="outline" size="sm" onclick={wakeAgent} disabled={actionLoading === "wake"}>
          <Zap size={14} class="mr-1" /> {actionLoading === "wake" ? "Waking..." : "Wake"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onclick={togglePause}
          disabled={actionLoading === "pause"}
        >
          {#if agent.status === "paused"}
            <Play size={14} class="mr-1" /> {actionLoading === "pause" ? "Resuming..." : "Resume"}
          {:else}
            <Pause size={14} class="mr-1" /> {actionLoading === "pause" ? "Pausing..." : "Pause"}
          {/if}
        </Button>
        {#if confirmingDelete}
          <div class="flex items-center gap-1 border border-red-500/30 rounded-lg px-2 py-1 bg-red-500/10">
            <span class="text-xs text-red-400">Confirm?</span>
            <Button variant="destructive" size="sm" onclick={deleteAgent} disabled={actionLoading === "delete"}>
              {actionLoading === "delete" ? "Deleting..." : "Yes, delete"}
            </Button>
            <Button variant="outline" size="sm" onclick={() => confirmingDelete = false}>Cancel</Button>
          </div>
        {:else}
          <Button variant="destructive" size="sm" onclick={() => confirmingDelete = true}>
            <Trash2 size={14} class="mr-1" /> Delete
          </Button>
        {/if}
      </div>
    </div>

    <!-- Edit Form -->
    {#if editMode}
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle>Edit Agent</CardTitle>
            <Button variant="ghost" size="sm" onclick={cancelEdit}><X size={16} /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label for="edit-name" class="block text-xs text-[#94A3B8] mb-1">Name</label>
              <input
                id="edit-name"
                type="text"
                bind:value={editForm.name}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label for="edit-title" class="block text-xs text-[#94A3B8] mb-1">Title</label>
              <input
                id="edit-title"
                type="text"
                bind:value={editForm.title}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label for="edit-role" class="block text-xs text-[#94A3B8] mb-1">Role</label>
              <select
                id="edit-role"
                bind:value={editForm.role}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB] capitalize"
              >
                {#each ROLES as role}
                  <option value={role} class="capitalize bg-[#0f172a]">{role}</option>
                {/each}
              </select>
            </div>
            <div>
              <label for="edit-status" class="block text-xs text-[#94A3B8] mb-1">Status</label>
              <select
                id="edit-status"
                bind:value={editForm.status}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB] capitalize"
              >
                {#each STATUSES as status}
                  <option value={status} class="capitalize bg-[#0f172a]">{status}</option>
                {/each}
              </select>
            </div>
            <div class="sm:col-span-2">
              <label for="edit-prompt" class="block text-xs text-[#94A3B8] mb-1">System Prompt</label>
              <textarea
                id="edit-prompt"
                bind:value={editForm.systemPrompt}
                rows={4}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB] resize-y"
                placeholder="Optional system prompt for the agent..."
              ></textarea>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onclick={cancelEdit}>Cancel</Button>
            <Button size="sm" onclick={saveEdit} disabled={editSaving}>
              <Save size={14} class="mr-1" /> {editSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Main content + sidebar -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main content area -->
      <div class="flex-1 min-w-0">
        <Tabs bind:value={activeTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
            <TabsTrigger value="runs">Runs ({heartbeats.length})</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <!-- OVERVIEW TAB -->
          <TabsContent value="overview">
            <div class="space-y-4 mt-4">
              <!-- Budget Card -->
              {#if agent.budgetMonthlyCents > 0}
                <Card>
                  <CardHeader><CardTitle>Budget & Spend</CardTitle></CardHeader>
                  <CardContent>
                    <div class="flex items-end gap-6 mb-3">
                      <div>
                        <p class="text-xs text-[#94A3B8]">Monthly Spend</p>
                        <p class="text-2xl font-semibold">{spentFormatted}</p>
                      </div>
                      <div>
                        <p class="text-xs text-[#94A3B8]">Budget</p>
                        <p class="text-lg text-[#94A3B8]">{budgetFormatted}</p>
                      </div>
                      <div class="ml-auto">
                        <Badge variant={budgetPct > 80 ? "destructive" : "outline"}>{budgetPct}%</Badge>
                      </div>
                    </div>
                    <div class="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all"
                        style="width: {budgetPct}%; background: {budgetPct > 80 ? '#ef4444' : budgetPct > 50 ? '#f59e0b' : '#10b981'};"
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Chain of Command -->
              {#if agent.chainOfCommand && agent.chainOfCommand.length > 0}
                <Card>
                  <CardHeader><CardTitle>Chain of Command</CardTitle></CardHeader>
                  <CardContent>
                    <div class="flex items-center gap-2 flex-wrap">
                      {#each agent.chainOfCommand as manager, i}
                        <a href="/{prefix}/agents/{manager.id}" class="text-sm text-[#2563EB] hover:underline">{manager.name}</a>
                        {#if i < agent.chainOfCommand.length - 1}<ChevronRight size={14} class="text-[#475569]" />{/if}
                      {/each}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Access & Permissions Summary -->
              {#if agent.access}
                <Card>
                  <CardHeader><CardTitle>Access</CardTitle></CardHeader>
                  <CardContent>
                    <div class="text-sm space-y-3">
                      <div class="flex items-center justify-between">
                        <span class="text-[#94A3B8]">Can assign tasks</span>
                        <Badge variant={agent.access.canAssignTasks ? "default" : "secondary"}>{agent.access.canAssignTasks ? "Yes" : "No"}</Badge>
                      </div>
                      {#if agent.access.taskAssignSource !== "none"}
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Source</span>
                          <span class="capitalize">{agent.access.taskAssignSource?.replace(/_/g, " ")}</span>
                        </div>
                      {/if}
                      {#if agent.access.membership}
                        <Separator />
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Membership Role</span>
                          <span class="capitalize">{agent.access.membership.membershipRole}</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Membership Status</span>
                          <StatusBadge status={agent.access.membership.status} />
                        </div>
                      {/if}
                    </div>
                  </CardContent>
                </Card>
              {/if}
            </div>
          </TabsContent>

          <!-- ISSUES TAB -->
          <TabsContent value="issues">
            <div class="mt-4">
              {#if issues.length === 0}
                <EmptyState title="No assigned issues" description="This agent has no issues assigned yet." icon="📋" />
              {:else}
                <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                  {#each issues as issue}
                    <a href="/{prefix}/issues/{issue.id}" class="flex items-center justify-between p-3 text-sm hover:bg-white/[0.03] transition">
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={issue.status} />
                        <span class="font-mono text-xs text-[#94A3B8]">{issue.identifier}</span>
                        <span class="truncate">{issue.title}</span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        {#if issue.priority}<Badge variant="outline" class="text-xs capitalize">{issue.priority}</Badge>{/if}
                        <TimeAgo date={issue.updatedAt} class="text-xs" />
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <!-- RUNS TAB -->
          <TabsContent value="runs">
            <div class="mt-4">
              {#if heartbeats.length === 0}
                <EmptyState title="No recent runs" description="This agent hasn't had any heartbeat runs yet." icon="🏃" />
              {:else}
                <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                  {#each heartbeats as run}
                    <div class="flex items-center justify-between p-3 text-sm hover:bg-white/[0.03]">
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={run.status} />
                        <span class="font-mono text-xs text-[#94A3B8]">{run.id.slice(0, 8)}</span>
                        {#if run.source}<Badge variant="outline" class="text-xs">{run.source}</Badge>{/if}
                        {#if run.reason}<span class="text-[#94A3B8] truncate">{run.reason}</span>{/if}
                      </div>
                      <div class="flex items-center gap-3 shrink-0">
                        {#if run.durationMs}<span class="text-xs text-[#94A3B8]">{(run.durationMs / 1000).toFixed(1)}s</span>{/if}
                        <TimeAgo date={run.startedAt} class="text-xs" />
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <!-- CONFIGURATION TAB -->
          <TabsContent value="config">
            <div class="space-y-4 mt-4">
              <Card>
                <CardHeader><CardTitle>Adapter Configuration</CardTitle></CardHeader>
                <CardContent>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p class="text-[#94A3B8] text-xs mb-1">Adapter Type</p>
                      <p class="font-medium">{adapterLabel(agent.adapterType)}</p>
                    </div>
                    {#if agent.model || agent.adapterConfig?.model}
                      <div>
                        <p class="text-[#94A3B8] text-xs mb-1">Model</p>
                        <p class="font-mono text-xs">{agent.model ?? agent.adapterConfig?.model}</p>
                      </div>
                    {/if}
                    {#if agent.adapterConfig?.instructionsBundleMode}
                      <div>
                        <p class="text-[#94A3B8] text-xs mb-1">Instructions Mode</p>
                        <p class="font-medium capitalize">{agent.adapterConfig.instructionsBundleMode}</p>
                      </div>
                    {/if}
                    {#if agent.adapterConfig?.instructionsEntryFile}
                      <div>
                        <p class="text-[#94A3B8] text-xs mb-1">Entry File</p>
                        <p class="font-mono text-xs">{agent.adapterConfig.instructionsEntryFile}</p>
                      </div>
                    {/if}
                  </div>
                  {#if agent.adapterConfig?.instructionsFilePath}
                    <Separator class="my-4" />
                    <div>
                      <p class="text-[#94A3B8] text-xs mb-1">Instructions Path</p>
                      <p class="font-mono text-xs text-[#94A3B8] break-all">{agent.adapterConfig.instructionsFilePath}</p>
                    </div>
                  {/if}
                </CardContent>
              </Card>

              {#if agent.runtimeConfig && Object.keys(agent.runtimeConfig).length > 0}
                <Card>
                  <CardHeader><CardTitle>Runtime Configuration</CardTitle></CardHeader>
                  <CardContent>
                    <pre class="text-xs font-mono text-[#94A3B8] bg-white/[0.03] rounded-lg p-3 overflow-auto">{JSON.stringify(agent.runtimeConfig, null, 2)}</pre>
                  </CardContent>
                </Card>
              {/if}

              {#if agent.capabilities}
                <Card>
                  <CardHeader><CardTitle>Capabilities</CardTitle></CardHeader>
                  <CardContent>
                    <pre class="text-xs font-mono text-[#94A3B8] bg-white/[0.03] rounded-lg p-3 overflow-auto">{JSON.stringify(agent.capabilities, null, 2)}</pre>
                  </CardContent>
                </Card>
              {/if}

              {#if agent.metadata && Object.keys(agent.metadata).length > 0}
                <Card>
                  <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
                  <CardContent>
                    <pre class="text-xs font-mono text-[#94A3B8] bg-white/[0.03] rounded-lg p-3 overflow-auto">{JSON.stringify(agent.metadata, null, 2)}</pre>
                  </CardContent>
                </Card>
              {/if}
            </div>
          </TabsContent>

          <!-- API KEYS TAB -->
          <TabsContent value="keys">
            <div class="space-y-4 mt-4">
              <!-- Create new key -->
              <Card>
                <CardHeader><CardTitle>Create API Key</CardTitle></CardHeader>
                <CardContent>
                  <div class="flex items-end gap-3">
                    <div class="flex-1">
                      <label for="new-key-name" class="block text-xs text-[#94A3B8] mb-1">Key Name</label>
                      <input
                        id="new-key-name"
                        type="text"
                        bind:value={newKeyName}
                        placeholder="e.g. production-key, ci-runner..."
                        class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        onkeydown={(e: KeyboardEvent) => { if (e.key === "Enter") createApiKey(); }}
                      />
                    </div>
                    <Button size="sm" onclick={createApiKey} disabled={newKeyCreating || !newKeyName.trim()}>
                      <Plus size={14} class="mr-1" /> {newKeyCreating ? "Creating..." : "Create Key"}
                    </Button>
                  </div>

                  <!-- Revealed key (shown once after creation) -->
                  {#if revealedKey}
                    <div class="mt-4 border border-emerald-500/30 bg-emerald-500/10 rounded-lg p-4">
                      <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-semibold text-emerald-400">New API Key — copy it now, it will not be shown again</span>
                        <Button variant="ghost" size="sm" onclick={() => revealedKey = null}><X size={14} /></Button>
                      </div>
                      <div class="flex items-center gap-2">
                        <code class="flex-1 text-xs font-mono bg-black/30 rounded px-3 py-2 break-all select-all">{revealedKey}</code>
                        <Button variant="outline" size="sm" onclick={() => copyToClipboard(revealedKey!)}>
                          <Copy size={14} />
                        </Button>
                      </div>
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Existing keys list -->
              <Card>
                <CardHeader><CardTitle>Active Keys</CardTitle></CardHeader>
                <CardContent>
                  {#if apiKeysLoading}
                    <PageSkeleton lines={3} />
                  {:else if apiKeys.length === 0}
                    <EmptyState title="No API keys" description="Create a key to allow programmatic access to this agent." icon="🔑" />
                  {:else}
                    <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                      {#each apiKeys as key}
                        <div class="flex items-center justify-between p-3 text-sm">
                          <div class="flex items-center gap-3 min-w-0">
                            <Key size={14} class="text-[#94A3B8] shrink-0" />
                            <div class="min-w-0">
                              <p class="font-medium truncate">{key.name ?? "Unnamed key"}</p>
                              <div class="flex items-center gap-2 mt-0.5">
                                <span class="font-mono text-xs text-[#94A3B8]">...{(key.id ?? key.keyId ?? "").slice(-8)}</span>
                                {#if key.createdAt}
                                  <span class="text-xs text-[#475569]">created <TimeAgo date={key.createdAt} /></span>
                                {/if}
                              </div>
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            {#if confirmRevokeId === (key.id ?? key.keyId)}
                              <span class="text-xs text-red-400">Revoke?</span>
                              <Button
                                variant="destructive"
                                size="sm"
                                onclick={() => revokeApiKey(key.id ?? key.keyId)}
                                disabled={revokingKeyId === (key.id ?? key.keyId)}
                              >
                                {revokingKeyId === (key.id ?? key.keyId) ? "Revoking..." : "Yes"}
                              </Button>
                              <Button variant="outline" size="sm" onclick={() => confirmRevokeId = null}>No</Button>
                            {:else}
                              <Button variant="destructive" size="sm" onclick={() => confirmRevokeId = key.id ?? key.keyId}>
                                Revoke
                              </Button>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <!-- PERMISSIONS TAB -->
          <TabsContent value="permissions">
            <div class="space-y-4 mt-4">
              {#if agent.permissions}
                <Card>
                  <CardHeader><CardTitle>Agent Permissions</CardTitle></CardHeader>
                  <CardContent>
                    <div class="space-y-2">
                      {#each Object.entries(agent.permissions) as [key, value]}
                        <div class="flex items-center justify-between text-sm">
                          <span class="text-[#94A3B8]">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>
                        </div>
                      {/each}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              {#if agent.access?.grants && agent.access.grants.length > 0}
                <Card>
                  <CardHeader><CardTitle>Permission Grants</CardTitle></CardHeader>
                  <CardContent>
                    <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                      {#each agent.access.grants as grant}
                        <div class="flex items-center justify-between p-3 text-sm">
                          <div class="flex items-center gap-2">
                            <Key size={14} class="text-[#94A3B8]" />
                            <span class="font-mono text-xs">{grant.permissionKey}</span>
                            {#if grant.scope}<Badge variant="outline" class="text-xs">{grant.scope}</Badge>{/if}
                          </div>
                          <TimeAgo date={grant.createdAt} class="text-xs" />
                        </div>
                      {/each}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Skills -->
              <Card>
                <CardHeader><CardTitle>Company Skills</CardTitle></CardHeader>
                <CardContent>
                  {#if skills.length === 0}
                    <p class="text-sm text-[#94A3B8]">No skills configured</p>
                  {:else}
                    <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                      {#each skills as skill}
                        <div class="flex items-center justify-between p-3 text-sm">
                          <div class="min-w-0">
                            <p class="font-medium truncate">{skill.name ?? skill.key}</p>
                            {#if skill.description}<p class="text-xs text-[#94A3B8] truncate mt-0.5">{skill.description}</p>{/if}
                          </div>
                          <Badge variant="outline" class="text-xs shrink-0">{skill.key}</Badge>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status"><StatusBadge status={agent.status} /></PropertyRow>
        <Separator />
        <PropertyRow label="Role"><span class="capitalize">{agent.role}</span></PropertyRow>
        {#if agent.title}
          <Separator />
          <PropertyRow label="Title">{agent.title}</PropertyRow>
        {/if}
        <Separator />
        <PropertyRow label="Adapter">{adapterLabel(agent.adapterType)}</PropertyRow>
        {#if agent.model || agent.adapterConfig?.model}
          <Separator />
          <PropertyRow label="Model"><span class="font-mono text-xs">{agent.model ?? agent.adapterConfig?.model ?? "—"}</span></PropertyRow>
        {/if}
        <Separator />
        <PropertyRow label="Budget">{budgetFormatted}</PropertyRow>
        <Separator />
        <PropertyRow label="Spent">{spentFormatted}</PropertyRow>
        <Separator />
        <PropertyRow label="Issues"><span class="font-medium">{issues.length}</span></PropertyRow>
        <Separator />
        <PropertyRow label="Last heartbeat"><TimeAgo date={agent.lastHeartbeatAt} class="text-xs" /></PropertyRow>
        <Separator />
        <PropertyRow label="Created"><TimeAgo date={agent.createdAt} class="text-xs" /></PropertyRow>
        <Separator />
        <PropertyRow label="Updated"><TimeAgo date={agent.updatedAt} class="text-xs" /></PropertyRow>
        {#if agent.sessionId || agent.runtimeState?.sessionId}
          <Separator />
          <PropertyRow label="Session">
            <span class="font-mono text-xs break-all">{agent.sessionId ?? agent.runtimeState?.sessionId}</span>
          </PropertyRow>
        {/if}
        {#if agent.runtimeState?.pid}
          <Separator />
          <PropertyRow label="PID"><span class="font-mono text-xs">{agent.runtimeState.pid}</span></PropertyRow>
        {/if}
        {#if agent.runtimeState?.startedAt}
          <Separator />
          <PropertyRow label="Session started"><TimeAgo date={agent.runtimeState.startedAt} class="text-xs" /></PropertyRow>
        {/if}
        {#if agent.metadata && Object.keys(agent.metadata).length > 0}
          <Separator />
          <PropertyRow label="Metadata" />
          {#each Object.entries(agent.metadata) as [key, value]}
            <PropertyRow label={key}>
              <span class="font-mono text-xs break-all truncate max-w-[160px]" title={String(value)}>
                {typeof value === "object" ? JSON.stringify(value) : String(value)}
              </span>
            </PropertyRow>
          {/each}
        {/if}
        {#if agent.urlKey}
          <Separator />
          <PropertyRow label="URL Key"><span class="font-mono text-xs">{agent.urlKey}</span></PropertyRow>
        {/if}
        <Separator />
        <PropertyRow label="ID"><span class="font-mono text-xs break-all">{agent.id}</span></PropertyRow>
      </PropertiesPanel>
    </div>
  </div>
{/if}
