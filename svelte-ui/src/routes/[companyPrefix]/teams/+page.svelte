<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Users, Plus, Crown, UserPlus, Calendar, CircleDot } from 'lucide-svelte';
  import { Card, CardContent, Badge, Button, Input, Skeleton } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    type HierarchyPreset,
  } from '@clawdev/shared';

  onMount(() => breadcrumbStore.set([{ label: 'Teams' }]));

  let loading = $state(true);
  let teams = $state<any[]>([]);
  let showCreate = $state(false);
  let newName = $state('');
  let newDescription = $state('');
  let creating = $state(false);

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

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agent-teams`)
      .then((r) => r.json())
      .then((d) => {
        teams = Array.isArray(d) ? d : [];
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function createTeam() {
    if (!newName.trim() || !companyId) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/agent-teams`, {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || undefined }),
      });
      const team = await res.json();
      teams = [team, ...teams];
      newName = '';
      newDescription = '';
      showCreate = false;
    } catch (e) {
      console.error(e);
    } finally {
      creating = false;
    }
  }

  const STATUS_BADGE_CLASSES: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    archived: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    dissolved: 'bg-red-500/15 text-red-600 dark:text-red-400',
  };

  function formatDate(d: string | undefined) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<PageLayout title="Teams" description="Manage agent teams and collaboration squads">
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Team
    </Button>
  {/snippet}

  {#if hierarchyPresetDefinition}
    <Card class="border-border/60">
      <CardContent class="pt-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hierarchy preset</p>
            <h2 class="mt-1 text-lg font-semibold text-foreground">{hierarchyPresetDefinition.label}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{hierarchyPresetDefinition.description}</p>
          </div>
          <div class="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Organizing principle</p>
            <p class="mt-1 text-sm text-foreground">{hierarchyPresetDefinition.fit}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {#each hierarchyPresetDepartments as department}
            <div class="rounded-xl border border-border/60 bg-background/60 p-3">
              <p class="text-sm font-medium text-foreground">{department.label}</p>
              <p class="mt-1 text-xs text-muted-foreground">{department.description}</p>
              <p class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{department.level.toUpperCase().replace('_', ' ')}</p>
            </div>
          {/each}
        </div>
      </CardContent>
    </Card>
  {/if}

  <!-- Create form -->
  {#if showCreate}
    <Card>
      <CardContent class="pt-5">
        <form
          onsubmit={(e) => { e.preventDefault(); createTeam(); }}
          class="space-y-4"
        >
          <div>
            <label for="team-name" class="block text-sm font-medium text-foreground mb-1">Team Name</label>
            <Input id="team-name" bind:value={newName} placeholder="e.g. Frontend Squad" />
          </div>
          <div>
            <label for="team-desc" class="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              id="team-desc"
              bind:value={newDescription}
              placeholder="What does this team focus on?"
              rows="2"
              class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-none"
            ></textarea>
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newName.trim()}>
              {creating ? 'Creating...' : 'Create Team'}
            </Button>
            <Button variant="outline" type="button" onclick={() => (showCreate = false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}

  <!-- Loading -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <Skeleton class="h-40 rounded-xl" />
      {/each}
    </div>
  {:else if teams.length === 0}
    <!-- Empty state -->
    <Card>
      <CardContent class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <Users class="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No teams yet</p>
          <p class="text-xs text-muted-foreground/60">Create your first team to coordinate agents.</p>
          <Button variant="outline" class="mt-2" onclick={() => (showCreate = true)}>
            <Plus class="h-4 w-4" />
            New Team
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <!-- Team list (ClickUp style) -->
    <div class="glass-card overflow-hidden font-card">
      <!-- Table header -->
      <div class="flex items-center border-b border-border/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span class="w-8 shrink-0"></span>
        <span class="min-w-0 flex-1">Name</span>
        <span class="hidden w-[100px] shrink-0 sm:block">Status</span>
        <span class="hidden w-[100px] shrink-0 sm:block">Members</span>
        <span class="hidden w-[100px] shrink-0 sm:block">Lead</span>
        <span class="hidden w-[120px] shrink-0 text-right sm:block">Created</span>
      </div>

      {#each teams as team (team.id)}
        {@const statusClasses = STATUS_BADGE_CLASSES[team.status] ?? 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400'}
        <a
          href="/{prefix}/teams/{team.id}"
          class="group flex items-center gap-3 border-b border-border/30 px-4 py-3 text-sm no-underline text-inherit transition-colors hover:bg-accent/40 last:border-b-0"
        >
          <!-- Icon -->
          <div class="w-8 shrink-0 flex items-center justify-center">
            <div class="rounded-lg p-1.5 bg-blue-500/10">
              <Users class="h-4 w-4 text-blue-500" />
            </div>
          </div>

          <!-- Name + description -->
          <div class="min-w-0 flex-1">
            <span class="font-medium text-foreground group-hover:text-blue-500 transition-colors truncate block">{team.name}</span>
            {#if team.description}
              <span class="text-xs text-muted-foreground/60 truncate block">{team.description}</span>
            {/if}
          </div>

          <!-- Status -->
          <span class="hidden w-[100px] shrink-0 sm:flex">
            <span
              class="inline-flex items-center gap-1.5 font-bold uppercase text-[10px] px-2 py-0.5 rounded-full {statusClasses}"
            >
              {team.status}
            </span>
          </span>

          <!-- Member count -->
          <span class="hidden w-[100px] shrink-0 items-center gap-1 sm:flex">
            <UserPlus class="h-3.5 w-3.5 text-muted-foreground/50" />
            <span class="text-xs text-muted-foreground tabular-nums">
              {team.memberCount ?? 0}
            </span>
          </span>

          <!-- Lead -->
          <span class="hidden w-[100px] shrink-0 items-center gap-1 sm:flex">
            {#if team.leadAgentName}
              <Crown class="h-3 w-3 text-amber-500" />
              <span class="text-xs text-muted-foreground truncate">{team.leadAgentName}</span>
            {:else}
              <span class="text-muted-foreground/40 text-xs">—</span>
            {/if}
          </span>

          <!-- Created -->
          <span class="hidden w-[120px] shrink-0 text-right text-xs text-muted-foreground sm:block">
            <span class="inline-flex items-center gap-1">
              <Calendar class="h-3 w-3" />
              {formatDate(team.createdAt)}
            </span>
          </span>
        </a>
      {/each}
    </div>

    <p class="mt-2 text-right text-xs text-muted-foreground/60">{teams.length} team{teams.length === 1 ? '' : 's'}</p>
  {/if}
</PageLayout>
