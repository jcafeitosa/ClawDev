<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    Activity, Bot, CircleDot, FolderKanban, MessageSquare, GitBranch,
    Zap, User, FileText, Filter, Target, ShieldCheck, Loader2
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Activity' }]));

  let loading = $state(true);
  let loadingMore = $state(false);
  let activities = $state<any[]>([]);
  let filterType = $state('all');
  let hasMore = $state(true);

  const PAGE_SIZE = 50;

  let companyId = $derived(companyStore.selectedCompany?.id);
  let prefix = $derived($page.params.companyPrefix);

  const entityTypes = [
    { value: 'all', label: 'All Activity' },
    { value: 'agent', label: 'Agents' },
    { value: 'issue', label: 'Issues' },
    { value: 'project', label: 'Projects' },
    { value: 'run', label: 'Runs' },
    { value: 'comment', label: 'Comments' },
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

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-[#F8FAFC]">Activity</h1>
      <p class="mt-1 text-sm text-[#94A3B8]">Recent events across your workspace</p>
    </div>

    <!-- Filter dropdown -->
    <div class="relative">
      <div class="inline-flex items-center gap-2">
        <Filter class="h-4 w-4 text-[#94A3B8]" />
        <select
          bind:value={filterType}
          class="appearance-none rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 pr-8 text-sm text-[#F8FAFC] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {#each entityTypes as t}
            <option value={t.value}>{t.label}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(8) as _}
        <div class="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#121218] p-4">
          <div class="h-9 w-9 animate-pulse rounded-lg bg-white/[0.05]"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-3/4 animate-pulse rounded bg-white/[0.05]"></div>
            <div class="h-3 w-1/4 animate-pulse rounded bg-white/[0.05]"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if activities.length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-white/[0.05] p-4 mb-4">
        <Activity class="h-10 w-10 text-[#94A3B8]" />
      </div>
      <h3 class="text-lg font-medium text-[#F8FAFC]">No activity yet</h3>
      <p class="mt-1 text-sm text-[#94A3B8]">Events will appear here as your team works</p>
    </div>
  {:else}
    <!-- Activity feed grouped by date -->
    <div class="space-y-6">
      {#each groupedActivities as group (group.label)}
        <!-- Date group header -->
        <div>
          <div class="sticky top-0 z-10 flex items-center gap-3 py-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">{group.label}</span>
            <div class="h-px flex-1 bg-white/[0.06]"></div>
          </div>

          <div class="space-y-1">
            {#each group.items as item, i (item.id ?? i)}
              {@const IconComponent = getIcon(item.entityType ?? item.type)}
              {@const colorClass = getIconColor(item.entityType ?? item.type)}
              {@const link = entityLink(item)}
              <div class="flex items-start gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.03] border-b border-white/[0.05] last:border-0">
                <!-- Icon -->
                <div class="shrink-0 rounded-lg p-2 {colorClass}">
                  <IconComponent class="h-4 w-4" />
                </div>

                <!-- Content -->
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-[#F8FAFC]">
                    <span class="font-medium {actorIsSystem(item) ? 'text-[#94A3B8]' : ''}">{actorDisplay(item)}</span>
                    <span class="text-[#94A3B8]"> {item.action ?? item.description ?? item.message ?? 'performed an action'}</span>
                    {#if link && (item.entityName || item.entityTitle)}
                      <a href={link} class="font-medium text-blue-400 hover:text-blue-300 hover:underline">
                        {item.entityName ?? item.entityTitle}
                      </a>
                    {:else if link}
                      <a href={link} class="font-medium text-blue-400 hover:text-blue-300 hover:underline">
                        {item.entityType ?? 'entity'}
                      </a>
                    {/if}
                  </p>
                  <p class="mt-0.5 text-xs text-[#94A3B8]">{timeAgo(item.createdAt ?? item.timestamp)}</p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <!-- Load More -->
    {#if hasMore}
      <div class="flex justify-center pt-2 pb-4">
        <button
          onclick={loadMore}
          disabled={loadingMore}
          class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-5 py-2.5 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.05] disabled:opacity-50"
        >
          {#if loadingMore}
            <Loader2 class="h-4 w-4 animate-spin" />
            Loading...
          {:else}
            Load More
          {/if}
        </button>
      </div>
    {/if}
  {/if}
</div>
