<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { FolderKanban, Plus, Calendar, CircleDot, FolderOpen } from 'lucide-svelte';
  import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Skeleton, Separator } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    type HierarchyPreset,
  } from '@clawdev/shared';

  onMount(() => breadcrumbStore.set([{ label: 'Projects' }]));

  let loading = $state(true);
  let projects = $state<any[]>([]);
  let showCreate = $state(false);
  let newName = $state('');
  let newDescription = $state('');
  let newSddSpec = $state('');
  let newSddDesign = $state('');
  let newSddValidation = $state('');
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
  let hierarchyPresetOperatingRules = $derived(
    selectedHierarchyPreset ? getHierarchyPresetOperatingRules(selectedHierarchyPreset) : []
  );
  const SDD_PROJECT_FLOW = [
    { label: 'Spec', description: 'Capture the project goal, boundaries, and success criteria.' },
    { label: 'Design', description: 'Define the structure, owners, and execution slices.' },
    { label: 'Decompose', description: 'Split into safe milestones and issue-level work.' },
    { label: 'Validate', description: 'Check risks, dependencies, and approval gates.' },
    { label: 'Implement', description: 'Execute with clear ownership and review loops.' },
  ] as const;

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/projects`)
      .then((r) => r.json())
      .then((d) => {
        projects = Array.isArray(d) ? d : d.projects ?? [];
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function createProject() {
    if (!newName.trim() || !companyId) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/projects`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          sddSpec: newSddSpec.trim(),
          sddDesign: newSddDesign.trim(),
          sddValidation: newSddValidation.trim() || undefined,
        }),
      });
      const p = await res.json();
      projects = [...projects, p];
      newName = '';
      newDescription = '';
      newSddSpec = '';
      newSddDesign = '';
      newSddValidation = '';
      showCreate = false;
    } catch (e) {
      console.error(e);
    } finally {
      creating = false;
    }
  }

  function formatDate(d: string | undefined) {
    if (!d) return null;
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: '#10b981' },
    in_progress: { label: 'In Progress', color: '#f97316' },
    paused: { label: 'Paused', color: '#eab308' },
    completed: { label: 'Completed', color: '#10b981' },
    archived: { label: 'Archived', color: '#6b7280' },
    planning: { label: 'Planning', color: '#3b82f6' },
  };

  function projectStatus(s: string | null | undefined) {
    if (!s) return { label: 'Active', color: '#10b981' };
    return STATUS_MAP[s] ?? { label: s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: '#6b7280' };
  }

  function progressPercent(p: any): number {
    const total = p.issueCount ?? 0;
    const done = p.issueDoneCount ?? 0;
    if (total === 0) return 0;
    return Math.round((done / total) * 100);
  }
</script>

