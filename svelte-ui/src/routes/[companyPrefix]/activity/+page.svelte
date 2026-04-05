<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    Activity, Bot, CircleDot, FolderKanban, MessageSquare, GitBranch,
    Zap, User, FileText, Filter, Target, ShieldCheck, Loader2
  } from 'lucide-svelte';
  import { Badge, Button, Skeleton, Separator } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Activity' }]));

  let loading = $state(true);
  let loadingMore = $state(false);
  let activities = $state<any[]>([]);
  let filterType = $state('all');
  let hasMore = $state(true);

  const PAGE_SIZE = 50;

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  const entityTypes = [
    { value: 'all', label: 'All types' },
    { value: 'issue', label: 'Issues' },
    { value: 'agent', label: 'Agents' },
    { value: 'company', label: 'Company' },
    { value: 'approval', label: 'Approvals' },
    { value: 'run', label: 'Runs' },
  ];

  $effect(() => {
    if (!companyId) return;
    loading = true;
    hasMore = true;
    const typeParam = filterType !== 'all' ? `&entityType=${filterType}` : '';
    api(`/api/companies/${companyId}/activity?limit=${PAGE_SIZE}${typeParam}`)
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : d.activities ?? d.items ?? [];
        activities = arr;
        hasMore = arr.length >= PAGE_SIZE;
      })
      .catch(console.error)
      .finally(() => (loading = false));
  });

  async function loadMore() {
    if (!companyId || loadingMore || !hasMore) return;
    loadingMore = true;
    try {
      const typeParam = filterType !== 'all' ? `&entityType=${filterType}` : '';
      const res = await api(`/api/companies/${companyId}/activity?limit=${PAGE_SIZE}&offset=${activities.length}${typeParam}`);
      const d = await res.json();
      const arr = Array.isArray(d) ? d : d.activities ?? d.items ?? [];
      activities = [...activities, ...arr];
      hasMore = arr.length >= PAGE_SIZE;
    } catch (e) {
      console.error(e);
    } finally {
      loadingMore = false;
    }
  }

  function getIcon(type: string) {
    switch (type) {
      case 'agent': return Bot;
      case 'issue': return CircleDot;
      case 'project': return FolderKanban;
      case 'run': return Zap;
      case 'comment': return MessageSquare;
      case 'commit': case 'git': return GitBranch;
      case 'document': case 'file': return FileText;
      case 'approval': return ShieldCheck;
      case 'goal': return Target;
      default: return Activity;
    }
  }

  function getIconColor(type: string): string {
    switch (type) {
      case 'agent': return 'text-emerald-400 bg-emerald-500/10';
      case 'issue': return 'text-blue-400 bg-blue-500/10';
      case 'project': return 'text-purple-400 bg-purple-500/10';
      case 'run': return 'text-orange-400 bg-orange-500/10';
      case 'comment': return 'text-cyan-400 bg-cyan-500/10';
      case 'approval': return 'text-amber-400 bg-amber-500/10';
      case 'goal': return 'text-rose-400 bg-rose-500/10';
      default: return 'text-zinc-400 bg-zinc-500/10';
    }
  }

  function timeAgo(date: string | undefined): string {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  function entityLink(item: any): string | null {
    if (!item.entityType || !item.entityId) return null;
    switch (item.entityType) {
      case 'agent': return `/${prefix}/agents/${item.entityId}`;
      case 'issue': return `/${prefix}/issues/${item.entityId}`;
      case 'project': return `/${prefix}/projects/${item.entityId}`;
      case 'run': return `/${prefix}/runs/${item.entityId}`;
      case 'approval': return `/${prefix}/approvals/${item.entityId}`;
      case 'goal': return `/${prefix}/goals/${item.entityId}`;
      default: return null;
    }
  }

  function actorDisplay(item: any): string {
    if (item.actorName) return item.actorName;
    if (item.actor) return item.actor;
    if (item.agentName) return item.agentName;
    if (item.userName) return item.userName;
    if (item.userId) return 'Board User';
    return 'System';
  }

  function actorIsSystem(item: any): boolean {
    return !item.actorName && !item.actor && !item.agentName && !item.userName && !item.userId;
  }

  /** Group activities by date label */
  function getDateLabel(dateStr: string | undefined): string {
    if (!dateStr) return 'Unknown';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (itemDate.getTime() === today.getTime()) return 'Today';
    if (itemDate.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  interface DateGroup {
    label: string;
    items: any[];
  }

  let groupedActivities = $derived.by(() => {
    const groups: DateGroup[] = [];
    let currentLabel = '';
    for (const item of activities) {
      const label = getDateLabel(item.createdAt ?? item.timestamp);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  });
</script>

<PageLayout title="Activity" description="Recent events across your workspace">
  {#snippet actions()}
    <div class="inline-flex items-center gap-2">
      <Filter class="h-4 w-4 text-muted-foreground" />
      <select
        bind:value={filterType}
        class="appearance-none rounded-lg border border-border bg-card px-3 py-2 pr-8 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {#each entityTypes as t}
          <option value={t.value}>{t.label}</option>
        {/each}
      </select>
    </div>
  {/snippet}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(8) as _}
        <div class="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
          <Skeleton class="h-9 w-9 rounded-lg" />
          <div class="flex-1 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/4" />
          </div>
        </div>
      {/each}
    </div>
  {:else if activities.length === 0}
    <!-- Empty state -->
    <div class="glass-card p-12 text-center">
      <div class="flex flex-col items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30">
          <Activity class="h-5 w-5 text-muted-foreground/40" />
        </div>
        <p class="text-sm font-medium text-muted-foreground">No activity yet</p>
        <p class="text-xs text-muted-foreground/60">Events will appear here as your team works.</p>
      </div>
    </div>
  {:else}
    <!-- Activity feed grouped by date -->
    <div class="glass-card p-0 overflow-hidden">
    <div class="space-y-6 p-5">
      {#each groupedActivities as group (group.label)}
        <!-- Date group header -->
        <div>
          <div class="sticky top-0 z-10 flex items-center gap-3 py-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
            <Separator class="flex-1" />
          </div>

          <div class="space-y-1">
            {#each group.items as item, i (item.id ?? i)}
              {@const IconComponent = getIcon(item.entityType ?? item.type)}
              {@const colorClass = getIconColor(item.entityType ?? item.type)}
              {@const link = entityLink(item)}
              <div class="flex items-start gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-accent/40 border-b border-border/50 last:border-0">
                <!-- Icon -->
                <div class="shrink-0 rounded-lg p-2 {colorClass}">
                  <IconComponent class="h-4 w-4" />
                </div>

                <!-- Content -->
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-foreground">
                    <span class="font-medium {actorIsSystem(item) ? 'text-muted-foreground' : ''}">{actorDisplay(item)}</span>
                    <span class="text-muted-foreground"> {item.action ?? item.description ?? item.message ?? 'performed an action'}</span>
                    {#if link && (item.entityName || item.entityTitle)}
                      <a href={link} class="cursor-pointer font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-150">
                        {item.entityName ?? item.entityTitle}
                      </a>
                    {:else if link}
                      <a href={link} class="cursor-pointer font-medium text-blue-400 hover:text-blue-300 hover:underline transition-colors duration-150">
                        {item.entityType ?? 'entity'}
                      </a>
                    {/if}
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">{timeAgo(item.createdAt ?? item.timestamp)}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    </div>

    <!-- Load More -->
    {#if hasMore}
      <div class="flex justify-center pt-2 pb-4">
        <Button variant="outline" onclick={loadMore} disabled={loadingMore}>
          {#if loadingMore}
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading...
          {:else}
            Load More
          {/if}
        </Button>
      </div>
    {/if}
  {/if}
</PageLayout>
