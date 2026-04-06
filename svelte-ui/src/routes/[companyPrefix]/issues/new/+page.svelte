<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus } from 'lucide-svelte';
  import { Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Button, Badge, Alert, AlertDescription, Label, Separator } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';
  import {
    getHierarchyPresetDefinition,
    getHierarchyPresetDepartments,
    getHierarchyPresetOperatingRules,
    type HierarchyPreset,
  } from '@clawdev/shared';

  onMount(() => breadcrumbStore.set([
    { label: 'Issues', href: `/${$page.params.companyPrefix}/issues` },
    { label: 'New' },
  ]));

  let title = $state('');
  let description = $state('');
  let sddSpec = $state('');
  let sddDesign = $state('');
  let sddValidation = $state('');
  let status = $state('todo');
  let priority = $state('medium');
  let creating = $state(false);
  let error = $state('');
  let agents = $state<any[]>([]);
  let assigneeAgentId = $state('');
  let projects = $state<any[]>([]);
  let projectId = $state('');
  let labels = $state<any[]>([]);
  let labelIds = $state<string[]>([]);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
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
  const SDD_ISSUE_FLOW = [
    { label: 'Spec', description: 'State the problem and the expected result.' },
    { label: 'Design', description: 'Link the issue to the right project, owner, and impact.' },
    { label: 'Validate', description: 'Confirm dependencies, priority, and acceptance criteria.' },
    { label: 'Implement', description: 'Only after the issue is ready for execution.' },
  ] as const;

  $effect(() => {
    if (!companyId) return;
    api(`/api/companies/${companyId}/agents`).then(r => r.json()).then(d => {
      agents = Array.isArray(d) ? d : d.agents ?? [];
    }).catch(() => {});
    api(`/api/companies/${companyId}/projects`).then(r => r.json()).then(d => {
      projects = Array.isArray(d) ? d : d.projects ?? [];
    }).catch(() => {});
    api(`/api/companies/${companyId}/labels`).then(r => r.json()).then(d => {
      labels = Array.isArray(d) ? d : d.labels ?? [];
    }).catch(() => {});
  });

  const statuses = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'in_review', label: 'In Review' },
    { value: 'done', label: 'Done' },
    { value: 'blocked', label: 'Blocked' },
  ];
  const priorities = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  function labelDotStyle(color: string) {
    const map: Record<string, string> = {
      red: '#ef4444',
      orange: '#f97316',
      yellow: '#eab308',
      green: '#22c55e',
      blue: '#3b82f6',
      purple: '#a855f7',
      pink: '#ec4899',
      zinc: '#71717a',
    };
    return `background-color: ${map[color] ?? map.blue};`;
  }

  async function create() {
    if (!title.trim() || !companyId) return;
    creating = true;
    error = '';
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        sddSpec: sddSpec.trim(),
        sddDesign: sddDesign.trim(),
        sddValidation: sddValidation.trim() || undefined,
        status,
        priority,
      };
      if (assigneeAgentId) body.assigneeAgentId = assigneeAgentId;
      if (projectId) body.projectId = projectId;
      if (labelIds.length > 0) body.labelIds = labelIds;

      const res = await api(`/api/companies/${companyId}/issues`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const issue = await res.json();
      if (!res.ok) throw new Error(issue?.error ?? 'Failed to create issue');
      goto(`/${$page.params.companyPrefix}/issues/${issue.id}`);
    } catch (e: any) {
      error = e.message;
    } finally {
      creating = false;
    }
  }
</script>

