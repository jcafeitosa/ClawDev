<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageLayout } from "$components/layout/index.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent } from "$components/ui/index.js";
  import { Pencil, Trash2, X } from "lucide-svelte";
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
  // Constants
  // ---------------------------------------------------------------------------
  const GOAL_STATUSES = ["planned", "active", "completed", "archived"];
  const GOAL_LEVELS = ["task", "quarter", "annual"];

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let goal = $state<Goal | null>(null);
  let allGoals = $state<Goal[]>([]);
  let linkedIssues = $state<Issue[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("overview");

  // Edit form state
  let editing = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editStatus = $state("");
  let editLevel = $state("");
  let saving = $state(false);

  // Delete state
  let confirmDelete = $state(false);
  let deleting = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let goalId = $derived($page.params.goalId);
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);
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
      const res = await api(`/api/goals/${goalId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      goal = (await res.json()) as Goal;
      breadcrumbStore.set([
        { label: "Goals", href: `/${prefix}/goals` },
        { label: goal.title },
      ]);
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: "Failed to load goal", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadAllGoals() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/goals`);
      allGoals = res.ok ? ((await res.json()) as Goal[]) ?? [] : [];
    } catch {
      allGoals = [];
    }
  }

  async function loadLinkedIssues() {
    if (!companyId || !goalId) return;
    try {
      const res = await api(`/api/companies/${companyId}/issues`);
      const all = res.ok ? ((await res.json()) as Issue[]) ?? [] : [];
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
  // Actions
  // ---------------------------------------------------------------------------
  function startEditing() {
    if (!goal) return;
    editTitle = goal.title;
    editDescription = goal.description ?? "";
    editStatus = goal.status ?? "planned";
    editLevel = goal.level ?? "task";
    editing = true;
  }

  function cancelEditing() {
    editing = false;
  }

  async function saveGoal() {
    if (!goal || !editTitle.trim()) return;
    saving = true;
    try {
      const body: Record<string, unknown> = {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        status: editStatus,
        level: editLevel,
      };
      const res = await api(`/api/goals/${goalId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = (await res.json()) as Goal;
      goal = updated;
      editing = false;
      toastStore.push({ title: "Goal updated", tone: "success" });
      breadcrumbStore.set([
        { label: "Goals", href: `/${prefix}/goals` },
        { label: updated.title },
      ]);
    } catch (err: any) {
      toastStore.push({ title: "Failed to update goal", body: err?.message, tone: "error" });
    } finally {
      saving = false;
    }
  }

  async function deleteGoal() {
    deleting = true;
    try {
      const res = await api(`/api/goals/${goalId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Goal deleted", tone: "success" });
      goto(`/${prefix}/goals`);
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete goal", body: err?.message, tone: "error" });
    } finally {
      deleting = false;
      confirmDelete = false;
    }
  }

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
      <a href="/{prefix}/goals" class="text-sm text-primary hover:underline">Back to goals</a>
    </EmptyState>
  </div>
{:else if goal}
  <PageLayout title={goal.title} fullWidth>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <StatusBadge status={goal.status} />
        {#if goal.level}
          <Badge variant="outline" class="capitalize">{goal.level}</Badge>
        {/if}
        {#if !editing}
          <Button variant="outline" size="sm" onclick={startEditing}>
            <Pencil class="size-3.5 mr-1.5" />
            Edit
          </Button>
          {#if confirmDelete}
            <div class="flex items-center gap-1.5">
              <Button variant="destructive" size="sm" onclick={deleteGoal} disabled={deleting}>
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
        <Button variant="outline" size="sm" href="/{prefix}/goals">
          Back
        </Button>
      </div>
    {/snippet}

    {#if editing}
      <!-- Edit form -->
      <div class="space-y-3 max-w-lg">
        <div>
          <label for="edit-title" class="block text-xs font-medium text-zinc-400 mb-1">Title</label>
          <input
            id="edit-title"
            type="text"
            bind:value={editTitle}
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label for="edit-description" class="block text-xs font-medium text-zinc-400 mb-1">Description</label>
          <textarea
            id="edit-description"
            bind:value={editDescription}
            rows="3"
            class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
          ></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="edit-status" class="block text-xs font-medium text-zinc-400 mb-1">Status</label>
            <select
              id="edit-status"
              bind:value={editStatus}
              class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 capitalize focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {#each GOAL_STATUSES as s}
                <option value={s} class="capitalize">{s}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="edit-level" class="block text-xs font-medium text-zinc-400 mb-1">Level</label>
            <select
              id="edit-level"
              bind:value={editLevel}
              class="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 capitalize focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {#each GOAL_LEVELS as l}
                <option value={l} class="capitalize">{l}</option>
              {/each}
            </select>
          </div>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <Button size="sm" onclick={saveGoal} disabled={saving || !editTitle.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="ghost" size="sm" onclick={cancelEditing} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    {/if}

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
                      href="/{prefix}/goals/{parentGoal.id}"
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
                      href="/{prefix}/goals/{child.id}"
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
            <a href="/{prefix}/goals/{parentGoal.id}" class="text-primary hover:underline text-sm">
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
  </PageLayout>
{/if}
