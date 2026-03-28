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
  interface Goal {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    level?: string | null;
    progress?: number | null;
    parentId?: string | null;
    companyId: string;
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
    goalId?: string | null;
    updatedAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let goal = $state<Goal | null>(null);
  let allGoals = $state<Goal[]>([]);
  let linkedIssues = $state<Issue[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("overview");

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let goalId = $derived($page.params.goalId);
  let companyId = $derived(companyStore.selectedCompanyId);
  let childGoals = $derived(allGoals.filter((g) => g.parentId === goalId));
  let parentGoal = $derived(goal?.parentId ? allGoals.find((g) => g.id === goal!.parentId) ?? null : null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadGoal() {
    if (!goalId) return;
    loading = true;
    notFound = false;
    try {
      const result = await (api as any).api.goals({ id: goalId }).get();
      goal = unwrap(result) as Goal;
      breadcrumbStore.set([
        { label: "Goals", href: `/${$page.params.companyPrefix}/goals` },
        { label: goal.title },
      ]);
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.status === 404) {
        notFound = true;
      } else {
        toastStore.push({ title: "Failed to load goal", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadAllGoals() {
    if (!companyId) return;
    try {
      const result = await (api as any).api.companies({ companyId }).goals.get();
      allGoals = (unwrap(result) as Goal[]) ?? [];
    } catch {
      allGoals = [];
    }
  }

  async function loadLinkedIssues() {
    if (!companyId || !goalId) return;
    try {
      // Issues API doesn't have goalId filter, so we fetch all and filter client-side
      const result = await (api as any).api.companies({ companyId }).issues.get();
      const all = (unwrap(result) as Issue[]) ?? [];
      linkedIssues = all.filter((i) => i.goalId === goalId);
    } catch {
      linkedIssues = [];
    }
  }

  onMount(async () => {
    await loadGoal();
    loadAllGoals();
    loadLinkedIssues();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function progressPercent(val: number | null | undefined): string {
    if (val == null) return "0%";
    return `${Math.round(val * 100)}%`;
  }
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={6} />
  </div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Goal not found" description="The goal you're looking for doesn't exist or you don't have access." icon="🎯">
      <a href="/{$page.params.companyPrefix}/goals" class="text-sm text-primary hover:underline">Back to goals</a>
    </EmptyState>
  </div>
{:else if goal}
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-semibold truncate">{goal.title}</h1>
          <StatusBadge status={goal.status} />
          {#if goal.level}
            <Badge variant="outline" class="capitalize">{goal.level}</Badge>
          {/if}
        </div>
        {#if goal.description}
          <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{goal.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/goals">
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
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="children">Child Goals ({childGoals.length})</TabsTrigger>
            <TabsTrigger value="issues">Linked Issues ({linkedIssues.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div class="space-y-6 mt-4">
              <!-- Progress -->
              <Card>
                <CardHeader>
                  <CardTitle>Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div class="space-y-3">
                    <div class="flex items-center justify-between text-sm">
                      <span class="text-zinc-500 dark:text-zinc-400">Overall progress</span>
                      <span class="font-medium">{progressPercent(goal.progress)}</span>
                    </div>
                    <div class="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2.5">
                      <div
                        class="bg-primary h-2.5 rounded-full transition-all"
                        style="width: {progressPercent(goal.progress)}"
                      ></div>
                    </div>
                    <div class="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>{childGoals.length} child goal{childGoals.length !== 1 ? "s" : ""}</span>
                      <span>{linkedIssues.length} linked issue{linkedIssues.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <!-- Description -->
              {#if goal.description}
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {goal.description}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Parent Goal -->
              {#if parentGoal}
                <Card>
                  <CardHeader>
                    <CardTitle>Parent Goal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <a
                      href="/{$page.params.companyPrefix}/goals/{parentGoal.id}"
                      class="flex items-center gap-3 text-sm hover:text-primary transition-colors"
                    >
                      <StatusBadge status={parentGoal.status} />
                      <span>{parentGoal.title}</span>
                      {#if parentGoal.level}
                        <Badge variant="outline" class="text-xs capitalize">{parentGoal.level}</Badge>
                      {/if}
                    </a>
                  </CardContent>
                </Card>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="children">
            <div class="mt-4">
              {#if childGoals.length === 0}
                <EmptyState title="No child goals" description="This goal has no sub-goals." icon="🌱" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each childGoals as child}
                    <a
                      href="/{$page.params.companyPrefix}/goals/{child.id}"
                      class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={child.status} />
                        <span class="truncate">{child.title}</span>
                        {#if child.level}
                          <Badge variant="outline" class="text-xs capitalize">{child.level}</Badge>
                        {/if}
                      </div>
                      {#if child.progress != null}
                        <span class="text-xs text-zinc-500 shrink-0">{progressPercent(child.progress)}</span>
                      {/if}
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div class="mt-4">
              {#if linkedIssues.length === 0}
                <EmptyState title="No linked issues" description="No issues are linked to this goal." icon="📋" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each linkedIssues as issue}
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
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status">
          <StatusBadge status={goal.status} />
        </PropertyRow>
        <Separator />
        {#if goal.level}
          <PropertyRow label="Level">
            <span class="capitalize">{goal.level}</span>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Progress">
          <span class="font-medium">{progressPercent(goal.progress)}</span>
        </PropertyRow>
        <Separator />
        {#if parentGoal}
          <PropertyRow label="Parent">
            <a href="/{$page.params.companyPrefix}/goals/{parentGoal.id}" class="text-primary hover:underline text-sm">
              {parentGoal.title}
            </a>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Child goals">
          <span class="font-medium">{childGoals.length}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Linked issues">
          <span class="font-medium">{linkedIssues.length}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Created">
          <TimeAgo date={goal.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={goal.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{goal.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </div>
{/if}
