<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus } from 'lucide-svelte';
  import { Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Button, Alert, AlertDescription, Label, Separator } from '$components/ui/index.js';

  onMount(() => breadcrumbStore.set([
    { label: 'Issues', href: `/${$page.params.companyPrefix}/issues` },
    { label: 'New' },
  ]));

  let title = $state('');
  let description = $state('');
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

<div class="mx-auto max-w-2xl p-6">
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
      <Button class="flex-1 cursor-pointer" disabled={creating || !title.trim()} onclick={() => create()}>
        {creating ? 'Creating...' : 'Create Issue'}
      </Button>
      <Button variant="outline" class="cursor-pointer" href="/{$page.params.companyPrefix}/issues">
        Cancel
      </Button>
    </CardFooter>
  </Card>
</div>