<PageLayout title="Projects" description="Manage your team's projects and track progress">
  {#snippet actions()}
    <Button onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Project
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
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project launch rule</p>
            <p class="mt-1 text-sm text-foreground">{hierarchyPresetDefinition.fit}</p>
          </div>
        </div>

        <div class="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div class="rounded-xl border border-border/60 bg-background/60 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SDD flow</p>
            <div class="mt-3 space-y-2">
              {#each SDD_PROJECT_FLOW as step, index}
                <div class="flex gap-3 rounded-lg border border-border/60 bg-card/60 p-3">
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</div>
                  <div>
                    <p class="text-sm font-medium text-foreground">{step.label}</p>
                    <p class="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <div class="space-y-4">
            <div class="rounded-xl border border-border/60 bg-background/60 p-4">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Departments</p>
              <div class="mt-3 flex flex-wrap gap-1.5">
                {#each hierarchyPresetDepartments as department}
                  <Badge variant="outline" class="text-[10px] uppercase tracking-wider">{department.label}</Badge>
                {/each}
              </div>
            </div>
            <div class="rounded-xl border border-border/60 bg-background/60 p-4">
              <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operating rules</p>
              <div class="mt-3 space-y-2">
                {#each hierarchyPresetOperatingRules as rule}
                  <div class="rounded-md border border-border/60 bg-card/60 p-3">
                    <p class="text-sm font-medium text-foreground">{rule.title}</p>
                    <p class="mt-1 text-xs text-muted-foreground">{rule.description}</p>
                  </div>
                {/each}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  {/if}

  <!-- Create form -->
  {#if showCreate}
    <Card>
      <CardContent class="pt-5">
        <form
          onsubmit={(e) => { e.preventDefault(); createProject(); }}
          class="space-y-4"
        >
          <div>
            <label for="proj-name" class="block text-sm font-medium text-foreground mb-1">Project Name</label>
            <Input
              id="proj-name"
              bind:value={newName}
              placeholder="e.g. API Redesign"
            />
          </div>
          <div>
            <label for="proj-desc" class="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              id="proj-desc"
              bind:value={newDescription}
              placeholder="Brief description..."
              rows="2"
              class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            ></textarea>
          </div>
          <div class="grid gap-4 lg:grid-cols-2">
            <div>
              <label for="proj-spec" class="block text-sm font-medium text-foreground mb-1">Spec *</label>
              <textarea
                id="proj-spec"
                bind:value={newSddSpec}
                rows="4"
                placeholder="Define the project scope, success criteria, and constraints."
                class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              ></textarea>
            </div>
            <div>
              <label for="proj-design" class="block text-sm font-medium text-foreground mb-1">Design *</label>
              <textarea
                id="proj-design"
                bind:value={newSddDesign}
                rows="4"
                placeholder="Map the execution model, owners, and delivery slices."
                class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              ></textarea>
            </div>
          </div>
          <div>
            <label for="proj-validation" class="block text-sm font-medium text-foreground mb-1">Validation</label>
            <textarea
              id="proj-validation"
              bind:value={newSddValidation}
              rows="3"
              placeholder="Describe how we confirm the project is ready to execute."
              class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            ></textarea>
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newName.trim() || !newSddSpec.trim() || !newSddDesign.trim()}>
              {creating ? 'Creating...' : 'Create Project'}
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
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <Skeleton class="h-40 rounded-xl" />
      {/each}
    </div>
  {:else if projects.length === 0}
    <!-- Empty state -->
    <Card>
      <CardContent class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <FolderKanban class="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No projects yet</p>
          <p class="text-xs text-muted-foreground/60">Create your first project to get started.</p>
          <Button class="mt-2" onclick={() => (showCreate = true)}>
            <Plus class="h-4 w-4" />
            New Project
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <!-- ClickUp-style project list -->
    <div class="glass-card overflow-hidden font-card">
      <!-- Table header -->
      <div class="flex items-center border-b border-border/50 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span class="w-8 shrink-0"></span>
        <span class="min-w-0 flex-1">Name</span>
        <span class="hidden w-[120px] shrink-0 sm:block">Status</span>
        <span class="hidden w-[180px] shrink-0 sm:block">Progress</span>
        <span class="hidden w-[100px] shrink-0 sm:block">Issues</span>
        <span class="hidden w-[120px] shrink-0 text-right sm:block">Target</span>
      </div>

      {#each projects as project (project.id)}
        {@const status = projectStatus(project.status)}
        {@const pct = progressPercent(project)}
        <a
          href="/{prefix}/projects/{project.id}"
          class="group flex items-center gap-3 border-b border-border/30 px-4 py-3 text-sm no-underline text-inherit transition-colors hover:bg-accent/40 last:border-b-0"
        >
          <!-- Icon -->
          <div class="w-8 shrink-0 flex items-center justify-center">
            <div class="rounded-lg p-1.5" style="background-color: {project.color ?? '#6366f1'}15;">
              <FolderKanban class="h-4 w-4" style="color: {project.color ?? '#6366f1'};" />
            </div>
          </div>

          <!-- Name + description -->
          <div class="min-w-0 flex-1">
            <span class="font-medium text-foreground group-hover:text-blue-500 transition-colors truncate block">{project.name}</span>
            {#if project.description}
              <span class="text-xs text-muted-foreground/60 truncate block">{project.description}</span>
            {/if}
          </div>

          <!-- Status badge -->
          <span class="hidden w-[120px] shrink-0 sm:flex">
            <span
              class="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
              style="background-color: {status.color};"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-white/30"></span>
              {status.label}
            </span>
          </span>

          <!-- Progress bar -->
          <span class="hidden w-[180px] shrink-0 items-center gap-2 sm:flex">
            {#if (project.issueCount ?? 0) > 0}
              <div class="h-1.5 flex-1 rounded-full bg-muted/50 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  style="width: {pct}%; background-color: {pct >= 100 ? '#10b981' : pct > 50 ? '#3b82f6' : '#f97316'};"
                ></div>
              </div>
              <span class="text-[11px] font-medium text-muted-foreground tabular-nums">{pct}%</span>
            {:else}
              <span class="text-[11px] text-muted-foreground/40">No issues</span>
            {/if}
          </span>

          <!-- Issue count -->
          <span class="hidden w-[100px] shrink-0 items-center gap-1 sm:flex">
            <CircleDot class="h-3.5 w-3.5 text-muted-foreground/50" />
            <span class="text-xs text-muted-foreground tabular-nums">
              {project.issueDoneCount ?? 0}/{project.issueCount ?? 0}
            </span>
          </span>

          <!-- Target date -->
          <span class="hidden w-[120px] shrink-0 text-right text-xs text-muted-foreground sm:block">
            {#if project.targetDate}
              <span class="inline-flex items-center gap-1">
                <Calendar class="h-3 w-3" />
                {formatDate(project.targetDate)}
              </span>
            {:else}
              <span class="text-muted-foreground/40">—</span>
            {/if}
          </span>
        </a>
      {/each}
    </div>

    <p class="mt-2 text-right text-xs text-muted-foreground/60">{projects.length} project{projects.length === 1 ? '' : 's'}</p>
  {/if}
</PageLayout>
