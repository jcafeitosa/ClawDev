<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    Card, CardContent, Badge, Button, Input, Skeleton, Progress,
  } from '$lib/components/ui/index.js';
  import { Target, Plus, ChevronRight, TrendingUp } from 'lucide-svelte';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Goals' }]));

  let loading = $state(true);
  let goals = $state<any[]>([]);
  let showCreate = $state(false);
  let newTitle = $state('');
  let newLevel = $state('task');
  let selectedParentId = $state<string | null>(null);
  let creating = $state(false);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/goals`)
      .then((r) => r.json())
      .then((d) => {
        goals = Array.isArray(d) ? d : d.goals ?? [];
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function createGoal() {
    if (!newTitle.trim() || !companyId) return;
    creating = true;
    try {
      const payload: Record<string, unknown> = { title: newTitle.trim(), level: newLevel };
      if (selectedParentId) payload.parentId = selectedParentId;
      const res = await api(`/api/companies/${companyId}/goals`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const g = await res.json();
      goals = [...goals, g];
      newTitle = '';
      newLevel = 'task';
      selectedParentId = null;
      showCreate = false;
    } catch (e) {
      console.error(e);
    } finally {
      creating = false;
    }
  }

  function statusVariant(status: string | undefined): string {
    switch (status) {
      case 'completed': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'in_progress': case 'in progress': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'blocked': return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'at_risk': case 'at risk': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      default: return '';
    }
  }

  function progressColor(pct: number): string {
    if (pct >= 80) return 'bg-emerald-500';
    if (pct >= 50) return 'bg-blue-500';
    if (pct >= 25) return 'bg-amber-500';
    return 'bg-zinc-500';
  }

  // Tree hierarchy helpers
  let rootGoals = $derived(goals.filter(g => !g.parentId));
  function childrenOf(parentId: string): any[] {
    return goals.filter(g => g.parentId === parentId);
  }

  /** Recursively flatten goals into a display-ordered list with depth */
  function flattenTree(nodes: any[], depth = 0): { goal: any; depth: number }[] {
    const result: { goal: any; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ goal: node, depth });
      const children = childrenOf(node.id);
      if (children.length > 0) {
        result.push(...flattenTree(children, depth + 1));
      }
    }
    return result;
  }

  let flatGoals = $derived(flattenTree(rootGoals));

  const LEVEL_ICONS: Record<string, string> = {
    epic: 'bg-purple-500/10 text-purple-400',
    milestone: 'bg-blue-500/10 text-blue-400',
    quarter: 'bg-cyan-500/10 text-cyan-400',
    annual: 'bg-amber-500/10 text-amber-400',
    task: 'bg-orange-500/10 text-orange-400',
  };
  function levelIconClass(level: string | undefined): string {
    return LEVEL_ICONS[level ?? ''] ?? 'bg-orange-500/10 text-orange-400';
  }
</script>

<PageLayout title="Goals" description="Track objectives and key results">
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Goal
    </Button>
  {/snippet}

  <!-- Create form -->
  {#if showCreate}
    <Card class="border-border/60">
      <CardContent class="pt-6">
        <form
          onsubmit={(e) => { e.preventDefault(); createGoal(); }}
          class="space-y-4"
        >
          <div>
            <label for="goal-title" class="block text-sm font-medium text-foreground mb-1">Goal Title</label>
            <Input
              id="goal-title"
              bind:value={newTitle}
              placeholder="e.g. Increase test coverage to 90%"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="goal-level" class="block text-sm font-medium text-foreground mb-1">Level</label>
              <select
                id="goal-level"
                bind:value={newLevel}
                class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-4 py-2 text-sm text-foreground capitalize focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              >
                <option value="task">Task</option>
                <option value="milestone">Milestone</option>
                <option value="quarter">Quarter</option>
                <option value="annual">Annual</option>
                <option value="epic">Epic</option>
              </select>
            </div>
            <div>
              <label for="goal-parent" class="block text-sm font-medium text-foreground mb-1">Parent Goal</label>
              <select
                id="goal-parent"
                bind:value={selectedParentId}
                class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-4 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
              >
                <option value={null}>None (root goal)</option>
                {#each goals as g (g.id)}
                  <option value={g.id}>{g.title ?? g.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newTitle.trim()}>
              {creating ? 'Creating...' : 'Create Goal'}
            </Button>
            <Button variant="outline" type="button" onclick={() => (showCreate = false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <Skeleton class="h-20 rounded-xl" />
      {/each}
    </div>
  {:else if goals.length === 0}
    <!-- Empty state -->
    <Card>
      <CardContent class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <Target class="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No goals yet</p>
          <p class="text-xs text-muted-foreground/60">Create your first goal to get started.</p>
          <Button variant="outline" onclick={() => (showCreate = true)} class="mt-2">
            <Plus class="h-4 w-4" />
            New Goal
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <!-- Goals tree -->
    <Card class="p-0 overflow-hidden">
      <div class="divide-y divide-border/50">
        {#each flatGoals as { goal, depth } (goal.id)}
          {@const children = childrenOf(goal.id)}
          <a
            href="/{prefix}/goals/{goal.id}"
            class="cursor-pointer group flex items-center gap-4 py-4 pr-5 transition-colors duration-150 hover:bg-accent/40"
            style="padding-left: {1.25 + depth * 1.5}rem"
          >
                <!-- Level-colored border accent -->
                {#if depth > 0}
                  <div class="w-0.5 self-stretch rounded-full {statusVariant(goal.status).includes('emerald') ? 'bg-emerald-500/40' : statusVariant(goal.status).includes('blue') ? 'bg-blue-500/40' : statusVariant(goal.status).includes('red') ? 'bg-red-500/40' : statusVariant(goal.status).includes('amber') ? 'bg-amber-500/40' : 'bg-border/60'} shrink-0"></div>
                {/if}

              <!-- Icon -->
              <div class="shrink-0 rounded-lg {levelIconClass(goal.level)} p-2">
                <TrendingUp class="h-5 w-5" />
              </div>

              <!-- Content -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 class="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {goal.title ?? goal.name}
                  </h3>
                  {#if goal.level}
                    <Badge variant="outline" class="text-[10px] capitalize">{goal.level}</Badge>
                  {/if}
                  {#if goal.status}
                    <Badge class={statusVariant(goal.status)}>
                      {goal.status.replace(/_/g, ' ')}
                    </Badge>
                  {/if}
                </div>

                <!-- Progress bar -->
                {#if goal.progress !== undefined}
                  <div class="flex items-center gap-3">
                    <div class="h-1.5 flex-1 rounded-full bg-accent overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all {progressColor(goal.progress)}"
                        style="width: {Math.min(100, goal.progress)}%"
                      ></div>
                    </div>
                    <span class="shrink-0 text-xs font-medium text-muted-foreground">{goal.progress}%</span>
                  </div>
                {/if}

                <!-- Sub-goals count -->
                {#if children.length > 0}
                  <p class="mt-1 text-xs text-muted-foreground">
                    {children.length} sub-goal{children.length === 1 ? '' : 's'}
                  </p>
                {/if}
              </div>

              <!-- Arrow -->
              <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </a>
      {/each}
      </div>
    </Card>
  {/if}
</PageLayout>
