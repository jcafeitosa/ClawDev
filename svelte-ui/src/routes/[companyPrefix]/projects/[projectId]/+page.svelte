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
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
  import { Pencil, Trash2, Plus, X } from "lucide-svelte";
  import { onMount } from "svelte";

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
  let activeTab = $state("issues");
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

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let projectId = $derived($page.params.projectId);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);
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
      const res = await api(`/api/projects/${projectId}/workspaces`);
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
      const res = await api(`/api/projects/${projectId}`, {
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
      const res = await api(`/api/projects/${projectId}`, { method: "DELETE" });
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
      const res = await api(`/api/projects/${projectId}/workspaces`, {
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
      const res = await api(`/api/projects/${projectId}/workspaces/${workspaceId}`, {
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
      const res = await api(`/api/projects/${projectId}/workspaces/${workspaceId}`, {
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
      const res = await api(`/api/projects/${projectId}/workspaces/${workspaceId}`, { method: "DELETE" });
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
        const res = await api(`/api/projects/${projectId}/workspaces/${primary.id}`, { method: "DELETE" });
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
      const res = await api(`/api/projects/${projectId}/workspaces/${primary.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return;
    }
    const res = await api(`/api/projects/${projectId}/workspaces`, {
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
      const projectRes = await api(`/api/projects/${projectId}`, {
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
        {#if project.status}
          <StatusBadge status={project.status} />
        {/if}
        {#if project.archivedAt}
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
          <label for="edit-name" class="block text-xs font-medium text-zinc-400 mb-1">Name</label>
          <input
            id="edit-name"
            type="text"
            bind:value={editName}
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="edit-status" class="block text-xs font-medium text-zinc-400 mb-1">Status</label>
          <select
            id="edit-status"
            bind:value={editStatus}
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 capitalize focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {#each PROJECT_STATUSES as s}
              <option value={s} class="capitalize">{s}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="edit-target-date" class="block text-xs font-medium text-zinc-400 mb-1">Target Date</label>
          <input
            id="edit-target-date"
            type="date"
            bind:value={editTargetDate}
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

    <div class="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div class="mb-3">
        <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Plugin launchers</p>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">Contextual actions contributed by installed plugins.</p>
      </div>
      {#snippet noProjectLaunchers()}
        <div class="text-sm text-zinc-500 dark:text-zinc-400">No project launchers installed.</div>
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
            <TabsTrigger value="issues">Issues ({issues.length})</TabsTrigger>
            <TabsTrigger value="goals">Goals ({goals.length})</TabsTrigger>
            <TabsTrigger value="workspaces">Workspaces ({workspaces.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            {#each pluginDetailTabs as tab (tab.id)}
              <TabsTrigger value={`plugin:${tab.pluginId}:${tab.id}`}>{tab.label}</TabsTrigger>
            {/each}
          </TabsList>

          <TabsContent value="issues">
            <div class="mt-4">
              <!-- Status summary -->
              {#if issues.length > 0}
                {@const counts = statusCounts()}
                <div class="flex flex-wrap gap-2 mb-4">
                  {#each Object.entries(counts) as [status, count]}
                    <div class="flex items-center gap-1.5 text-xs">
                      <StatusBadge {status} />
                      <span class="text-zinc-600 dark:text-zinc-400">{count}</span>
                    </div>
                  {/each}
                </div>
              {/if}

              {#if issues.length === 0}
                <EmptyState title="No issues" description="No issues are linked to this project yet." icon="📋" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each issues as issue}
                    <a
                      href="/{prefix}/issues/{issue.id}"
                      class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <PriorityIcon priority={issue.priority} />
                        <StatusBadge status={issue.status} />
                        {#if issue.identifier}
                          <span class="text-xs font-mono text-zinc-500 shrink-0">{issue.identifier}</span>
                        {/if}
                        <span class="truncate">{issue.title}</span>
                      </div>
                      <TimeAgo date={issue.updatedAt} class="text-xs shrink-0" />
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="goals">
            <div class="mt-4">
              {#if goals.length === 0}
                <EmptyState title="No goals linked" description="No goals are linked to this project." icon="🎯" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each goals as goal}
                    <a
                      href="/{prefix}/goals/{goal.id}"
                      class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
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
                          <label for="ws-name" class="block text-xs font-medium text-zinc-400 mb-1">Name</label>
                          <input
                            id="ws-name"
                            type="text"
                            bind:value={newWsName}
                            placeholder="e.g. frontend-workspace"
                            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label for="ws-cwd" class="block text-xs font-medium text-zinc-400 mb-1">Working Directory (CWD)</label>
                          <input
                            id="ws-cwd"
                            type="text"
                            bind:value={newWsCwd}
                            placeholder="/path/to/project"
                            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-mono text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label for="ws-repo-url" class="block text-xs font-medium text-zinc-400 mb-1">Repo URL</label>
                          <input
                            id="ws-repo-url"
                            type="text"
                            bind:value={newWsRepoUrl}
                            placeholder="https://github.com/org/repo"
                            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <label class="flex items-center gap-2 text-xs text-zinc-400">
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
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each workspaces as ws}
                    <div class="p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      {#if editingWorkspaceId === ws.id}
                        <div class="space-y-3">
                          <div>
                            <label for={`workspace-name-${ws.id}`} class="block text-xs font-medium text-zinc-400 mb-1">Name</label>
                            <input
                              id={`workspace-name-${ws.id}`}
                              type="text"
                              bind:value={editWsName}
                              class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label for={`workspace-cwd-${ws.id}`} class="block text-xs font-medium text-zinc-400 mb-1">CWD</label>
                            <input
                              id={`workspace-cwd-${ws.id}`}
                              type="text"
                              bind:value={editWsCwd}
                              class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-mono text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div>
                            <label for={`workspace-repo-${ws.id}`} class="block text-xs font-medium text-zinc-400 mb-1">Repo URL</label>
                            <input
                              id={`workspace-repo-${ws.id}`}
                              type="text"
                              bind:value={editWsRepoUrl}
                              class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <label class="flex items-center gap-2 text-xs text-zinc-400">
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
                              <p class="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{ws.cwd}</p>
                            {/if}
                            {#if ws.repoUrl}
                              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{ws.repoUrl}</p>
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
                    <label for="project-description" class="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                    <textarea
                      id="project-description"
                      bind:value={settingsDescription}
                      rows="3"
                      class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    ></textarea>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label for="project-status" class="block text-xs font-medium text-zinc-400 mb-1">Status</label>
                      <select
                        id="project-status"
                        bind:value={settingsStatus}
                        class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 capitalize focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        {#each PROJECT_STATUSES as s}
                          <option value={s}>{s}</option>
                        {/each}
                      </select>
                    </div>
                    <div>
                      <label for="project-target-date" class="block text-xs font-medium text-zinc-400 mb-1">Target Date</label>
                      <input
                        id="project-target-date"
                        type="date"
                        bind:value={settingsTargetDate}
                        class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <label for="project-repo-url" class="block text-xs font-medium text-zinc-400 mb-1">Repo URL</label>
                    <input
                      id="project-repo-url"
                      type="text"
                      bind:value={settingsRepoUrl}
                      placeholder="https://github.com/org/repo"
                      class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label for="project-local-folder" class="block text-xs font-medium text-zinc-400 mb-1">Local Folder</label>
                    <input
                      id="project-local-folder"
                      type="text"
                      bind:value={settingsLocalFolder}
                      placeholder="/absolute/path/to/workspace"
                      class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-mono text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {#if project.codebase?.effectiveLocalFolder}
                      <p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Effective folder: {project.codebase.effectiveLocalFolder}</p>
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
                        <span class="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs">
                          <a href="/{prefix}/goals/{goal.id}" class="hover:underline">{goal.title}</a>
                          <button class="text-zinc-400 hover:text-zinc-100" onclick={() => unlinkGoal(goal.id)} aria-label="Remove goal">
                            <X class="size-3" />
                          </button>
                        </span>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-xs text-zinc-500 dark:text-zinc-400">No linked goals.</p>
                  {/if}
                  <div class="flex gap-2">
                    <select
                      id="project-goal-select"
                      bind:value={settingsGoalToAdd}
                      class="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                    <label for="project-policy-default-mode" class="block text-xs font-medium text-zinc-400 mb-1">Default Mode</label>
                    <select
                      id="project-policy-default-mode"
                      bind:value={policyDefaultMode}
                      class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {#each EXECUTION_WORKSPACE_DEFAULT_MODES as mode}
                        <option value={mode}>{mode}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label for="project-policy-base-ref" class="block text-xs font-medium text-zinc-400 mb-1">Base Ref</label>
                      <input id="project-policy-base-ref" type="text" bind:value={policyBaseRef} class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label for="project-policy-branch-template" class="block text-xs font-medium text-zinc-400 mb-1">Branch Template</label>
                      <input id="project-policy-branch-template" type="text" bind:value={policyBranchTemplate} class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                      <label for="project-policy-worktree-parent-dir" class="block text-xs font-medium text-zinc-400 mb-1">Worktree Parent Dir</label>
                      <input id="project-policy-worktree-parent-dir" type="text" bind:value={policyWorktreeParentDir} class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  </div>
                  <div>
                    <label for="project-policy-provision-command" class="block text-xs font-medium text-zinc-400 mb-1">Provision Command</label>
                    <input id="project-policy-provision-command" type="text" bind:value={policyProvisionCommand} class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label for="project-policy-teardown-command" class="block text-xs font-medium text-zinc-400 mb-1">Teardown Command</label>
                    <input id="project-policy-teardown-command" type="text" bind:value={policyTeardownCommand} class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
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
                  <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{tab.label}</p>
                  <p class="text-xs text-zinc-500 dark:text-zinc-400">Plugin-contributed project detail tab.</p>
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
