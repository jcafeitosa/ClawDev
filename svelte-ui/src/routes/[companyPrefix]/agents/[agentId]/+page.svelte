<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "$components/ui/index.js";
  import { onMount } from "svelte";
  import { Bot, Settings, Shield, DollarSign, Play, Pause, Zap, Key, FileText, Link2, ChevronRight, ChevronDown, Pencil, Trash2, Copy, Eye, EyeOff, Plus, X, Save, RotateCcw, Wallet, Check, FolderOpen, Loader2, ExternalLink, BookOpen, MoreHorizontal, AlertCircle, Activity, ClipboardList, StopCircle } from "lucide-svelte";
  import { openNewIssueDialog } from '$lib/components/new-issue-dialog.svelte';
  import AgentIconPicker from '$lib/components/agent-icon-picker.svelte';
  import ReportsToPicker from '$lib/components/reports-to-picker.svelte';
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import InlineEditor from '$lib/components/inline-editor.svelte';

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
  let editForm = $state({ name: "", title: "", role: "", status: "", systemPrompt: "", icon: "Bot", reportsTo: null as string | null });
  let editSaving = $state(false);

  // API Keys state
  let apiKeys = $state<any[]>([]);
  let apiKeysLoading = $state(false);
  let newKeyName = $state("");
  let newKeyCreating = $state(false);
  let revealedKey = $state<string | null>(null);
  let revokingKeyId = $state<string | null>(null);
  let confirmRevokeId = $state<string | null>(null);

  // Budget edit state
  let editingBudget = $state(false);
  let budgetInputDollars = $state('');
  let budgetSaving = $state(false);

  // Instructions tab state
  type InstructionsBundle = {
    mode: "managed" | "external";
    rootPath: string;
    managedRootPath?: string;
    entryFile: string;
    files: { path: string; size: number; isEntryFile?: boolean; deprecated?: boolean }[];
    warnings: string[];
    legacyPromptTemplateActive?: boolean;
    legacyBootstrapPromptTemplateActive?: boolean;
  };
  type InstructionsFileDetail = { path: string; content: string; language?: string };

  let instructionsBundle = $state<InstructionsBundle | null>(null);
  let instructionsBundleLoading = $state(false);
  let selectedFile = $state("AGENTS.md");
  let selectedFileContent = $state("");
  let selectedFileLoading = $state(false);
  let instructionsDraft = $state<string | null>(null);
  let instructionsSaving = $state(false);
  let advancedOpen = $state(false);
  let bundleDraftMode = $state<"managed" | "external" | null>(null);
  let bundleDraftRootPath = $state<string | null>(null);
  let bundleDraftEntryFile = $state<string | null>(null);
  let newFilePath = $state("");
  let showNewFileInput = $state(false);
  let instructionsViewMode = $state<'view' | 'code'>('view');

  // Skills tab state
  type SkillSnapshot = {
    mode: "persistent" | "ephemeral" | "unsupported";
    entries: { key: string; required?: boolean; requiredReason?: string; detail?: string; locationLabel?: string; originLabel?: string; runtimeName?: string }[];
    desiredSkills: string[];
    warnings: string[];
  };
  type CompanySkill = { id: string; key: string; name: string; description?: string };

  let skillSnapshot = $state<SkillSnapshot | null>(null);
  let skillSnapshotLoading = $state(false);
  let companySkills = $state<CompanySkill[]>([]);
  let skillDraft = $state<string[]>([]);
  let skillLastSaved = $state<string[]>([]);
  let skillSyncing = $state(false);
  let skillSyncTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  // Budget tab state
  let budgetTabDollars = $state('');
  let budgetTabSaving = $state(false);

  // Overview dashboard state
  let costsSummary = $state<{ inputTokens?: number; outputTokens?: number; cachedTokens?: number; totalCostCents?: number } | null>(null);
  let costsSummaryLoading = $state(false);
  let moreMenuOpen = $state(false);

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
  let budgetBarColor = $derived(
    budgetPct > 85 ? '#ef4444' : budgetPct > 60 ? '#f59e0b' : '#10b981'
  );

  // Instructions derived
  let isLocalAdapter = $derived(
    agent?.adapterType === "claude_local" ||
    agent?.adapterType === "codex_local" ||
    agent?.adapterType === "opencode_local" ||
    agent?.adapterType === "pi_local" ||
    agent?.adapterType === "hermes_local" ||
    agent?.adapterType === "cursor"
  );
  let currentMode = $derived(bundleDraftMode ?? instructionsBundle?.mode ?? "managed");
  let currentEntryFile = $derived(bundleDraftEntryFile ?? instructionsBundle?.entryFile ?? "AGENTS.md");
  let currentRootPath = $derived(bundleDraftRootPath ?? (instructionsBundle?.mode === "managed" ? (instructionsBundle?.managedRootPath ?? instructionsBundle?.rootPath ?? "") : (instructionsBundle?.rootPath ?? "")));
  let fileOptions = $derived(instructionsBundle?.files.map(f => f.path) ?? []);
  let selectedFileExists = $derived(fileOptions.includes(selectedFile));
  let selectedFileMeta = $derived(instructionsBundle?.files.find(f => f.path === selectedFile) ?? null);
  let displayContent = $derived(instructionsDraft ?? selectedFileContent);
  let instructionsBundleDirty = $derived(
    bundleDraftMode !== null || bundleDraftRootPath !== null || bundleDraftEntryFile !== null
  );
  let instructionsFileDirty = $derived(instructionsDraft !== null && instructionsDraft !== selectedFileContent);
  let instructionsAnyDirty = $derived(instructionsBundleDirty || instructionsFileDirty);

  // Skills derived
  let companySkillByKey = $derived(new Map(companySkills.map(s => [s.key, s])));
  let companySkillKeys = $derived(new Set(companySkills.map(s => s.key)));
  let adapterEntryByKey = $derived(new Map((skillSnapshot?.entries ?? []).map(e => [e.key, e])));
  let optionalSkillRows = $derived(
    companySkills
      .filter(s => !adapterEntryByKey.get(s.key)?.required)
      .map(s => ({
        id: s.id, key: s.key, name: s.name, description: s.description ?? null,
        detail: adapterEntryByKey.get(s.key)?.detail ?? null,
        locationLabel: adapterEntryByKey.get(s.key)?.locationLabel ?? null,
        originLabel: adapterEntryByKey.get(s.key)?.originLabel ?? null,
        readOnly: false, required: false,
        adapterEntry: adapterEntryByKey.get(s.key) ?? null,
      }))
  );
  let requiredSkillRows = $derived(
    (skillSnapshot?.entries ?? [])
      .filter(e => e.required)
      .map(e => {
        const cs = companySkillByKey.get(e.key);
        return {
          id: cs?.id ?? `required:${e.key}`, key: e.key, name: cs?.name ?? e.key,
          description: cs?.description ?? null, detail: e.detail ?? null,
          locationLabel: e.locationLabel ?? null, originLabel: e.originLabel ?? null,
          readOnly: false, required: true, adapterEntry: e,
        };
      })
  );
  let unmanagedSkillRows = $derived(
    (skillSnapshot?.entries ?? [])
      .filter(e => {
        if (e.required) return false;
        if (companySkillKeys.has(e.key)) return false;
        return true;
      })
      .map(e => ({
        id: `external:${e.key}`, key: e.key, name: e.runtimeName ?? e.key,
        description: null, detail: e.detail ?? null,
        locationLabel: e.locationLabel ?? null, originLabel: e.originLabel ?? null,
        readOnly: true, required: false, adapterEntry: e,
      }))
  );
  let skillApplicationLabel = $derived(
    skillSnapshot?.mode === "persistent" ? "Kept in the workspace" :
    skillSnapshot?.mode === "ephemeral" ? "Applied when the agent runs" :
    skillSnapshot?.mode === "unsupported" ? "Tracked only" : "Unknown"
  );
  let unsupportedSkillMessage = $derived(
    skillSnapshot?.mode !== "unsupported" ? null :
    agent?.adapterType === "openclaw_gateway"
      ? "ClawDev cannot manage OpenClaw skills here. Visit your OpenClaw instance to manage this agent's skills."
      : "ClawDev cannot manage skills for this adapter yet. Manage them in the adapter directly."
  );
  let skillsHaveUnsaved = $derived(
    JSON.stringify(skillDraft.slice().sort()) !== JSON.stringify(skillLastSaved.slice().sort())
  );

  // Overview derived
  let latestRun = $derived(heartbeats.length > 0 ? heartbeats[0] : null);
  let recentIssues = $derived(issues.slice(0, 5));
  let runSuccessCount = $derived(heartbeats.filter(r => r.status === 'completed' || r.status === 'success').length);
  let runFailCount = $derived(heartbeats.filter(r => r.status === 'error' || r.status === 'failed').length);
  let runSuccessRate = $derived(heartbeats.length > 0 ? Math.round((runSuccessCount / heartbeats.length) * 100) : 0);
  let issuesByStatus = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      const s = issue.status ?? 'unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  });
  let issuesByPriority = $derived.by(() => {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      const p = issue.priority ?? 'none';
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  });
  let hasError = $derived(agent?.status === 'error');

  // Budget tab derived
  let budgetTabPct = $derived(
    agent?.budgetMonthlyCents && agent.budgetMonthlyCents > 0
      ? Math.min(100, Math.round(((agent.spentMonthlyCents ?? 0) / agent.budgetMonthlyCents) * 100))
      : 0
  );
  let budgetTabBarColor = $derived(budgetTabPct > 85 ? '#ef4444' : budgetTabPct > 60 ? '#f59e0b' : '#10b981');
  let budgetTabStatus = $derived(
    !agent?.budgetMonthlyCents || agent.budgetMonthlyCents <= 0 ? 'no_budget' :
    (agent.spentMonthlyCents ?? 0) >= agent.budgetMonthlyCents ? 'over_budget' :
    budgetTabPct > 80 ? 'warning' : 'ok'
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

  // Instructions data fetching
  async function loadInstructionsBundle() {
    if (!agentId || !companyId || !isLocalAdapter) return;
    instructionsBundleLoading = true;
    try {
      const res = await api(`/api/agents/${agentId}/instructions-bundle?companyId=${companyId}`);
      if (!res.ok) { instructionsBundle = null; return; }
      instructionsBundle = await res.json();
      bundleDraftMode = null;
      bundleDraftRootPath = null;
      bundleDraftEntryFile = null;
    } catch { instructionsBundle = null; }
    finally { instructionsBundleLoading = false; }
  }

  async function loadInstructionsFile(path: string) {
    if (!agentId || !companyId || !isLocalAdapter) return;
    selectedFileLoading = true;
    try {
      const res = await api(`/api/agents/${agentId}/instructions-bundle/file?path=${encodeURIComponent(path)}&companyId=${companyId}`);
      if (!res.ok) { selectedFileContent = ""; return; }
      const detail: InstructionsFileDetail = await res.json();
      selectedFileContent = detail.content ?? "";
      instructionsDraft = null;
    } catch { selectedFileContent = ""; }
    finally { selectedFileLoading = false; }
  }

  async function saveInstructionsFile() {
    if (!agentId || !companyId) return;
    instructionsSaving = true;
    try {
      // Save bundle settings if changed
      if (instructionsBundleDirty) {
        const bundlePayload: Record<string, any> = {};
        if (bundleDraftMode !== null) bundlePayload.mode = bundleDraftMode;
        if (bundleDraftRootPath !== null) bundlePayload.rootPath = bundleDraftMode === "external" ? bundleDraftRootPath : null;
        if (bundleDraftEntryFile !== null) bundlePayload.entryFile = bundleDraftEntryFile;
        await api(`/api/agents/${agentId}/instructions-bundle?companyId=${companyId}`, {
          method: "PATCH",
          body: JSON.stringify(bundlePayload),
        });
      }
      // Save file content if changed
      if (instructionsFileDirty) {
        const shouldClearLegacy = Boolean(instructionsBundle?.legacyPromptTemplateActive || instructionsBundle?.legacyBootstrapPromptTemplateActive);
        await api(`/api/agents/${agentId}/instructions-bundle/file?companyId=${companyId}`, {
          method: "PUT",
          body: JSON.stringify({ path: selectedFile, content: displayContent, clearLegacyPromptTemplate: shouldClearLegacy }),
        });
      }
      toastStore.push({ title: "Instructions saved", body: "Changes saved successfully.", tone: "success" });
      await loadInstructionsBundle();
      await loadInstructionsFile(selectedFile);
    } catch (err: any) {
      toastStore.push({ title: "Save failed", body: err?.message, tone: "error" });
    } finally {
      instructionsSaving = false;
    }
  }

  async function deleteInstructionsFileAction(path: string) {
    if (!agentId || !companyId) return;
    instructionsSaving = true;
    try {
      await api(`/api/agents/${agentId}/instructions-bundle/file?path=${encodeURIComponent(path)}&companyId=${companyId}`, { method: "DELETE" });
      toastStore.push({ title: "File deleted", body: `${path} has been removed.`, tone: "success" });
      selectedFile = currentEntryFile;
      instructionsDraft = null;
      await loadInstructionsBundle();
      await loadInstructionsFile(currentEntryFile);
    } catch (err: any) {
      toastStore.push({ title: "Delete failed", body: err?.message, tone: "error" });
    } finally {
      instructionsSaving = false;
    }
  }

  function cancelInstructionsEdit() {
    instructionsDraft = null;
    bundleDraftMode = null;
    bundleDraftRootPath = null;
    bundleDraftEntryFile = null;
  }

  function addNewInstructionsFile() {
    if (!newFilePath.trim()) return;
    const path = newFilePath.trim().endsWith('.md') ? newFilePath.trim() : newFilePath.trim() + '.md';
    selectedFile = path;
    selectedFileContent = "";
    instructionsDraft = "";
    newFilePath = "";
    showNewFileInput = false;
  }

  // Skills data fetching
  async function loadSkillSnapshot() {
    if (!agentId || !companyId) return;
    skillSnapshotLoading = true;
    try {
      const res = await api(`/api/agents/${agentId}/skills?companyId=${companyId}`);
      if (!res.ok) { skillSnapshot = null; return; }
      const snap: SkillSnapshot = await res.json();
      skillSnapshot = snap;
      skillDraft = [...snap.desiredSkills];
      skillLastSaved = [...snap.desiredSkills];
    } catch { skillSnapshot = null; }
    finally { skillSnapshotLoading = false; }
  }

  async function loadCompanySkills() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/company-skills`);
      if (!res.ok) return;
      companySkills = await res.json() ?? [];
    } catch { companySkills = []; }
  }

  async function syncSkillsToServer() {
    if (!agentId || !companyId || skillSyncing) return;
    skillSyncing = true;
    try {
      const res = await api(`/api/agents/${agentId}/skills/sync?companyId=${companyId}`, {
        method: "POST",
        body: JSON.stringify({ desiredSkills: skillDraft }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const snap: SkillSnapshot = await res.json();
      skillSnapshot = snap;
      skillLastSaved = [...snap.desiredSkills];
    } catch (err: any) {
      toastStore.push({ title: "Skill sync failed", body: err?.message, tone: "error" });
    } finally {
      skillSyncing = false;
    }
  }

  function toggleSkill(key: string, checked: boolean) {
    if (checked) {
      skillDraft = [...new Set([...skillDraft, key])];
    } else {
      skillDraft = skillDraft.filter(k => k !== key);
    }
    // Debounced auto-save
    if (skillSyncTimeout) clearTimeout(skillSyncTimeout);
    skillSyncTimeout = setTimeout(() => {
      const sortedDraft = [...skillDraft].sort();
      const sortedSaved = [...skillLastSaved].sort();
      if (JSON.stringify(sortedDraft) !== JSON.stringify(sortedSaved)) {
        syncSkillsToServer();
      }
    }, 500);
  }

  // Budget tab save
  async function saveBudgetTab() {
    if (!agentId) return;
    const dollars = parseFloat(budgetTabDollars);
    if (isNaN(dollars) || dollars < 0) {
      toastStore.push({ title: "Invalid amount", body: "Enter a valid dollar amount.", tone: "error" });
      return;
    }
    budgetTabSaving = true;
    try {
      const res = await api(`/api/agents/${agentId}/budgets`, {
        method: "PATCH",
        body: JSON.stringify({ budgetMonthlyCents: Math.round(dollars * 100) }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Budget updated", body: `Monthly budget set to $${dollars.toFixed(2)}.`, tone: "success" });
      await loadAgent();
    } catch (err: any) {
      toastStore.push({ title: "Budget update failed", body: err?.message, tone: "error" });
    } finally {
      budgetTabSaving = false;
    }
  }

  async function loadCostsSummary() {
    if (!companyId || !agentId) return;
    costsSummaryLoading = true;
    try {
      const res = await api(`/api/companies/${companyId}/costs/summary?agentId=${agentId}`);
      if (!res.ok) { costsSummary = null; return; }
      costsSummary = await res.json();
    } catch { costsSummary = null; }
    finally { costsSummaryLoading = false; }
  }

  onMount(() => {
    loadAgent();
    loadHeartbeats();
    loadSkills();
  });

  // Load issues and costs after agent is loaded
  $effect(() => {
    if (agent?.id && companyId) {
      loadAgentIssues();
      loadCostsSummary();
    }
  });

  // Load tab-specific data when switching tabs
  $effect(() => {
    if (activeTab === "instructions" && agentId && companyId && isLocalAdapter && !instructionsBundle && !instructionsBundleLoading) {
      loadInstructionsBundle();
    }
  });
  $effect(() => {
    if (activeTab === "instructions" && selectedFile && selectedFileExists && agentId && companyId) {
      loadInstructionsFile(selectedFile);
    }
  });
  $effect(() => {
    if (activeTab === "agent-skills" && agentId && companyId && !skillSnapshot && !skillSnapshotLoading) {
      loadSkillSnapshot();
      loadCompanySkills();
    }
  });
  $effect(() => {
    if (activeTab === "budget" && agent) {
      budgetTabDollars = agent.budgetMonthlyCents ? (agent.budgetMonthlyCents / 100).toFixed(2) : '';
    }
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

  async function terminateAgent() {
    if (!agentId) return;
    actionLoading = "terminate";
    try {
      const res = await api(`/api/agents/${agentId}/terminate`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Agent terminated", body: "Active session has been terminated.", tone: "success" });
      await loadAgent();
    } catch (err: any) {
      toastStore.push({ title: "Terminate failed", body: err?.message, tone: "error" });
    } finally {
      actionLoading = null;
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
      icon: agent.icon ?? "Bot",
      reportsTo: agent.reportsTo ?? null,
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
      if (editForm.icon !== (agent.icon ?? "Bot")) payload.icon = editForm.icon;
      if (editForm.reportsTo !== (agent.reportsTo ?? null)) payload.reportsTo = editForm.reportsTo;

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
  // Inline name edit
  // ---------------------------------------------------------------------------
  async function saveInlineName(newName: string): Promise<void> {
    if (!agentId) throw new Error("No agent ID");
    const res = await api(`/api/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: newName }),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    toastStore.push({ title: "Name updated", body: `Agent renamed to "${newName}".`, tone: "success" });
    await loadAgent();
  }

  // ---------------------------------------------------------------------------
  // Budget Edit
  // ---------------------------------------------------------------------------
  function openBudgetEdit() {
    budgetInputDollars = agent?.budgetMonthlyCents ? (agent.budgetMonthlyCents / 100).toFixed(2) : '';
    editingBudget = true;
  }

  function cancelBudgetEdit() {
    editingBudget = false;
    budgetInputDollars = '';
  }

  async function saveBudget() {
    if (!agentId) return;
    const dollars = parseFloat(budgetInputDollars);
    if (isNaN(dollars) || dollars < 0) {
      toastStore.push({ title: "Invalid amount", body: "Enter a valid dollar amount.", tone: "error" });
      return;
    }
    budgetSaving = true;
    try {
      const res = await api(`/api/agents/${agentId}/budgets`, {
        method: "PATCH",
        body: JSON.stringify({ budgetMonthlyCents: Math.round(dollars * 100) }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Budget updated", body: `Monthly budget set to $${dollars.toFixed(2)}.`, tone: "success" });
      editingBudget = false;
      await loadAgent();
    } catch (err: any) {
      toastStore.push({ title: "Budget update failed", body: err?.message, tone: "error" });
    } finally {
      budgetSaving = false;
    }
  }

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
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#60a5fa] shrink-0" title={agent.icon ?? "Bot"}>
            <Bot size={20} />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <InlineEditor
                value={agent.name}
                onSave={saveInlineName}
                tag="h1"
                class="text-xl font-semibold"
                placeholder="Agent name"
              />
              <StatusBadge status={agent.status} />
              {#if hasError}<Badge variant="destructive" class="gap-1"><AlertCircle size={12} /> error</Badge>{/if}
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
        <Button size="sm" onclick={() => openNewIssueDialog({ assigneeAgentId: agent?.id })}>
          <Plus size={14} class="mr-1" /> Assign Task
        </Button>
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
        <!-- More actions dropdown -->
        <DropdownMenu bind:open={moreMenuOpen}>
          <DropdownMenuTrigger class="inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-sm hover:bg-white/[0.06] transition-colors focus:outline-none focus:ring-1 focus:ring-[#2563EB]">
            <MoreHorizontal size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onclick={terminateAgent} disabled={actionLoading === "terminate"}>
              <StopCircle size={14} class="mr-2" />
              {actionLoading === "terminate" ? "Terminating..." : "Terminate Session"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onclick={() => { moreMenuOpen = false; confirmingDelete = true; }} class="text-red-400 focus:text-red-400">
              <Trash2 size={14} class="mr-2" />
              Delete Agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {#if confirmingDelete}
          <div class="flex items-center gap-1 border border-red-500/30 rounded-lg px-2 py-1 bg-red-500/10">
            <span class="text-xs text-red-400">Confirm?</span>
            <Button variant="destructive" size="sm" onclick={deleteAgent} disabled={actionLoading === "delete"}>
              {actionLoading === "delete" ? "Deleting..." : "Yes, delete"}
            </Button>
            <Button variant="outline" size="sm" onclick={() => confirmingDelete = false}>Cancel</Button>
          </div>
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
            <!-- Icon + Name row -->
            <div class="sm:col-span-2 flex items-start gap-4">
              <div>
                <label class="block text-xs text-[#94A3B8] mb-1">Icon</label>
                <AgentIconPicker value={editForm.icon} onSelect={(name) => editForm.icon = name} />
              </div>
              <div class="flex-1">
                <label for="edit-name" class="block text-xs text-[#94A3B8] mb-1">Name</label>
                <input
                  id="edit-name"
                  type="text"
                  bind:value={editForm.name}
                  class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
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
                {#each ROLES as r}
                  <option value={r} class="capitalize bg-[#0f172a]">{r}</option>
                {/each}
              </select>
            </div>
            <!-- Reports To -->
            <div>
              <label class="block text-xs text-[#94A3B8] mb-1">Reports To</label>
              {#if companyId}
                <ReportsToPicker
                  {companyId}
                  value={editForm.reportsTo}
                  excludeId={agentId}
                  onSelect={(id) => editForm.reportsTo = id}
                />
              {/if}
            </div>
            <div>
              <label for="edit-status" class="block text-xs text-[#94A3B8] mb-1">Status</label>
              <select
                id="edit-status"
                bind:value={editForm.status}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB] capitalize"
              >
                {#each STATUSES as s}
                  <option value={s} class="capitalize bg-[#0f172a]">{s}</option>
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
            <TabsTrigger value="overview">Dashboard</TabsTrigger>
            <TabsTrigger value="instructions">Instructions</TabsTrigger>
            <TabsTrigger value="agent-skills">Skills</TabsTrigger>
            <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
            <TabsTrigger value="runs">Runs ({heartbeats.length})</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="keys">API Keys</TabsTrigger>
            <TabsTrigger value="permissions">Permissions</TabsTrigger>
          </TabsList>

          <!-- OVERVIEW TAB -->
          <TabsContent value="overview">
            <div class="space-y-4 mt-4">
              <!-- Description -->
              {#if agent.description}
                <Card>
                  <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                  <CardContent>
                    <MarkdownBody content={agent.description} />
                  </CardContent>
                </Card>
              {/if}

              <!-- Latest Run -->
              <Card>
                <CardHeader><CardTitle>Latest Run</CardTitle></CardHeader>
                <CardContent>
                  {#if !latestRun}
                    <p class="text-sm text-[#94A3B8]">No runs recorded yet.</p>
                  {:else}
                    <div class="space-y-3">
                      <div class="flex items-center gap-3">
                        <StatusBadge status={latestRun.status} />
                        <span class="font-mono text-xs text-[#94A3B8]">{latestRun.id.slice(0, 8)}</span>
                        {#if latestRun.source}<Badge variant="outline" class="text-xs">{latestRun.source}</Badge>{/if}
                        <span class="ml-auto text-xs text-[#94A3B8]"><TimeAgo date={latestRun.startedAt} /></span>
                      </div>
                      {#if latestRun.reason}
                        <p class="text-sm text-[#94A3B8]">{latestRun.reason}</p>
                      {/if}
                      {#if latestRun.issueTitle}
                        <div class="flex items-center gap-2 text-sm">
                          <ClipboardList size={14} class="text-[#94A3B8]" />
                          <span>{latestRun.issueTitle}</span>
                        </div>
                      {/if}
                      {#if latestRun.stdout}
                        <div>
                          <p class="text-xs font-medium text-[#94A3B8] mb-1">stdout</p>
                          <pre class="text-xs font-mono bg-white/[0.03] rounded-lg p-3 overflow-auto max-h-32 text-[#94A3B8]">{latestRun.stdout}</pre>
                        </div>
                      {/if}
                      {#if latestRun.stderr}
                        <div>
                          <p class="text-xs font-medium text-red-400 mb-1">stderr</p>
                          <pre class="text-xs font-mono bg-red-500/5 border border-red-500/20 rounded-lg p-3 overflow-auto max-h-32 text-red-300">{latestRun.stderr}</pre>
                        </div>
                      {/if}
                      {#if latestRun.errorResult || latestRun.error}
                        <div>
                          <p class="text-xs font-medium text-red-400 mb-1">Error</p>
                          <pre class="text-xs font-mono bg-red-500/5 border border-red-500/20 rounded-lg p-3 overflow-auto max-h-32 text-red-300">{latestRun.errorResult ?? latestRun.error}</pre>
                        </div>
                      {/if}
                      {#if latestRun.durationMs}
                        <p class="text-xs text-[#94A3B8]">Duration: {(latestRun.durationMs / 1000).toFixed(1)}s</p>
                      {/if}
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Stats row: Run Activity, Issues by Priority, Issues by Status, Success Rate -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent class="pt-4">
                    <div class="flex items-center gap-2 mb-2">
                      <Activity size={16} class="text-[#60a5fa]" />
                      <span class="text-xs font-medium text-[#94A3B8]">Run Activity</span>
                    </div>
                    <p class="text-2xl font-semibold">{heartbeats.length}</p>
                    <p class="text-xs text-[#94A3B8] mt-1">recent runs</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent class="pt-4">
                    <div class="flex items-center gap-2 mb-2">
                      <ClipboardList size={16} class="text-[#f59e0b]" />
                      <span class="text-xs font-medium text-[#94A3B8]">Issues by Priority</span>
                    </div>
                    <div class="space-y-1">
                      {#each Object.entries(issuesByPriority) as [priority, count]}
                        <div class="flex items-center justify-between text-xs">
                          <span class="capitalize text-[#94A3B8]">{priority}</span>
                          <span class="font-medium">{count}</span>
                        </div>
                      {/each}
                      {#if Object.keys(issuesByPriority).length === 0}
                        <p class="text-xs text-[#475569]">No issues</p>
                      {/if}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent class="pt-4">
                    <div class="flex items-center gap-2 mb-2">
                      <ClipboardList size={16} class="text-[#10b981]" />
                      <span class="text-xs font-medium text-[#94A3B8]">Issues by Status</span>
                    </div>
                    <div class="space-y-1">
                      {#each Object.entries(issuesByStatus) as [status, count]}
                        <div class="flex items-center justify-between text-xs">
                          <span class="capitalize text-[#94A3B8]">{status}</span>
                          <span class="font-medium">{count}</span>
                        </div>
                      {/each}
                      {#if Object.keys(issuesByStatus).length === 0}
                        <p class="text-xs text-[#475569]">No issues</p>
                      {/if}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent class="pt-4">
                    <div class="flex items-center gap-2 mb-2">
                      <Activity size={16} class="text-[#10b981]" />
                      <span class="text-xs font-medium text-[#94A3B8]">Success Rate</span>
                    </div>
                    <p class="text-2xl font-semibold">{runSuccessRate}%</p>
                    <div class="h-1.5 rounded-full bg-white/[0.06] overflow-hidden mt-2">
                      <div
                        class="h-full rounded-full transition-all"
                        style="width: {runSuccessRate}%; background: {runSuccessRate > 80 ? '#10b981' : runSuccessRate > 50 ? '#f59e0b' : '#ef4444'};"
                      ></div>
                    </div>
                    <p class="text-xs text-[#94A3B8] mt-1">{runSuccessCount} passed, {runFailCount} failed</p>
                  </CardContent>
                </Card>
              </div>

              <!-- Recent Issues -->
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between">
                    <CardTitle>Recent Issues</CardTitle>
                    {#if issues.length > 5}
                      <button class="text-xs text-[#2563EB] hover:underline" onclick={() => activeTab = "issues"}>View all ({issues.length})</button>
                    {/if}
                  </div>
                </CardHeader>
                <CardContent>
                  {#if recentIssues.length === 0}
                    <p class="text-sm text-[#94A3B8]">No issues assigned to this agent.</p>
                  {:else}
                    <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                      {#each recentIssues as issue}
                        <a href="/{prefix}/issues/{issue.id}" class="flex items-center justify-between p-2.5 text-sm hover:bg-white/[0.03] transition">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <StatusBadge status={issue.status} />
                            <span class="truncate">{issue.title}</span>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            {#if issue.priority}<Badge variant="outline" class="text-[10px] capitalize">{issue.priority}</Badge>{/if}
                          </div>
                        </a>
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Costs Summary -->
              <Card>
                <CardHeader><CardTitle>Costs Summary</CardTitle></CardHeader>
                <CardContent>
                  {#if costsSummaryLoading}
                    <PageSkeleton lines={3} />
                  {:else if costsSummary}
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div class="border border-white/[0.08] rounded-lg p-3">
                        <p class="text-xs text-[#94A3B8] mb-1">Input Tokens</p>
                        <p class="text-lg font-semibold">{(costsSummary.inputTokens ?? 0).toLocaleString()}</p>
                      </div>
                      <div class="border border-white/[0.08] rounded-lg p-3">
                        <p class="text-xs text-[#94A3B8] mb-1">Output Tokens</p>
                        <p class="text-lg font-semibold">{(costsSummary.outputTokens ?? 0).toLocaleString()}</p>
                      </div>
                      <div class="border border-white/[0.08] rounded-lg p-3">
                        <p class="text-xs text-[#94A3B8] mb-1">Cached Tokens</p>
                        <p class="text-lg font-semibold">{(costsSummary.cachedTokens ?? 0).toLocaleString()}</p>
                      </div>
                      <div class="border border-white/[0.08] rounded-lg p-3">
                        <p class="text-xs text-[#94A3B8] mb-1">Total Cost</p>
                        <p class="text-lg font-semibold">{costsSummary.totalCostCents != null ? formatCents(costsSummary.totalCostCents) : '$0.00'}</p>
                      </div>
                    </div>
                  {:else}
                    <p class="text-sm text-[#94A3B8]">No cost data available.</p>
                  {/if}
                </CardContent>
              </Card>

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

          <!-- INSTRUCTIONS TAB -->
          <TabsContent value="instructions">
            <div class="space-y-4 mt-4 max-w-6xl">
              {#if !isLocalAdapter}
                <div class="border border-white/[0.08] rounded-lg p-6">
                  <p class="text-sm text-[#94A3B8]">Instructions bundles are only available for local adapters.</p>
                </div>
              {:else if instructionsBundleLoading && !instructionsBundle}
                <PageSkeleton lines={6} />
              {:else}
                <!-- Warnings -->
                {#if instructionsBundle?.warnings?.length}
                  <div class="space-y-2">
                    {#each instructionsBundle.warnings as warning}
                      <div class="rounded-md border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-200">{warning}</div>
                    {/each}
                  </div>
                {/if}

                <!-- Save / Cancel bar -->
                {#if instructionsAnyDirty}
                  <div class="sticky top-4 z-10 flex items-center justify-end gap-2">
                    <div class="flex items-center gap-2 bg-[#0f172a]/90 backdrop-blur-sm border border-white/[0.08] rounded-lg px-3 py-1.5 shadow-lg">
                      <Button variant="ghost" size="sm" onclick={cancelInstructionsEdit} disabled={instructionsSaving}>Cancel</Button>
                      <Button size="sm" onclick={saveInstructionsFile} disabled={instructionsSaving}>
                        {instructionsSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                {/if}

                <!-- Advanced collapsible -->
                <div>
                  <button
                    class="flex items-center gap-1 text-xs text-[#94A3B8] hover:text-white transition-colors"
                    onclick={() => advancedOpen = !advancedOpen}
                  >
                    <ChevronRight size={12} class="transition-transform {advancedOpen ? 'rotate-90' : ''}" />
                    Advanced
                  </button>
                  {#if advancedOpen}
                    <div class="pt-4 pb-6 grid gap-x-6 gap-y-4 sm:grid-cols-3">
                      <!-- Mode -->
                      <div class="space-y-1.5">
                        <span class="text-xs font-medium text-[#94A3B8]">Mode</span>
                        <div class="flex gap-2">
                          <Button
                            size="sm"
                            variant={currentMode === "managed" ? "default" : "outline"}
                            onclick={() => {
                              bundleDraftMode = "managed";
                              bundleDraftRootPath = instructionsBundle?.managedRootPath ?? currentRootPath;
                            }}
                          >
                            Managed
                          </Button>
                          <Button
                            size="sm"
                            variant={currentMode === "external" ? "default" : "outline"}
                            onclick={() => {
                              bundleDraftMode = "external";
                              if (!bundleDraftRootPath) bundleDraftRootPath = instructionsBundle?.rootPath ?? "";
                            }}
                          >
                            External
                          </Button>
                        </div>
                      </div>
                      <!-- Root path -->
                      <div class="space-y-1.5 min-w-0">
                        <span class="text-xs font-medium text-[#94A3B8]">Root path</span>
                        {#if currentMode === "managed"}
                          <div class="flex items-center gap-1.5 font-mono text-xs text-[#94A3B8] pt-1.5">
                            <span class="min-w-0 truncate" title={currentRootPath || undefined}>{currentRootPath || "(managed)"}</span>
                            {#if currentRootPath}
                              <button class="shrink-0 text-[#94A3B8] hover:text-white" onclick={() => { navigator.clipboard.writeText(currentRootPath); toastStore.push({ title: "Copied", tone: "success" }); }}>
                                <Copy size={12} />
                              </button>
                            {/if}
                          </div>
                        {:else}
                          <input
                            type="text"
                            value={currentRootPath}
                            oninput={(e) => bundleDraftRootPath = (e.target as HTMLInputElement).value}
                            class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                            placeholder="/absolute/path/to/agent/prompts"
                          />
                        {/if}
                      </div>
                      <!-- Entry file -->
                      <div class="space-y-1.5 min-w-0">
                        <span class="text-xs font-medium text-[#94A3B8]">Entry file</span>
                        <input
                          type="text"
                          value={currentEntryFile}
                          oninput={(e) => bundleDraftEntryFile = (e.target as HTMLInputElement).value}
                          class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                          placeholder="AGENTS.md"
                        />
                      </div>
                    </div>
                  {/if}
                </div>

                <!-- File browser + editor -->
                <div class="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <!-- Left panel: file list -->
                  <div class="border border-white/[0.08] rounded-lg p-3 space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-[#94A3B8]">Files</span>
                      <Button variant="ghost" size="sm" onclick={() => showNewFileInput = !showNewFileInput}>
                        <Plus size={14} />
                      </Button>
                    </div>

                    {#if showNewFileInput}
                      <div class="flex items-center gap-1">
                        <input
                          type="text"
                          bind:value={newFilePath}
                          placeholder="new-file.md"
                          class="flex-1 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                          onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') addNewInstructionsFile(); if (e.key === 'Escape') { showNewFileInput = false; newFilePath = ''; } }}
                        />
                        <Button variant="ghost" size="sm" onclick={addNewInstructionsFile}>
                          <Check size={12} />
                        </Button>
                      </div>
                    {/if}

                    <div class="space-y-0.5">
                      {#each [...new Set([currentEntryFile, ...fileOptions])] as filePath}
                        {@const isSelected = filePath === selectedFile}
                        {@const fileMeta = instructionsBundle?.files.find(f => f.path === filePath)}
                        <button
                          class="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors {isSelected ? 'bg-[#2563EB]/20 text-white' : 'text-[#94A3B8] hover:bg-white/[0.04] hover:text-white'}"
                          onclick={() => { selectedFile = filePath; instructionsDraft = null; }}
                        >
                          <div class="flex items-center gap-2 min-w-0">
                            <FileText size={14} class="shrink-0 {isSelected ? 'text-[#60a5fa]' : ''}" />
                            <span class="truncate font-mono text-xs">{filePath}</span>
                          </div>
                          <span class="shrink-0 rounded border border-white/[0.08] text-[#94A3B8] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                            {fileMeta?.isEntryFile ? "entry" : fileMeta?.size ? `${fileMeta.size}b` : "new"}
                          </span>
                        </button>
                      {/each}
                    </div>
                  </div>

                  <!-- Right panel: editor -->
                  <div class="border border-white/[0.08] rounded-lg p-4 space-y-3 min-w-0">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0">
                        <h4 class="text-sm font-medium font-mono truncate">{selectedFile}</h4>
                        <p class="text-xs text-[#94A3B8]">
                          {selectedFileExists
                            ? selectedFileMeta?.deprecated ? "Deprecated virtual file" : "markdown file"
                            : "New file in this bundle"}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <!-- View / Code toggle -->
                        <div class="flex items-center rounded-md border border-white/[0.08] overflow-hidden">
                          <button
                            class="px-2.5 py-1 text-xs font-medium transition-colors {instructionsViewMode === 'view' ? 'bg-[#2563EB]/20 text-white' : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'}"
                            onclick={() => instructionsViewMode = 'view'}
                          >
                            View
                          </button>
                          <button
                            class="px-2.5 py-1 text-xs font-medium transition-colors {instructionsViewMode === 'code' ? 'bg-[#2563EB]/20 text-white' : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04]'}"
                            onclick={() => instructionsViewMode = 'code'}
                          >
                            Code
                          </button>
                        </div>
                        {#if selectedFileExists && selectedFile !== currentEntryFile}
                          <Button
                            variant="outline"
                            size="sm"
                            onclick={() => { if (confirm(`Delete ${selectedFile}?`)) deleteInstructionsFileAction(selectedFile); }}
                            disabled={instructionsSaving}
                          >
                            <Trash2 size={14} class="mr-1" /> Delete
                          </Button>
                        {/if}
                      </div>
                    </div>

                    {#if selectedFileLoading}
                      <PageSkeleton lines={10} />
                    {:else if instructionsViewMode === 'view'}
                      <div class="min-h-[420px] w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 overflow-auto">
                        {#if displayContent.trim()}
                          <MarkdownBody content={displayContent} />
                        {:else}
                          <p class="text-sm text-[#94A3B8] italic">No content</p>
                        {/if}
                      </div>
                    {:else}
                      <textarea
                        value={displayContent}
                        oninput={(e) => instructionsDraft = (e.target as HTMLTextAreaElement).value}
                        class="min-h-[420px] w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 font-mono text-sm outline-none focus:ring-1 focus:ring-[#2563EB] resize-y"
                        placeholder="# Agent instructions"
                      ></textarea>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </TabsContent>

          <!-- SKILLS TAB -->
          <TabsContent value="agent-skills">
            <div class="space-y-5 mt-4 max-w-4xl">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <a
                  href="/{prefix}/skills"
                  class="text-sm font-medium underline-offset-4 transition-colors hover:underline text-[#60a5fa] hover:text-[#93c5fd]"
                >
                  View company skills library
                </a>
                {#if skillSyncing}
                  <div class="flex items-center gap-2 text-xs text-[#94A3B8]">
                    <Loader2 size={14} class="animate-spin" />
                    <span>Saving changes...</span>
                  </div>
                {:else if skillsHaveUnsaved}
                  <div class="flex items-center gap-2 text-xs text-[#94A3B8]">
                    <span>Saving soon...</span>
                  </div>
                {/if}
              </div>

              <!-- Warnings -->
              {#if skillSnapshot?.warnings?.length}
                <div class="space-y-1 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                  {#each skillSnapshot.warnings as warning}
                    <div>{warning}</div>
                  {/each}
                </div>
              {/if}

              {#if unsupportedSkillMessage}
                <div class="rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-[#94A3B8]">{unsupportedSkillMessage}</div>
              {/if}

              {#if skillSnapshotLoading}
                <PageSkeleton lines={5} />
              {:else}
                {#if optionalSkillRows.length === 0 && requiredSkillRows.length === 0 && unmanagedSkillRows.length === 0}
                  <div class="border-y border-white/[0.08] px-3 py-6 text-sm text-[#94A3B8]">
                    Import skills into the company library first, then attach them here.
                  </div>
                {:else}
                  <!-- Optional skills -->
                  {#if optionalSkillRows.length > 0}
                    <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06]">
                      {#each optionalSkillRows as skill}
                        {@const checked = skill.required || skillDraft.includes(skill.key)}
                        {@const disabled = skill.required || skillSnapshot?.mode === "unsupported"}
                        <label class="flex items-start gap-3 px-3 py-3 text-sm hover:bg-white/[0.03] cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            {checked}
                            {disabled}
                            onchange={(e) => toggleSkill(skill.key, (e.target as HTMLInputElement).checked)}
                            class="mt-0.5 accent-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between gap-3">
                              <span class="truncate font-medium">{skill.name}</span>
                              <a href="/{prefix}/skills" class="shrink-0 text-xs text-[#94A3B8] no-underline hover:text-white">View</a>
                            </div>
                            {#if skill.description}
                              <p class="mt-1 text-xs text-[#94A3B8]">{skill.description}</p>
                            {/if}
                            {#if skill.detail}
                              <p class="mt-1 text-xs text-[#94A3B8]">{skill.detail}</p>
                            {/if}
                          </div>
                        </label>
                      {/each}
                    </div>
                  {/if}

                  <!-- Required skills -->
                  {#if requiredSkillRows.length > 0}
                    <div class="border border-white/[0.08] rounded-lg overflow-hidden">
                      <div class="border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <span class="text-xs font-medium text-[#94A3B8]">Required by ClawDev</span>
                      </div>
                      <div class="divide-y divide-white/[0.06]">
                        {#each requiredSkillRows as skill}
                          <label class="flex items-start gap-3 px-3 py-3 text-sm cursor-not-allowed">
                            <input
                              type="checkbox"
                              checked={true}
                              disabled
                              class="mt-0.5 accent-[#2563EB] disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center justify-between gap-3">
                                <span class="truncate font-medium">{skill.name}</span>
                              </div>
                              {#if skill.description}
                                <p class="mt-1 text-xs text-[#94A3B8]">{skill.description}</p>
                              {/if}
                              {#if skill.adapterEntry?.requiredReason}
                                <p class="mt-1 text-xs text-[#f59e0b]">{skill.adapterEntry.requiredReason}</p>
                              {/if}
                              {#if skill.detail}
                                <p class="mt-1 text-xs text-[#94A3B8]">{skill.detail}</p>
                              {/if}
                            </div>
                          </label>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Unmanaged / user-installed skills -->
                  {#if unmanagedSkillRows.length > 0}
                    <div class="border border-white/[0.08] rounded-lg overflow-hidden">
                      <div class="border-b border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <span class="text-xs font-medium text-[#94A3B8]">User-installed skills, not managed by ClawDev</span>
                      </div>
                      <div class="divide-y divide-white/[0.06]">
                        {#each unmanagedSkillRows as skill}
                          <div class="flex items-start gap-3 px-3 py-3 text-sm bg-white/[0.01]">
                            <span class="mt-1 h-2 w-2 rounded-full bg-[#475569] shrink-0"></span>
                            <div class="min-w-0 flex-1">
                              <span class="truncate font-medium">{skill.name}</span>
                              {#if skill.originLabel}
                                <p class="mt-1 text-xs text-[#94A3B8]">{skill.originLabel}</p>
                              {/if}
                              {#if skill.locationLabel}
                                <p class="mt-1 text-xs text-[#94A3B8]">Location: {skill.locationLabel}</p>
                              {/if}
                              {#if skill.detail}
                                <p class="mt-1 text-xs text-[#94A3B8]">{skill.detail}</p>
                              {/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/if}

                <!-- Skill summary footer -->
                <div class="border-t border-white/[0.08] pt-4">
                  <div class="grid gap-2 text-sm sm:grid-cols-2">
                    <div class="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2">
                      <span class="text-[#94A3B8]">Adapter</span>
                      <span class="font-medium">{adapterLabel(agent?.adapterType ?? '')}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2">
                      <span class="text-[#94A3B8]">Skills applied</span>
                      <span>{skillApplicationLabel}</span>
                    </div>
                    <div class="flex items-center justify-between gap-3 border-b border-white/[0.06] py-2">
                      <span class="text-[#94A3B8]">Selected skills</span>
                      <span>{skillDraft.length}</span>
                    </div>
                  </div>
                </div>
              {/if}
            </div>
          </TabsContent>

          <!-- BUDGET TAB -->
          <TabsContent value="budget">
            <div class="space-y-6 mt-4 max-w-3xl">
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between">
                    <CardTitle>Agent Budget Policy</CardTitle>
                    <Badge variant={budgetTabStatus === 'over_budget' ? 'destructive' : budgetTabStatus === 'warning' ? 'outline' : 'secondary'}>
                      {budgetTabStatus === 'no_budget' ? 'No budget set' : budgetTabStatus === 'over_budget' ? 'Over budget' : budgetTabStatus === 'warning' ? `${budgetTabPct}% used` : `${budgetTabPct}% used`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="space-y-6">
                    <!-- Current spend overview -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div class="border border-white/[0.08] rounded-lg p-4">
                        <p class="text-xs text-[#94A3B8] mb-1">Monthly Budget</p>
                        <p class="text-2xl font-semibold">{budgetFormatted}</p>
                      </div>
                      <div class="border border-white/[0.08] rounded-lg p-4">
                        <p class="text-xs text-[#94A3B8] mb-1">Current Spend</p>
                        <p class="text-2xl font-semibold">{spentFormatted}</p>
                      </div>
                      <div class="border border-white/[0.08] rounded-lg p-4">
                        <p class="text-xs text-[#94A3B8] mb-1">Remaining</p>
                        <p class="text-2xl font-semibold">
                          {agent?.budgetMonthlyCents
                            ? formatCents(Math.max(0, agent.budgetMonthlyCents - (agent.spentMonthlyCents ?? 0)))
                            : '$0.00'}
                        </p>
                      </div>
                    </div>

                    <!-- Utilization bar -->
                    {#if agent?.budgetMonthlyCents && agent.budgetMonthlyCents > 0}
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <span class="text-xs text-[#94A3B8]">Budget utilization</span>
                          <span class="text-sm font-semibold" style="color: {budgetTabBarColor};">{budgetTabPct}%</span>
                        </div>
                        <div class="h-3 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all duration-500"
                            style="width: {budgetTabPct}%; background-color: {budgetTabBarColor};"
                          ></div>
                        </div>
                        <p class="mt-1 text-xs text-[#94A3B8]">{spentFormatted} of {budgetFormatted} used this period</p>
                      </div>
                    {/if}

                    <Separator />

                    <!-- Edit budget amount -->
                    <div class="space-y-3">
                      <h4 class="text-sm font-medium">Set Monthly Budget</h4>
                      <p class="text-xs text-[#94A3B8]">
                        Define a monthly spending cap for this agent. When the budget is reached the agent will be paused automatically.
                      </p>
                      <div class="flex items-end gap-3">
                        <div class="flex-1 max-w-xs">
                          <label for="budget-tab-amount" class="block text-xs text-[#94A3B8] mb-1">Amount (USD)</label>
                          <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94A3B8]">$</span>
                            <input
                              id="budget-tab-amount"
                              type="number"
                              step="0.01"
                              min="0"
                              bind:value={budgetTabDollars}
                              class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                              placeholder="0.00"
                              onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') saveBudgetTab(); }}
                            />
                          </div>
                        </div>
                        <Button size="sm" onclick={saveBudgetTab} disabled={budgetTabSaving}>
                          <Save size={14} class="mr-1" /> {budgetTabSaving ? "Saving..." : "Save Budget"}
                        </Button>
                      </div>
                    </div>

                    <!-- Budget behavior info -->
                    <div class="border border-white/[0.08] rounded-lg p-4 space-y-2">
                      <h5 class="text-xs font-medium text-[#94A3B8] uppercase tracking-wider">Budget behavior</h5>
                      <div class="grid gap-2 text-sm">
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Window</span>
                          <span>Calendar month (UTC)</span>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Hard stop</span>
                          <Badge variant="outline">Enabled</Badge>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Notifications</span>
                          <Badge variant="outline">Enabled</Badge>
                        </div>
                        <div class="flex items-center justify-between">
                          <span class="text-[#94A3B8]">Warning threshold</span>
                          <span>80%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
        <!-- Budget section with progress bar -->
        <div class="px-1 py-1.5">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-[#94A3B8]">Monthly Budget</span>
            {#if !editingBudget}
              <button
                class="text-[10px] font-medium text-[#2563EB] hover:underline"
                onclick={openBudgetEdit}
              >
                Edit
              </button>
            {/if}
          </div>

          {#if editingBudget}
            <div class="flex items-center gap-1.5 mt-1">
              <div class="relative flex-1">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8]">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={budgetInputDollars}
                  class="w-full rounded-md border border-white/[0.12] bg-white/[0.04] pl-5 pr-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  placeholder="0.00"
                  onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') saveBudget(); if (e.key === 'Escape') cancelBudgetEdit(); }}
                />
              </div>
              <button
                class="flex h-6 w-6 items-center justify-center rounded-md bg-[#2563EB]/20 text-[#2563EB] hover:bg-[#2563EB]/30 transition-colors disabled:opacity-50"
                onclick={saveBudget}
                disabled={budgetSaving}
              >
                <Check size={12} />
              </button>
              <button
                class="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-[#94A3B8] hover:bg-white/[0.1] transition-colors"
                onclick={cancelBudgetEdit}
              >
                <X size={12} />
              </button>
            </div>
          {:else}
            <p class="text-sm font-medium" title={agent?.budgetMonthlyCents ? `${agent.budgetMonthlyCents} cents` : ''}>{budgetFormatted}</p>
          {/if}

          <div class="flex items-center justify-between mt-2 mb-1">
            <span class="text-xs text-[#94A3B8]">Monthly Spent</span>
            {#if agent?.budgetMonthlyCents && agent.budgetMonthlyCents > 0}
              <span class="text-[10px] font-semibold" style="color: {budgetBarColor};">{budgetPct}%</span>
            {/if}
          </div>
          <p class="text-sm font-medium" title={agent?.spentMonthlyCents ? `${agent.spentMonthlyCents} cents` : ''}>{spentFormatted}</p>

          {#if agent?.budgetMonthlyCents && agent.budgetMonthlyCents > 0}
            <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                class="h-full rounded-full transition-all duration-500"
                style="width: {budgetPct}%; background-color: {budgetBarColor};"
              ></div>
            </div>
            <p class="mt-1 text-[10px] text-[#94A3B8]">
              {spentFormatted} of {budgetFormatted}
            </p>
          {/if}
        </div>
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
