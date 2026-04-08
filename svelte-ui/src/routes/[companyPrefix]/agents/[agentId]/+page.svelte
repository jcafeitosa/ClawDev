<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PluginLauncherOutlet } from "$lib/components/plugins/index.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "$components/ui/index.js";
  import { PageLayout } from "$components/layout/index.js";
  import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "$lib/components/charts/index.js";
  import { onMount } from "svelte";
  import { Bot, Play, Pause, Zap, Key, FileText, ChevronRight, ChevronDown, Pencil, Trash2, Copy, Plus, X, Save, RotateCcw, Check, Loader2, MoreHorizontal, AlertCircle, ClipboardList, StopCircle, Brain, Cpu, Terminal, Crown, Code, Rocket, Globe, Server, Database, Cloud, Webhook, TestTube2, Clock } from "lucide-svelte";
  import type { ComponentType } from "svelte";
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    isLevelCAgentRole,
    type HierarchyPreset,
  } from "@clawdev/shared";

  const AGENT_ICON_COMPONENTS: Record<string, ComponentType> = {
    bot: Bot, brain: Brain, cpu: Cpu, zap: Zap, terminal: Terminal, crown: Crown,
    code: Code, rocket: Rocket, globe: Globe, server: Server, database: Database, cloud: Cloud,
  };
  function resolveAgentIcon(name: string | null | undefined): ComponentType {
    if (!name) return Bot;
    return AGENT_ICON_COMPONENTS[name.toLowerCase()] ?? Bot;
  }
  import { openNewIssueDialog } from '$lib/components/new-issue-dialog.svelte';
  import AgentIconPicker from '$lib/components/agent-icon-picker.svelte';
  import ReportsToPicker from '$lib/components/reports-to-picker.svelte';
  import { AGENT_ADAPTER_OPTIONS } from '$lib/constants/agent-adapters';
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import InlineEditor from '$lib/components/inline-editor.svelte';
  import RunTranscriptPreview from '$lib/components/run-transcript-preview.svelte';
  import AgentConfigForm from '$lib/components/agent-config-form.svelte';
  import { buildTranscriptFromLog, normalizeTranscript } from '$lib/transcript/run-transcript';

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
  let selectedRunId = $state<string | null>(null);
  let selectedRunDetail = $state<Record<string, any> | null>(null);
  let selectedRunLogText = $state("");
  let selectedRunIssues = $state<any[]>([]);
  let selectedRunWorkspaceOps = $state<any[]>([]);
  let selectedRunLoading = $state(false);
  let selectedRunError = $state<string | null>(null);
  let selectedRunAction = $state<"cancel" | "retry" | null>(null);
  let selectedRunLastLoadedId = $state<string | null>(null);

  // Action state
  let actionLoading = $state<string | null>(null);
  let confirmingDelete = $state(false);

  // Edit form state
  let editMode = $state(false);
  let editForm = $state({
    name: "",
    title: "",
    role: "",
    status: "",
    adapterType: "",
    systemPrompt: "",
    icon: "Bot",
    reportsTo: null as string | null,
  });
  let editSaving = $state(false);

  // Delegations state
  let delegations = $state<any[]>([]);
  let delegationsLoading = $state(false);
  let showDelegateForm = $state(false);
  let delegateForm = $state({ toAgentId: '', delegationType: 'task', instructions: '', issueId: '' });
  let delegateCreating = $state(false);
  let companyAgents = $state<any[]>([]);

  // Hooks state
  let hooks = $state<any[]>([]);
  let hooksLoading = $state(false);
  let showHookForm = $state(false);
  let hookCreating = $state(false);
  let hookForm = $state({
    name: '',
    event: 'issue.created' as string,
    hookType: 'webhook' as string,
    config: '{}',
    enabled: true,
    priority: 0,
    runAsync: true,
    retryCount: 0,
  });
  let hookExpandedRuns = $state<Record<string, boolean>>({});
  let hookRuns = $state<Record<string, any[]>>({});
  let hookRunsLoading = $state<Record<string, boolean>>({});
  let editingHookId = $state<string | null>(null);

  // Hooks — config sub-fields for structured editing
  let hookConfigWebhook = $state({ url: '', method: 'POST', headers: '{}' });
  let hookConfigWakeAgent = $state({ targetAgentId: '' });
  let hookConfigCreateIssue = $state({ title: '', description: '', projectId: '' });
  let hookConfigNotifyChannel = $state({ channelId: '', messageTemplate: '' });

  // Cron Jobs (Routines)
  let routines: any[] = $state([]);
  let routineRuns: Record<string, any[]> = $state({});
  let routinesLoading = $state(false);
  let routinesLoaded = $state(false);
  let routineRunsLoading: Record<string, boolean> = $state({});
  let routineExpandedRuns: Record<string, boolean> = $state({});

  // API Keys state
  let apiKeys = $state<any[]>([]);
  let apiKeysLoading = $state(false);
  let newKeyName = $state("");
  let newKeyCreating = $state(false);
  let revealedKey = $state<string | null>(null);
  let revokingKeyId = $state<string | null>(null);
  let confirmRevokeId = $state<string | null>(null);

  // Model selector state (Configuration tab)
  let configModels = $state<{id: string; label: string; status?: string; statusDetail?: string; provider?: string}[]>([]);
  let configModelsLoading = $state(false);
  let configModelsError = $state<string | null>(null);
  let configModelValue = $state("");
  let configSaving = $state(false);
  let configModelTestResult = $state<{status: string; testedAt: string; checks: {level: string; message: string; detail?: string; hint?: string; code?: string}[]} | null>(null);
  let configModelTestLoading = $state(false);
  let configModelTestTimer = $state<ReturnType<typeof setTimeout> | null>(null);
  let configDraft = $state<Record<string, any>>({});
  let configAdapterType = $state("");

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
  /** Resolved UUID — prefers loaded agent.id over URL param (which may be a urlKey like "ceo") */
  let agentUuid = $derived(agent?.id ?? agentId);
  let prefix = $derived($page.params.companyPrefix);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix(prefix));
  let companyId = $derived(routeCompanyId);
  let agentIsUuid = $derived(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(agentId ?? ""));
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
  let agentLayer = $derived(isLevelCAgentRole(agent?.role) ? "Level C" : "Execution");

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
  let sortedHeartbeats = $derived.by(() =>
    [...heartbeats].sort(
      (a, b) =>
        new Date((b.startedAt ?? b.createdAt ?? 0) as string | number | Date).getTime() -
        new Date((a.startedAt ?? a.createdAt ?? 0) as string | number | Date).getTime(),
    ),
  );
  let latestRun = $derived(sortedHeartbeats.length > 0 ? sortedHeartbeats[0] : null);
  let selectedRun = $derived.by(() => {
    if (selectedRunId) return sortedHeartbeats.find((run) => run.id === selectedRunId) ?? null;
    return sortedHeartbeats[0] ?? null;
  });
  let selectedRunBlocks = $derived.by(() =>
    normalizeTranscript(
      buildTranscriptFromLog(selectedRunLogText),
      Boolean(selectedRun && (selectedRun.status === "running" || selectedRun.status === "queued")),
    ),
  );
  let latestRunBlocks = $derived.by(() =>
    normalizeTranscript(
      buildTranscriptFromLog(selectedRunId ? "" : selectedRunLogText),
      Boolean(latestRun && (latestRun.status === "running" || latestRun.status === "queued")),
    ),
  );
  let recentIssues = $derived(issues.slice(0, 10));
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
      const res = await api(`/api/agents/${agentUuid}/heartbeat-runs?limit=20${companyId ? `&companyId=${companyId}` : ''}`);
      if (!res.ok) return;
      const data = await res.json();
      heartbeats = Array.isArray(data) ? data : data.runs ?? data.data ?? [];
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
      const res = await api(`/api/companies/${companyId}/issues?assigneeAgentId=${agentUuid}`);
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
      const res = await api(`/api/agents/${agentUuid}/instructions-bundle?companyId=${companyId}`);
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
      const res = await api(`/api/agents/${agentUuid}/instructions-bundle/file?path=${encodeURIComponent(path)}&companyId=${companyId}`);
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
        await api(`/api/agents/${agentUuid}/instructions-bundle?companyId=${companyId}`, {
          method: "PATCH",
          body: JSON.stringify(bundlePayload),
        });
      }
      // Save file content if changed
      if (instructionsFileDirty) {
        const shouldClearLegacy = Boolean(instructionsBundle?.legacyPromptTemplateActive || instructionsBundle?.legacyBootstrapPromptTemplateActive);
        await api(`/api/agents/${agentUuid}/instructions-bundle/file?companyId=${companyId}`, {
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
      await api(`/api/agents/${agentUuid}/instructions-bundle/file?path=${encodeURIComponent(path)}&companyId=${companyId}`, { method: "DELETE" });
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
      const res = await api(`/api/agents/${agentUuid}/skills?companyId=${companyId}`);
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
      const res = await api(`/api/agents/${agentUuid}/skills/sync?companyId=${companyId}`, {
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
      const res = await api(`/api/agents/${agentUuid}/budgets`, {
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
    if (!companyId || !agentUuid) return;
    costsSummaryLoading = true;
    try {
      // Aggregate costs from heartbeat runs (the /costs/summary endpoint doesn't support per-agent filtering)
      const res = await api(`/api/agents/${agentUuid}/heartbeat-runs?limit=100&companyId=${companyId}`);
      if (!res.ok) { costsSummary = null; return; }
      const data = await res.json();
      const runs = data.runs ?? [];
      let inputTokens = 0, outputTokens = 0, cachedTokens = 0, totalCostCents = 0;
      for (const run of runs) {
        const usage = run.usageJson;
        if (typeof usage === 'object' && usage) {
          inputTokens += Number(usage.inputTokens ?? 0);
          outputTokens += Number(usage.outputTokens ?? 0);
          cachedTokens += Number(usage.cachedTokens ?? usage.cacheReadInputTokens ?? 0);
          totalCostCents += Math.round(Number(usage.costUsd ?? 0) * 100);
        }
      }
      costsSummary = { inputTokens, outputTokens, cachedTokens, totalCostCents };
    } catch { costsSummary = null; }
    finally { costsSummaryLoading = false; }
  }

  async function loadSelectedRunDetail(runId: string) {
    if (!companyId || !runId) return;
    selectedRunLoading = true;
    selectedRunError = null;
    try {
      const res = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}`);
      if (!res.ok) {
        selectedRunDetail = null;
        selectedRunLogText = "";
        selectedRunError = `Failed to load run (${res.status})`;
        return;
      }

      const data = await res.json();
      selectedRunDetail = data.run ?? data;

      const logRes = await api(`/api/companies/${companyId}/heartbeat-runs/${runId}/log?limitBytes=600000`);
      if (logRes.ok) {
        const logData = await logRes.json();
        selectedRunLogText = typeof logData.content === "string" ? logData.content : "";
      } else {
        selectedRunLogText = "";
      }

      const [issuesRes, workspaceRes] = await Promise.all([
        api(`/api/companies/${companyId}/runs/${runId}/issues`),
        api(`/api/companies/${companyId}/heartbeat-runs/${runId}/workspace-operations`),
      ]);
      if (issuesRes.ok) {
        const issuesData = await issuesRes.json();
        selectedRunIssues = Array.isArray(issuesData) ? issuesData : [];
      } else {
        selectedRunIssues = [];
      }
      if (workspaceRes.ok) {
        const workspaceData = await workspaceRes.json();
        selectedRunWorkspaceOps = Array.isArray(workspaceData) ? workspaceData : [];
      } else {
        selectedRunWorkspaceOps = [];
      }
    } catch (err: any) {
      selectedRunDetail = null;
      selectedRunLogText = "";
      selectedRunIssues = [];
      selectedRunWorkspaceOps = [];
      selectedRunError = err?.message ?? "Failed to load selected run";
    } finally {
      selectedRunLoading = false;
    }
  }

  $effect(() => {
    if (!agentId) return;
    // Load agent even without companyId — the API resolves by urlKey with ?companyId if available
    loadAgent();
    if (companyId) {
      loadHeartbeats();
      loadSkills();
    }
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

  $effect(() => {
    if (selectedRunId) return;
    if (!latestRun?.id || !companyId) return;
    if (selectedRunLastLoadedId === latestRun.id) return;
    selectedRunLastLoadedId = latestRun.id;
    void loadSelectedRunDetail(latestRun.id);
  });

  $effect(() => {
    if (activeTab !== "runs") return;
    if (sortedHeartbeats.length === 0) return;

    const nextSelectedRunId = selectedRunId && sortedHeartbeats.some((run) => run.id === selectedRunId)
      ? selectedRunId
      : sortedHeartbeats[0]?.id ?? null;

    if (nextSelectedRunId && nextSelectedRunId !== selectedRunId) {
      selectedRunId = nextSelectedRunId;
      return;
    }

    if (!nextSelectedRunId || selectedRunLastLoadedId === nextSelectedRunId) return;
    selectedRunLastLoadedId = nextSelectedRunId;
    void loadSelectedRunDetail(nextSelectedRunId);
  });

  function selectRun(runId: string) {
    selectedRunId = runId;
    selectedRunLastLoadedId = null;
    activeTab = "runs";
    void loadSelectedRunDetail(runId);
  }

  async function cancelSelectedRun() {
    const run = selectedRunDetail;
    if (!run?.id) return;
    selectedRunAction = "cancel";
    try {
      const companyScopeId = run.companyId ?? companyId;
      if (!companyScopeId) throw new Error("No company selected");
      const res = await api(`/api/heartbeat-runs/${run.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Run cancelled", body: "The selected run was cancelled.", tone: "success" });
      await loadHeartbeats();
      await loadSelectedRunDetail(run.id);
    } catch (err: any) {
      toastStore.push({ title: "Cancel failed", body: err?.message, tone: "error" });
    } finally {
      selectedRunAction = null;
    }
  }

  async function retrySelectedRun() {
    const run = selectedRunDetail;
    if (!run?.id || !run.agentId) return;
    selectedRunAction = "retry";
    try {
      const payload: Record<string, unknown> = {};
      const context = run.contextSnapshot && typeof run.contextSnapshot === "object" ? run.contextSnapshot : null;
      if (context) {
        const issueId = typeof context.issueId === "string" ? context.issueId : null;
        const taskId = typeof context.taskId === "string" ? context.taskId : null;
        const taskKey = typeof context.taskKey === "string" ? context.taskKey : null;
        if (issueId) payload.issueId = issueId;
        if (taskId) payload.taskId = taskId;
        if (taskKey) payload.taskKey = taskKey;
      }
      const res = await api(`/api/agents/${run.agentId}/wakeup`, {
        method: "POST",
        body: JSON.stringify({
          source: "on_demand",
          triggerDetail: "manual",
          reason: "retry_failed_run",
          payload,
        }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      const nextRunId = typeof data?.id === "string" ? data.id : null;
      toastStore.push({ title: "Retry requested", body: "A new run has been queued.", tone: "success" });
      await loadHeartbeats();
      if (nextRunId) {
        selectedRunId = nextRunId;
        selectedRunLastLoadedId = null;
        await loadSelectedRunDetail(nextRunId);
      }
    } catch (err: any) {
      toastStore.push({ title: "Retry failed", body: err?.message, tone: "error" });
    } finally {
      selectedRunAction = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Agent Actions
  // ---------------------------------------------------------------------------
  async function wakeAgent() {
    if (!agentId) return;
    actionLoading = "wake";
    try {
      // Pass the first open issue assigned to this agent so the heartbeat has context
      const firstIssue = issues.find(i => i.status !== 'done' && i.status !== 'cancelled');
      const payload: Record<string, any> = { source: "on_demand" };
      if (firstIssue) {
        payload.payload = { issueId: firstIssue.id };
      }
      const res = await api(`/api/agents/${agentUuid}/wakeup`, {
        method: "POST",
        body: JSON.stringify(payload),
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
      const res = await api(`/api/agents/${agentUuid}/${endpoint}`, { method: "POST" });
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
      const res = await api(`/api/agents/${agentUuid}`, { method: "DELETE" });
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
      const res = await api(`/api/agents/${agentUuid}/terminate`, { method: "POST" });
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
      adapterType: agent.adapterType ?? "claude_local",
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
      if (editForm.adapterType !== (agent.adapterType ?? "")) payload.adapterType = editForm.adapterType;
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

      const res = await api(`/api/agents/${agentUuid}`, {
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
  // Configuration tab — model selector with auto-test
  // ---------------------------------------------------------------------------
  const CONFIG_MODEL_FILTERS: Record<string, { providers?: string[]; idPrefix?: string }> = {
    claude_local: { providers: ["anthropic"] },
    codex_local: { providers: ["openai"] },
    gemini_local: { providers: ["google"] },
    opencode_local: { idPrefix: "opencode/" },
  };

  let configModelDirty = $derived(
    agent ? (configModelValue !== (agent.adapterConfig?.model ?? agent.model ?? "")) : false
  );

  function filterModelsForAdapter(models: typeof configModels, adapterType: string): typeof configModels {
    const filter = CONFIG_MODEL_FILTERS[adapterType];
    if (!filter) return models; // copilot, cursor, pi — show all
    return models.filter((m) => {
      if (filter.providers?.length) {
        const p = (m.provider ?? "").toLowerCase();
        if (!filter.providers.includes(p)) return false;
      }
      if (filter.idPrefix && !m.id.toLowerCase().startsWith(filter.idPrefix.toLowerCase())) return false;
      return true;
    });
  }

  async function loadConfigModels() {
    if (!agent || !companyId) return;
    const at = agent.adapterType;
    configModelsLoading = true;
    configModelsError = null;
    try {
      const res = await api(`/api/models?adapterType=${encodeURIComponent(at)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Failed (${res.status})`);
      }
      const data = await res.json();
      const raw = Array.isArray(data?.models) ? data.models : [];
      configModels = filterModelsForAdapter(
        raw.filter((model: any) => model.circuitState === "available" || model.circuitState === "cooldown"),
        at,
      );
    } catch (err: any) {
      configModels = [];
      configModelsError = err?.message ?? "Failed to load models";
    } finally {
      configModelsLoading = false;
    }
  }

  // Sync model value + load models when agent loads
  $effect(() => {
    if (agent && !configSaving) {
      configModelValue = agent.adapterConfig?.model ?? agent.model ?? "";
      configAdapterType = agent.adapterType ?? "";
      configModelTestResult = null;
      void loadConfigModels();
    }
  });

  function handleConfigModelChange() {
    // Auto-test after model change (debounced)
    configModelTestResult = null;
    if (configModelTestTimer) clearTimeout(configModelTestTimer);
    if (!companyId || !agent) return;
    configModelTestTimer = setTimeout(() => {
      void runConfigModelTest();
    }, 600);
  }

  async function runConfigModelTest() {
    if (!companyId || !agent) return;
    configModelTestLoading = true;
    configModelTestResult = null;
    try {
      const testConfig = { ...(typeof agent.adapterConfig === 'object' && agent.adapterConfig ? agent.adapterConfig : {}), model: configModelValue };
      const res = await api(`/api/companies/${companyId}/adapters/${agent.adapterType}/test-environment`, {
        method: "POST",
        body: JSON.stringify({ adapterConfig: testConfig }),
      });
      if (!res.ok) throw new Error(`Test failed (${res.status})`);
      configModelTestResult = await res.json();
    } catch {
      configModelTestResult = { status: "fail", testedAt: new Date().toISOString(), checks: [{ level: "error", message: "Environment test failed" }] };
    } finally {
      configModelTestLoading = false;
    }
  }

  async function saveModelChange() {
    if (!agentUuid || !agent || !configModelDirty) return;
    configSaving = true;
    try {
      const existingConfig = typeof agent.adapterConfig === 'object' && agent.adapterConfig ? agent.adapterConfig : {};
      const res = await api(`/api/agents/${agentUuid}`, {
        method: "PATCH",
        body: JSON.stringify({ adapterConfig: { ...existingConfig, model: configModelValue } }),
      });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      toastStore.push({ title: "Model updated", body: `Now using ${configModelValue}`, tone: "success" });
      await loadAgent();
    } catch (err: any) {
      toastStore.push({ title: "Save failed", body: err?.message, tone: "error" });
    } finally {
      configSaving = false;
    }
  }

  // ---------------------------------------------------------------------------
  // API Keys
  // ---------------------------------------------------------------------------
  async function loadApiKeys() {
    if (!agentId) return;
    apiKeysLoading = true;
    try {
      const res = await api(`/api/agents/${agentUuid}/keys`);
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
      const res = await api(`/api/agents/${agentUuid}/keys`, {
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
      const res = await api(`/api/agents/${agentUuid}/keys/${keyId}`, { method: "DELETE" });
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

  // Load delegations when switching to the delegations tab
  $effect(() => {
    if (activeTab === "delegations" && agentId) loadDelegations();
  });

  async function loadDelegations() {
    if (!agentId) return;
    delegationsLoading = true;
    try {
      const res = await api(`/api/agents/${agentId}/delegations`);
      delegations = await res.json();
    } catch (e) { console.error(e); }
    finally { delegationsLoading = false; }
  }

  async function loadCompanyAgentsForDelegate() {
    if (!companyId || companyAgents.length > 0) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      const data = await res.json();
      companyAgents = (Array.isArray(data) ? data : data.agents ?? []).filter((a: any) => a.id !== agentId);
    } catch (e) { console.error(e); }
  }

  async function createDelegation() {
    if (!delegateForm.toAgentId || !delegateForm.instructions.trim() || !companyId) return;
    delegateCreating = true;
    try {
      await api(`/api/agents/${agentId}/delegations`, {
        method: 'POST',
        body: JSON.stringify({
          companyId,
          toAgentId: delegateForm.toAgentId,
          delegationType: delegateForm.delegationType,
          instructions: delegateForm.instructions.trim(),
          issueId: delegateForm.issueId || undefined,
        }),
      });
      delegateForm = { toAgentId: '', delegationType: 'task', instructions: '', issueId: '' };
      showDelegateForm = false;
      await loadDelegations();
    } catch (e) { console.error(e); }
    finally { delegateCreating = false; }
  }

  async function handleDelegationAction(delegationId: string, action: string, payload?: Record<string, unknown>) {
    try {
      await api(`/api/agent-delegations/${delegationId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ agentId, ...payload }),
      });
      await loadDelegations();
    } catch (e) { console.error(e); }
  }

  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------
  const HOOK_EVENTS = [
    'issue.created', 'issue.updated', 'issue.status_changed', 'issue.assigned',
    'run.started', 'run.completed', 'run.failed',
    'agent.status_changed', 'agent.budget_exceeded',
    'delegation.created', 'delegation.completed',
    'channel.message', 'schedule.cron',
  ] as const;

  const HOOK_TYPES = ['webhook', 'wake_agent', 'create_issue', 'notify_channel'] as const;

  // Load hooks when switching to the hooks tab
  $effect(() => {
    if (activeTab === "hooks" && agentUuid) loadHooks();
  });

  // Load routines when switching to the cron-jobs tab
  $effect(() => {
    if (activeTab === "cron-jobs" && agentUuid && companyId && !routinesLoaded && !routinesLoading) {
      loadRoutines();
    }
  });

  async function loadRoutines() {
    routinesLoading = true;
    try {
      const res = await api(`/api/companies/${companyId}/routines`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const allRoutines = await res.json();
      // Filter routines assigned to this agent
      const agentUuid = agent?.id ?? agentId;
      routines = allRoutines.filter((r: any) => r.assigneeAgentId === agentUuid);

      // Load triggers for each routine
      for (const routine of routines) {
        const trigRes = await api(`/api/routines/${routine.id}`);
        if (trigRes.ok) {
          const detail = await trigRes.json();
          routine.triggers = detail.triggers || [];
          routine.runsCount = detail.runsCount || 0;
        }
      }
    } catch (e: any) {
      toastStore.push({ title: "Failed to load routines", body: e.message || "Unknown error", tone: "error" });
    } finally {
      routinesLoading = false;
      routinesLoaded = true;
    }
  }

  async function loadRoutineRuns(routineId: string) {
    routineRunsLoading = { ...routineRunsLoading, [routineId]: true };
    try {
      const res = await api(`/api/routines/${routineId}/runs?limit=10`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const runs = await res.json();
      routineRuns = { ...routineRuns, [routineId]: Array.isArray(runs) ? runs : runs.items || [] };
    } catch (e: any) {
      toastStore.push({ title: "Failed to load runs", body: e.message || "Unknown error", tone: "error" });
    } finally {
      routineRunsLoading = { ...routineRunsLoading, [routineId]: false };
    }
  }

  function toggleRoutineRuns(routineId: string) {
    const isExpanded = routineExpandedRuns[routineId];
    routineExpandedRuns = { ...routineExpandedRuns, [routineId]: !isExpanded };
    if (!isExpanded && !routineRuns[routineId]) {
      loadRoutineRuns(routineId);
    }
  }

  async function loadHooks() {
    if (!agentUuid) return;
    hooksLoading = true;
    try {
      const res = await api(`/api/agents/${agentUuid}/hooks`);
      hooks = await res.json();
    } catch (e) { console.error(e); }
    finally { hooksLoading = false; }
  }

  function buildHookConfig(): Record<string, unknown> {
    switch (hookForm.hookType) {
      case 'webhook':
        return { url: hookConfigWebhook.url, method: hookConfigWebhook.method, headers: JSON.parse(hookConfigWebhook.headers || '{}') };
      case 'wake_agent':
        return { targetAgentId: hookConfigWakeAgent.targetAgentId };
      case 'create_issue':
        return { title: hookConfigCreateIssue.title, description: hookConfigCreateIssue.description, projectId: hookConfigCreateIssue.projectId || undefined };
      case 'notify_channel':
        return { channelId: hookConfigNotifyChannel.channelId, messageTemplate: hookConfigNotifyChannel.messageTemplate };
      default:
        return JSON.parse(hookForm.config || '{}');
    }
  }

  function resetHookForm() {
    hookForm = { name: '', event: 'issue.created', hookType: 'webhook', config: '{}', enabled: true, priority: 0, runAsync: true, retryCount: 0 };
    hookConfigWebhook = { url: '', method: 'POST', headers: '{}' };
    hookConfigWakeAgent = { targetAgentId: '' };
    hookConfigCreateIssue = { title: '', description: '', projectId: '' };
    hookConfigNotifyChannel = { channelId: '', messageTemplate: '' };
    editingHookId = null;
  }

  async function createOrUpdateHook() {
    if (!hookForm.name.trim()) return;
    hookCreating = true;
    try {
      const payload = {
        name: hookForm.name.trim(),
        event: hookForm.event,
        hookType: hookForm.hookType,
        config: buildHookConfig(),
        enabled: hookForm.enabled,
        priority: hookForm.priority,
        runAsync: hookForm.runAsync,
        retryCount: hookForm.retryCount,
      };
      if (editingHookId) {
        await api(`/api/agent-hooks/${editingHookId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/agents/${agentUuid}/hooks`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetHookForm();
      showHookForm = false;
      await loadHooks();
    } catch (e) { console.error(e); }
    finally { hookCreating = false; }
  }

  async function toggleHookEnabled(hook: any) {
    try {
      await api(`/api/agent-hooks/${hook.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !hook.enabled }),
      });
      await loadHooks();
    } catch (e) { console.error(e); }
  }

  async function deleteHook(hook: any) {
    try {
      await api(`/api/agent-hooks/${hook.id}`, { method: 'DELETE' });
      await loadHooks();
    } catch (e) { console.error(e); }
  }

  async function testHook(hook: any) {
    try {
      const res = await api(`/api/agent-hooks/${hook.id}/test`, {
        method: 'POST',
        body: JSON.stringify({ payload: { _test: true } }),
      });
      const result = await res.json();
      toastStore.push({ title: "Hook test completed", body: `Hook test ${result.status ?? 'completed'}`, tone: "success" });
    } catch (e) {
      toastStore.push({ title: "Hook test failed", tone: "error" });
      console.error(e);
    }
  }

  async function loadHookRuns(hookId: string) {
    hookRunsLoading = { ...hookRunsLoading, [hookId]: true };
    try {
      const res = await api(`/api/agent-hooks/${hookId}/runs?limit=10`);
      const data = await res.json();
      hookRuns = { ...hookRuns, [hookId]: Array.isArray(data) ? data : data.runs ?? [] };
    } catch (e) { console.error(e); }
    finally { hookRunsLoading = { ...hookRunsLoading, [hookId]: false }; }
  }

  function toggleHookRuns(hookId: string) {
    const expanded = !hookExpandedRuns[hookId];
    hookExpandedRuns = { ...hookExpandedRuns, [hookId]: expanded };
    if (expanded && !hookRuns[hookId]) loadHookRuns(hookId);
  }

  function startEditHook(hook: any) {
    editingHookId = hook.id;
    hookForm = {
      name: hook.name,
      event: hook.event,
      hookType: hook.hookType,
      config: JSON.stringify(hook.config ?? {}, null, 2),
      enabled: hook.enabled,
      priority: hook.priority ?? 0,
      runAsync: hook.runAsync ?? true,
      retryCount: hook.retryCount ?? 0,
    };
    const cfg = hook.config ?? {};
    if (hook.hookType === 'webhook') hookConfigWebhook = { url: cfg.url ?? '', method: cfg.method ?? 'POST', headers: JSON.stringify(cfg.headers ?? {}, null, 2) };
    if (hook.hookType === 'wake_agent') hookConfigWakeAgent = { targetAgentId: cfg.targetAgentId ?? '' };
    if (hook.hookType === 'create_issue') hookConfigCreateIssue = { title: cfg.title ?? '', description: cfg.description ?? '', projectId: cfg.projectId ?? '' };
    if (hook.hookType === 'notify_channel') hookConfigNotifyChannel = { channelId: cfg.channelId ?? '', messageTemplate: cfg.messageTemplate ?? '' };
    showHookForm = true;
  }

  // ---------------------------------------------------------------------------
  // Inline name edit
  // ---------------------------------------------------------------------------
  async function saveInlineName(newName: string): Promise<void> {
    if (!agentUuid) throw new Error("No agent ID");
    const res = await api(`/api/agents/${agentUuid}`, {
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
      const res = await api(`/api/agents/${agentUuid}/budgets`, {
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
    opencode_local: "OpenCode (Local)", pi_local: "Pi (Local)",
    openclaw_gateway: "OpenClaw Gateway", process: "Process", http: "HTTP",
  };
  function adapterLabel(type: string): string { return ADAPTER_LABELS[type] ?? type; }
  function formatCents(cents: number): string { return `$${(cents / 100).toFixed(2)}`; }

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return n.toLocaleString();
  }

  function runMetrics(run: Record<string, any>): { input: number; output: number; cached: number; cost: number } {
    const usage = run.usageJson ?? run.usage ?? {};
    return {
      input: (usage.inputTokens ?? usage.input_tokens ?? 0) as number,
      output: (usage.outputTokens ?? usage.output_tokens ?? 0) as number,
      cached: (usage.cachedTokens ?? usage.cached_tokens ?? usage.cacheReadInputTokens ?? 0) as number,
      cost: ((usage.costCents ?? usage.cost_cents ?? 0) as number) / 100,
    };
  }

  function formatRunDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  let runsWithCost = $derived.by(() => {
    return heartbeats
      .filter(r => {
        const m = runMetrics(r);
        return m.cost > 0 || m.input > 0 || m.output > 0;
      })
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  });
</script>

<PageLayout title={agent?.name ?? 'Agent'} fullWidth>
{#if loading}
  <PageSkeleton lines={8} />
{:else if notFound}
  <EmptyState title="Agent not found" description="The agent doesn't exist or you don't have access." icon="🤖">
    <a href="/{prefix}/agents" class="text-sm text-[#2563EB] hover:underline">Back to agents</a>
  </EmptyState>
{:else if agent}
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-[#2563EB]/10 text-[#60a5fa] shrink-0" title={agent.icon ?? "Bot"}>
            {#if agent.icon && resolveAgentIcon(agent.icon)}
              {@const AgentIcon = resolveAgentIcon(agent.icon)}
              <AgentIcon size={20} />
            {:else}
              <span>Bot</span>
            {/if}
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
        <Button size="sm" onclick={() => openNewIssueDialog({ assigneeAgentId: agent?.id, companyId: companyId ?? undefined })}>
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

    <div class="rounded-xl border border-border bg-card p-4">
      <div class="mb-3">
        <p class="text-sm font-medium text-foreground">Plugin launchers</p>
        <p class="text-xs text-muted-foreground">Contextual agent actions exposed by installed plugins.</p>
      </div>
      {#snippet noAgentLaunchers()}
        <div class="text-sm text-muted-foreground">No agent launchers installed.</div>
      {/snippet}
      <PluginLauncherOutlet
        placementZones={["detailTab", "toolbarButton", "globalToolbarButton"]}
        context={{
          companyId,
          companyPrefix: prefix ?? null,
          projectId: null,
          entityId: agentUuid,
          entityType: "agent",
          parentEntityId: null,
          userId: null,
        }}
        itemClassName="flex flex-wrap gap-2"
        fallback={noAgentLaunchers}
      />
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
                <div class="block text-xs text-[#94A3B8] mb-1">Icon</div>
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
            <div>
              <label for="edit-adapter" class="block text-xs text-[#94A3B8] mb-1">Provider</label>
              <select
                id="edit-adapter"
                bind:value={editForm.adapterType}
                class="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
              >
                {#each AGENT_ADAPTER_OPTIONS as option}
                  <option value={option.value} class="bg-[#0f172a]">{option.label}</option>
                {/each}
              </select>
            </div>
            <!-- Reports To -->
            <div>
              <div class="block text-xs text-[#94A3B8] mb-1">Reports To</div>
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
            <TabsTrigger value="delegations">Delegations</TabsTrigger>
            <TabsTrigger value="hooks">Hooks</TabsTrigger>
            <TabsTrigger value="cron-jobs">Cron Jobs{routines.length > 0 ? ` (${routines.length})` : ''}</TabsTrigger>
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
                      {#if selectedRunId === null}
                        <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                          <RunTranscriptPreview
                            blocks={latestRunBlocks}
                            live={latestRun.status === "running" || latestRun.status === "queued"}
                            limit={6}
                            emptyMessage="Waiting for transcript..."
                          />
                        </div>
                      {/if}
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Charts row: Run Activity, Issues by Priority, Issues by Status, Success Rate -->
              <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <ChartCard title="Run Activity" subtitle="Last 14 days">
                  <RunActivityChart runs={heartbeats} />
                </ChartCard>
                <ChartCard title="Issues by Priority" subtitle="Last 14 days">
                  <PriorityChart {issues} />
                </ChartCard>
                <ChartCard title="Issues by Status" subtitle="Last 14 days">
                  <IssueStatusChart {issues} />
                </ChartCard>
                <ChartCard title="Success Rate" subtitle="Last 14 days">
                  <SuccessRateChart runs={heartbeats} />
                </ChartCard>
              </div>

              <!-- Recent Issues -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="text-sm font-medium">Recent Issues</h3>
                  <button
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onclick={() => activeTab = "issues"}
                  >
                    See All &rarr;
                  </button>
                </div>
                {#if recentIssues.length === 0}
                  <p class="text-sm text-muted-foreground">No recent issues.</p>
                {:else}
                  <div class="border border-border rounded-lg">
                    {#each recentIssues as issue}
                      <a
                        href="/{prefix}/issues/{issue.identifier ?? issue.id}"
                        class="flex items-center gap-2 border-b border-border last:border-b-0 px-3 py-2 text-sm no-underline text-inherit transition-colors hover:bg-accent/50"
                      >
                        <span class="shrink-0 font-mono text-xs text-muted-foreground">{issue.identifier ?? issue.id?.slice(0, 8)}</span>
                        <span class="min-w-0 flex-1 truncate">{issue.title}</span>
                        <span class="ml-auto shrink-0"><StatusBadge status={issue.status} /></span>
                      </a>
                    {/each}
                    {#if issues.length > 10}
                      <div class="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                        +{issues.length - 10} more issues
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>

              <!-- Costs -->
              <div class="space-y-3">
                <h3 class="text-sm font-medium">Costs</h3>
                {#if costsSummaryLoading}
                  <PageSkeleton lines={3} />
                {:else if costsSummary}
                  <div class="border border-border rounded-lg p-4">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
                      <div>
                        <span class="text-xs text-muted-foreground block">Input tokens</span>
                        <span class="text-lg font-semibold">{formatTokens(costsSummary.inputTokens ?? 0)}</span>
                      </div>
                      <div>
                        <span class="text-xs text-muted-foreground block">Output tokens</span>
                        <span class="text-lg font-semibold">{formatTokens(costsSummary.outputTokens ?? 0)}</span>
                      </div>
                      <div>
                        <span class="text-xs text-muted-foreground block">Cached tokens</span>
                        <span class="text-lg font-semibold">{formatTokens(costsSummary.cachedTokens ?? 0)}</span>
                      </div>
                      <div>
                        <span class="text-xs text-muted-foreground block">Total cost</span>
                        <span class="text-lg font-semibold">{costsSummary.totalCostCents != null ? formatCents(costsSummary.totalCostCents) : '$0.00'}</span>
                      </div>
                    </div>
                  </div>
                {:else}
                  <p class="text-sm text-muted-foreground">No cost data available.</p>
                {/if}

                <!-- Per-run cost table -->
                {#if runsWithCost.length > 0}
                  <div class="border border-border rounded-lg overflow-hidden">
                    <table class="w-full text-xs">
                      <thead>
                        <tr class="border-b border-border bg-accent/20">
                          <th class="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                          <th class="text-left px-3 py-2 font-medium text-muted-foreground">Run</th>
                          <th class="text-right px-3 py-2 font-medium text-muted-foreground">Input</th>
                          <th class="text-right px-3 py-2 font-medium text-muted-foreground">Output</th>
                          <th class="text-right px-3 py-2 font-medium text-muted-foreground">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each runsWithCost.slice(0, 10) as run}
                          {@const metrics = runMetrics(run)}
                          <tr class="border-b border-border last:border-b-0">
                            <td class="px-3 py-2">{formatRunDate(run.createdAt ?? run.startedAt)}</td>
                            <td class="px-3 py-2 font-mono">{run.id.slice(0, 8)}</td>
                            <td class="px-3 py-2 text-right tabular-nums">{formatTokens(metrics.input)}</td>
                            <td class="px-3 py-2 text-right tabular-nums">{formatTokens(metrics.output)}</td>
                            <td class="px-3 py-2 text-right tabular-nums">{metrics.cost > 0 ? `$${metrics.cost.toFixed(4)}` : '-'}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                {/if}
              </div>

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
                    <a href="/{prefix}/issues/{issue.identifier ?? issue.id}" class="flex items-center justify-between p-3 text-sm hover:bg-white/[0.03] transition">
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
                <div class="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                  <div class="border border-white/[0.08] rounded-lg divide-y divide-white/[0.06] overflow-hidden">
                    {#each sortedHeartbeats as run}
                      {@const isSelected = (selectedRun?.id ?? latestRun?.id) === run.id}
                      <button
                        type="button"
                        class="w-full flex flex-col gap-1 p-3 text-left text-sm transition-colors {isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}"
                        onclick={() => selectRun(run.id)}
                      >
                        <div class="flex items-center gap-3 min-w-0">
                          <StatusBadge status={run.status} />
                          <span class="font-mono text-xs text-[#94A3B8]">{run.id.slice(0, 8)}</span>
                          {#if run.source}<Badge variant="outline" class="text-xs">{run.source}</Badge>{/if}
                          {#if run.reason}<span class="text-[#94A3B8] truncate">{run.reason}</span>{/if}
                        </div>
                        <div class="flex items-center justify-between gap-3 pl-8">
                          <div class="flex items-center gap-2 text-xs text-[#94A3B8]">
                            {#if run.durationMs}<span>{(run.durationMs / 1000).toFixed(1)}s</span>{/if}
                          </div>
                          <TimeAgo date={run.startedAt} class="text-xs" />
                        </div>
                      </button>
                    {/each}
                  </div>

                  <div class="space-y-4 min-w-0">
                    {#if selectedRunLoading && !selectedRunDetail}
                      <PageSkeleton lines={8} />
                    {:else if !selectedRun}
                      <EmptyState title="Select a run" description="Choose a run from the list to inspect transcript, errors, and actions." icon="🏃" />
                    {:else}
                      <Card>
                        <CardHeader>
                          <div class="flex items-center justify-between gap-3">
                            <CardTitle>Selected Run</CardTitle>
                            <div class="flex items-center gap-2">
                              <Button variant="outline" size="sm" href="/{prefix}/runs/{selectedRun.id}">
                                Open full run
                              </Button>
                              {#if (selectedRun.status === "failed" || selectedRun.status === "timed_out") && selectedRunDetail?.agentId}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onclick={retrySelectedRun}
                                  disabled={selectedRunAction === "retry"}
                                >
                                  <RotateCcw size={14} class="mr-1" />
                                  {selectedRunAction === "retry" ? "Retrying..." : "Retry"}
                                </Button>
                              {/if}
                              {#if (selectedRun.status === "running" || selectedRun.status === "queued") && selectedRunDetail?.id}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onclick={cancelSelectedRun}
                                  disabled={selectedRunAction === "cancel"}
                                >
                                  <StopCircle size={14} class="mr-1" />
                                  {selectedRunAction === "cancel" ? "Cancelling..." : "Cancel"}
                                </Button>
                              {/if}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent class="space-y-4">
                          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p class="text-[#94A3B8] text-xs mb-1">Status</p>
                              <StatusBadge status={selectedRun.status} />
                            </div>
                            <div>
                              <p class="text-[#94A3B8] text-xs mb-1">Run ID</p>
                              <p class="font-mono text-xs break-all">{selectedRun.id}</p>
                            </div>
                            <div>
                              <p class="text-[#94A3B8] text-xs mb-1">Source</p>
                              <p class="text-sm">{selectedRun.source ?? selectedRun.trigger ?? "—"}</p>
                            </div>
                            <div>
                              <p class="text-[#94A3B8] text-xs mb-1">Started</p>
                              <TimeAgo date={selectedRun.startedAt ?? selectedRun.createdAt} class="text-xs" />
                            </div>
                          </div>

                          {#if selectedRun.reason}
                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                              <p class="text-xs text-[#94A3B8] mb-1">Reason</p>
                              <p class="text-sm">{selectedRun.reason}</p>
                            </div>
                          {/if}

                          {#if selectedRun.error}
                            <div class="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                              <p class="text-xs font-medium text-red-300 mb-1">Error</p>
                              <p class="text-sm text-red-100 break-all">{selectedRun.error}</p>
                              {#if selectedRun.errorCode}
                                <p class="text-xs text-red-200/80 mt-1">Code: {selectedRun.errorCode}</p>
                              {/if}
                            </div>
                          {/if}

                          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                              <p class="text-[#94A3B8] mb-1">Duration</p>
                              <p class="font-medium">{selectedRun.durationMs ? `${(selectedRun.durationMs / 1000).toFixed(1)}s` : "—"}</p>
                            </div>
                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                              <p class="text-[#94A3B8] mb-1">Exit code</p>
                              <p class="font-medium">{selectedRun.exitCode ?? "—"}</p>
                            </div>
                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                              <p class="text-[#94A3B8] mb-1">Tokens</p>
                              <p class="font-medium">
                                {#if selectedRun.usageJson}
                                  {(((selectedRun.usageJson as any).inputTokens ?? (selectedRun.usageJson as any).input_tokens ?? 0) + ((selectedRun.usageJson as any).outputTokens ?? (selectedRun.usageJson as any).output_tokens ?? 0)).toLocaleString()}
                                {:else}
                                  —
                                {/if}
                              </p>
                            </div>
                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.03] p-3">
                              <p class="text-[#94A3B8] mb-1">Cost</p>
                              <p class="font-medium">{selectedRun.usageJson ? formatCents(((selectedRun.usageJson as any).costCents ?? 0) as number) : "—"}</p>
                            </div>
                          </div>

                          <div class="grid gap-3 sm:grid-cols-2">
                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                              <p class="text-xs font-medium text-[#94A3B8]">Session</p>
                              <div class="space-y-1 text-xs">
                                <div class="flex items-start justify-between gap-3">
                                  <span class="text-[#94A3B8]">Before</span>
                                  <span class="font-mono break-all">{selectedRun.sessionIdBefore ?? "—"}</span>
                                </div>
                                <div class="flex items-start justify-between gap-3">
                                  <span class="text-[#94A3B8]">After</span>
                                  <span class="font-mono break-all">{selectedRun.sessionIdAfter ?? "—"}</span>
                                </div>
                              </div>
                            </div>

                            <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                              <p class="text-xs font-medium text-[#94A3B8]">Issues touched</p>
                              {#if selectedRunIssues.length === 0}
                                <p class="text-xs text-[#94A3B8]">No issues were recorded for this run.</p>
                              {:else}
                                <div class="space-y-1">
                                  {#each selectedRunIssues.slice(0, 5) as issue}
                                    <a href="/{prefix}/issues/{issue.identifier ?? issue.issueId}" class="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-white/[0.04] transition-colors">
                                      <div class="min-w-0">
                                        <p class="truncate">{issue.title ?? issue.identifier ?? issue.issueId}</p>
                                        <p class="font-mono text-[10px] text-[#94A3B8]">{issue.identifier ?? issue.issueId?.slice?.(0, 8) ?? ""}</p>
                                      </div>
                                      {#if issue.status}
                                        <StatusBadge status={issue.status} />
                                      {/if}
                                    </a>
                                  {/each}
                                </div>
                              {/if}
                            </div>
                          </div>

                          <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                            <p class="text-xs font-medium text-[#94A3B8]">Workspace operations</p>
                            {#if selectedRunWorkspaceOps.length === 0}
                              <p class="text-xs text-[#94A3B8]">No workspace operations recorded.</p>
                            {:else}
                              <div class="space-y-2">
                                {#each selectedRunWorkspaceOps as op}
                                  <div class="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-xs">
                                    <div class="flex items-center justify-between gap-2">
                                      <span class="font-medium capitalize">{String(op.phase ?? op.type ?? "operation").replace(/_/g, " ")}</span>
                                      <StatusBadge status={op.status ?? "unknown"} />
                                    </div>
                                    <div class="mt-1 space-y-0.5 text-[#94A3B8]">
                                      {#if op.command}
                                        <p class="font-mono break-all">{op.command}</p>
                                      {/if}
                                      {#if op.cwd}
                                        <p class="font-mono break-all">cwd: {op.cwd}</p>
                                      {/if}
                                    </div>
                                  </div>
                                {/each}
                              </div>
                            {/if}
                          </div>

                          <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                            <div class="flex items-center justify-between gap-3 mb-2">
                              <p class="text-xs font-medium text-[#94A3B8]">Transcript</p>
                              {#if selectedRunError}
                                <span class="text-xs text-red-300">{selectedRunError}</span>
                              {/if}
                            </div>
                            {#if selectedRunLoading && selectedRunBlocks.length === 0}
                              <PageSkeleton lines={4} />
                            {:else}
                              <RunTranscriptPreview
                                blocks={selectedRunBlocks}
                                live={selectedRun.status === "running" || selectedRun.status === "queued"}
                                limit={10}
                                emptyMessage="No transcript captured for this run."
                              />
                            {/if}
                          </div>
                        </CardContent>
                      </Card>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </TabsContent>

          <!-- CONFIGURATION TAB -->
          <TabsContent value="config">
            <div class="space-y-4 mt-4">
              <!-- Model selector card -->
              <Card>
                <CardHeader class="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Model</CardTitle>
                    <p class="text-xs text-muted-foreground mt-1">{adapterLabel(agent.adapterType)}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <!-- Model discovery status from probed data -->
                    {#if configModelValue && configModels.length > 0}
                      {@const selectedModelData = configModels.find(m => m.id === configModelValue)}
                      {#if selectedModelData}
                        {#if selectedModelData.status === 'available'}
                          <Badge variant="outline" class="gap-1 border-green-500/30 bg-green-500/10 text-green-600">✅ Available</Badge>
                        {:else if selectedModelData.status === 'quota_exceeded'}
                          <Badge variant="outline" class="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600">⏳ Cooldown</Badge>
                        {:else if selectedModelData.status === 'unavailable' || selectedModelData.status === 'error'}
                          <Badge variant="outline" class="gap-1 border-red-500/30 bg-red-500/10 text-red-600">❌ Unavailable</Badge>
                        {:else}
                          <Badge variant="outline" class="gap-1">⚪ Unknown</Badge>
                        {/if}
                      {/if}
                    {/if}
                    <!-- Live test result -->
                    {#if configModelTestLoading}
                      <Badge variant="outline" class="gap-1"><Loader2 size={12} class="animate-spin" /> Testing...</Badge>
                    {:else if configModelTestResult}
                      {#if configModelTestResult.status === 'pass'}
                        <Badge variant="outline" class="gap-1 border-green-500/30 bg-green-500/10 text-green-600"><Check size={12} /> Test Passed</Badge>
                      {:else if configModelTestResult.status === 'warn'}
                        <Badge variant="outline" class="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600"><AlertCircle size={12} /> Cooldown</Badge>
                      {:else}
                        <Badge variant="outline" class="gap-1 border-red-500/30 bg-red-500/10 text-red-600"><AlertCircle size={12} /> Unavailable</Badge>
                      {/if}
                    {/if}
                    <Button size="sm" onclick={saveModelChange} disabled={configSaving || !configModelDirty}>
                      {#if configSaving}<Loader2 size={14} class="mr-1 animate-spin" />{:else}<Save size={14} class="mr-1" />{/if}
                      Save
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {#if configModelsLoading}
                    <div class="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 size={16} class="animate-spin" /> Loading models...
                    </div>
                  {:else if configModels.length > 0}
                    {@const grouped = Object.entries(
                      configModels.reduce((acc, m) => {
                        const p = m.provider ?? m.id.split('/')[0] ?? "other";
                        (acc[p] ??= []).push(m);
                        return acc;
                      }, {} as Record<string, typeof configModels>)
                    ).sort(([a], [b]) => a.localeCompare(b))}
                    {@const providerCount = grouped.length}
                    {@const availableCount = configModels.filter(m => m.status === 'available').length}
                    {@const quotaCount = configModels.filter(m => m.status === 'quota_exceeded').length}
                    {@const unavailableCount = configModels.filter(m => m.status === 'unavailable' || m.status === 'error').length}
                    <div class="relative">
                      <select
                        id="config-model-select"
                        class="w-full appearance-none rounded-lg border border-border bg-background px-3.5 py-2.5 pr-9 text-sm text-foreground focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]/30 transition cursor-pointer"
                        bind:value={configModelValue}
                        onchange={handleConfigModelChange}
                      >
                        <option value="">Select model...</option>
                        {#each grouped as [provider, models]}
                          <optgroup label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
                            {#each models as m (m.id)}
                              <option value={m.id} disabled={m.status === 'unavailable' || m.status === 'error'}>
                                {m.status === 'available' ? '✅' : m.status === 'quota_exceeded' ? '⏳' : m.status === 'unavailable' ? '❌' : '⚪'} {m.label || m.id}
                              </option>
                            {/each}
                          </optgroup>
                        {/each}
                      </select>
                      <ChevronDown class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>✅ {availableCount} available</span>
                      {#if quotaCount > 0}<span>⏳ {quotaCount} cooldown</span>{/if}
                      {#if unavailableCount > 0}<span>❌ {unavailableCount} unavailable</span>{/if}
                      <span class="text-muted-foreground/60">— {providerCount} provider{providerCount > 1 ? 's' : ''}</span>
                    </div>
                  {:else if configModelsError}
                    <p class="text-sm text-red-400">{configModelsError}</p>
                  {:else}
                    <p class="text-sm text-muted-foreground">No models discovered for this adapter.</p>
                  {/if}

                  <!-- Test result details -->
                  {#if configModelTestLoading}
                    <div class="mt-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                      <div class="flex items-center gap-2">
                        <Loader2 size={14} class="animate-spin" />
                        <span>Sending PING to <span class="font-mono font-medium">{configModelValue}</span>...</span>
                      </div>
                    </div>
                  {:else if configModelTestResult}
                    <div class="mt-3 rounded-lg border px-4 py-3 text-xs space-y-2 {configModelTestResult.status === 'pass' ? 'border-green-500/20 bg-green-500/5 text-green-700' : configModelTestResult.status === 'warn' ? 'border-amber-500/20 bg-amber-500/5 text-amber-600' : 'border-red-500/20 bg-red-500/5 text-red-500'}">
                      <div class="flex items-center justify-between">
                        <span class="font-semibold">
                          {configModelTestResult.status === 'pass' ? '✅ Model responded successfully' : configModelTestResult.status === 'warn' ? '⏳ Model in cooldown' : '❌ Model unavailable'}
                        </span>
                        <span class="opacity-60">{new Date(configModelTestResult.testedAt).toLocaleTimeString()}</span>
                      </div>
                      {#each configModelTestResult.checks as check}
                        {#if check.code?.includes('model_test') || check.code?.includes('quota') || check.code?.includes('unavailable') || check.code?.includes('subscription')}
                          <div class="rounded-md border border-current/10 bg-white/40 dark:bg-white/5 px-3 py-2">
                            <p>{check.message}</p>
                            {#if check.detail}
                              <p class="mt-1 font-mono opacity-70 break-all">{check.detail}</p>
                            {/if}
                            {#if check.hint}
                              <p class="mt-1 opacity-80 italic">{check.hint}</p>
                            {/if}
                          </div>
                        {/if}
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Adapter info summary -->
              <Card>
                <CardHeader><CardTitle>Adapter Details</CardTitle></CardHeader>
                <CardContent>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p class="text-[#94A3B8] text-xs mb-1">Adapter Type</p>
                      <p class="font-medium">{adapterLabel(agent.adapterType)}</p>
                    </div>
                    {#if agent.adapterConfig?.cwd}
                      <div>
                        <p class="text-[#94A3B8] text-xs mb-1">Working Directory</p>
                        <p class="font-mono text-xs break-all">{agent.adapterConfig.cwd}</p>
                      </div>
                    {/if}
                    {#if agent.adapterConfig?.effort || agent.adapterConfig?.modelReasoningEffort || agent.adapterConfig?.thinking}
                      <div>
                        <p class="text-[#94A3B8] text-xs mb-1">Effort / Reasoning</p>
                        <p class="font-medium capitalize">{agent.adapterConfig?.effort ?? agent.adapterConfig?.modelReasoningEffort ?? agent.adapterConfig?.thinking}</p>
                      </div>
                    {/if}
                    {#if agent.adapterConfig?.instructionsBundleMode}
                      <div>
                        <p class="text-[#94A3B8] text-xs mb-1">Instructions Mode</p>
                        <p class="font-medium capitalize">{agent.adapterConfig.instructionsBundleMode}</p>
                      </div>
                    {/if}
                  </div>
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

          <!-- ── Delegations Tab ─────────────────────────────────────── -->
          <TabsContent value="delegations">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium text-foreground">Delegations</h3>
                <Button size="sm" onclick={() => { showDelegateForm = !showDelegateForm; if (showDelegateForm) loadCompanyAgentsForDelegate(); }}>
                  <Plus class="h-3.5 w-3.5" />
                  New Delegation
                </Button>
              </div>

              {#if showDelegateForm}
                <Card>
                  <CardContent class="pt-5">
                    <form onsubmit={(e) => { e.preventDefault(); createDelegation(); }} class="space-y-3">
                      <div>
                        <label for="delegate-to" class="block text-xs font-medium text-foreground mb-1">Delegate To</label>
                        <select id="delegate-to" bind:value={delegateForm.toAgentId} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none">
                          <option value="">Select agent...</option>
                          {#each companyAgents as a}
                            <option value={a.id}>{a.name} ({a.role})</option>
                          {/each}
                        </select>
                      </div>
                      <div>
                        <label for="delegate-type" class="block text-xs font-medium text-foreground mb-1">Type</label>
                        <select id="delegate-type" bind:value={delegateForm.delegationType} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none">
                          <option value="task">Task</option>
                          <option value="review">Review</option>
                          <option value="consultation">Consultation</option>
                          <option value="escalation">Escalation</option>
                        </select>
                      </div>
                      <div>
                        <label for="delegate-instructions" class="block text-xs font-medium text-foreground mb-1">Instructions</label>
                        <textarea id="delegate-instructions" bind:value={delegateForm.instructions} rows="3" placeholder="What do you need from this agent?" class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none resize-none"></textarea>
                      </div>
                      <div class="flex items-center gap-2">
                        <Button type="submit" size="sm" disabled={delegateCreating || !delegateForm.toAgentId || !delegateForm.instructions.trim()}>
                          {delegateCreating ? 'Creating...' : 'Create Delegation'}
                        </Button>
                        <Button variant="outline" size="sm" type="button" onclick={() => (showDelegateForm = false)}>Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              {/if}

              {#if delegationsLoading}
                <div class="text-center py-8 text-sm text-muted-foreground">Loading delegations...</div>
              {:else if delegations.length === 0}
                <Card>
                  <CardContent class="p-8 text-center">
                    <p class="text-sm text-muted-foreground">No delegations yet</p>
                    <p class="text-xs text-muted-foreground/60 mt-1">Create a delegation to assign work to other agents.</p>
                  </CardContent>
                </Card>
              {:else}
                <div class="glass-card overflow-hidden font-card">
                  <div class="flex items-center border-b border-border/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span class="min-w-0 flex-1">Instructions</span>
                    <span class="w-[80px] shrink-0">Type</span>
                    <span class="w-[80px] shrink-0">Status</span>
                    <span class="w-[100px] shrink-0">From / To</span>
                    <span class="w-[100px] shrink-0 text-right">Actions</span>
                  </div>
                  {#each delegations as d}
                    {@const del = d.delegation ?? d}
                    {@const isIncoming = del.toAgentId === agentId}
                    {@const statusColors: Record<string, string> = { pending: '#f59e0b', accepted: '#3b82f6', rejected: '#ef4444', completed: '#10b981', cancelled: '#6b7280' }}
                    <div class="flex items-center border-b border-border/30 px-4 py-3 text-sm last:border-b-0">
                      <div class="min-w-0 flex-1">
                        <span class="text-foreground truncate block">{del.instructions?.slice(0, 80)}{del.instructions?.length > 80 ? '...' : ''}</span>
                        {#if del.result}
                          <span class="text-xs text-muted-foreground/60 truncate block mt-0.5">Result: {del.result.slice(0, 60)}</span>
                        {/if}
                      </div>
                      <span class="w-[80px] shrink-0">
                        <Badge variant="outline" class="text-[10px]">{del.delegationType}</Badge>
                      </span>
                      <span class="w-[80px] shrink-0">
                        <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white" style="background-color: {statusColors[del.status] ?? '#6b7280'}">
                          {del.status}
                        </span>
                      </span>
                      <span class="w-[100px] shrink-0 text-xs text-muted-foreground">
                        {#if isIncoming}
                          <span class="text-blue-400">← {d.fromAgentName ?? 'Agent'}</span>
                        {:else}
                          <span class="text-green-400">→ {d.toAgentName ?? 'Agent'}</span>
                        {/if}
                      </span>
                      <span class="w-[100px] shrink-0 flex items-center justify-end gap-1">
                        {#if isIncoming && del.status === 'pending'}
                          <Button size="sm" variant="outline" class="h-6 px-2 text-[10px]" onclick={() => handleDelegationAction(del.id, 'accept')}>Accept</Button>
                          <Button size="sm" variant="outline" class="h-6 px-2 text-[10px] text-red-400" onclick={() => handleDelegationAction(del.id, 'reject', { reason: 'Rejected by agent' })}>Reject</Button>
                        {:else if isIncoming && del.status === 'accepted'}
                          <Button size="sm" variant="outline" class="h-6 px-2 text-[10px] text-green-400" onclick={() => handleDelegationAction(del.id, 'complete', { result: 'Completed' })}>Complete</Button>
                        {:else if !isIncoming && del.status === 'pending'}
                          <Button size="sm" variant="outline" class="h-6 px-2 text-[10px]" onclick={() => handleDelegationAction(del.id, 'escalate')}>Escalate</Button>
                        {/if}
                      </span>
                    </div>
                  {/each}
                </div>
                <p class="mt-2 text-right text-xs text-muted-foreground/60">{delegations.length} delegation{delegations.length === 1 ? '' : 's'}</p>
              {/if}
            </div>
          </TabsContent>

          <!-- ── Hooks Tab ─────────────────────────────────────── -->
          <TabsContent value="hooks">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium text-foreground">Hooks</h3>
                <Button size="sm" onclick={() => { if (showHookForm && !editingHookId) { showHookForm = false; } else { resetHookForm(); showHookForm = true; } if (showHookForm) loadCompanyAgentsForDelegate(); }}>
                  <Plus class="h-3.5 w-3.5" />
                  New Hook
                </Button>
              </div>

              {#if showHookForm}
                <Card>
                  <CardContent class="pt-5">
                    <form onsubmit={(e) => { e.preventDefault(); createOrUpdateHook(); }} class="space-y-3">
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label for="hook-name" class="block text-xs font-medium text-foreground mb-1">Name</label>
                          <input id="hook-name" type="text" bind:value={hookForm.name} placeholder="My hook" class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none" />
                        </div>
                        <div>
                          <label for="hook-event" class="block text-xs font-medium text-foreground mb-1">Event</label>
                          <select id="hook-event" bind:value={hookForm.event} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none">
                            {#each HOOK_EVENTS as ev}
                              <option value={ev}>{ev}</option>
                            {/each}
                          </select>
                        </div>
                        <div>
                          <label for="hook-type" class="block text-xs font-medium text-foreground mb-1">Hook Type</label>
                          <select id="hook-type" bind:value={hookForm.hookType} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none">
                            {#each HOOK_TYPES as ht}
                              <option value={ht}>{ht.replace('_', ' ')}</option>
                            {/each}
                          </select>
                        </div>
                        <div>
                          <label for="hook-priority" class="block text-xs font-medium text-foreground mb-1">Priority</label>
                          <input id="hook-priority" type="number" bind:value={hookForm.priority} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none" />
                        </div>
                      </div>

                      <!-- Hook type specific config -->
                      {#if hookForm.hookType === 'webhook'}
                        <div class="space-y-2 rounded-lg border border-border/50 p-3">
                          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Webhook Config</p>
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label for="hook-wh-url" class="block text-xs text-muted-foreground mb-1">URL</label>
                              <input id="hook-wh-url" type="url" bind:value={hookConfigWebhook.url} placeholder="https://..." class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none" />
                            </div>
                            <div>
                              <label for="hook-wh-method" class="block text-xs text-muted-foreground mb-1">Method</label>
                              <select id="hook-wh-method" bind:value={hookConfigWebhook.method} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none">
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                                <option value="PUT">PUT</option>
                                <option value="PATCH">PATCH</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label for="hook-wh-headers" class="block text-xs text-muted-foreground mb-1">Headers (JSON)</label>
                            <textarea id="hook-wh-headers" bind:value={hookConfigWebhook.headers} rows="2" placeholder={'{"Authorization": "Bearer ..."}'} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground font-mono focus:border-blue-500 focus:outline-none resize-none"></textarea>
                          </div>
                        </div>
                      {:else if hookForm.hookType === 'wake_agent'}
                        <div class="space-y-2 rounded-lg border border-border/50 p-3">
                          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wake Agent Config</p>
                          <div>
                            <label for="hook-wa-agent" class="block text-xs text-muted-foreground mb-1">Target Agent</label>
                            <select id="hook-wa-agent" bind:value={hookConfigWakeAgent.targetAgentId} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none">
                              <option value="">Select agent...</option>
                              {#each companyAgents as a}
                                <option value={a.id}>{a.name} ({a.role})</option>
                              {/each}
                            </select>
                          </div>
                        </div>
                      {:else if hookForm.hookType === 'create_issue'}
                        <div class="space-y-2 rounded-lg border border-border/50 p-3">
                          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Create Issue Config</p>
                          <div>
                            <label for="hook-ci-title" class="block text-xs text-muted-foreground mb-1">Issue Title</label>
                            <input id="hook-ci-title" type="text" bind:value={hookConfigCreateIssue.title} placeholder="Issue title template" class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none" />
                          </div>
                          <div>
                            <label for="hook-ci-desc" class="block text-xs text-muted-foreground mb-1">Description</label>
                            <textarea id="hook-ci-desc" bind:value={hookConfigCreateIssue.description} rows="2" placeholder="Issue description..." class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none resize-none"></textarea>
                          </div>
                          <div>
                            <label for="hook-ci-project" class="block text-xs text-muted-foreground mb-1">Project ID (optional)</label>
                            <input id="hook-ci-project" type="text" bind:value={hookConfigCreateIssue.projectId} placeholder="project-uuid" class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none" />
                          </div>
                        </div>
                      {:else if hookForm.hookType === 'notify_channel'}
                        <div class="space-y-2 rounded-lg border border-border/50 p-3">
                          <p class="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notify Channel Config</p>
                          <div>
                            <label for="hook-nc-channel" class="block text-xs text-muted-foreground mb-1">Channel ID</label>
                            <input id="hook-nc-channel" type="text" bind:value={hookConfigNotifyChannel.channelId} placeholder="channel-uuid" class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none" />
                          </div>
                          <div>
                            <label for="hook-nc-msg" class="block text-xs text-muted-foreground mb-1">Message Template</label>
                            <textarea id="hook-nc-msg" bind:value={hookConfigNotifyChannel.messageTemplate} rows="2" placeholder={"Hook triggered: {{event}}"} class="w-full rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none resize-none"></textarea>
                          </div>
                        </div>
                      {/if}

                      <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 text-xs text-foreground">
                          <input type="checkbox" bind:checked={hookForm.enabled} class="rounded border-border" />
                          Enabled
                        </label>
                        <label class="flex items-center gap-2 text-xs text-foreground">
                          <input type="checkbox" bind:checked={hookForm.runAsync} class="rounded border-border" />
                          Run Async
                        </label>
                        <div class="flex items-center gap-1">
                          <label for="hook-retry" class="text-xs text-muted-foreground">Retry Count</label>
                          <input id="hook-retry" type="number" min="0" max="10" bind:value={hookForm.retryCount} class="w-16 rounded-lg border border-border bg-accent/60 px-2 py-1 text-xs text-foreground focus:border-blue-500 focus:outline-none" />
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <Button type="submit" size="sm" disabled={hookCreating || !hookForm.name.trim()}>
                          {hookCreating ? 'Saving...' : editingHookId ? 'Update Hook' : 'Create Hook'}
                        </Button>
                        <Button variant="outline" size="sm" type="button" onclick={() => { showHookForm = false; resetHookForm(); }}>Cancel</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              {/if}

              {#if hooksLoading}
                <div class="text-center py-8 text-sm text-muted-foreground">Loading hooks...</div>
              {:else if hooks.length === 0}
                <Card>
                  <CardContent class="p-8 text-center">
                    <Webhook class="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p class="text-sm text-muted-foreground">No hooks yet</p>
                    <p class="text-xs text-muted-foreground/60 mt-1">Create a hook to automate actions when events occur.</p>
                  </CardContent>
                </Card>
              {:else}
                <div class="glass-card overflow-hidden font-card">
                  <div class="flex items-center border-b border-border/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span class="min-w-0 flex-1">Name</span>
                    <span class="w-[120px] shrink-0">Event</span>
                    <span class="w-[100px] shrink-0">Type</span>
                    <span class="w-[60px] shrink-0 text-center">Active</span>
                    <span class="w-[50px] shrink-0 text-center">Pri</span>
                    <span class="w-[160px] shrink-0 text-right">Actions</span>
                  </div>
                  {#each hooks as hook}
                    <div class="border-b border-border/30 last:border-b-0">
                      <div class="flex items-center px-4 py-3 text-sm">
                        <div class="min-w-0 flex-1 flex items-center gap-2">
                          <button type="button" onclick={() => toggleHookRuns(hook.id)} class="text-muted-foreground hover:text-foreground transition-colors">
                            {#if hookExpandedRuns[hook.id]}
                              <ChevronDown class="h-3.5 w-3.5" />
                            {:else}
                              <ChevronRight class="h-3.5 w-3.5" />
                            {/if}
                          </button>
                          <span class="text-foreground truncate">{hook.name}</span>
                        </div>
                        <span class="w-[120px] shrink-0">
                          <Badge variant="secondary" class="text-[10px]">{hook.event}</Badge>
                        </span>
                        <span class="w-[100px] shrink-0">
                          <Badge variant="outline" class="text-[10px]">{hook.hookType?.replace('_', ' ')}</Badge>
                        </span>
                        <span class="w-[60px] shrink-0 text-center">
                          <button
                            type="button"
                            onclick={() => toggleHookEnabled(hook)}
                            class="inline-flex items-center justify-center h-5 w-9 rounded-full text-xs font-bold uppercase transition-colors {hook.enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/40 text-muted-foreground'}"
                          >
                            {hook.enabled ? 'ON' : 'OFF'}
                          </button>
                        </span>
                        <span class="w-[50px] shrink-0 text-center text-xs text-muted-foreground tabular-nums">{hook.priority ?? 0}</span>
                        <span class="w-[160px] shrink-0 flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" class="h-6 px-2 text-[10px]" onclick={() => testHook(hook)}>
                            <TestTube2 class="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" class="h-6 px-2 text-[10px]" onclick={() => startEditHook(hook)}>
                            <Pencil class="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" class="h-6 px-2 text-[10px] text-red-400" onclick={() => deleteHook(hook)}>
                            <Trash2 class="h-3 w-3" />
                          </Button>
                        </span>
                      </div>

                      <!-- Expandable runs section -->
                      {#if hookExpandedRuns[hook.id]}
                        <div class="bg-accent/30 border-t border-border/30 px-6 py-3">
                          {#if hookRunsLoading[hook.id]}
                            <p class="text-xs text-muted-foreground">Loading runs...</p>
                          {:else if !hookRuns[hook.id] || hookRuns[hook.id].length === 0}
                            <p class="text-xs text-muted-foreground">No runs recorded yet.</p>
                          {:else}
                            <table class="w-full text-xs">
                              <thead>
                                <tr class="text-muted-foreground/70">
                                  <th class="text-left py-1 pr-3">Status</th>
                                  <th class="text-left py-1 pr-3">Event</th>
                                  <th class="text-right py-1 pr-3">Attempt</th>
                                  <th class="text-right py-1 pr-3">Duration</th>
                                  <th class="text-right py-1">Started</th>
                                </tr>
                              </thead>
                              <tbody>
                                {#each hookRuns[hook.id] as run}
                                  {@const statusColors: Record<string, string> = { success: '#10b981', failed: '#ef4444', running: '#3b82f6', pending: '#f59e0b' }}
                                  <tr class="border-t border-border/20">
                                    <td class="py-1.5 pr-3">
                                      <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style="background-color: {statusColors[run.status] ?? '#6b7280'}">
                                        {run.status}
                                      </span>
                                    </td>
                                    <td class="py-1.5 pr-3 text-foreground">{run.event ?? '-'}</td>
                                    <td class="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{run.attempt ?? 1}</td>
                                    <td class="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{run.durationMs != null ? `${run.durationMs}ms` : '-'}</td>
                                    <td class="py-1.5 text-right text-muted-foreground">{run.startedAt ? new Date(run.startedAt).toLocaleString() : '-'}</td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
                <p class="mt-2 text-right text-xs text-muted-foreground/60">{hooks.length} hook{hooks.length === 1 ? '' : 's'}</p>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="cron-jobs">
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-medium text-foreground">Cron Jobs</h3>
              </div>

              {#if routinesLoading}
                <div class="text-center py-8 text-sm text-muted-foreground">Loading cron jobs...</div>
              {:else if routines.length === 0}
                <Card>
                  <CardContent class="p-8 text-center">
                    <Clock class="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p class="text-sm text-muted-foreground">No cron jobs assigned to this agent</p>
                    <p class="text-xs text-muted-foreground/60 mt-1">Routines with cron triggers will appear here</p>
                  </CardContent>
                </Card>
              {:else}
                <div class="glass-card overflow-hidden font-card">
                  <div class="flex items-center border-b border-border/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span class="min-w-0 flex-1">Title</span>
                    <span class="w-[90px] shrink-0 text-center">Status</span>
                    <span class="w-[80px] shrink-0 text-center">Priority</span>
                    <span class="w-[120px] shrink-0">Concurrency</span>
                    <span class="w-[80px] shrink-0 text-center">Triggers</span>
                  </div>
                  {#each routines as routine}
                    {@const statusColors: Record<string, string> = { active: 'bg-green-500/20 text-green-400', paused: 'bg-yellow-500/20 text-yellow-400', archived: 'bg-zinc-700/40 text-muted-foreground' }}
                    {@const priorityColors: Record<string, string> = { critical: 'bg-red-500/20 text-red-400', high: 'bg-orange-500/20 text-orange-400', medium: 'bg-blue-500/20 text-blue-400', low: 'bg-zinc-700/40 text-muted-foreground' }}
                    <div class="border-b border-border/30 last:border-b-0">
                      <div class="flex items-center px-4 py-3 text-sm">
                        <div class="min-w-0 flex-1 flex items-center gap-2">
                          <button type="button" onclick={() => toggleRoutineRuns(routine.id)} class="text-muted-foreground hover:text-foreground transition-colors">
                            {#if routineExpandedRuns[routine.id]}
                              <ChevronDown class="h-3.5 w-3.5" />
                            {:else}
                              <ChevronRight class="h-3.5 w-3.5" />
                            {/if}
                          </button>
                          <div class="min-w-0">
                            <span class="text-foreground truncate block">{routine.title || routine.name || 'Untitled'}</span>
                            {#if routine.description}
                              <span class="text-xs text-muted-foreground truncate block">{routine.description}</span>
                            {/if}
                          </div>
                        </div>
                        <span class="w-[90px] shrink-0 text-center">
                          <Badge variant="secondary" class="text-[10px] {statusColors[routine.status] ?? ''}">{routine.status ?? 'active'}</Badge>
                        </span>
                        <span class="w-[80px] shrink-0 text-center">
                          <Badge variant="outline" class="text-[10px] {priorityColors[routine.priority] ?? ''}">{routine.priority ?? 'medium'}</Badge>
                        </span>
                        <span class="w-[120px] shrink-0 text-xs text-muted-foreground">{routine.concurrencyPolicy ?? 'allow'}</span>
                        <span class="w-[80px] shrink-0 text-center text-xs text-muted-foreground tabular-nums">{routine.triggers?.length ?? 0}</span>
                      </div>

                      <!-- Triggers detail -->
                      {#if routine.triggers && routine.triggers.length > 0}
                        <div class="px-10 pb-3">
                          {#each routine.triggers as trigger}
                            <div class="flex items-center gap-3 text-xs py-1 border-t border-border/20 first:border-t-0">
                              <Clock class="h-3 w-3 text-muted-foreground/60 shrink-0" />
                              <span class="font-mono text-foreground">{trigger.cronExpression ?? '-'}</span>
                              {#if trigger.humanReadable}
                                <span class="text-muted-foreground">({trigger.humanReadable})</span>
                              {/if}
                              {#if trigger.timezone}
                                <span class="text-muted-foreground">{trigger.timezone}</span>
                              {/if}
                              <span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase {trigger.enabled !== false ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/40 text-muted-foreground'}">
                                {trigger.enabled !== false ? 'ON' : 'OFF'}
                              </span>
                              {#if trigger.nextRunAt}
                                <span class="text-muted-foreground ml-auto">next: {new Date(trigger.nextRunAt).toLocaleString()}</span>
                              {/if}
                              {#if trigger.lastFiredAt}
                                <span class="text-muted-foreground">last: {new Date(trigger.lastFiredAt).toLocaleString()}</span>
                              {/if}
                            </div>
                          {/each}
                        </div>
                      {/if}

                      <!-- Expandable runs section -->
                      {#if routineExpandedRuns[routine.id]}
                        <div class="bg-accent/30 border-t border-border/30 px-6 py-3">
                          {#if routineRunsLoading[routine.id]}
                            <p class="text-xs text-muted-foreground">Loading runs...</p>
                          {:else if !routineRuns[routine.id] || routineRuns[routine.id].length === 0}
                            <p class="text-xs text-muted-foreground">No runs recorded yet.</p>
                          {:else}
                            <table class="w-full text-xs">
                              <thead>
                                <tr class="text-muted-foreground/70">
                                  <th class="text-left py-1 pr-3">Status</th>
                                  <th class="text-left py-1 pr-3">Source</th>
                                  <th class="text-right py-1 pr-3">Triggered</th>
                                  <th class="text-right py-1 pr-3">Completed</th>
                                  <th class="text-left py-1">Failure</th>
                                </tr>
                              </thead>
                              <tbody>
                                {#each routineRuns[routine.id] as run}
                                  {@const runStatusColors: Record<string, string> = { received: '#f59e0b', enqueued: '#f59e0b', running: '#3b82f6', succeeded: '#10b981', failed: '#ef4444' }}
                                  <tr class="border-t border-border/20">
                                    <td class="py-1.5 pr-3">
                                      <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white" style="background-color: {runStatusColors[run.status] ?? '#6b7280'}">
                                        {run.status}
                                      </span>
                                    </td>
                                    <td class="py-1.5 pr-3 text-foreground">{run.source ?? '-'}</td>
                                    <td class="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{run.triggeredAt ? new Date(run.triggeredAt).toLocaleString() : '-'}</td>
                                    <td class="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{run.completedAt ? new Date(run.completedAt).toLocaleString() : '-'}</td>
                                    <td class="py-1.5 text-red-400 truncate max-w-[200px]">{run.failureReason ?? ''}</td>
                                  </tr>
                                {/each}
                              </tbody>
                            </table>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
                <p class="mt-2 text-right text-xs text-muted-foreground/60">{routines.length} routine{routines.length === 1 ? '' : 's'}</p>
              {/if}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status"><StatusBadge status={agent.status} /></PropertyRow>
        <Separator />
        <PropertyRow label="Role"><span class="capitalize">{agent.role}</span></PropertyRow>
        <Separator />
        <PropertyRow label="Layer">
          <Badge variant="outline" class="text-[10px] uppercase tracking-wider">
            {agentLayer}
          </Badge>
        </PropertyRow>
        {#if hierarchyPresetDefinition}
          <Separator />
          <PropertyRow label="Hierarchy preset">
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">{hierarchyPresetDefinition.label}</p>
              <p class="text-xs text-muted-foreground">{hierarchyPresetDefinition.fit}</p>
            </div>
          </PropertyRow>
          <Separator />
          <PropertyRow label="Departments">
            <div class="flex flex-wrap gap-1.5">
              {#each hierarchyPresetDepartments as department}
                <Badge variant="outline" class="text-[10px] uppercase tracking-wider">
                  {department.label}
                </Badge>
              {/each}
            </div>
          </PropertyRow>
          <Separator />
          <PropertyRow label="Operating rules">
            <div class="space-y-2">
              {#each hierarchyPresetOperatingRules as rule}
                <div class="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <p class="text-xs font-medium text-foreground">{rule.title}</p>
                  <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">{rule.description}</p>
                </div>
              {/each}
            </div>
          </PropertyRow>
        {/if}
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
</PageLayout>
