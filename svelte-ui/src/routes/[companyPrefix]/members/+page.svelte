<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Users, Plus, UserMinus, Mail, Shield, Clock, Search, X, ChevronDown } from 'lucide-svelte';
  import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Alert, AlertTitle, AlertDescription, Skeleton, Separator, Avatar, AvatarFallback } from '$components/ui/index.js';
  import { PageLayout } from '$components/layout/index.js';

  onMount(() => breadcrumbStore.set([{ label: 'Members' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Member {
    id: string;
    userId: string;
    name?: string | null;
    email: string;
    role: 'admin' | 'member' | 'viewer' | string;
    status: 'active' | 'pending' | 'revoked' | string;
    avatarUrl?: string | null;
    joinedAt?: string | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  type InviteRole = 'admin' | 'member' | 'viewer';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let members = $state<Member[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let activeTab = $state<'active' | 'pending' | 'all'>('all');

  // Invite form
  let showInviteForm = $state(false);
  let inviting = $state(false);
  let inviteError = $state<string | null>(null);
  let inviteSuccess = $state(false);
  let inviteEmail = $state('');
  let inviteRole = $state<InviteRole>('member');
  let inviteMessage = $state('');

  // Actions
  let revokingId = $state<string | null>(null);
  let confirmRevokeId = $state<string | null>(null);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Filtered & tabbed list
  // ---------------------------------------------------------------------------
  let activeMembers = $derived(members.filter((m) => m.status === 'active'));
  let pendingMembers = $derived(members.filter((m) => m.status === 'pending'));

  let tabbedMembers = $derived.by(() => {
    if (activeTab === 'active') return activeMembers;
    if (activeTab === 'pending') return pendingMembers;
    return members;
  });

  let filteredMembers = $derived.by(() => {
    if (!searchQuery.trim()) return tabbedMembers;
    const q = searchQuery.trim().toLowerCase();
    return tabbedMembers.filter(
      (m) =>
        (m.name ?? '').toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
    );
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    loading = true;
    error = null;
    api(`/api/companies/${companyId}/members`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        members = (Array.isArray(d) ? d : d.members ?? []) as Member[];
      })
      .catch((e) => {
        error = e.message ?? 'Failed to load members';
      })
      .finally(() => {
        loading = false;
      });
  });

  // ---------------------------------------------------------------------------
  // Invite member
  // ---------------------------------------------------------------------------
  async function inviteMember() {
    if (!companyId || !inviteEmail.trim()) return;
    inviting = true;
    inviteError = null;
    inviteSuccess = false;
    try {
      const res = await api(`/api/companies/${companyId}/invites`, {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          message: inviteMessage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const invited = await res.json();
      // Add as pending member if returned
      if (invited?.id || invited?.userId) {
        const newMember: Member = {
          id: invited.id ?? invited.userId ?? crypto.randomUUID(),
          userId: invited.userId ?? invited.id ?? '',
          name: invited.name ?? null,
          email: invited.email ?? inviteEmail.trim(),
          role: invited.role ?? inviteRole,
          status: 'pending',
          joinedAt: null,
          createdAt: invited.createdAt ?? new Date().toISOString(),
        };
        members = [newMember, ...members];
      }
      inviteSuccess = true;
      setTimeout(() => {
        resetInviteForm();
      }, 2000);
    } catch (e: any) {
      inviteError = e.message ?? 'Failed to send invitation';
    } finally {
      inviting = false;
    }
  }

  function resetInviteForm() {
    showInviteForm = false;
    inviteEmail = '';
    inviteRole = 'member';
    inviteMessage = '';
    inviteError = null;
    inviteSuccess = false;
  }

  // ---------------------------------------------------------------------------
  // Revoke access
  // ---------------------------------------------------------------------------
  async function revokeAccess(member: Member) {
    revokingId = member.id;
    try {
      const res = await api(`/api/companies/${companyId}/members/${member.userId}/revoke`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      members = members.map((m) =>
        m.id === member.id ? { ...m, status: 'revoked' } : m
      );
    } catch (e) {
      console.error('Failed to revoke access:', e);
    } finally {
      revokingId = null;
      confirmRevokeId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  }

  function roleBadgeColor(role: string): string {
    const colors: Record<string, string> = {
      admin: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      member: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      viewer: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
      owner: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };
    return colors[role.toLowerCase()] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }

  function statusBadgeColor(status: string): string {
    const colors: Record<string, string> = {
      active: 'bg-emerald-500/10 text-emerald-400',
      pending: 'bg-amber-500/10 text-amber-400',
      revoked: 'bg-red-500/10 text-red-400',
    };
    return colors[status.toLowerCase()] ?? 'bg-zinc-500/10 text-zinc-400';
  }

  function memberInitials(member: Member): string {
    if (member.name) {
      return member.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    }
    return member.email.charAt(0).toUpperCase();
  }

  const ROLE_OPTIONS: { value: InviteRole; label: string; description: string }[] = [
    { value: 'admin', label: 'Admin', description: 'Full access to all resources and settings' },
    { value: 'member', label: 'Member', description: 'Can manage agents, issues, and projects' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only access to dashboards and reports' },
  ];
</script>

<PageLayout title="Members" description="Manage team access and roles">
  {#snippet actions()}
    <Button onclick={() => { showInviteForm = !showInviteForm; }}>
      {#if showInviteForm}
        <X class="w-4 h-4" />
        Cancel
      {:else}
        <Plus class="w-4 h-4" />
        Invite
      {/if}
    </Button>
  {/snippet}

  <!-- Invite form -->
  {#if showInviteForm}
    <Card class="overflow-hidden">
      <CardHeader class="flex-row items-center gap-3 border-b border-border/50">
        <div class="rounded-lg bg-blue-500/10 p-2">
          <Mail class="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <CardTitle class="text-sm">Invite Team Member</CardTitle>
          <p class="text-xs text-muted-foreground">Send an invitation to join this company</p>
        </div>
      </CardHeader>

      <form
        onsubmit={(e) => { e.preventDefault(); inviteMember(); }}
        class="p-5 space-y-4"
      >
        <!-- Email -->
        <div>
          <label for="invite-email" class="block text-sm font-medium text-foreground mb-1">
            Email <span class="text-red-400">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            bind:value={inviteEmail}
            placeholder="colleague@company.com"
            required
            class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- Role -->
        <div>
          <label for="invite-role" class="block text-sm font-medium text-foreground mb-1">
            Role <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <select
              id="invite-role"
              bind:value={inviteRole}
              class="w-full appearance-none rounded-lg border border-border bg-accent/60 px-4 py-2 pr-10 text-sm text-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {#each ROLE_OPTIONS as opt}
                <option value={opt.value} class="bg-card text-foreground">{opt.label}</option>
              {/each}
            </select>
            <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {ROLE_OPTIONS.find((o) => o.value === inviteRole)?.description ?? ''}
          </p>
        </div>

        <!-- Message -->
        <div>
          <label for="invite-message" class="block text-sm font-medium text-foreground mb-1">
            Message <span class="text-muted-foreground font-normal">(optional)</span>
          </label>
          <textarea
            id="invite-message"
            bind:value={inviteMessage}
            placeholder="Add a personal message to the invitation..."
            rows="3"
            class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] resize-none focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          ></textarea>
        </div>

        <!-- Error / Success -->
        {#if inviteError}
          <Alert variant="destructive">
            <AlertDescription>{inviteError}</AlertDescription>
          </Alert>
        {/if}
        {#if inviteSuccess}
          <Alert>
            <AlertDescription class="text-emerald-400">Invitation sent successfully!</AlertDescription>
          </Alert>
        {/if}

        <!-- Submit -->
        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim() || inviteSuccess}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Mail class="h-4 w-4" />
            {inviting ? 'Sending...' : 'Send Invitation'}
          </button>
          <button
            type="button"
            onclick={resetInviteForm}
            class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  {/if}

  <!-- Tabs + Search -->
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <!-- Tabs -->
    <div class="flex items-center gap-1 border-b border-border">
      <button
        onclick={() => { activeTab = 'all'; }}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors
          {activeTab === 'all' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
      >
        All
        <span class="ml-1 text-xs opacity-70">({members.length})</span>
        {#if activeTab === 'all'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
        {/if}
      </button>
      <button
        onclick={() => { activeTab = 'active'; }}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors
          {activeTab === 'active' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
      >
        Active
        <span class="ml-1 text-xs opacity-70">({activeMembers.length})</span>
        {#if activeTab === 'active'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
        {/if}
      </button>
      <button
        onclick={() => { activeTab = 'pending'; }}
        class="relative px-4 py-2.5 text-sm font-medium transition-colors
          {activeTab === 'pending' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
      >
        Pending
        {#if pendingMembers.length > 0}
          <span class="ml-1.5 inline-flex items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {pendingMembers.length}
          </span>
        {:else}
          <span class="ml-1 text-xs opacity-70">(0)</span>
        {/if}
        {#if activeTab === 'pending'}
          <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full"></span>
        {/if}
      </button>
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search members..."
        bind:value={searchQuery}
        class="w-full sm:w-64 rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2563EB] transition"
      />
    </div>
  </div>

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <Skeleton class="h-[72px] rounded-xl" />
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <Alert variant="destructive">
      <AlertTitle>Failed to load members</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
      <button
        onclick={() => {
          loading = true;
          error = null;
          api(`/api/companies/${companyId}/members`)
            .then((r) => r.json())
            .then((d) => { members = (Array.isArray(d) ? d : d.members ?? []) as Member[]; })
            .catch((e) => { error = e.message; })
            .finally(() => { loading = false; });
        }}
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        Retry
      </button>
    </Alert>

  <!-- Empty -->
  {:else if filteredMembers.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <Users class="w-8 h-8 text-muted-foreground" />
      </div>
      {#if members.length === 0}
        <h3 class="text-lg font-medium text-foreground">No members yet</h3>
        <p class="mt-1 text-sm text-muted-foreground">Invite your first team member to get started.</p>
        <button
          onclick={() => { showInviteForm = true; }}
          class="mt-4 text-sm text-[#2563EB] hover:underline"
        >
          Send your first invite
        </button>
      {:else}
        <p class="text-muted-foreground text-sm">No members match your search or filter.</p>
      {/if}
    </div>

  <!-- Members list -->
  {:else}
    <Card class="overflow-hidden">
      {#each filteredMembers as member, i (member.id)}
        <div
          class="flex items-center gap-4 px-5 py-4 transition hover:bg-accent/40
            {i < filteredMembers.length - 1 ? 'border-b border-border/50' : ''}"
        >
          <!-- Avatar -->
          <div class="shrink-0">
            <Avatar class="h-9 w-9">
              {#if member.avatarUrl}
                <img
                  src={member.avatarUrl}
                  alt={member.name ?? member.email}
                  class="h-9 w-9 rounded-full object-cover"
                />
              {:else}
                <AvatarFallback>{memberInitials(member)}</AvatarFallback>
              {/if}
            </Avatar>
          </div>

          <!-- Name & email -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2.5">
              <span class="text-sm font-semibold text-foreground truncate">
                {member.name ?? member.email}
              </span>
              <Badge variant="outline" class="text-[10px] {roleBadgeColor(member.role)}">
                {member.role}
              </Badge>
              <Badge variant="secondary" class="text-[10px] {statusBadgeColor(member.status)}">
                {member.status}
              </Badge>
            </div>
            {#if member.name}
              <p class="text-xs text-muted-foreground mt-0.5 truncate">{member.email}</p>
            {/if}
          </div>

          <!-- Joined date -->
          <div class="hidden md:flex items-center gap-1.5 shrink-0">
            <Clock class="h-3.5 w-3.5 text-muted-foreground" />
            <span class="text-xs text-muted-foreground tabular-nums">
              {member.status === 'pending' ? 'Invited ' + timeAgo(member.createdAt) : formatDate(member.joinedAt ?? member.createdAt)}
            </span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 shrink-0">
            {#if member.status !== 'revoked'}
              {#if confirmRevokeId === member.id}
                <div class="flex items-center gap-1.5">
                  <button
                    onclick={() => revokeAccess(member)}
                    disabled={revokingId === member.id}
                    class="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {revokingId === member.id ? 'Revoking...' : 'Confirm'}
                  </button>
                  <button
                    onclick={() => { confirmRevokeId = null; }}
                    class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <button
                  onclick={() => { confirmRevokeId = member.id; }}
                  disabled={revokingId === member.id}
                  title="Revoke access"
                  class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-red-400 disabled:opacity-50"
                >
                  <UserMinus class="h-4 w-4" />
                </button>
              {/if}
            {:else}
              <span class="text-xs text-red-400/60 italic">Revoked</span>
            {/if}
          </div>
        </div>
      {/each}
    </Card>

    <!-- Summary -->
    <p class="text-xs text-muted-foreground text-center">
      {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
      {#if searchQuery.trim() && filteredMembers.length !== tabbedMembers.length}
        <span class="text-muted-foreground/60">(filtered from {tabbedMembers.length})</span>
      {/if}
    </p>
  {/if}
</PageLayout>
