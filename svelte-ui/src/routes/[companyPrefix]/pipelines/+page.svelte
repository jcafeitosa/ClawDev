<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    GitBranch, Plus, Play, Pause, Trash2, CheckCircle2, Circle, Clock,
    AlertCircle, XCircle, Bot, ArrowRight, ChevronDown, ChevronRight
  } from 'lucide-svelte';
  import { Card, CardContent, Badge, Button, Input, Skeleton } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Pipelines' }]));

  let loading = $state(true);
  let pipelines = $state<any[]>([]);
  let showCreate = $state(false);
  let agents = $state<any[]>([]);

  // Create form
  let newName = $state('');
  let newDescription = $state('');
  let newTriggerType = $state('manual');
  let newSteps = $state<{ agentId: string; action: string; dependsOn: number[] }[]>([]);
  let creating = $state(false);

  // Execution detail
  let expandedPipelineId = $state<string | null>(null);
  let executions = $state<any[]>([]);
  let executionsLoading = $state(false);

  let companyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let prefix = $derived($page.params.companyPrefix);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agent-pipelines`)
      .then((r) => r.json())
      .then((d) => { pipelines = Array.isArray(d) ? d : []; })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function loadAgents() {
    if (!companyId || agents.length > 0) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      const data = await res.json();
      agents = Array.isArray(data) ? data : data.agents ?? [];
    } catch (e) { console.error(e); }
  }

  function addStep() {
    newSteps = [...newSteps, { agentId: '', action: '', dependsOn: [] }];
  }

  function removeStep(index: number) {
    newSteps = newSteps.filter((_, i) => i !== index).map((s) => ({
      ...s,
      dependsOn: s.dependsOn.filter((d) => d !== index).map((d) => (d > index ? d - 1 : d)),
    }));
  }

  async function createPipeline() {
    if (!newName.trim() || !companyId || newSteps.length === 0) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/agent-pipelines`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          triggerType: newTriggerType,
          steps: newSteps,
        }),
      });
      const pipeline = await res.json();
      pipelines = [{ pipeline, executionCount: 0, lastRunAt: null }, ...pipelines];
      newName = '';
      newDescription = '';
      newSteps = [];
      showCreate = false;
    } catch (e) { console.error(e); }
    finally { creating = false; }
  }

  async function toggleStatus(pipelineId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await api(`/api/agent-pipelines/${pipelineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      pipelines = pipelines.map((p) => {
        const pl = p.pipeline ?? p;
        if (pl.id === pipelineId) return { ...p, pipeline: { ...pl, status: newStatus } };
        return p;
      });
    } catch (e) { console.error(e); }
  }

  async function executePipeline(pipelineId: string) {
    try {
      await api(`/api/agent-pipelines/${pipelineId}/execute`, { method: 'POST', body: '{}' });
      // Reload executions if expanded
      if (expandedPipelineId === pipelineId) await loadExecutions(pipelineId);
    } catch (e) { console.error(e); }
  }

  async function deletePipeline(pipelineId: string) {
    try {
      await api(`/api/agent-pipelines/${pipelineId}`, { method: 'DELETE' });
      pipelines = pipelines.filter((p) => (p.pipeline ?? p).id !== pipelineId);
    } catch (e) { console.error(e); }
  }

  async function loadExecutions(pipelineId: string) {
    executionsLoading = true;
    try {
      const res = await api(`/api/agent-pipelines/${pipelineId}/executions`);
      executions = await res.json();
    } catch (e) { console.error(e); }
    finally { executionsLoading = false; }
  }

  async function toggleExpand(pipelineId: string) {
    if (expandedPipelineId === pipelineId) {
      expandedPipelineId = null;
    } else {
      expandedPipelineId = pipelineId;
      await loadExecutions(pipelineId);
    }
  }

  const STATUS_BADGE_CLASSES: Record<string, string> = {
    draft: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    paused: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    archived: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  };

  const EXEC_STATUS_CLASSES: Record<string, string> = {
    running: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
    cancelled: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
  };

  const TRIGGER_LABELS: Record<string, string> = {
    manual: 'Manual',
    on_issue_create: 'On Issue Create',
    on_approval: 'On Approval',
    cron: 'Scheduled',
  };

  function formatDate(d: string | null | undefined) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function agentName(id: string): string {
    return agents.find((a) => a.id === id)?.name ?? id.slice(0, 8);
  }
</script>

<PageLayout title="Pipelines" description="Multi-agent workflow pipelines">
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={() => { showCreate = !showCreate; if (showCreate) loadAgents(); }}>
      <Plus class="h-4 w-4" />
      New Pipeline
    </Button>
  {/snippet}

  <!-- Create form -->
  {#if showCreate}
    <Card>
      <CardContent class="pt-5">
        <form onsubmit={(e) => { e.preventDefault(); createPipeline(); }} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="pl-name" class="block text-xs font-medium text-foreground mb-1">Pipeline Name</label>
              <Input id="pl-name" bind:value={newName} placeholder="e.g. Code Review Pipeline" />
            </div>
            <div>
              <label for="pl-trigger" class="block text-xs font-medium text-foreground mb-1">Trigger</label>
              <select id="pl-trigger" bind:value={newTriggerType} class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
                <option value="manual">Manual</option>
                <option value="on_issue_create">On Issue Create</option>
                <option value="on_approval">On Approval</option>
                <option value="cron">Scheduled (Cron)</option>
              </select>
            </div>
          </div>
          <div>
            <label for="pl-desc" class="block text-xs font-medium text-foreground mb-1">Description</label>
            <textarea id="pl-desc" bind:value={newDescription} rows="2" placeholder="What does this pipeline do?" class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-none"></textarea>
          </div>

          <!-- Steps builder -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <p class="block text-xs font-medium text-foreground">Steps</p>
              <Button type="button" size="sm" variant="outline" onclick={addStep}>
                <Plus class="h-3 w-3" /> Add Step
              </Button>
            </div>
            {#if newSteps.length === 0}
              <p class="text-xs text-muted-foreground/60 py-4 text-center">Add at least one step to the pipeline.</p>
            {/if}
            <div class="space-y-2">
              {#each newSteps as step, i}
                <div class="flex items-center gap-2 rounded-lg border border-border/50 bg-accent/30 px-3 py-2">
                  <span class="text-xs font-mono text-muted-foreground w-6 shrink-0">#{i + 1}</span>
                  <select bind:value={step.agentId} class="flex-1 selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-2 py-1.5 text-xs text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
                    <option value="">Agent...</option>
                    {#each agents as a}
                      <option value={a.id}>{a.name}</option>
                    {/each}
                  </select>
                  <Input bind:value={step.action} placeholder="Action (e.g. review, test)" class="flex-1 !text-xs !py-1.5" />
                  {#if i > 0}
                    <select bind:value={step.dependsOn} multiple class="w-20 selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-1 py-1 text-[10px] text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
                      {#each newSteps.slice(0, i) as _, di}
                        <option value={di}>#{di + 1}</option>
                      {/each}
                    </select>
                  {/if}
                  <button type="button" class="text-muted-foreground/40 hover:text-red-400 transition-colors" onclick={() => removeStep(i)}>
                    <Trash2 class="h-3.5 w-3.5" />
                  </button>
                </div>
              {/each}
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newName.trim() || newSteps.length === 0}>
              {creating ? 'Creating...' : 'Create Pipeline'}
            </Button>
            <Button variant="outline" type="button" onclick={() => (showCreate = false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}

  <!-- Loading -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}
        <Skeleton class="h-20 rounded-xl" />
      {/each}
    </div>
  {:else if pipelines.length === 0}
    <Card>
      <CardContent class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <GitBranch class="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No pipelines yet</p>
          <p class="text-xs text-muted-foreground/60">Create a pipeline to orchestrate multi-agent workflows.</p>
          <Button variant="outline" class="mt-2" onclick={() => { showCreate = true; loadAgents(); }}>
            <Plus class="h-4 w-4" />
            New Pipeline
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="space-y-3">
      {#each pipelines as p (((p.pipeline ?? p).id))}
        {@const pl = p.pipeline ?? p}
        {@const statusClasses = STATUS_BADGE_CLASSES[pl.status] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'}
        {@const steps = (pl.steps ?? []) as { agentId: string; action: string; dependsOn: number[] }[]}
        <div class="glass-card overflow-hidden font-card">
          <!-- Pipeline header -->
          <div class="flex items-center gap-3 px-4 py-3">
            <button class="text-muted-foreground/50 hover:text-foreground transition-colors" onclick={() => toggleExpand(pl.id)}>
              {#if expandedPipelineId === pl.id}
                <ChevronDown class="h-4 w-4" />
              {:else}
                <ChevronRight class="h-4 w-4" />
              {/if}
            </button>
            <div class="rounded-lg p-1.5 bg-purple-500/10">
              <GitBranch class="h-4 w-4 text-purple-500" />
            </div>
            <div class="min-w-0 flex-1">
              <span class="font-medium text-foreground block">{pl.name}</span>
              {#if pl.description}
                <span class="text-xs text-muted-foreground/60 truncate block">{pl.description}</span>
              {/if}
            </div>

            <!-- Steps preview -->
            <div class="hidden sm:flex items-center gap-1">
              {#each steps.slice(0, 4) as step, i}
                {#if i > 0}<ArrowRight class="h-3 w-3 text-muted-foreground/30" />{/if}
                <span class="text-[10px] text-muted-foreground bg-accent/60 rounded px-1.5 py-0.5 truncate max-w-[80px]">{step.action}</span>
              {/each}
              {#if steps.length > 4}
                <span class="text-[10px] text-muted-foreground/40">+{steps.length - 4}</span>
              {/if}
            </div>

            <span class="inline-flex items-center gap-1 font-bold uppercase text-[10px] px-2 py-0.5 rounded-full {statusClasses}">
              {pl.status}
            </span>

            <Badge variant="outline" class="text-[10px]">{TRIGGER_LABELS[pl.triggerType] ?? pl.triggerType}</Badge>

            <span class="text-xs text-muted-foreground tabular-nums">{p.executionCount ?? 0} runs</span>

            <div class="flex items-center gap-1">
              {#if pl.status === 'active'}
                <Button size="sm" variant="outline" class="h-7 px-2" onclick={() => executePipeline(pl.id)}>
                  <Play class="h-3 w-3" />
                </Button>
              {/if}
              <Button size="sm" variant="outline" class="h-7 px-2" onclick={() => toggleStatus(pl.id, pl.status)}>
                {#if pl.status === 'active'}
                  <Pause class="h-3 w-3" />
                {:else}
                  <Play class="h-3 w-3" />
                {/if}
              </Button>
              <Button size="sm" variant="outline" class="h-7 px-2 text-red-400" onclick={() => deletePipeline(pl.id)}>
                <Trash2 class="h-3 w-3" />
              </Button>
            </div>
          </div>

          <!-- Expanded: executions -->
          {#if expandedPipelineId === pl.id}
            <div class="border-t border-border/30 px-4 py-3 bg-accent/20">
              <!-- Steps detail -->
              <div class="mb-3">
                <p class="text-xs font-medium text-muted-foreground mb-2">Pipeline Steps ({steps.length})</p>
                <div class="flex items-start gap-2 flex-wrap">
                  {#each steps as step, i}
                    <div class="flex items-center gap-1">
                      {#if i > 0}
                        <ArrowRight class="h-3 w-3 text-muted-foreground/30" />
                      {/if}
                      <div class="rounded-lg border border-border/50 bg-accent/40 px-3 py-1.5 text-xs">
                        <span class="font-mono text-muted-foreground/50">#{i + 1}</span>
                        <span class="font-medium text-foreground ml-1">{step.action}</span>
                        <span class="text-muted-foreground/60 ml-1">({agentName(step.agentId)})</span>
                        {#if step.dependsOn.length > 0}
                          <span class="text-[10px] text-muted-foreground/40 ml-1">after #{step.dependsOn.map(d => d + 1).join(', #')}</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>

              <!-- Executions -->
              <p class="text-xs font-medium text-muted-foreground mb-2">Recent Executions</p>
              {#if executionsLoading}
                <p class="text-xs text-muted-foreground/60 py-2">Loading...</p>
              {:else if executions.length === 0}
                <p class="text-xs text-muted-foreground/60 py-2">No executions yet.</p>
              {:else}
                <div class="space-y-1">
                  {#each executions as exec}
                    {@const execClasses = EXEC_STATUS_CLASSES[exec.status] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'}
                    {@const stepResults = (exec.stepResults ?? []) as { stepIndex: number; status: string; agentId: string }[]}
                    <div class="flex items-center gap-3 rounded-lg bg-accent/30 px-3 py-2 text-xs">
                      <span class="inline-flex items-center gap-1 font-bold uppercase text-[10px] px-2 py-0.5 rounded-full {execClasses}">
                        {exec.status}
                      </span>
                      <div class="flex items-center gap-0.5">
                        {#each stepResults as sr}
                          {@const stepColor = sr.status === 'completed' ? '#10b981' : sr.status === 'running' ? '#3b82f6' : sr.status === 'failed' ? '#ef4444' : '#6b7280'}
                          <div class="h-2 w-6 rounded-sm" style="background-color: {stepColor}" title="Step {sr.stepIndex + 1}: {sr.status}"></div>
                        {/each}
                      </div>
                      <span class="text-muted-foreground">{formatDate(exec.startedAt)}</span>
                      {#if exec.completedAt}
                        <span class="text-muted-foreground/50">→ {formatDate(exec.completedAt)}</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
    <p class="mt-2 text-right text-xs text-muted-foreground/60">{pipelines.length} pipeline{pipelines.length === 1 ? '' : 's'}</p>
  {/if}
</PageLayout>
