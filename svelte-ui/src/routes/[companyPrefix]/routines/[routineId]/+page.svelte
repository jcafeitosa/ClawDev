<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { goto } from "$app/navigation";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Input, Textarea, Select, SelectTrigger, SelectContent, SelectItem } from "$components/ui/index.js";
  import { Pencil, Trash2 } from "lucide-svelte";
  import { onMount } from "svelte";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Routine {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    assigneeAgentId?: string | null;
    companyId: string;
    createdAt?: string;
    updatedAt?: string;
    triggers?: Trigger[];
    [key: string]: unknown;
  }

  interface Trigger {
    id: string;
    kind: string;
    cronExpression?: string | null;
    enabled?: boolean;
    publicId?: string | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface RoutineRun {
    id: string;
    status: string;
    source?: string;
    triggerId?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
    durationMs?: number | null;
    issueId?: string | null;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let routine = $state<Routine | null>(null);
  let runs = $state<RoutineRun[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("overview");
  let triggeringRun = $state(false);

  // Edit mode
  let editing = $state(false);
  let editTitle = $state("");
  let editDescription = $state("");
  let editStatus = $state("");
  let saving = $state(false);

  // Delete
  let confirmingDelete = $state(false);
  let deleting = $state(false);

  // Create trigger
  let showCreateTrigger = $state(false);
  let newTriggerKind = $state<"cron" | "webhook">("cron");
  let newTriggerCron = $state("");
  let creatingTrigger = $state(false);

  // Delete trigger
  let deletingTriggerId = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let routineId = $derived($page.params.routineId);
  let triggers = $derived(routine?.triggers ?? []);
  let cronTriggers = $derived(triggers.filter((t) => t.kind === "cron"));
  let webhookTriggers = $derived(triggers.filter((t) => t.kind === "webhook"));

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadRoutine() {
    if (!routineId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/routines/${routineId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      routine = (await res.json()) as Routine;
      breadcrumbStore.set([
        { label: "Routines", href: `/${$page.params.companyPrefix}/routines` },
        { label: routine.title },
      ]);
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: "Failed to load routine", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadRuns() {
    if (!routineId) return;
    try {
      const res = await api(`/api/routines/${routineId}/runs?limit=30`);
      runs = res.ok ? ((await res.json()) as RoutineRun[]) ?? [] : [];
    } catch {
      runs = [];
    }
  }

  async function triggerManualRun() {
    if (!routineId) return;
    triggeringRun = true;
    try {
      const res = await api(`/api/routines/${routineId}/run`, {
        method: "POST",
        body: JSON.stringify({ source: "manual" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Run triggered", body: "A new routine run has been queued.", tone: "success" });
      await loadRuns();
    } catch (err: any) {
      toastStore.push({ title: "Failed to trigger run", body: err?.message, tone: "error" });
    } finally {
      triggeringRun = false;
    }
  }

  function startEdit() {
    if (!routine) return;
    editTitle = routine.title;
    editDescription = routine.description ?? "";
    editStatus = routine.status;
    editing = true;
  }

  function cancelEdit() {
    editing = false;
  }

  async function saveEdit() {
    if (!routineId || !editTitle.trim()) return;
    saving = true;
    try {
      const res = await api(`/api/routines/${routineId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          status: editStatus,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Routine updated", tone: "success" });
      editing = false;
      await loadRoutine();
    } catch (err: any) {
      toastStore.push({ title: "Failed to update routine", body: err?.message, tone: "error" });
    } finally {
      saving = false;
    }
  }

  async function deleteRoutine() {
    if (!routineId) return;
    deleting = true;
    try {
      const res = await api(`/api/routines/${routineId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Routine deleted", tone: "success" });
      goto(`/${$page.params.companyPrefix}/routines`);
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete routine", body: err?.message, tone: "error" });
    } finally {
      deleting = false;
      confirmingDelete = false;
    }
  }

  async function createTrigger() {
    if (!routineId) return;
    if (newTriggerKind === "cron" && !newTriggerCron.trim()) return;
    creatingTrigger = true;
    try {
      const body: Record<string, string> = { kind: newTriggerKind };
      if (newTriggerKind === "cron") body.cronExpression = newTriggerCron.trim();
      const res = await api(`/api/routines/${routineId}/triggers`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Trigger created", tone: "success" });
      newTriggerKind = "cron";
      newTriggerCron = "";
      showCreateTrigger = false;
      await loadRoutine();
    } catch (err: any) {
      toastStore.push({ title: "Failed to create trigger", body: err?.message, tone: "error" });
    } finally {
      creatingTrigger = false;
    }
  }

  async function deleteTrigger(triggerId: string) {
    deletingTriggerId = triggerId;
    try {
      const res = await api(`/api/routine-triggers/${triggerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Trigger deleted", tone: "success" });
      await loadRoutine();
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete trigger", body: err?.message, tone: "error" });
    } finally {
      deletingTriggerId = null;
    }
  }

  onMount(() => {
    loadRoutine();
    loadRuns();
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function cronLabel(expression: string | null | undefined): string {
    if (!expression) return "No schedule";
    // Simple human-readable labels for common cron patterns
    const map: Record<string, string> = {
      "* * * * *": "Every minute",
      "*/5 * * * *": "Every 5 minutes",
      "*/15 * * * *": "Every 15 minutes",
      "*/30 * * * *": "Every 30 minutes",
      "0 * * * *": "Every hour",
      "0 */6 * * *": "Every 6 hours",
      "0 */12 * * *": "Every 12 hours",
      "0 0 * * *": "Daily at midnight",
      "0 9 * * *": "Daily at 9 AM",
      "0 9 * * 1-5": "Weekdays at 9 AM",
      "0 0 * * 0": "Weekly on Sunday",
      "0 0 * * 1": "Weekly on Monday",
    };
    return map[expression] ?? expression;
  }

  function triggerKindLabel(kind: string): string {
    const map: Record<string, string> = {
      cron: "Cron Schedule",
      webhook: "Webhook",
      manual: "Manual",
    };
    return map[kind] ?? kind;
  }
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={6} />
  </div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Routine not found" description="The routine you're looking for doesn't exist or you don't have access." icon="🔁">
      <a href="/{$page.params.companyPrefix}/routines" class="text-sm text-primary hover:underline">Back to routines</a>
    </EmptyState>
  </div>
{:else if routine}
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-semibold truncate">{routine.title}</h1>
          <StatusBadge status={routine.status} />
        </div>
        {#if routine.description}
          <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{routine.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onclick={startEdit}>
          <Pencil class="w-3.5 h-3.5 mr-1" />
          Edit
        </Button>
        {#if confirmingDelete}
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onclick={deleteRoutine}
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
          </Button>
          <Button variant="outline" size="sm" onclick={() => (confirmingDelete = false)}>
            Cancel
          </Button>
        {:else}
          <Button variant="destructive" size="sm" onclick={() => (confirmingDelete = true)}>
            <Trash2 class="w-3.5 h-3.5 mr-1" />
            Delete
          </Button>
        {/if}
        <Button
          variant="outline"
          size="sm"
          disabled={triggeringRun}
          onclick={triggerManualRun}
        >
          {triggeringRun ? "Triggering..." : "Run Now"}
        </Button>
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/routines">
          Back
        </Button>
      </div>
    </div>

    <!-- Edit form -->
    {#if editing}
      <Card class="mb-6">
        <CardContent class="pt-6">
          <form onsubmit={(e) => { e.preventDefault(); saveEdit(); }} class="space-y-4">
            <div>
              <label for="edit-title" class="block text-sm font-medium mb-1">Title</label>
              <Input id="edit-title" bind:value={editTitle} placeholder="Routine title" />
            </div>
            <div>
              <label for="edit-desc" class="block text-sm font-medium mb-1">Description</label>
              <Textarea id="edit-desc" bind:value={editDescription} placeholder="Description (optional)" class="min-h-[60px] resize-y" />
            </div>
            <div>
              <label for="edit-status" class="block text-sm font-medium mb-1">Status</label>
              <select
                id="edit-status"
                bind:value={editStatus}
                class="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div class="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onclick={cancelEdit} type="button">Cancel</Button>
              <Button size="sm" disabled={saving || !editTitle.trim()} type="submit">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
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
            <TabsTrigger value="runs">Executions ({runs.length})</TabsTrigger>
            <TabsTrigger value="triggers">Triggers ({triggers.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div class="space-y-6 mt-4">
              <!-- Description -->
              {#if routine.description}
                <Card>
                  <CardHeader>
                    <CardTitle>Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {routine.description}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Schedule Summary -->
              <Card>
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  {#if cronTriggers.length === 0}
                    <p class="text-sm text-zinc-500 dark:text-zinc-400">No scheduled triggers configured. This routine can only be run manually or via webhook.</p>
                  {:else}
                    <div class="space-y-2">
                      {#each cronTriggers as trigger}
                        <div class="flex items-center justify-between text-sm">
                          <div class="flex items-center gap-2">
                            <span class="font-medium">{cronLabel(trigger.cronExpression)}</span>
                            {#if trigger.cronExpression}
                              <span class="text-xs font-mono text-zinc-500">{trigger.cronExpression}</span>
                            {/if}
                          </div>
                          <Badge variant={trigger.enabled ? "default" : "secondary"}>
                            {trigger.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>

              <!-- Recent run summary -->
              {#if runs.length > 0}
                {@const lastRun = runs[0]}
                <Card>
                  <CardHeader>
                    <CardTitle>Last Execution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="flex items-center gap-3 text-sm">
                      <StatusBadge status={lastRun.status} />
                      {#if lastRun.source}
                        <Badge variant="outline" class="text-xs capitalize">{lastRun.source}</Badge>
                      {/if}
                      {#if lastRun.durationMs}
                        <span class="text-zinc-500">{(lastRun.durationMs / 1000).toFixed(1)}s</span>
                      {/if}
                      <TimeAgo date={lastRun.startedAt} class="text-xs" />
                    </div>
                  </CardContent>
                </Card>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="runs">
            <div class="mt-4">
              {#if runs.length === 0}
                <EmptyState title="No executions yet" description="This routine hasn't been executed yet." icon="🏃" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each runs as run}
                    <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={run.status} />
                        <span class="font-mono text-xs text-zinc-500 shrink-0">{run.id.slice(0, 8)}</span>
                        {#if run.source}
                          <Badge variant="outline" class="text-xs capitalize">{run.source}</Badge>
                        {/if}
                        {#if run.issueId}
                          <a href="/{$page.params.companyPrefix}/issues/{run.issueId}" class="text-xs text-primary hover:underline shrink-0">
                            Issue
                          </a>
                        {/if}
                      </div>
                      <div class="flex items-center gap-3 shrink-0">
                        {#if run.durationMs}
                          <span class="text-xs text-zinc-500">{(run.durationMs / 1000).toFixed(1)}s</span>
                        {/if}
                        <TimeAgo date={run.startedAt} class="text-xs" />
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="triggers">
            <div class="mt-4 space-y-4">
              <!-- Create Trigger -->
              <div class="flex justify-end">
                <Button variant="outline" size="sm" onclick={() => (showCreateTrigger = !showCreateTrigger)}>
                  {showCreateTrigger ? "Cancel" : "Add Trigger"}
                </Button>
              </div>

              {#if showCreateTrigger}
                <Card>
                  <CardContent class="pt-6">
                    <form onsubmit={(e) => { e.preventDefault(); createTrigger(); }} class="space-y-4">
                      <div>
                        <label for="trigger-kind" class="block text-sm font-medium mb-1">Kind</label>
                        <select
                          id="trigger-kind"
                          bind:value={newTriggerKind}
                          class="w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="cron">Cron</option>
                          <option value="webhook">Webhook</option>
                        </select>
                      </div>
                      {#if newTriggerKind === "cron"}
                        <div>
                          <label for="trigger-cron" class="block text-sm font-medium mb-1">Cron Expression</label>
                          <Input id="trigger-cron" bind:value={newTriggerCron} placeholder="e.g. 0 9 * * 1-5" />
                          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Standard cron format: minute hour day month weekday</p>
                        </div>
                      {/if}
                      <div class="flex justify-end">
                        <Button size="sm" type="submit" disabled={creatingTrigger || (newTriggerKind === "cron" && !newTriggerCron.trim())}>
                          {creatingTrigger ? "Creating..." : "Create Trigger"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              {/if}

              {#if triggers.length === 0 && !showCreateTrigger}
                <EmptyState title="No triggers" description="No triggers have been configured for this routine." icon="⚡" />
              {:else}
                <div class="space-y-4">
                  {#each triggers as trigger}
                    <Card>
                      <CardContent class="pt-6">
                        <div class="flex items-start justify-between">
                          <div class="space-y-1">
                            <div class="flex items-center gap-2">
                              <span class="font-medium text-sm">{triggerKindLabel(trigger.kind)}</span>
                              <Badge variant={trigger.enabled ? "default" : "secondary"} class="text-xs">
                                {trigger.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>
                            {#if trigger.kind === "cron" && trigger.cronExpression}
                              <div class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                                <span>{cronLabel(trigger.cronExpression)}</span>
                                <span class="font-mono text-xs">{trigger.cronExpression}</span>
                              </div>
                            {/if}
                            {#if trigger.kind === "webhook" && trigger.publicId}
                              <div class="text-xs font-mono text-zinc-500 dark:text-zinc-400 break-all">
                                Public ID: {trigger.publicId}
                              </div>
                            {/if}
                          </div>
                          <div class="flex items-center gap-3 shrink-0">
                            <span class="text-xs text-zinc-500">
                              <TimeAgo date={trigger.createdAt} />
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingTriggerId === trigger.id}
                              onclick={() => {
                                if (deletingTriggerId === trigger.id) return;
                                if (confirm("Delete this trigger? This action cannot be undone.")) {
                                  deleteTrigger(trigger.id);
                                }
                              }}
                            >
                              {deletingTriggerId === trigger.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
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
          <StatusBadge status={routine.status} />
        </PropertyRow>
        <Separator />
        {#if routine.assigneeAgentId}
          <PropertyRow label="Assignee">
            <a href="/{$page.params.companyPrefix}/agents/{routine.assigneeAgentId}" class="text-primary hover:underline text-xs font-mono">
              {routine.assigneeAgentId.slice(0, 8)}...
            </a>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Triggers">
          <span class="font-medium">{triggers.length}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Executions">
          <span class="font-medium">{runs.length}</span>
        </PropertyRow>
        <Separator />
        {#if cronTriggers.length > 0}
          <PropertyRow label="Schedule">
            <span class="text-xs">{cronLabel(cronTriggers[0].cronExpression)}</span>
          </PropertyRow>
          <Separator />
        {/if}
        <PropertyRow label="Created">
          <TimeAgo date={routine.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={routine.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{routine.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </div>
{/if}
