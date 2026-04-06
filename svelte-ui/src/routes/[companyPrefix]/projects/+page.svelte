<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { FolderKanban, Plus, Calendar, CircleDot, FolderOpen } from 'lucide-svelte';
  import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Skeleton, Separator } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

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

<PageLayout title="Projects" description="Manage your team's projects and track progress">
  {#snippet actions()}
    <Button onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Project
    </Button>
  {/snippet}

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
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newName.trim()}>
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
    <!-- Project cards grid -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each projects as project (project.id)}
        <a
          href="/{prefix}/projects/{project.id}"
          class="cursor-pointer group block no-underline transition-colors duration-150"
        >
          <Card class="transition-colors hover:bg-accent/40 hover:border-white/[0.12]">
            <CardContent class="pt-5">
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
                <Separator class="my-3" />
                <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                  {project.status}
                </Badge>
              {/if}
            </CardContent>
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</PageLayout>
