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

  onMount(() => breadcrumbStore.set([{ label: 'Goals' }]));

  let loading = $state(true);
  let goals = $state<any[]>([]);
  let showCreate = $state(false);
  let newTitle = $state('');
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
      const res = await api(`/api/companies/${companyId}/goals`, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const g = await res.json();
      goals = [...goals, g];
      newTitle = '';
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
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Goals</h1>
      <p class="mt-1 text-sm text-muted-foreground">Track objectives and key results</p>
    </div>
    <Button onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Goal
    </Button>
  </div>

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
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <Target class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">No goals defined</h3>
      <p class="mt-1 text-sm text-muted-foreground">Set goals to align your team's efforts</p>
      <Button onclick={() => (showCreate = true)} class="mt-4">
        <Plus class="h-4 w-4" />
        New Goal
      </Button>
    </div>
  {:else}
    <!-- Goals list -->
    <div class="space-y-3">
      {#each goals as goal (goal.id)}
        <a
          href="/{prefix}/goals/{goal.id}"
          class="group block"
        >
          <Card class="border-border/60 transition-all hover:bg-accent/40 hover:border-border">
            <CardContent class="flex items-center gap-4 py-4">
              <!-- Icon -->
              <div class="shrink-0 rounded-lg bg-orange-500/10 p-2">
                <TrendingUp class="h-5 w-5 text-orange-400" />
              </div>

              <!-- Content -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-3 mb-1">
                  <h3 class="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {goal.title ?? goal.name}
                  </h3>
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
                {#if goal.subGoalCount || goal.children?.length}
                  <p class="mt-1 text-xs text-muted-foreground">
                    {goal.subGoalCount ?? goal.children?.length ?? 0} sub-goal{(goal.subGoalCount ?? goal.children?.length ?? 0) === 1 ? '' : 's'}
                  </p>
                {/if}
              </div>

              <!-- Arrow -->
              <ChevronRight class="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </CardContent>
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</div>
