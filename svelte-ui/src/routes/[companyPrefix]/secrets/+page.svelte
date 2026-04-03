<script lang="ts">
  import { page } from '$app/stores';
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { KeyRound, Plus, RotateCw, Trash2, ShieldAlert, Clock, Tag, Search, X, Eye, EyeOff } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Secrets' }]));

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Secret {
    id: string;
    name: string;
    description?: string | null;
    provider?: string | null;
    lastRotatedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let secrets = $state<Secret[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');

  // Create form
  let showCreateForm = $state(false);
  let creating = $state(false);
  let createError = $state<string | null>(null);
  let newName = $state('');
  let newValue = $state('');
  let newDescription = $state('');
  let showValue = $state(false);

  // Actions
  let rotatingId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let confirmRotateId = $state<string | null>(null);

  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let prefix = $derived($page.params.companyPrefix);

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------
  let filteredSecrets = $derived.by(() => {
    if (!searchQuery.trim()) return secrets;
    const q = searchQuery.trim().toLowerCase();
    return secrets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q) ||
        (s.provider ?? '').toLowerCase().includes(q)
    );
  });

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  $effect(() => {
    if (!companyId) return;
    loading = true;
    error = null;
    api(`/api/companies/${companyId}/secrets`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        secrets = (Array.isArray(d) ? d : d.secrets ?? []) as Secret[];
      })
      .catch((e) => {
        error = e.message ?? 'Failed to load secrets';
      })
      .finally(() => {
        loading = false;
      });
  });

  // ---------------------------------------------------------------------------
  // Create secret
  // ---------------------------------------------------------------------------
  async function createSecret() {
    if (!companyId || !newName.trim() || !newValue.trim()) return;
    creating = true;
    createError = null;
    try {
      const res = await api(`/api/companies/${companyId}/secrets`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          value: newValue.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const created = await res.json();
      secrets = [created, ...secrets];
      resetCreateForm();
    } catch (e: any) {
      createError = e.message ?? 'Failed to create secret';
    } finally {
      creating = false;
    }
  }

  function resetCreateForm() {
    showCreateForm = false;
    newName = '';
    newValue = '';
    newDescription = '';
    showValue = false;
    createError = null;
  }

  // ---------------------------------------------------------------------------
  // Rotate secret
  // ---------------------------------------------------------------------------
  async function rotateSecret(id: string) {
    rotatingId = id;
    try {
      const res = await api(`/api/secrets/${id}/rotate`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      secrets = secrets.map((s) => (s.id === id ? { ...s, ...updated, lastRotatedAt: updated.lastRotatedAt ?? new Date().toISOString() } : s));
    } catch (e) {
      console.error('Failed to rotate secret:', e);
    } finally {
      rotatingId = null;
      confirmRotateId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete secret
  // ---------------------------------------------------------------------------
  async function deleteSecret(id: string) {
    deletingId = id;
    try {
      const res = await api(`/api/secrets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      secrets = secrets.filter((s) => s.id !== id);
    } catch (e) {
      console.error('Failed to delete secret:', e);
    } finally {
      deletingId = null;
      confirmDeleteId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function timeAgo(dateStr: string | null | undefined): string {
    if (!dateStr) return 'never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(dateStr));
  }

  function providerBadgeColor(provider: string | null | undefined): string {
    if (!provider) return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    const colors: Record<string, string> = {
      openai: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      anthropic: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      github: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      aws: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      gcp: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      azure: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
      custom: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    };
    return colors[provider.toLowerCase()] ?? 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
</script>

<div class="space-y-6 p-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-foreground">Secrets</h1>
      <p class="mt-1 text-sm text-muted-foreground">Manage API keys, tokens, and credentials</p>
    </div>
    <button
      onclick={() => { showCreateForm = !showCreateForm; }}
      class="inline-flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1d4ed8] active:scale-[0.98]"
    >
      {#if showCreateForm}
        <X class="w-4 h-4" />
        Cancel
      {:else}
        <Plus class="w-4 h-4" />
        Add Secret
      {/if}
    </button>
  </div>

  <!-- Create form -->
  {#if showCreateForm}
    <section class="rounded-xl border border-border bg-card overflow-hidden">
      <div class="flex items-center gap-3 px-5 py-4 border-b border-border/50">
        <div class="rounded-lg bg-blue-500/10 p-2">
          <KeyRound class="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <h2 class="text-sm font-semibold text-foreground">New Secret</h2>
          <p class="text-xs text-muted-foreground">Secret values are encrypted and cannot be viewed after creation</p>
        </div>
      </div>

      <form
        onsubmit={(e) => { e.preventDefault(); createSecret(); }}
        class="p-5 space-y-4"
      >
        <!-- Name -->
        <div>
          <label for="secret-name" class="block text-sm font-medium text-foreground mb-1">
            Name <span class="text-red-400">*</span>
          </label>
          <input
            id="secret-name"
            type="text"
            bind:value={newName}
            placeholder="e.g. OPENAI_API_KEY"
            required
            class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground font-mono placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- Value -->
        <div>
          <label for="secret-value" class="block text-sm font-medium text-foreground mb-1">
            Value <span class="text-red-400">*</span>
          </label>
          <div class="relative">
            <input
              id="secret-value"
              type={showValue ? 'text' : 'password'}
              bind:value={newValue}
              placeholder="Enter secret value"
              required
              class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 pr-10 text-sm text-foreground font-mono placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onclick={() => { showValue = !showValue; }}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              title={showValue ? 'Hide value' : 'Show value'}
            >
              {#if showValue}
                <EyeOff class="h-4 w-4" />
              {:else}
                <Eye class="h-4 w-4" />
              {/if}
            </button>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">This value will be encrypted and cannot be retrieved after saving.</p>
        </div>

        <!-- Description -->
        <div>
          <label for="secret-description" class="block text-sm font-medium text-foreground mb-1">
            Description <span class="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            id="secret-description"
            type="text"
            bind:value={newDescription}
            placeholder="What is this secret used for?"
            class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <!-- Error -->
        {#if createError}
          <div class="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
            <p class="text-sm text-red-400">{createError}</p>
          </div>
        {/if}

        <!-- Submit -->
        <div class="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={creating || !newName.trim() || !newValue.trim()}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <KeyRound class="h-4 w-4" />
            {creating ? 'Creating...' : 'Create Secret'}
          </button>
          <button
            type="button"
            onclick={resetCreateForm}
            class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  {/if}

  <!-- Search -->
  {#if !loading && secrets.length > 0}
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        placeholder="Search secrets..."
        bind:value={searchQuery}
        class="w-full sm:w-64 rounded-lg border border-border bg-card pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2563EB] transition"
      />
    </div>
  {/if}

  <!-- Loading skeleton -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-[72px] animate-pulse rounded-xl bg-card border border-border"></div>
      {/each}
    </div>

  <!-- Error -->
  {:else if error}
    <div class="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
      <p class="text-sm text-red-400">{error}</p>
      <button
        onclick={() => {
          loading = true;
          error = null;
          api(`/api/companies/${companyId}/secrets`)
            .then((r) => r.json())
            .then((d) => { secrets = (Array.isArray(d) ? d : d.secrets ?? []) as Secret[]; })
            .catch((e) => { error = e.message; })
            .finally(() => { loading = false; });
        }}
        class="mt-3 text-sm text-[#2563EB] hover:underline"
      >
        Retry
      </button>
    </div>

  <!-- Empty -->
  {:else if filteredSecrets.length === 0}
    <div class="flex flex-col items-center justify-center py-16 text-center">
      <div class="rounded-full bg-accent/60 p-4 mb-4">
        <KeyRound class="w-8 h-8 text-muted-foreground" />
      </div>
      {#if secrets.length === 0}
        <h3 class="text-lg font-medium text-foreground">No secrets yet</h3>
        <p class="mt-1 text-sm text-muted-foreground">Add your first API key or credential to get started.</p>
        <button
          onclick={() => { showCreateForm = true; }}
          class="mt-4 text-sm text-[#2563EB] hover:underline"
        >
          Add your first secret
        </button>
      {:else}
        <p class="text-muted-foreground text-sm">No secrets match your search.</p>
      {/if}
    </div>

  <!-- Secrets list -->
  {:else}
    <div class="rounded-xl border border-border bg-card overflow-hidden">
      {#each filteredSecrets as secret, i (secret.id)}
        <div
          class="flex items-center gap-4 px-5 py-4 transition hover:bg-accent/40
            {i < filteredSecrets.length - 1 ? 'border-b border-border/50' : ''}"
        >
          <!-- Icon -->
          <div class="rounded-lg bg-accent/60 p-2 shrink-0">
            <KeyRound class="h-4 w-4 text-muted-foreground" />
          </div>

          <!-- Name & description -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2.5">
              <span class="text-sm font-semibold text-foreground font-mono truncate">{secret.name}</span>
              {#if secret.provider}
                <span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none {providerBadgeColor(secret.provider)}">
                  {secret.provider}
                </span>
              {/if}
            </div>
            {#if secret.description}
              <p class="text-xs text-muted-foreground mt-0.5 truncate">{secret.description}</p>
            {/if}
          </div>

          <!-- Value placeholder -->
          <div class="hidden sm:flex items-center gap-1.5 shrink-0">
            <ShieldAlert class="h-3.5 w-3.5 text-muted-foreground" />
            <span class="text-xs text-muted-foreground font-mono">••••••••</span>
          </div>

          <!-- Created date -->
          <div class="hidden md:flex items-center gap-1.5 shrink-0">
            <Clock class="h-3.5 w-3.5 text-muted-foreground" />
            <span class="text-xs text-muted-foreground tabular-nums">{formatDate(secret.createdAt)}</span>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Rotate -->
            {#if confirmRotateId === secret.id}
              <div class="flex items-center gap-1.5">
                <button
                  onclick={() => rotateSecret(secret.id)}
                  disabled={rotatingId === secret.id}
                  class="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                >
                  {rotatingId === secret.id ? 'Rotating...' : 'Confirm'}
                </button>
                <button
                  onclick={() => { confirmRotateId = null; }}
                  class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
              </div>
            {:else if confirmDeleteId === secret.id}
              <div class="flex items-center gap-1.5">
                <button
                  onclick={() => deleteSecret(secret.id)}
                  disabled={deletingId === secret.id}
                  class="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === secret.id ? 'Deleting...' : 'Confirm'}
                </button>
                <button
                  onclick={() => { confirmDeleteId = null; }}
                  class="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/40"
                >
                  Cancel
                </button>
              </div>
            {:else}
              <button
                onclick={() => { confirmRotateId = secret.id; confirmDeleteId = null; }}
                disabled={rotatingId === secret.id}
                title="Rotate secret"
                class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-amber-400 disabled:opacity-50"
              >
                <RotateCw class="h-4 w-4 {rotatingId === secret.id ? 'animate-spin' : ''}" />
              </button>
              <button
                onclick={() => { confirmDeleteId = secret.id; confirmRotateId = null; }}
                disabled={deletingId === secret.id}
                title="Delete secret"
                class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Summary -->
    <p class="text-xs text-muted-foreground text-center">
      {filteredSecrets.length} secret{filteredSecrets.length !== 1 ? 's' : ''} stored
      {#if searchQuery.trim() && filteredSecrets.length !== secrets.length}
        <span class="text-muted-foreground/60">(filtered from {secrets.length} total)</span>
      {/if}
    </p>
  {/if}
</div>
