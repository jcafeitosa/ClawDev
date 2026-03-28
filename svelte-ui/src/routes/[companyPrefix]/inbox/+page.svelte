<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import {
    Inbox, Bell, CircleDot, Bot, MessageSquare, AlertTriangle, FileText,
    ChevronRight, ListTodo, ShieldCheck, Play, CheckCheck, Loader2
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Inbox' }]));

  let loading = $state(true);
  let markingAllRead = $state(false);
  let items = $state<any[]>([]);
  let activeTab = $state<'mine' | 'recent' | 'all'>('mine');

  let prefix = $derived($page.params.companyPrefix);

  /** Count unread items per tab (computed from loaded items per tab cache) */
  let tabUnreadCounts = $state<Record<string, number>>({ mine: 0, recent: 0, all: 0 });

  $effect(() => {
    loading = true;
    const endpoint =
      activeTab === 'mine' ? '/api/agents/me/inbox-lite' :
      activeTab === 'recent' ? '/api/agents/me/inbox-lite?filter=recent' :
      '/api/agents/me/inbox-lite?filter=all';

    api(endpoint)
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .then((d) => {
        const arr = Array.isArray(d) ? d : d.items ?? d.messages ?? [];
        items = arr;
        tabUnreadCounts[activeTab] = arr.filter((it: any) => it.unread !== false && it.read !== true).length;
      })
      .catch(() => {
        items = [];
      })
      .finally(() => (loading = false));
  });

  function getIcon(type: string) {
    switch (type) {
      case 'issue': return ListTodo;
      case 'approval': return ShieldCheck;
      case 'run': return Play;
      case 'comment': case 'reply': return MessageSquare;
      case 'agent': case 'mention': return Bot;
      case 'alert': case 'warning': return AlertTriangle;
      case 'document': return FileText;
      case 'notification': return Bell;
      default: return Inbox;
    }
  }

  function getIconColor(type: string): string {
    switch (type) {
      case 'issue': return 'text-blue-400 bg-blue-500/10';
      case 'approval': return 'text-amber-400 bg-amber-500/10';
      case 'run': return 'text-orange-400 bg-orange-500/10';
      case 'comment': case 'reply': return 'text-cyan-400 bg-cyan-500/10';
      case 'agent': case 'mention': return 'text-emerald-400 bg-emerald-500/10';
      case 'alert': case 'warning': return 'text-red-400 bg-red-500/10';
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
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  function itemLink(item: any): string | null {
    if (item.link) return item.link;
    if (item.entityType && item.entityId) {
      switch (item.entityType) {
        case 'issue': return `/${prefix}/issues/${item.entityId}`;
        case 'agent': return `/${prefix}/agents/${item.entityId}`;
        case 'run': return `/${prefix}/runs/${item.entityId}`;
        case 'approval': return `/${prefix}/approvals/${item.entityId}`;
        case 'project': return `/${prefix}/projects/${item.entityId}`;
        case 'goal': return `/${prefix}/goals/${item.entityId}`;
        default: return null;
      }
    }
    return null;
  }

  /** Navigate to detail page and mark item as read */
  async function handleItemClick(item: any) {
    const link = itemLink(item);
    // Mark as read locally
    if (item.unread !== false && item.read !== true) {
      item.read = true;
      item.unread = false;
      tabUnreadCounts[activeTab] = Math.max(0, (tabUnreadCounts[activeTab] ?? 1) - 1);
      // Mark as read on server (fire-and-forget)
      if (item.id) {
        api(`/api/agents/me/inbox/${item.id}/read`, { method: 'POST' }).catch(() => {});
      }
    }
    if (link) {
      goto(link);
    }
  }

  /** Mark all items in current tab as read */
  async function markAllRead() {
    markingAllRead = true;
    try {
      await api('/api/agents/me/inbox/mark-all-read', { method: 'POST' });
      items = items.map((it) => ({ ...it, read: true, unread: false }));
      tabUnreadCounts[activeTab] = 0;
      toastStore.push({ title: 'All marked as read', tone: 'success' });
    } catch {
      toastStore.push({ title: 'Failed to mark all as read', tone: 'error' });
    } finally {
      markingAllRead = false;
    }
  }

  const emptyMessages: Record<string, { title: string; body: string }> = {
    mine: { title: 'Nothing assigned to you', body: 'Items assigned to you will appear here' },
    recent: { title: 'No recent notifications', body: 'Recent activity will show up here' },
    all: { title: 'Inbox is empty', body: "You're all caught up" },
  };

  let unreadCount = $derived(items.filter((it) => it.unread !== false && it.read !== true).length);
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-[#F8FAFC]">Inbox</h1>
      <p class="mt-1 text-sm text-[#94A3B8]">Notifications and updates for you</p>
    </div>

    <!-- Mark all read button -->
    {#if unreadCount > 0}
      <button
        onclick={markAllRead}
        disabled={markingAllRead}
        class="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#121218] px-3 py-2 text-sm font-medium text-[#F8FAFC] transition-colors hover:bg-white/[0.05] disabled:opacity-50"
      >
        {#if markingAllRead}
          <Loader2 class="h-4 w-4 animate-spin" />
        {:else}
          <CheckCheck class="h-4 w-4" />
        {/if}
        Mark all read
      </button>
    {/if}
  </div>

  <!-- Tabs -->
  <div class="flex items-center gap-1 border-b border-white/[0.08]">
    {#each [
      { key: 'mine', label: 'Mine' },
      { key: 'recent', label: 'Recent' },
      { key: 'all', label: 'All' },
    ] as tab (tab.key)}
      <button
        onclick={() => (activeTab = tab.key as 'mine' | 'recent' | 'all')}
        class="relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
          {activeTab === tab.key ? 'text-[#F8FAFC]' : 'text-[#94A3B8] hover:text-[#F8FAFC]'}"
      >
        {tab.label}
        {#if (tabUnreadCounts[tab.key] ?? 0) > 0}
          <span class="inline-flex items-center justify-center rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white min-w-[18px]">
            {tabUnreadCounts[tab.key]}
          </span>
        {/if}
        {#if activeTab === tab.key}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-1">
      {#each Array(6) as _}
        <div class="flex items-center gap-4 px-4 py-3">
          <div class="h-9 w-9 animate-pulse rounded-lg bg-white/[0.05]"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 w-2/3 animate-pulse rounded bg-white/[0.05]"></div>
            <div class="h-3 w-1/3 animate-pulse rounded bg-white/[0.05]"></div>
          </div>
        </div>
      {/each}
    </div>
  {:else if items.length === 0}
    <!-- Empty state per tab -->
    {@const empty = emptyMessages[activeTab] ?? emptyMessages.all}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="rounded-full bg-white/[0.05] p-4 mb-4">
        <Inbox class="h-10 w-10 text-[#94A3B8]" />
      </div>
      <h3 class="text-lg font-medium text-[#F8FAFC]">{empty.title}</h3>
      <p class="mt-1 text-sm text-[#94A3B8]">{empty.body}</p>
    </div>
  {:else}
    <!-- Inbox items -->
    <div class="space-y-0.5">
      {#each items as item, i (item.id ?? i)}
        {@const IconComponent = getIcon(item.type ?? item.entityType)}
        {@const colorClass = getIconColor(item.type ?? item.entityType)}
        {@const link = itemLink(item)}
        {@const isUnread = item.unread !== false && item.read !== true}

        <button
          onclick={() => handleItemClick(item)}
          class="group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/[0.03] border-b border-white/[0.05] last:border-0"
        >
          <!-- Unread dot -->
          <div class="w-2 shrink-0">
            {#if isUnread}
              <div class="h-2 w-2 rounded-full bg-blue-500"></div>
            {/if}
          </div>

          <!-- Icon -->
          <div class="shrink-0 rounded-lg p-2 {colorClass}">
            <IconComponent class="h-4 w-4" />
          </div>

          <!-- Content -->
          <div class="min-w-0 flex-1">
            <h3 class="text-sm font-medium text-[#F8FAFC] truncate {isUnread ? 'font-semibold' : ''}">
              {item.title ?? item.subject ?? item.name ?? 'Notification'}
            </h3>
            {#if item.summary ?? item.body ?? item.description}
              <p class="mt-0.5 text-xs text-[#94A3B8] truncate">{item.summary ?? item.body ?? item.description}</p>
            {/if}
          </div>

          <!-- Time -->
          <span class="shrink-0 text-xs text-[#94A3B8]">{timeAgo(item.createdAt ?? item.timestamp)}</span>

          <!-- Swipe hint / chevron -->
          {#if link}
            <ChevronRight class="h-4 w-4 shrink-0 text-[#94A3B8] opacity-50 transition-transform group-hover:translate-x-0.5" />
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
