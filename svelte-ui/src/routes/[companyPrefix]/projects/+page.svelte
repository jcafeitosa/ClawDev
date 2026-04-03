<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { FolderKanban, Plus, Calendar, CircleDot, FolderOpen } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Projects' }]));

  let loading = $state(true);
  let projects = $state<any[]>([]);
  let showCreate = $state(false);
  let newName = $state('');
  let newDescription = $state('');
  let creating = $state(false);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

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
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      const p = await res.json();
      projects = [...projects, p];
      newName = '';
      newDescription = '';
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
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Projects</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage your team's projects and track progress</p>
    </div>
    <button
      onclick={() => (showCreate = !showCreate)}
      class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      <Plus class="h-4 w-4" />
      New Project
    </button>
  </div>

  <!-- Create form -->
  {#if showCreate}
    <form
      onsubmit={(e) => { e.preventDefault(); createProject(); }}
      class="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <div>
        <label for="proj-name" class="block text-sm font-medium text-foreground mb-1">Project Name</label>
        <input
          id="proj-name"
          bind:value={newName}
          placeholder="e.g. API Redesign"
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label for="proj-desc" class="block text-sm font-medium text-foreground mb-1">Description</label>
        <textarea
          id="proj-desc"
          bind:value={newDescription}
          placeholder="Brief description..."
          rows="2"
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        ></textarea>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Project'}
        </button>
        <button
          type="button"
          onclick={() => (showCreate = false)}
          class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
        >
          Cancel
        </button>
      </div>
    </form>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}
        <div class="h-40 animate-pulse rounded-xl border border-border bg-card"></div>
      {/each}
    </div>
  {:else if projects.length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <FolderOpen class="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 class="text-lg font-medium text-foreground">No projects yet</h3>
      <p class="mt-1 text-sm text-muted-foreground">Create your first project to get started</p>
      <button
        onclick={() => (showCreate = true)}
        class="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus class="h-4 w-4" />
        New Project
      </button>
    </div>
  {:else}
    <!-- Project cards grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each projects as project (project.id)}
        <a
          href="/{prefix}/projects/{project.id}"
          class="group rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/40 hover:border-white/[0.12]"
        >
          <div class="flex items-start gap-3 mb-3">
            <div class="rounded-lg bg-blue-600/10 p-2">
              <FolderKanban class="h-5 w-5 text-blue-500" />
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">
                {project.name}
              </h3>
              {#if project.description}
                <p class="mt-1 text-xs text-muted-foreground line-clamp-2">{project.description}</p>
              {/if}
            </div>
          </div>

          <div class="flex items-center gap-4 text-xs text-muted-foreground">
            {#if project.targetDate}
              <span class="inline-flex items-center gap-1">
                <Calendar class="h-3.5 w-3.5" />
                {formatDate(project.targetDate)}
              </span>
            {/if}
            {#if project.issueCount !== undefined}
              <span class="inline-flex items-center gap-1">
                <CircleDot class="h-3.5 w-3.5" />
                {project.issueCount} issue{project.issueCount === 1 ? '' : 's'}
              </span>
            {/if}
          </div>

          {#if project.status}
            <div class="mt-3 pt-3 border-t border-border/50">
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
                {project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                 project.status === 'archived' ? 'bg-zinc-500/10 text-zinc-400' :
                 'bg-blue-500/10 text-blue-400'}">
                {project.status}
              </span>
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