<PageLayout title="Create Issue" description="Create a new issue for this company." fullWidth>
  {#if hierarchyPresetDefinition}
    <Card class="mb-4 rounded-xl border-border/60 backdrop-blur-sm">
      <CardContent class="pt-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="max-w-3xl">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hierarchy preset</p>
            <h2 class="mt-1 text-lg font-semibold text-foreground">{hierarchyPresetDefinition.label}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{hierarchyPresetDefinition.description}</p>
          </div>
          <div class="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issue intake rule</p>
            <p class="mt-1 text-sm text-foreground">Tie the issue to the current operating model before execution.</p>
          </div>
        </div>

        <div class="mt-5 grid gap-4 xl:grid-cols-[1fr_0.95fr]">
          <div class="rounded-xl border border-border/60 bg-background/60 p-4">
            <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SDD flow</p>
            <div class="mt-3 space-y-2">
              {#each SDD_ISSUE_FLOW as step, index}
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

  <Card class="rounded-xl border-border/60 backdrop-blur-sm">
    <CardHeader>
      <CardTitle>Create Issue</CardTitle>
    </CardHeader>
    <CardContent>
      <form onsubmit={(e) => { e.preventDefault(); create(); }} class="space-y-4">
        <div>
          <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Title *</Label>
          <Input bind:value={title} required placeholder="Issue title" />
        </div>

        <div>
          <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Description</Label>
          <textarea bind:value={description} rows={4} placeholder="Describe the issue..."
            class="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30"></textarea>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div>
            <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Spec *</Label>
            <textarea bind:value={sddSpec} rows={4} placeholder="State the problem and the success criteria."
              class="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30 resize-none"></textarea>
          </div>
          <div>
            <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Design *</Label>
            <textarea bind:value={sddDesign} rows={4} placeholder="Map the owners, execution slices, and dependencies."
              class="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30 resize-none"></textarea>
          </div>
        </div>

        <div>
          <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Validation</Label>
          <textarea bind:value={sddValidation} rows={3} placeholder="Describe how to verify it is safe to implement."
            class="flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30 resize-none"></textarea>
        </div>

        <Separator />

        <div class="grid grid-cols-2 gap-4">
          <div>
            <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Status</Label>
            <select bind:value={status}
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30 capitalize">
              {#each statuses as s}<option value={s.value}>{s.label}</option>{/each}
            </select>
          </div>

          <div>
            <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Priority</Label>
            <select bind:value={priority}
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30 capitalize">
              {#each priorities as p}<option value={p.value}>{p.label}</option>{/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Assignee Agent</Label>
            <select bind:value={assigneeAgentId}
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30">
              <option value="">Unassigned</option>
              {#each agents as a}<option value={a.id}>{a.name}</option>{/each}
            </select>
          </div>

          <div>
            <Label class="text-xs font-medium text-muted-foreground mb-1.5 block">Project</Label>
            <select bind:value={projectId}
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none dark:bg-input/30">
              <option value="">No project</option>
              {#each projects as p}<option value={p.id}>{p.name}</option>{/each}
            </select>
          </div>
        </div>

        <Separator />

        <div>
          <div class="flex items-center justify-between gap-2">
            <Label class="text-xs font-medium text-muted-foreground">Labels</Label>
            <span class="text-[11px] text-muted-foreground">{labelIds.length} selected</span>
          </div>
          {#if labels.length === 0}
            <p class="mt-1 text-xs text-muted-foreground">No labels yet.</p>
          {:else}
            <div class="mt-2 flex flex-wrap gap-2">
              {#each labels as label}
                {@const selected = labelIds.includes(label.id)}
                <button
                  type="button"
                  onclick={() => {
                    labelIds = selected ? labelIds.filter((id) => id !== label.id) : [...labelIds, label.id];
                  }}
                  class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 {selected
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'}"
                >
                  <span class="h-2 w-2 rounded-full" style={labelDotStyle(label.color)}></span>
                  {label.name}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        {#if error}
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        {/if}
      </form>
    </CardContent>
    <CardFooter class="flex items-center gap-3 pt-0">
      <Button class="flex-1 cursor-pointer" disabled={creating || !title.trim() || !sddSpec.trim() || !sddDesign.trim()} onclick={() => create()}>
        {creating ? 'Creating...' : 'Create Issue'}
      </Button>
      <Button variant="outline" class="cursor-pointer" href="/{$page.params.companyPrefix}/issues">
        Cancel
      </Button>
    </CardFooter>
  </Card>
</PageLayout>
