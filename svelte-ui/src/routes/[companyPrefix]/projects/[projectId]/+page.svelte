<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
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
  // State
  // ---------------------------------------------------------------------------
  let project = $state<Project | null>(null);
  let issues = $state<Issue[]>([]);
  let goals = $state<Goal[]>([]);
  let workspaces = $state<Workspace[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("issues");

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let projectId = $derived($page.params.projectId);
  let companyId = $derived(companyStore.selectedCompanyId);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadProject() {
    if (!projectId) return;
    loading = true;
    notFound = false;
    try {
      const result = await (api as any).api.projects({ id: projectId }).get();
      project = unwrap(result) as Project;
      breadcrumbStore.set([
        { label: "Projects", href: `/${$page.params.companyPrefix}/projects` },
        { label: project.name },
      ]);
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.status === 404) {
        notFound = true;
      } else {
        toastStore.push({ title: "Failed to load project", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadIssues() {
    if (!projectId || !companyId) return;
    try {
      const result = await (api as any).api.companies({ companyId }).issues.get({ query: { projectId } });
      issues = (unwrap(result) as Issue[]) ?? [];
    } catch {
      issues = [];
    }
  }

  async function loadGoals() {
    if (!companyId) return;
    try {
      const result = await (api as any).api.companies({ companyId }).goals.get();
      const allGoals = (unwrap(result) as Goal[]) ?? [];
      // Filter goals linked to this project
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
      const result = await (api as any).api.projects({ id: projectId }).workspaces.get();
      workspaces = (unwrap(result) as Workspace[]) ?? [];
    } catch {
      workspaces = [];
    }
  }

  onMount(async () => {
    await loadProject();
    // Load secondary data after project is loaded (need companyId from project)
    loadIssues();
    loadGoals();
    loadWorkspaces();
  });

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
      <a href="/{$page.params.companyPrefix}/projects" class="text-sm text-primary hover:underline">Back to projects</a>
    </EmptyState>
  </div>
{:else if project}
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
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
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/projects">
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
                      href="/{$page.params.companyPrefix}/issues/{issue.id}"
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
                      href="/{$page.params.companyPrefix}/goals/{goal.id}"
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
              {#if workspaces.length === 0}
                <EmptyState title="No workspaces" description="No execution workspaces configured for this project." icon="🗂" />
              {:else}
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
