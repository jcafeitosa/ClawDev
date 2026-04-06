<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Copy, Plus, Trash2, Bot, Rocket, Zap } from 'lucide-svelte';
  import { Card, CardContent, Badge, Button, Input, Skeleton } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Templates' }]));

  let loading = $state(true);
  let templates = $state<any[]>([]);
  let showCreate = $state(false);

  // Create form
  let newName = $state('');
  let newDescription = $state('');
  let newRole = $state('general');
  let newAdapterType = $state('process');
  let creating = $state(false);

  let companyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let prefix = $derived($page.params.companyPrefix);

  $effect(() => {
    if (!companyId) return;
    loading = true;
    api(`/api/companies/${companyId}/agent-templates`)
      .then((r) => r.json())
      .then((d) => { templates = Array.isArray(d) ? d : []; })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function createTemplate() {
    if (!newName.trim() || !companyId) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/agent-templates`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          baseConfig: { role: newRole, adapterType: newAdapterType },
        }),
      });
      const t = await res.json();
      templates = [t, ...templates];
      newName = '';
      newDescription = '';
      showCreate = false;
    } catch (e) { console.error(e); }
    finally { creating = false; }
  }

  async function instantiate(templateId: string) {
    try {
      const res = await api(`/api/agent-templates/${templateId}/instantiate`, {
        method: 'POST',
        body: '{}',
      });
      const agent = await res.json();
      // Could navigate to the new agent
      templates = templates.map((t) =>
        t.id === templateId ? { ...t, usageCount: (t.usageCount ?? 0) + 1 } : t,
      );
    } catch (e) { console.error(e); }
  }

  async function deleteTemplate(templateId: string) {
    try {
      await api(`/api/agent-templates/${templateId}`, { method: 'DELETE' });
      templates = templates.filter((t) => t.id !== templateId);
    } catch (e) { console.error(e); }
  }

  function formatDate(d: string | undefined) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<PageLayout title="Templates" description="Agent templates for quick cloning">
  {#snippet actions()}
    <Button variant="outline" size="sm" onclick={() => (showCreate = !showCreate)}>
      <Plus class="h-4 w-4" />
      New Template
    </Button>
  {/snippet}

  {#if showCreate}
    <Card>
      <CardContent class="pt-5">
        <form onsubmit={(e) => { e.preventDefault(); createTemplate(); }} class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="tmpl-name" class="block text-xs font-medium text-foreground mb-1">Template Name</label>
              <Input id="tmpl-name" bind:value={newName} placeholder="e.g. Backend Developer" />
            </div>
            <div>
              <label for="tmpl-role" class="block text-xs font-medium text-foreground mb-1">Role</label>
              <Input id="tmpl-role" bind:value={newRole} placeholder="e.g. developer, reviewer" />
            </div>
          </div>
          <div>
            <label for="tmpl-desc" class="block text-xs font-medium text-foreground mb-1">Description</label>
            <textarea id="tmpl-desc" bind:value={newDescription} rows="2" placeholder="What kind of agent does this create?" class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none resize-none"></textarea>
          </div>
          <div>
            <label for="tmpl-adapter" class="block text-xs font-medium text-foreground mb-1">Adapter Type</label>
            <select id="tmpl-adapter" bind:value={newAdapterType} class="w-full selection:bg-primary selection:text-primary-foreground border-input dark:bg-input/30 rounded-md px-3 py-2 text-sm text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none">
              <option value="process">Process</option>
              <option value="docker">Docker</option>
              <option value="api">API</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <Button type="submit" disabled={creating || !newName.trim()}>
              {creating ? 'Creating...' : 'Create Template'}
            </Button>
            <Button variant="outline" type="button" onclick={() => (showCreate = false)}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  {/if}

  {#if loading}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each Array(6) as _}<Skeleton class="h-36 rounded-xl" />{/each}
    </div>
  {:else if templates.length === 0}
    <Card>
      <CardContent class="p-12 text-center">
        <div class="flex flex-col items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
            <Copy class="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p class="text-sm font-medium text-muted-foreground">No templates yet</p>
          <p class="text-xs text-muted-foreground/60">Create templates to quickly clone pre-configured agents.</p>
          <Button variant="outline" class="mt-2" onclick={() => (showCreate = true)}>
            <Plus class="h-4 w-4" />
            New Template
          </Button>
        </div>
      </CardContent>
    </Card>
  {:else}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each templates as t (t.id)}
        {@const config = (t.baseConfig ?? {}) as Record<string, unknown>}
        <Card class="group hover:border-blue-500/30 transition-colors">
          <CardContent class="pt-5">
            <div class="flex items-start gap-3">
              <div class="rounded-lg p-2 bg-violet-500/10">
                <Bot class="h-5 w-5 text-violet-500" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="font-medium text-foreground text-sm">{t.name}</h3>
                {#if t.description}
                  <p class="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2">{t.description}</p>
                {/if}
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5 mt-3">
              {#if config.role}
                <Badge variant="outline" class="text-[10px]">{config.role}</Badge>
              {/if}
              {#if config.adapterType}
                <Badge variant="outline" class="text-[10px]">{config.adapterType}</Badge>
              {/if}
              {#if t.isPublic}
                <Badge variant="outline" class="text-[10px] text-green-400">Public</Badge>
              {/if}
            </div>

            <div class="flex items-center justify-between mt-4 pt-3 border-t border-border/30">
              <span class="text-xs text-muted-foreground tabular-nums">{t.usageCount ?? 0} uses</span>
              <div class="flex items-center gap-1">
                <Button size="sm" variant="outline" class="h-7 px-2" onclick={() => instantiate(t.id)}>
                  <Rocket class="h-3 w-3" />
                  <span class="text-[10px] ml-1">Instantiate</span>
                </Button>
                <Button size="sm" variant="outline" class="h-7 px-2 text-red-400" onclick={() => deleteTemplate(t.id)}>
                  <Trash2 class="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      {/each}
    </div>
    <p class="mt-2 text-right text-xs text-muted-foreground/60">{templates.length} template{templates.length === 1 ? '' : 's'}</p>
  {/if}
</PageLayout>
