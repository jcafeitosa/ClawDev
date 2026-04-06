<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { pluginUiContributionsStore } from "$stores/plugin-ui-contributions.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PluginLauncherOutlet, PluginRenderer } from "$lib/components/plugins/index.js";
  import { PageLayout } from "$components/layout/index.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Input } from "$components/ui/index.js";
  import { Pencil, Trash2, Plus, X, List, LayoutGrid, ChevronRight, Search } from "lucide-svelte";
  import { ISSUE_STATUS_ORDER, ISSUE_STATUS_VISUALS } from '$lib/constants/visual';
  import KanbanBoard from '$lib/components/board/kanban-board.svelte';
  import { onMount } from "svelte";
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    type HierarchyPreset,
  } from "@clawdev/shared";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface ProjectExecutionWorkspacePolicy {
    enabled: boolean;
    defaultMode?: "shared_workspace" | "isolated_workspace" | "operator_branch" | "adapter_default" | null;
    allowIssueOverride?: boolean;
    defaultProjectWorkspaceId?: string | null;
    workspaceStrategy?: {
      type?: "project_primary" | "git_worktree" | "adapter_managed" | "cloud_sandbox";
      baseRef?: string | null;
      branchTemplate?: string | null;
      worktreeParentDir?: string | null;
      provisionCommand?: string | null;
      teardownCommand?: string | null;
    } | null;
    [key: string]: unknown;
  }

  interface Project {
    id: string;
    name: string;
    shortname?: string;
    description?: string | null;
    status?: string;
    companyId: string;
    goalId?: string | null;
    goalIds?: string[];
    targetDate?: string | null;
    archivedAt?: string | null;
    executionWorkspacePolicy?: ProjectExecutionWorkspacePolicy | null;
    codebase?: {
      repoUrl?: string | null;
      localFolder?: string | null;
      effectiveLocalFolder?: string;
      origin?: "local_folder" | "managed_checkout";
    };
    primaryWorkspace?: Workspace | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface Issue {
    id: string;
    identifier?: string;
    title: string;
    status: string;
    priority?: string | null;
    assigneeAgentId?: string | null;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface Goal {
    id: string;
    title: string;
    status: string;
    level?: string;
    [key: string]: unknown;
  }

  interface Workspace {
    id: string;
    name?: string;
    cwd?: string;
    repoUrl?: string | null;
    repoRef?: string | null;
    sourceType?: string;
    isPrimary?: boolean;
    [key: string]: unknown;
  }

  interface PluginDetailTab {
    id: string;
    pluginId: string;
    label: string;
    routePath: string | null;
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const PROJECT_STATUSES = ["backlog", "planned", "in_progress", "completed", "cancelled"];
  const EXECUTION_WORKSPACE_DEFAULT_MODES = ["shared_workspace", "isolated_workspace", "operator_branch", "adapter_default"];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let project = $state<Project | null>(null);
  let issues = $state<Issue[]>([]);
  let goals = $state<Goal[]>([]);
  let allGoals = $state<Goal[]>([]);
  let workspaces = $state<Workspace[]>([]);
  let pluginDetailTabs = $state<PluginDetailTab[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("overview");
  let workspacesLoading = $state(false);
  let workspacesLoadError = $state<string | null>(null);
  let pluginTabsLoading = $state(false);
  let pluginTabsLoadError = $state<string | null>(null);

  // Edit form state
  let editing = $state(false);
  let editName = $state("");
  let editStatus = $state("");
  let editTargetDate = $state("");
  let saving = $state(false);

  // Delete state
  let confirmDelete = $state(false);
  let deleting = $state(false);

  // Create workspace form state
  let showCreateWorkspace = $state(false);
  let newWsName = $state("");
  let newWsCwd = $state("");
  let newWsRepoUrl = $state("");
  let newWsPrimary = $state(false);
  let creatingWorkspace = $state(false);
  let editingWorkspaceId = $state<string | null>(null);
  let editWsName = $state("");
  let editWsCwd = $state("");
  let editWsRepoUrl = $state("");
  let editWsPrimary = $state(false);
  let savingWorkspaceId = $state<string | null>(null);
  let deletingWorkspaceId = $state<string | null>(null);

  // Settings tab state
  let settingsDescription = $state("");
  let settingsStatus = $state("backlog");
  let settingsTargetDate = $state("");
  let settingsGoalToAdd = $state("");
  let settingsRepoUrl = $state("");
  let settingsLocalFolder = $state("");
  let policyEnabled = $state(false);
  let policyDefaultMode = $state("shared_workspace");
  let policyBaseRef = $state("");
  let policyBranchTemplate = $state("");
  let policyWorktreeParentDir = $state("");
  let policyProvisionCommand = $state("");
  let policyTeardownCommand = $state("");
  let savingSettings = $state(false);

  // Issues view state
  let issueViewMode = $state<'list' | 'board'>('list');
  let issueSearchQuery = $state('');
  let issueGroupBy = $state<'status' | 'none'>('status');
  let collapsedGroups = $state<string[]>([]);

  // Status filter chips
  let activeStatusFilters = $state<string[]>([]);

  // Inline add issue state (list view)
  let addingInGroup = $state<string | null>(null);
  let newIssueTitleList = $state('');
  let newIssueTitleListInput = $state<HTMLInputElement | null>(null);
  let creatingIssueList = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let projectId = $derived($page.params.projectId);
  /** Resolved UUID — prefers loaded project.id over URL param (which may be a slug like "onboarding") */
  let projectUuid = $derived(project?.id ?? projectId);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);
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
  const SDD_FLOW = [
    { key: "spec", label: "Spec", description: "Define scope, constraints, and acceptance criteria." },
    { key: "design", label: "Design", description: "Map the solution, dependencies, and UX/architecture." },
    { key: "decompose", label: "Decompose", description: "Split work into safe, single-owner tasks." },
    { key: "validate", label: "Validate", description: "Review risks, tests, and failure modes before coding." },
    { key: "implement", label: "Implement", description: "Ship the smallest safe change and verify it." },
  ] as const;
  let projectPluginHostContext = $derived({
    companyId,
    companyPrefix: prefix ?? null,
    projectId: (project?.id ?? projectId) ?? null,
    entityId: (project?.id ?? projectId) ?? null,
    entityType: "project",
    parentEntityId: null,
    userId: null,
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadProject() {
    if (!projectId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/projects/${projectId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      project = (await res.json()) as Project;
      breadcrumbStore.set([
        { label: "Projects", href: `/${prefix}/projects` },
        { label: project.name },
      ]);
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: "Failed to load project", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadIssues() {
    if (!projectId || !companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/issues?projectId=${projectId}`);
      issues = res.ok ? ((await res.json()) as Issue[]) ?? [] : [];
    } catch {
      issues = [];
    }
  }

  async function loadGoals() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/goals`);
      allGoals = res.ok ? ((await res.json()) as Goal[]) ?? [] : [];
      const projectGoalIds = new Set([
        ...(project?.goalIds ?? []),
        ...(project?.goalId ? [project.goalId] : []),
      ]);
      goals = projectGoalIds.size > 0 ? allGoals.filter((g) => projectGoalIds.has(g.id)) : [];
    } catch {
      allGoals = [];
      goals = [];
    }
  }

  async function loadWorkspaces() {
    if (!projectId) return;
    workspacesLoading = true;
    workspacesLoadError = null;
    try {
      const res = await api(`/api/projects/${projectUuid}/workspaces`);
      if (!res.ok) throw new Error(await res.text());
      workspaces = ((await res.json()) as Workspace[]) ?? [];
    } catch {
      workspaces = [];
      workspacesLoadError = "Failed to load workspaces";
    } finally {
      workspacesLoading = false;
    }
  }

  async function loadPluginDetailTabs() {
    pluginTabsLoading = true;
    pluginTabsLoadError = null;
    try {
      const contributions = await pluginUiContributionsStore.load();
      const tabs: PluginDetailTab[] = [];
      for (const contribution of contributions ?? []) {
        for (const slot of contribution.slots ?? []) {
          if (slot.type !== "detailTab") continue;
          tabs.push({
            id: slot.id,
            pluginId: contribution.pluginId,
            label: slot.displayName ?? contribution.displayName ?? contribution.pluginKey ?? contribution.pluginId,
            routePath: slot.routePath ?? null,
          });
        }
      }
      tabs.sort((a, b) => {
        const labelCmp = a.label.localeCompare(b.label);
        if (labelCmp !== 0) return labelCmp;
        return a.id.localeCompare(b.id);
      });
      pluginDetailTabs = tabs;
    } catch (err: any) {
      pluginDetailTabs = [];
      pluginTabsLoadError = err?.message ?? "Failed to load plugin tabs";
    } finally {
      pluginTabsLoading = false;
    }
  }

  onMount(async () => {
    await loadProject();
    await Promise.all([loadIssues(), loadGoals(), loadWorkspaces(), loadPluginDetailTabs()]);
  });

  $effect(() => {
    if (!project) return;
    settingsDescription = project.description ?? "";
    settingsStatus = project.status ?? "backlog";
    settingsTargetDate = project.targetDate ? project.targetDate.slice(0, 10) : "";
    settingsRepoUrl = project.codebase?.repoUrl ?? "";
    settingsLocalFolder = project.codebase?.localFolder ?? "";
    const policy = project.executionWorkspacePolicy;
    policyEnabled = policy?.enabled === true;
    policyDefaultMode = policy?.defaultMode ?? "shared_workspace";
    policyBaseRef = policy?.workspaceStrategy?.baseRef ?? "";
    policyBranchTemplate = policy?.workspaceStrategy?.branchTemplate ?? "";
    policyWorktreeParentDir = policy?.workspaceStrategy?.worktreeParentDir ?? "";
    policyProvisionCommand = policy?.workspaceStrategy?.provisionCommand ?? "";
    policyTeardownCommand = policy?.workspaceStrategy?.teardownCommand ?? "";
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function startEditing() {
    if (!project) return;
    editName = project.name;
    editStatus = project.status ?? "backlog";
    editTargetDate = project.targetDate ? project.targetDate.slice(0, 10) : "";
    editing = true;
  }

  function cancelEditing() {
    editing = false;
  }

  async function saveProject() {
    if (!project || !editName.trim()) return;
    saving = true;
    try {
      const body: Record<string, unknown> = {
        name: editName.trim(),
        status: editStatus,
      };
      if (editTargetDate) {
        body.targetDate = new Date(editTargetDate).toISOString();
      } else {
        body.targetDate = null;
      }
      const res = await api(`/api/projects/${projectUuid}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Project;
      project = updated;
      editing = false;
      toastStore.push({ title: "Project updated", tone: "success" });
      breadcrumbStore.set([
        { label: "Projects", href: `/${prefix}/projects` },
        { label: updated.name },
      ]);
    } catch (err: any) {
      toastStore.push({ title: "Failed to update project", body: err?.message, tone: "error" });
    } finally {
      saving = false;
    }
  }

  async function deleteProject() {
    deleting = true;
    try {
      const res = await api(`/api/projects/${projectUuid}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Project deleted", tone: "success" });
      goto(`/${prefix}/projects`);
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete project", body: err?.message, tone: "error" });
    } finally {
      deleting = false;
      confirmDelete = false;
    }
  }

  async function createWorkspace() {
    if (!newWsName.trim() || (!newWsCwd.trim() && !newWsRepoUrl.trim())) return;
    creatingWorkspace = true;
    try {
      const body: Record<string, unknown> = {
        name: newWsName.trim(),
        isPrimary: newWsPrimary,
      };
      if (newWsCwd.trim()) body.cwd = newWsCwd.trim();
      if (newWsRepoUrl.trim()) body.repoUrl = newWsRepoUrl.trim();
      const res = await api(`/api/projects/${projectUuid}/workspaces`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Workspace created", tone: "success" });
      showCreateWorkspace = false;
      newWsName = "";
      newWsCwd = "";
      newWsRepoUrl = "";
      newWsPrimary = false;
      await loadWorkspaces();
      await loadProject();
    } catch (err: any) {
      toastStore.push({ title: "Failed to create workspace", body: err?.message, tone: "error" });
    } finally {
      creatingWorkspace = false;
    }
  }

  function startWorkspaceEdit(ws: Workspace) {
    editingWorkspaceId = ws.id;
    editWsName = ws.name ?? "";
    editWsCwd = ws.cwd ?? "";
    editWsRepoUrl = ws.repoUrl ?? "";
    editWsPrimary = ws.isPrimary === true;
  }

  function cancelWorkspaceEdit() {
    editingWorkspaceId = null;
    editWsName = "";
    editWsCwd = "";
    editWsRepoUrl = "";
    editWsPrimary = false;
  }

  async function saveWorkspaceEdit(workspaceId: string) {
    if (!editWsName.trim() || (!editWsCwd.trim() && !editWsRepoUrl.trim())) return;
    savingWorkspaceId = workspaceId;
    try {
      const body: Record<string, unknown> = {
        name: editWsName.trim(),
        isPrimary: editWsPrimary,
      };
      if (editWsCwd.trim()) body.cwd = editWsCwd.trim();
      if (editWsRepoUrl.trim()) body.repoUrl = editWsRepoUrl.trim();
      const res = await api(`/api/projects/${projectUuid}/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Workspace updated", tone: "success" });
      cancelWorkspaceEdit();
      await loadWorkspaces();
      await loadProject();
    } catch (err: any) {
      toastStore.push({ title: "Failed to update workspace", body: err?.message, tone: "error" });
    } finally {
      savingWorkspaceId = null;
    }
  }

  async function makeWorkspacePrimary(workspaceId: string) {
    savingWorkspaceId = workspaceId;
    try {
      const res = await api(`/api/projects/${projectUuid}/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Primary workspace updated", tone: "success" });
      await loadWorkspaces();
      await loadProject();
    } catch (err: any) {
      toastStore.push({ title: "Failed to set primary workspace", body: err?.message, tone: "error" });
    } finally {
      savingWorkspaceId = null;
    }
  }

  async function deleteWorkspace(workspaceId: string) {
    if (!confirm("Delete this workspace?")) return;
    deletingWorkspaceId = workspaceId;
    try {
      const res = await api(`/api/projects/${projectUuid}/workspaces/${workspaceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Workspace deleted", tone: "success" });
      if (editingWorkspaceId === workspaceId) cancelWorkspaceEdit();
      await loadWorkspaces();
      await loadProject();
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete workspace", body: err?.message, tone: "error" });
    } finally {
      deletingWorkspaceId = null;
    }
  }

  async function upsertPrimaryWorkspaceFromCodebase() {
    const primary = project?.primaryWorkspace;
    const cwd = settingsLocalFolder.trim();
    const repoUrl = settingsRepoUrl.trim();
    if (!cwd && !repoUrl) {
      if (primary?.id) {
        const res = await api(`/api/projects/${projectUuid}/workspaces/${primary.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await res.text());
      }
      return;
    }
    const payload: Record<string, unknown> = {
      name: primary?.name ?? project?.name ?? "Workspace",
      isPrimary: true,
      cwd: cwd || null,
      repoUrl: repoUrl || null,
    };
    if (primary?.id) {
      const res = await api(`/api/projects/${projectUuid}/workspaces/${primary.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return;
    }
    const res = await api(`/api/projects/${projectUuid}/workspaces`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  async function saveSettings() {
    if (!project) return;
    savingSettings = true;
    try {
      const nextGoalIds = Array.from(new Set(goals.map((g) => g.id)));
      const projectBody: Record<string, unknown> = {
        description: settingsDescription.trim() || null,
        status: settingsStatus,
        targetDate: settingsTargetDate ? new Date(settingsTargetDate).toISOString() : null,
        goalIds: nextGoalIds,
        executionWorkspacePolicy: {
          enabled: policyEnabled,
          defaultMode: policyDefaultMode,
          allowIssueOverride: true,
          defaultProjectWorkspaceId:
            (project.executionWorkspacePolicy?.defaultProjectWorkspaceId as string | null | undefined) ??
            project.primaryWorkspace?.id ??
            null,
          workspaceStrategy: {
            type: "git_worktree",
            baseRef: policyBaseRef.trim() || null,
            branchTemplate: policyBranchTemplate.trim() || null,
            worktreeParentDir: policyWorktreeParentDir.trim() || null,
            provisionCommand: policyProvisionCommand.trim() || null,
            teardownCommand: policyTeardownCommand.trim() || null,
          },
        },
      };
      const projectRes = await api(`/api/projects/${projectUuid}`, {
        method: "PATCH",
        body: JSON.stringify(projectBody),
      });
      if (!projectRes.ok) throw new Error(await projectRes.text());
      await upsertPrimaryWorkspaceFromCodebase();
      toastStore.push({ title: "Project settings updated", tone: "success" });
      await loadProject();
      await Promise.all([loadGoals(), loadWorkspaces()]);
    } catch (err: any) {
      toastStore.push({ title: "Failed to save settings", body: err?.message, tone: "error" });
    } finally {
      savingSettings = false;
    }
  }

  function unlinkGoal(goalId: string) {
    goals = goals.filter((g) => g.id !== goalId);
  }

  function linkGoal(goalId: string) {
    const existing = new Set(goals.map((g) => g.id));
    if (existing.has(goalId)) return;
    const goal = allGoals.find((g) => g.id === goalId);
    if (!goal) return;
    goals = [...goals, goal];
    settingsGoalToAdd = "";
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const statusCounts = $derived(() => {
    const counts: Record<string, number> = {};
    for (const issue of issues) {
      counts[issue.status] = (counts[issue.status] ?? 0) + 1;
    }
    return counts;
  });

  let doneCount = $derived((statusCounts().done ?? 0) + (statusCounts().cancelled ?? 0));
  let progressPercent = $derived(issues.length > 0 ? Math.round((doneCount / issues.length) * 100) : 0);
  let recentIssues = $derived(
    [...issues]
      .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
      .slice(0, 5)
  );

  let filteredIssues = $derived.by(() => {
    let list = issues;
    if (activeStatusFilters.length > 0) {
      list = list.filter(i => activeStatusFilters.includes(i.status));
    }
    if (issueSearchQuery.trim()) {
      const q = issueSearchQuery.trim().toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || (i.identifier ?? '').toLowerCase().includes(q));
    }
    return list;
  });

  function toggleStatusFilter(status: string) {
    if (activeStatusFilters.includes(status)) {
      activeStatusFilters = activeStatusFilters.filter(s => s !== status);
    } else {
      activeStatusFilters = [...activeStatusFilters, status];
    }
  }

  interface IssueGroup { key: string; label: string; issues: Issue[]; }

  let groupedIssues = $derived.by((): IssueGroup[] => {
    if (issueGroupBy === 'none') {
      return [{ key: '__all', label: 'All', issues: filteredIssues }];
    }
    const map = new Map<string, Issue[]>();
    for (const issue of filteredIssues) {
      const key = issue.status ?? 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    const sorted = [...map.entries()].sort((a, b) => {
      const ai = ISSUE_STATUS_ORDER.indexOf(a[0]);
      const bi = ISSUE_STATUS_ORDER.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    return sorted.map(([key, items]) => ({
      key,
      label: ISSUE_STATUS_VISUALS[key]?.label ?? key,
      issues: items,
    }));
  });

  function toggleIssueGroup(key: string) {
    if (collapsedGroups.includes(key)) {
      collapsedGroups = collapsedGroups.filter(k => k !== key);
    } else {
      collapsedGroups = [...collapsedGroups, key];
    }
  }

  async function handleStatusChange(issueId: string, newStatus: string) {
    if (!companyId) return;
    try {
      await api(`/api/companies/${companyId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      loadIssues();
    } catch { /* ignore */ }
  }

  async function handleCreateIssue(title: string, status: string) {
    if (!companyId || !projectUuid) return;
    const projectName = project?.name ?? "this project";
    const issueSpec = `Implement "${title}" within ${projectName}. Keep the issue scoped to the selected status "${status}".`;
    const issueDesign = `Use the project execution model for ${projectName}. Keep the change small, reviewable, and owned by a single agent.`;
    const issueValidation = `Verify the work satisfies the issue title, the selected project context, and the expected status transition before marking it done.`;
    const res = await api(`/api/companies/${companyId}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        status,
        projectId: projectUuid,
        description: `Quick issue created from ${projectName}.`,
        sddSpec: issueSpec,
        sddDesign: issueDesign,
        sddValidation: issueValidation,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await loadIssues();
  }

  function startAddingInGroup(groupKey: string) {
    addingInGroup = groupKey;
    newIssueTitleList = '';
  }

  function cancelAddingInGroup() {
    addingInGroup = null;
    newIssueTitleList = '';
  }

  $effect(() => {
    if (!addingInGroup || !newIssueTitleListInput) return;
    queueMicrotask(() => {
      newIssueTitleListInput?.focus();
    });
  });

  async function submitNewIssueInGroup(status: string) {
    if (!newIssueTitleList.trim() || creatingIssueList) return;
    creatingIssueList = true;
    try {
      await handleCreateIssue(newIssueTitleList.trim(), status);
      newIssueTitleList = '';
      addingInGroup = null;
    } catch {
      /* keep form open on error */
    } finally {
      creatingIssueList = false;
    }
  }
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={8} />
  </div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Project not found" description="The project you're looking for doesn't exist or you don't have access." icon="📁">
      <a href="/{prefix}/projects" class="text-sm text-primary hover:underline">Back to projects</a>
    </EmptyState>
  </div>
{:else if project}
  <PageLayout title={project.name} description={project.description ?? undefined} fullWidth>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        {#if project!.status}
          <StatusBadge status={project!.status} />
        {/if}
        {#if project!.archivedAt}
          <Badge variant="secondary">Archived</Badge>
        {/if}
        {#if !editing}
          <Button variant="outline" size="sm" onclick={startEditing}>
            <Pencil class="size-3.5 mr-1.5" />
            Edit
          </Button>
          {#if confirmDelete}
            <div class="flex items-center gap-1.5">
              <Button variant="destructive" size="sm" onclick={deleteProject} disabled={deleting}>
                {deleting ? "Deleting..." : "Confirm"}
              </Button>
              <Button variant="ghost" size="sm" onclick={() => (confirmDelete = false)} disabled={deleting}>
                <X class="size-3.5" />
              </Button>
            </div>
          {:else}
            <Button variant="destructive" size="sm" onclick={() => (confirmDelete = true)}>
              <Trash2 class="size-3.5 mr-1.5" />
              Delete
            </Button>
          {/if}
        {/if}
        <Button variant="outline" size="sm" href="/{prefix}/projects">
          Back
        </Button>
      </div>
    {/snippet}

    {#if editing}
      <!-- Edit form -->
      <div class="space-y-3 max-w-lg">
        <div>
          <label for="edit-name" class="block text-xs font-medium text-muted-foreground mb-1">Name</label>
          <input
            id="edit-name"
            type="text"
            bind:value={editName}
            class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="edit-status" class="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select
            id="edit-status"
            bind:value={editStatus}
            class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground capitalize focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {#each PROJECT_STATUSES as s}
              <option value={s} class="capitalize">{s}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="edit-target-date" class="block text-xs font-medium text-muted-foreground mb-1">Target Date</label>
          <input
            id="edit-target-date"
            type="date"
            bind:value={editTargetDate}
            class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div class="flex items-center gap-2 pt-1">
          <Button size="sm" onclick={saveProject} disabled={saving || !editName.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onclick={cancelEditing} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    {/if}

    <div class="mb-6 rounded-xl border border-border bg-card p-4">
      <div class="mb-3">
        <p class="text-sm font-medium text-foreground">Plugin launchers</p>
        <p class="text-xs text-muted-foreground">Contextual actions contributed by installed plugins.</p>
      </div>
      {#snippet noProjectLaunchers()}
        <div class="text-sm text-muted-foreground">No project launchers installed.</div>
      {/snippet}
      <PluginLauncherOutlet
        placementZones={["projectSidebarItem", "detailTab", "toolbarButton", "contextMenuItem"]}
        context={{
          companyId,
          companyPrefix: prefix ?? null,
          projectId: (project?.id ?? projectId) ?? null,
          entityId: (project?.id ?? projectId) ?? null,
          entityType: "project",
          parentEntityId: null,
          userId: null,
        }}
        itemClassName="flex flex-wrap gap-2"
        fallback={noProjectLaunchers}
      />
    </div>

    <!-- Main content + sidebar -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main content area -->
      <div class="flex-1 min-w-0">
        <Tabs bind:value={activeTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
            <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces ({workspaces.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            {#each pluginDetailTabs as tab (tab.id)}
              <TabsTrigger value={`plugin:${tab.pluginId}:${tab.id}`}>{tab.label}</TabsTrigger>
            {/each}
          </TabsList>

          <TabsContent value="overview">
            <div class="mt-4 space-y-5">
              {#if hierarchyPresetDefinition}
                <div class="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
                  <div class="rounded-lg border border-border bg-card p-4">
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hierarchy preset</p>
                        <h3 class="mt-1 text-base font-semibold text-foreground">{hierarchyPresetDefinition.label}</h3>
                        <p class="mt-1 text-sm text-muted-foreground">{hierarchyPresetDefinition.description}</p>
                      </div>
                      <Badge variant="outline" class="text-[10px] uppercase tracking-wider">{hierarchyPresetDefinition.rootTitle}</Badge>
                    </div>
                    <p class="mt-3 text-sm text-foreground/90">{hierarchyPresetDefinition.fit}</p>
                    <div class="mt-4 flex flex-wrap gap-1.5">
                      {#each hierarchyPresetDepartments as department}
                        <Badge variant="secondary" class="text-[10px] uppercase tracking-wider">{department.label}</Badge>
                      {/each}
                    </div>
                  </div>

                  <div class="rounded-lg border border-border bg-card p-4">
                    <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SDD flow</p>
                    <div class="mt-3 space-y-2">
                      {#each SDD_FLOW as step, index}
                        <div class="flex gap-3 rounded-md border border-border/60 bg-background/60 p-3">
                          <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </div>
                          <div>
                            <p class="text-sm font-medium text-foreground">{step.label}</p>
                            <p class="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                </div>

                <div class="rounded-lg border border-border bg-card p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating rules</p>
                      <p class="mt-1 text-sm text-foreground">These guardrails apply to planning, decomposition, and implementation.</p>
                    </div>
                    <Badge variant="outline" class="text-[10px] uppercase tracking-wider">{hierarchyPresetOperatingRules.length} rules</Badge>
                  </div>
                  <div class="mt-4 grid gap-3 lg:grid-cols-3">
                    {#each hierarchyPresetOperatingRules as rule}
                      <div class="rounded-md border border-border/60 bg-background/60 p-3">
                        <p class="text-sm font-medium text-foreground">{rule.title}</p>
                        <p class="mt-1 text-xs text-muted-foreground">{rule.description}</p>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Stats row -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="rounded-lg border border-border bg-card p-3">
                  <p class="text-xs text-muted-foreground mb-1">Total Issues</p>
                  <p class="text-2xl font-bold tabular-nums">{issues.length}</p>
                </div>
                <div class="rounded-lg border border-border bg-card p-3">
                  <p class="text-xs text-muted-foreground mb-1">Completed</p>
                  <p class="text-2xl font-bold tabular-nums text-emerald-500">{doneCount}</p>
                </div>
                <div class="rounded-lg border border-border bg-card p-3">
                  <p class="text-xs text-muted-foreground mb-1">In Progress</p>
                  <p class="text-2xl font-bold tabular-nums text-amber-500">{statusCounts().in_progress ?? 0}</p>
                </div>
                <div class="rounded-lg border border-border bg-card p-3">
                  <p class="text-xs text-muted-foreground mb-1">To Do</p>
                  <p class="text-2xl font-bold tabular-nums text-blue-500">{statusCounts().todo ?? 0}</p>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="rounded-lg border border-border bg-card p-4">
                <div class="flex items-center justify-between mb-2">
                  <p class="text-sm font-medium">Progress</p>
                  <p class="text-sm font-bold tabular-nums">{progressPercent}%</p>
                </div>
                <div class="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style="width: {progressPercent}%"
                  ></div>
                </div>
                <p class="text-xs text-muted-foreground mt-1.5">
                  {doneCount} of {issues.length} issue{issues.length !== 1 ? 's' : ''} completed
                </p>
              </div>

              <!-- Status breakdown -->
              {#if issues.length > 0}
                {@const counts = statusCounts()}
                <div class="rounded-lg border border-border bg-card p-4">
                  <p class="text-sm font-medium mb-3">Status Breakdown</p>
                  <div class="space-y-2">
                    {#each ISSUE_STATUS_ORDER.filter(s => counts[s]) as status}
                      {@const count = counts[status] ?? 0}
                      {@const pct = Math.round((count / issues.length) * 100)}
                      <div class="flex items-center gap-3">
                        <span class="w-2 h-2 rounded-full shrink-0 {ISSUE_STATUS_VISUALS[status]?.dotClass ?? 'bg-zinc-500'}"></span>
                        <span class="text-xs font-medium w-24 shrink-0">{ISSUE_STATUS_VISUALS[status]?.label ?? status}</span>
                        <div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all duration-300"
                            style="width: {pct}%; background-color: {ISSUE_STATUS_VISUALS[status]?.hex ?? '#64748b'}"
                          ></div>
                        </div>
                        <span class="text-xs text-muted-foreground tabular-nums w-10 text-right">{count}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Recent issues -->
              {#if recentIssues.length > 0}
                <div class="rounded-lg border border-border bg-card p-4">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-sm font-medium">Recent Activity</p>
                    <button
                      type="button"
                      onclick={() => { activeTab = 'issues'; }}
                      class="cursor-pointer text-xs text-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div class="divide-y divide-border">
                    {#each recentIssues as issue (issue.id)}
                      <a
                        href="/{prefix}/issues/{issue.id}"
                        class="flex items-center gap-3 py-2 text-sm hover:bg-accent/30 -mx-2 px-2 rounded transition-colors"
                      >
                        <span class="w-2 h-2 rounded-full shrink-0 {ISSUE_STATUS_VISUALS[issue.status]?.dotClass ?? 'bg-zinc-500'}"></span>
                        {#if issue.identifier}
                          <span class="text-xs font-mono text-muted-foreground shrink-0">{issue.identifier}</span>
                        {/if}
                        <span class="min-w-0 flex-1 truncate">{issue.title}</span>
                        <TimeAgo date={issue.updatedAt} class="text-xs text-muted-foreground shrink-0" />
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Linked goals -->
              {#if goals.length > 0}
                <div class="rounded-lg border border-border bg-card p-4">
                  <div class="flex items-center justify-between mb-3">
                    <p class="text-sm font-medium">Linked Goals</p>
                    <button
                      type="button"
                      onclick={() => { activeTab = 'goals'; }}
                      class="cursor-pointer text-xs text-primary hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div class="divide-y divide-border">
                    {#each goals as goal (goal.id)}
                      <a
                        href="/{prefix}/goals/{goal.id}"
                        class="flex items-center gap-3 py-2 text-sm hover:bg-accent/30 -mx-2 px-2 rounded transition-colors"
                      >
                        <StatusBadge status={goal.status} />
                        <span class="min-w-0 flex-1 truncate">{goal.title}</span>
                        {#if goal.level}
                          <Badge variant="outline" class="text-[10px] capitalize">{goal.level}</Badge>
                        {/if}
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div class="mt-4 space-y-4">
              <!-- Toolbar: View toggle + Search -->
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center border-b border-border">
                  <button
                    onclick={() => { issueViewMode = 'list'; }}
                    class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
                      {issueViewMode === 'list'
                        ? 'border-b-2 border-blue-500 text-foreground'
                        : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
                  >
                    <List class="size-4" />
                    List
                  </button>
                  <button
                    onclick={() => { issueViewMode = 'board'; }}
                    class="cursor-pointer inline-flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-sm font-medium transition-colors
                      {issueViewMode === 'board'
                        ? 'border-b-2 border-blue-500 text-foreground'
                        : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground'}"
                  >
                    <LayoutGrid class="size-4" />
                    Board
                  </button>
                </div>

                <div class="relative">
                  <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search issues..."
                    bind:value={issueSearchQuery}
                    class="w-full sm:w-64 pl-9"
                  />
                </div>
              </div>

              <!-- Status filter chips -->
              {#if issues.length > 0}
                {@const counts = statusCounts()}
                <div class="flex flex-wrap items-center gap-2">
                  {#if activeStatusFilters.length > 0}
                    <button
                      type="button"
                      onclick={() => { activeStatusFilters = []; }}
                      class="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Clear filters
                    </button>
                  {/if}
                  {#each Object.entries(counts) as [status, count]}
                    <button
                      type="button"
                      onclick={() => toggleStatusFilter(status)}
                      class="cursor-pointer flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all border
                        {activeStatusFilters.includes(status)
                          ? (ISSUE_STATUS_VISUALS[status]?.badgeClass ?? '') + ' border-current ring-1 ring-current/20'
                          : activeStatusFilters.length > 0
                            ? 'border-transparent opacity-50 hover:opacity-80 ' + (ISSUE_STATUS_VISUALS[status]?.badgeClass ?? '')
                            : 'border-transparent ' + (ISSUE_STATUS_VISUALS[status]?.badgeClass ?? '')}"
                    >
                      <span class="w-1.5 h-1.5 rounded-full {ISSUE_STATUS_VISUALS[status]?.dotClass ?? 'bg-zinc-500'}"></span>
                      {ISSUE_STATUS_VISUALS[status]?.label ?? status}
                      <span class="font-semibold">{count}</span>
                    </button>
                  {/each}
                </div>
              {/if}

              <!-- Board View -->
              {#if issueViewMode === 'board'}
                {#if filteredIssues.length === 0}
                  <EmptyState title="No issues" description="No issues are linked to this project yet." icon="📋" />
                {:else}
                  <KanbanBoard issues={filteredIssues} prefix={prefix ?? ''} onStatusChange={handleStatusChange} onCreateIssue={handleCreateIssue} />
                {/if}

              <!-- List View -->
              {:else}
                {#if filteredIssues.length === 0}
                  <EmptyState title="No issues" description="No issues are linked to this project yet." icon="📋" />
                {:else}
                  <Card class="p-0 overflow-hidden">
                    <!-- Table header -->
                    <div class="flex items-center border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span class="w-5 shrink-0"></span>
                      <span class="w-20 shrink-0">ID</span>
                      <span class="min-w-0 flex-1">Name</span>
                      <span class="hidden w-[80px] shrink-0 sm:block">Priority</span>
                      <span class="hidden w-[100px] shrink-0 text-right sm:block">Updated</span>
                    </div>

                    {#each groupedIssues as group (group.key)}
                      {#if group.key === '__all'}
                        {#each group.issues as issue (issue.id)}
                          <a
                            href="/{prefix}/issues/{issue.id}"
                            class="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-accent/40 transition-colors border-b border-border/50 last:border-b-0"
                          >
                            <span class="w-2 h-2 rounded-full shrink-0 {ISSUE_STATUS_VISUALS[issue.status]?.dotClass ?? 'bg-zinc-500'}"></span>
                            {#if issue.identifier}
                              <span class="w-20 shrink-0 text-xs font-mono text-muted-foreground truncate">{issue.identifier}</span>
                            {:else}
                              <span class="w-20 shrink-0"></span>
                            {/if}
                            <span class="min-w-0 flex-1 truncate">{issue.title}</span>
                            <span class="hidden sm:block w-[80px] shrink-0">
                              <PriorityIcon priority={issue.priority} />
                            </span>
                            <span class="hidden sm:block w-[100px] shrink-0 text-right">
                              <TimeAgo date={issue.updatedAt} class="text-xs" />
                            </span>
                          </a>
                        {/each}
                      {:else}
                        <!-- Group header -->
                        <button
                          type="button"
                          onclick={() => toggleIssueGroup(group.key)}
                          class="flex items-center gap-2 w-full px-4 py-2 border-b border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <ChevronRight class="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform {collapsedGroups.includes(group.key) ? '' : 'rotate-90'}" />
                          <span class="w-2 h-2 rounded-full shrink-0 {ISSUE_STATUS_VISUALS[group.key]?.dotClass ?? 'bg-zinc-500'}"></span>
                          <span class="text-xs font-semibold uppercase tracking-wide">{group.label}</span>
                          <Badge variant="secondary" class="text-[10px] px-1.5 py-0">{group.issues.length}</Badge>
                        </button>
                        {#if !collapsedGroups.includes(group.key)}
                          {#each group.issues as issue (issue.id)}
                            <a
                              href="/{prefix}/issues/{issue.id}"
                              class="flex items-center gap-3 px-4 py-2.5 pl-10 text-sm hover:bg-accent/40 transition-colors border-b border-border/50 last:border-b-0"
                            >
                              {#if issue.identifier}
                                <span class="w-20 shrink-0 text-xs font-mono text-muted-foreground truncate">{issue.identifier}</span>
                              {:else}
                                <span class="w-20 shrink-0"></span>
                              {/if}
                              <span class="min-w-0 flex-1 truncate">{issue.title}</span>
                              <span class="hidden sm:block w-[80px] shrink-0">
                                <PriorityIcon priority={issue.priority} />
                              </span>
                              <span class="hidden sm:block w-[100px] shrink-0 text-right">
                                <TimeAgo date={issue.updatedAt} class="text-xs" />
                              </span>
                            </a>
                          {/each}
                          <!-- Inline add issue row -->
                          <div class="px-4 py-1.5 pl-10 border-b border-border/50">
                            {#if addingInGroup === group.key}
                              <form
                                onsubmit={(e) => { e.preventDefault(); submitNewIssueInGroup(group.key); }}
                                class="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  bind:this={newIssueTitleListInput}
                                  bind:value={newIssueTitleList}
                                  placeholder="Issue title..."
                                  disabled={creatingIssueList}
                                  class="flex-1 rounded-md border border-border bg-background px-2.5 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                                  onkeydown={(e) => { if (e.key === 'Escape') cancelAddingInGroup(); }}
                                />
                                <button
                                  type="submit"
                                  disabled={creatingIssueList || !newIssueTitleList.trim()}
                                  class="cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                  {creatingIssueList ? 'Adding...' : 'Add'}
                                </button>
                                <button
                                  type="button"
                                  onclick={cancelAddingInGroup}
                                  disabled={creatingIssueList}
                                  class="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              </form>
                            {:else}
                              <button
                                type="button"
                                onclick={() => startAddingInGroup(group.key)}
                                class="cursor-pointer flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                              >
                                <Plus class="size-3.5" />
                                Add issue
                              </button>
                            {/if}
                          </div>
                        {/if}
                      {/if}
                    {/each}
                  </Card>

                  <p class="text-xs text-muted-foreground text-right">
                    {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''}
                  </p>
                {/if}
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <div class="mt-4">
              {#if goals.length === 0}
                <EmptyState title="No goals linked" description="No goals are linked to this project." icon="🎯" />
              {:else}
                <div class="border rounded-lg divide-y divide-border border-border">
                  {#each goals as goal}
                    <a
                      href="/{prefix}/goals/{goal.id}"
                      class="flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={goal.status} />
                        <span class="truncate">{goal.title}</span>
                        {#if goal.level}
                          <Badge variant="outline" class="text-xs capitalize">{goal.level}</Badge>
                        {/if}
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="workspaces">
            <div class="mt-4">
              <!-- Create workspace form -->
              <div class="mb-4">
                {#if showCreateWorkspace}
                  <Card>
                    <CardContent class="pt-4">
                      <div class="space-y-3">
                        <div>
                          <label for="ws-name" class="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                          <input
                            id="ws-name"
                            type="text"
                            bind:value={newWsName}
                            placeholder="e.g. frontend-workspace"
                            class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label for="ws-cwd" class="block text-xs font-medium text-muted-foreground mb-1">Working Directory (CWD)</label>
                          <input
                            id="ws-cwd"
                            type="text"
                            bind:value={newWsCwd}
                            placeholder="/path/to/project"
                            class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label for="ws-repo-url" class="block text-xs font-medium text-muted-foreground mb-1">Repo URL</label>
                          <input
                            id="ws-repo-url"
                            type="text"
                            bind:value={newWsRepoUrl}
                            placeholder="https://github.com/org/repo"
                            class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <label class="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" bind:checked={newWsPrimary} />
                          Set as primary workspace
                        </label>
                        <div class="flex items-center gap-2">
                          <Button
                            size="sm"
                            onclick={createWorkspace}
                            disabled={creatingWorkspace || !newWsName.trim() || (!newWsCwd.trim() && !newWsRepoUrl.trim())}
                          >
                            {creatingWorkspace ? "Creating..." : "Create"}
                          </Button>
                          <Button variant="ghost" size="sm" onclick={() => (showCreateWorkspace = false)} disabled={creatingWorkspace}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                {:else}
                  <Button variant="outline" size="sm" onclick={() => (showCreateWorkspace = true)}>
                    <Plus class="size-3.5 mr-1.5" />
                    Create Workspace
                  </Button>
                {/if}
              </div>

              {#if workspacesLoading}
                <PageSkeleton lines={4} />
              {:else if workspacesLoadError}
                <EmptyState title="Workspace load failed" description={workspacesLoadError} icon="⚠️" />
              {:else if workspaces.length === 0 && !showCreateWorkspace}
                <EmptyState title="No workspaces" description="No execution workspaces configured for this project." icon="🗂" />
              {:else if workspaces.length > 0}
                <div class="border rounded-lg divide-y divide-border border-border">
                  {#each workspaces as ws}
                    <div class="p-3 text-sm hover:bg-muted/50">
                      {#if editingWorkspaceId === ws.id}
                        <div class="space-y-3">
                          <div>
                            <label for={`workspace-name-${ws.id}`} class="block text-xs font-medium text-muted-foreground mb-1">Name</label>
                            <input
                              id={`workspace-name-${ws.id}`}
                              type="text"
                              bind:value={editWsName}
                              class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label for={`workspace-cwd-${ws.id}`} class="block text-xs font-medium text-muted-foreground mb-1">CWD</label>
                            <input
                              id={`workspace-cwd-${ws.id}`}
                              type="text"
                              bind:value={editWsCwd}
                              class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label for={`workspace-repo-${ws.id}`} class="block text-xs font-medium text-muted-foreground mb-1">Repo URL</label>
                            <input
                              id={`workspace-repo-${ws.id}`}
                              type="text"
                              bind:value={editWsRepoUrl}
                              class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <label class="flex items-center gap-2 text-xs text-muted-foreground">
                            <input type="checkbox" bind:checked={editWsPrimary} />
                            Primary workspace
                          </label>
                          <div class="flex items-center gap-2">
                            <Button
                              size="sm"
                              onclick={() => saveWorkspaceEdit(ws.id)}
                              disabled={savingWorkspaceId === ws.id || !editWsName.trim() || (!editWsCwd.trim() && !editWsRepoUrl.trim())}
                            >
                              {savingWorkspaceId === ws.id ? "Saving..." : "Save"}
                            </Button>
                            <Button variant="ghost" size="sm" onclick={cancelWorkspaceEdit} disabled={savingWorkspaceId === ws.id}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      {:else}
                        <div class="flex items-center justify-between gap-3">
                          <div class="min-w-0">
                            <div class="flex items-center gap-2">
                              <p class="font-medium truncate">{ws.name ?? "Workspace"}</p>
                              {#if ws.isPrimary}
                                <Badge variant="outline" class="text-xs">Primary</Badge>
                              {/if}
                              {#if ws.sourceType}
                                <Badge variant="secondary" class="text-xs">{ws.sourceType}</Badge>
                              {/if}
                            </div>
                            {#if ws.cwd}
                              <p class="text-xs font-mono text-muted-foreground mt-0.5 truncate">{ws.cwd}</p>
                            {/if}
                            {#if ws.repoUrl}
                              <p class="text-xs text-muted-foreground mt-0.5 truncate">{ws.repoUrl}</p>
                            {/if}
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            {#if !ws.isPrimary}
                              <Button
                                variant="outline"
                                size="sm"
                                onclick={() => makeWorkspacePrimary(ws.id)}
                                disabled={savingWorkspaceId === ws.id}
                              >
                                Set Primary
                              </Button>
                            {/if}
                            <Button variant="outline" size="sm" onclick={() => startWorkspaceEdit(ws)}>
                              <Pencil class="size-3.5 mr-1.5" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onclick={() => deleteWorkspace(ws.id)}
                              disabled={deletingWorkspaceId === ws.id}
                            >
                              <Trash2 class="size-3.5 mr-1.5" />
                              {deletingWorkspaceId === ws.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div class="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle class="text-base">Project Settings</CardTitle>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div>
                    <label for="project-description" class="block text-xs font-medium text-muted-foreground mb-1">Description</label>
                    <textarea
                      id="project-description"
                      bind:value={settingsDescription}
                      rows="3"
                      class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ></textarea>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label for="project-status" class="block text-xs font-medium text-muted-foreground mb-1">Status</label>
                      <select
                        id="project-status"
                        bind:value={settingsStatus}
                        class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground capitalize focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {#each PROJECT_STATUSES as s}
                          <option value={s}>{s}</option>
                        {/each}
                      </select>
                    </div>
                    <div>
                      <label for="project-target-date" class="block text-xs font-medium text-muted-foreground mb-1">Target Date</label>
                      <input
                        id="project-target-date"
                        type="date"
                        bind:value={settingsTargetDate}
                        class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="text-base">Codebase</CardTitle>
                </CardHeader>
              <CardContent class="space-y-3">
                  <div>
                    <label for="project-repo-url" class="block text-xs font-medium text-muted-foreground mb-1">Repo URL</label>
                    <input
                      id="project-repo-url"
                      type="text"
                      bind:value={settingsRepoUrl}
                      placeholder="https://github.com/org/repo"
                      class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label for="project-local-folder" class="block text-xs font-medium text-muted-foreground mb-1">Local Folder</label>
                    <input
                      id="project-local-folder"
                      type="text"
                      bind:value={settingsLocalFolder}
                      placeholder="/absolute/path/to/workspace"
                      class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {#if project.codebase?.effectiveLocalFolder}
                      <p class="mt-1 text-xs text-muted-foreground">Effective folder: {project.codebase.effectiveLocalFolder}</p>
                    {/if}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="text-base">Goals</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                  {#if goals.length > 0}
                    <div class="flex flex-wrap gap-2">
                      {#each goals as goal}
                        <span class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                          <a href="/{prefix}/goals/{goal.id}" class="hover:underline">{goal.title}</a>
                          <button class="text-muted-foreground hover:text-foreground" onclick={() => unlinkGoal(goal.id)} aria-label="Remove goal">
                            <X class="size-3" />
                          </button>
                        </span>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-xs text-muted-foreground">No linked goals.</p>
                  {/if}
                  <div class="flex gap-2">
                    <select
                      id="project-goal-select"
                      bind:value={settingsGoalToAdd}
                      class="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select a goal</option>
                      {#each allGoals.filter((g) => !goals.some((x) => x.id === g.id)) as g}
                        <option value={g.id}>{g.title}</option>
                      {/each}
                    </select>
                    <Button variant="outline" size="sm" onclick={() => linkGoal(settingsGoalToAdd)} disabled={!settingsGoalToAdd}>
                      Add Goal
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle class="text-base">Execution Workspace Policy</CardTitle>
                </CardHeader>
                <CardContent class="space-y-3">
                  <label class="flex items-center gap-2 text-sm">
                    <input id="project-policy-enabled" type="checkbox" bind:checked={policyEnabled} />
                    Enable isolated execution workspaces
                  </label>
                  <div>
                    <label for="project-policy-default-mode" class="block text-xs font-medium text-muted-foreground mb-1">Default Mode</label>
                    <select
                      id="project-policy-default-mode"
                      bind:value={policyDefaultMode}
                      class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {#each EXECUTION_WORKSPACE_DEFAULT_MODES as mode}
                        <option value={mode}>{mode}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label for="project-policy-base-ref" class="block text-xs font-medium text-muted-foreground mb-1">Base Ref</label>
                      <input id="project-policy-base-ref" type="text" bind:value={policyBaseRef} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label for="project-policy-branch-template" class="block text-xs font-medium text-muted-foreground mb-1">Branch Template</label>
                      <input id="project-policy-branch-template" type="text" bind:value={policyBranchTemplate} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label for="project-policy-worktree-parent-dir" class="block text-xs font-medium text-muted-foreground mb-1">Worktree Parent Dir</label>
                      <input id="project-policy-worktree-parent-dir" type="text" bind:value={policyWorktreeParentDir} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>
                  <div>
                    <label for="project-policy-provision-command" class="block text-xs font-medium text-muted-foreground mb-1">Provision Command</label>
                    <input id="project-policy-provision-command" type="text" bind:value={policyProvisionCommand} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label for="project-policy-teardown-command" class="block text-xs font-medium text-muted-foreground mb-1">Teardown Command</label>
                    <input id="project-policy-teardown-command" type="text" bind:value={policyTeardownCommand} class="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div class="flex items-center gap-2">
                    <Button size="sm" onclick={saveSettings} disabled={savingSettings}>
                      {savingSettings ? "Saving..." : "Save Settings"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {#each pluginDetailTabs as tab (tab.id)}
            <TabsContent value={`plugin:${tab.pluginId}:${tab.id}`}>
              <div class="mt-4 space-y-3">
                <div>
                  <p class="text-sm font-medium text-foreground">{tab.label}</p>
                  <p class="text-xs text-muted-foreground">Plugin-contributed project detail tab.</p>
                </div>
                <PluginRenderer
                  pluginId={tab.pluginId}
                  view="detailTab"
                  context={projectPluginHostContext}
                  routePath={tab.routePath}
                />
              </div>
            </TabsContent>
          {/each}
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        {#if project.status}
          <PropertyRow label="Status">
            <StatusBadge status={project.status} />
          </PropertyRow>
          <Separator />
        {/if}
        {#if project.targetDate}
          <PropertyRow label="Target date">
            <span class="text-sm">{new Date(project.targetDate).toLocaleDateString()}</span>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Issues">
          <span class="font-medium">{issues.length}</span>
        </PropertyRow>
        <Separator />
        {#if hierarchyPresetDefinition}
          <PropertyRow label="Hierarchy preset">
            <div class="space-y-1">
              <p class="text-sm font-medium text-foreground">{hierarchyPresetDefinition.label}</p>
              <p class="text-xs text-muted-foreground">{hierarchyPresetDefinition.rootSubtitle}</p>
            </div>
          </PropertyRow>
          <Separator />
          <PropertyRow label="Departments">
            <div class="flex flex-wrap gap-1.5">
              {#each hierarchyPresetDepartments as department}
                <Badge variant="outline" class="text-[10px] uppercase tracking-wider">{department.label}</Badge>
              {/each}
            </div>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Goals">
          <span class="font-medium">{goals.length}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Created">
          <TimeAgo date={project.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={project.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{project.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </PageLayout>
{/if}
