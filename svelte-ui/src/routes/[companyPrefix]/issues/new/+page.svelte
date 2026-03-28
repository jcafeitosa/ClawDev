<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Plus } from 'lucide-svelte';

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

  let companyId = $derived(companyStore.selectedCompany?.id);

  $effect(() => {
    if (!companyId) return;
    api(`/api/companies/${companyId}/agents`).then(r => r.json()).then(d => {
      agents = Array.isArray(d) ? d : d.agents ?? [];
    }).catch(() => {});
    api(`/api/companies/${companyId}/projects`).then(r => r.json()).then(d => {
      projects = Array.isArray(d) ? d : d.projects ?? [];
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

<div class="mx-auto max-w-2xl p-6 space-y-6">
  <h1 class="text-xl font-bold text-zinc-900 dark:text-zinc-50">Create Issue</h1>
  <form onsubmit={(e) => { e.preventDefault(); create(); }} class="space-y-4">
    <label class="block">
      <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Title *</span>
      <input bind:value={title} required placeholder="Issue title"
        class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
    </label>

    <label class="block">
      <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</span>
      <textarea bind:value={description} rows={4} placeholder="Describe the issue..."
        class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"></textarea>
    </label>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</span>
        <select bind:value={status}
          class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 capitalize">
          {#each statuses as s}<option value={s.value}>{s.label}</option>{/each}
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Priority</span>
        <select bind:value={priority}
          class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 capitalize">
          {#each priorities as p}<option value={p.value}>{p.label}</option>{/each}
        </select>
      </label>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <label class="block">
        <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Assignee Agent</span>
        <select bind:value={assigneeAgentId}
          class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">Unassigned</option>
          {#each agents as a}<option value={a.id}>{a.name}</option>{/each}
        </select>
      </label>

      <label class="block">
        <span class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Project</span>
        <select bind:value={projectId}
          class="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <option value="">No project</option>
          {#each projects as p}<option value={p.id}>{p.name}</option>{/each}
        </select>
      </label>
    </div>

    {#if error}<p class="text-sm text-red-500">{error}</p>{/if}

    <button type="submit" disabled={creating || !title.trim()}
      class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
      {creating ? 'Creating...' : 'Create Issue'}
    </button>
  </form>
</div>
