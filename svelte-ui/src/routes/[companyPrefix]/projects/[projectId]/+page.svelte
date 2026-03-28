<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
  import { Pencil, Trash2, Plus, X } from "lucide-svelte";
  import { onMount } from "svelte";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
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
    isPrimary?: boolean;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const PROJECT_STATUSES = ["backlog", "active", "paused", "completed", "archived"];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let project = $state<Project | null>(null);
  let issues = $state<Issue[]>([]);
  let goals = $state<Goal[]>([]);
  let workspaces = $state<Workspace[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("issues");

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
  let creatingWorkspace = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let projectId = $derived($page.params.projectId);
  let companyId = $derived(companyStore.selectedCompanyId);
  let prefix = $derived($page.params.companyPrefix);

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
      const allGoals = res.ok ? ((await res.json()) as Goal[]) ?? [] : [];
      const projectGoalIds = new Set([
        ...(project?.goalIds ?? []),
        ...(project?.goalId ? [project.goalId] : []),
      ]);
      goals = projectGoalIds.size > 0 ? allGoals.filter((g) => projectGoalIds.has(g.id)) : [];
    } catch {
      goals = [];
    }
  }

  async function loadWorkspaces() {
    if (!projectId) return;
    try {
      const res = await api(`/api/projects/${projectId}/workspaces`);
      workspaces = res.ok ? ((await res.json()) as Workspace[]) ?? [] : [];
    } catch {
      workspaces = [];
    }
  }

  onMount(async () => {
    await loadProject();
    loadIssues();
    loadGoals();
    loadWorkspaces();
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
    if (!newWsName.trim()) return;
    creatingWorkspace = true;
    try {
      const res = await api(`/api/projects/${projectId}/workspaces`, {
        method: "POST",
        body: JSON.stringify({ name: newWsName.trim(), cwd: newWsCwd.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Workspace created", tone: "success" });
      showCreateWorkspace = false;
      newWsName = "";
      newWsCwd = "";
      await loadWorkspaces();
    } catch (err: any) {
      toastStore.push({ title: "Failed to create workspace", body: err?.message, tone: "error" });
    } finally {
      creatingWorkspace = false;
    }
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
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
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
        {:else}
          <div class="flex items-center gap-3 mb-1">
            <h1 class="text-xl font-semibold truncate">{project.name}</h1>
            {#if project.status}
              <StatusBadge status={project.status} />
            {/if}
            {#if project.archivedAt}
              <Badge variant="secondary">Archived</Badge>
            {/if}
          </div>
          {#if project.shortname}
            <p class="text-xs font-mono text-zinc-500 dark:text-zinc-400">{project.shortname}</p>
          {/if}
          {#if project.description}
            <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{project.description}</p>
          {/if}
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
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
                        <div class="flex items-center gap-2">
                          <Button size="sm" onclick={createWorkspace} disabled={creatingWorkspace || !newWsName.trim()}>
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

              {#if workspaces.length === 0 && !showCreateWorkspace}
                <EmptyState title="No workspaces" description="No execution workspaces configured for this project." icon="🗂" />
              {:else if workspaces.length > 0}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each workspaces as ws}
                    <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="font-medium truncate">{ws.name ?? "Workspace"}</p>
                          {#if ws.isPrimary}
                            <Badge variant="outline" class="text-xs">Primary</Badge>
                          {/if}
                        </div>
                        {#if ws.cwd}
                          <p class="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{ws.cwd}</p>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>
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
  </div>
{/if}
