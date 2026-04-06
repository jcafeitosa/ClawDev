<script lang="ts">
  import { api } from '$lib/api';
  import { goto } from '$app/navigation';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { Building2, Plus, ArrowRight, Zap, Sparkles, MoreVertical, Pencil, Trash2, Bot, ListTodo, DollarSign, X, Check } from 'lucide-svelte';
  import { listHierarchyPresetDefinitions, type HierarchyPreset } from '@clawdev/shared';

  let companies = $state<any[]>([]);
  let stats = $state<Record<string, any>>({});
  let loading = $state(true);
  let showCreate = $state(false);
  let newName = $state('');
  let newHierarchyPreset = $state<HierarchyPreset>('classic_pyramid');
  let creating = $state(false);
  const hierarchyPresetOptions = listHierarchyPresetDefinitions();

  // Rename state
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let renameSaving = $state(false);

  // Delete state
  let deleteTarget = $state<any>(null);
  let deleting = $state(false);

  // Dropdown state
  let openMenuId = $state<string | null>(null);

  $effect(() => {
    Promise.all([
      api('/api/companies').then((r) => r.json()),
      api('/api/companies/stats').then((r) => r.json()).catch(() => ({})),
    ]).then(([companiesData, statsData]) => {
      companies = Array.isArray(companiesData) ? companiesData : companiesData.companies ?? [];
      // stats can be { [companyId]: { agents, issues, budgetPct } } or an array
      if (Array.isArray(statsData)) {
        stats = Object.fromEntries(statsData.map((s: any) => [s.companyId ?? s.id, s]));
      } else if (statsData && typeof statsData === 'object') {
        stats = statsData;
      }
    }).finally(() => {
      loading = false;
    });
  });

  // Close dropdown when clicking outside
  function handleBodyClick() {
    openMenuId = null;
  }

  $effect(() => {
    if (openMenuId) {
      document.addEventListener('click', handleBodyClick, { once: true });
    }
  });

  function select(c: any) {
    if (renamingId === c.id) return;
    companyStore.select(c.id, 'manual');
    goto(`/${c.slug ?? c.id}/dashboard`);
  }

  async function create() {
    if (!newName.trim()) return;
    creating = true;
    try {
      const res = await api('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), hierarchyPreset: newHierarchyPreset }),
      });
      const c = await res.json();
      companies = [...companies, c];
      newName = '';
      newHierarchyPreset = 'classic_pyramid';
      showCreate = false;
      select(c);
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to create company', tone: 'error' });
    } finally {
      creating = false;
    }
  }

  function toggleMenu(e: MouseEvent, id: string) {
    e.stopPropagation();
    openMenuId = openMenuId === id ? null : id;
  }

  function startRename(e: MouseEvent, c: any) {
    e.stopPropagation();
    openMenuId = null;
    renamingId = c.id;
    renameValue = c.name;
  }

  function cancelRename() {
    renamingId = null;
    renameValue = '';
  }

  async function saveRename(id: string) {
    if (!renameValue.trim() || renameSaving) return;
    renameSaving = true;
    try {
      const res = await api(`/api/companies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      companies = companies.map((c) => (c.id === id ? { ...c, ...updated } : c));
      toastStore.push({ title: 'Company renamed', tone: 'success' });
    } catch {
      toastStore.push({ title: 'Failed to rename company', tone: 'error' });
    } finally {
      renameSaving = false;
      renamingId = null;
      renameValue = '';
    }
  }

  function confirmDelete(e: MouseEvent, c: any) {
    e.stopPropagation();
    openMenuId = null;
    deleteTarget = c;
  }

  async function executeDelete() {
    if (!deleteTarget || deleting) return;
    deleting = true;
    try {
      const res = await api(`/api/companies/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      companies = companies.filter((c) => c.id !== deleteTarget.id);
      toastStore.push({ title: `"${deleteTarget.name}" deleted`, tone: 'success' });
    } catch {
      toastStore.push({ title: 'Failed to delete company', tone: 'error' });
    } finally {
      deleting = false;
      deleteTarget = null;
    }
  }

  function getStatusColor(status?: string): string {
    switch (status) {
      case 'active': return '#22c55e';
      case 'paused': return '#eab308';
      default: return '#64748b';
    }
  }

  function getStatusLabel(status?: string): string {
    switch (status) {
      case 'active': return 'Active';
      case 'paused': return 'Paused';
      default: return 'Active';
    }
  }

  function truncate(text: string | undefined, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
  }
</script>

<div class="companies-page">
  <div class="companies-container">
    <!-- Logo -->
    <div class="companies-logo">
      <Zap size={20} />
      <span>ClawDev</span>
    </div>

    <!-- Header -->
    <div class="companies-header">
      <div>
        <h1 class="companies-title">Your Companies</h1>
        <p class="companies-subtitle">Select an agent company or create a new one</p>
      </div>
      <button class="companies-btn-primary" onclick={() => (showCreate = !showCreate)}>
        <Plus size={16} />
        New Company
      </button>
    </div>

    <!-- Create form -->
    {#if showCreate}
      <form class="companies-create-form" onsubmit={(e) => { e.preventDefault(); create(); }}>
        <div class="companies-field">
          <label for="company-name">Company Name</label>
          <input
            id="company-name"
            bind:value={newName}
            placeholder="e.g. Acme AI Corp"
          />
        </div>
        <div class="companies-field">
          <label for="company-hierarchy-preset">Hierarchy preset</label>
          <select id="company-hierarchy-preset" bind:value={newHierarchyPreset}>
            {#each hierarchyPresetOptions as preset}
              <option value={preset.id}>{preset.label}</option>
            {/each}
          </select>
          <p class="companies-field-help">
            {#if hierarchyPresetOptions.find((preset) => preset.id === newHierarchyPreset)}
              {hierarchyPresetOptions.find((preset) => preset.id === newHierarchyPreset)?.fit}
            {/if}
          </p>
        </div>
        <div class="companies-form-actions">
          <button type="submit" class="companies-btn-primary" disabled={creating || !newName.trim()}>
            {creating ? 'Creating...' : 'Create Company'}
          </button>
          <button type="button" class="companies-btn-ghost" onclick={() => { showCreate = false; newName = ''; newHierarchyPreset = 'classic_pyramid'; }}>
            Cancel
          </button>
        </div>
      </form>
    {/if}

    <!-- Content -->
    {#if loading}
      <div class="companies-grid">
        {#each Array(3) as _}
          <div class="companies-skeleton"></div>
        {/each}
      </div>
    {:else if companies.length === 0}
      <div class="companies-empty">
        <div class="companies-empty-icon">
          <Sparkles size={28} />
        </div>
        <h3>No companies yet</h3>
        <p>Create your first AI agent company to get started.</p>
        <button class="companies-btn-primary companies-btn-lg" onclick={() => (showCreate = true)}>
          <Plus size={16} />
          Create Your First Company
        </button>
      </div>
    {:else}
      <div class="companies-grid">
        {#each companies as c (c.id)}
          {@const s = stats[c.id] ?? {}}
          <div class="companies-card" role="button" tabindex="0" onclick={() => renamingId !== c.id && select(c)} onkeydown={(e) => { if (e.key === 'Enter' && renamingId !== c.id) select(c); }}>
            <div class="companies-card-top">
              <div class="companies-card-icon">
                <Building2 size={18} />
              </div>
              <div class="companies-card-top-right">
                <span class="companies-status-badge" style:--status-color={getStatusColor(c.status)}>
                  <span class="companies-status-dot"></span>
                  {getStatusLabel(c.status)}
                </span>
                <div class="companies-menu-wrapper">
                  <button
                    class="companies-menu-btn"
                    onclick={(e) => toggleMenu(e, c.id)}
                    aria-label="Company options"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {#if openMenuId === c.id}
                    <div class="companies-dropdown">
                      <button class="companies-dropdown-item" onclick={(e) => startRename(e, c)}>
                        <Pencil size={13} />
                        Rename
                      </button>
                      <button class="companies-dropdown-item companies-dropdown-danger" onclick={(e) => confirmDelete(e, c)}>
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            {#if renamingId === c.id}
              <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
              <form class="companies-rename-form" onsubmit={(e) => { e.preventDefault(); saveRename(c.id); }}>
                <input
                  class="companies-rename-input"
                  bind:value={renameValue}
                  onkeydown={(e) => { if (e.key === 'Escape') cancelRename(); }}
                />
                <button type="submit" class="companies-rename-action" disabled={renameSaving} aria-label="Save">
                  <Check size={14} />
                </button>
                <button type="button" class="companies-rename-action" onclick={cancelRename} aria-label="Cancel">
                  <X size={14} />
                </button>
              </form>
            {:else}
              <h3 class="companies-card-name">{c.name}</h3>
            {/if}

            {#if c.description}
              <p class="companies-card-desc">{truncate(c.description, 80)}</p>
            {/if}
            <p class="companies-card-slug">{c.slug ?? c.id}</p>

            <!-- Stats row -->
            <div class="companies-card-stats">
              <span class="companies-stat" title="Agents">
                <Bot size={12} />
                {s.agents ?? s.agentCount ?? 0}
              </span>
              <span class="companies-stat" title="Issues">
                <ListTodo size={12} />
                {s.issues ?? s.issueCount ?? 0}
              </span>
              <span class="companies-stat" title="Budget used">
                <DollarSign size={12} />
                {s.budgetPct != null ? `${Math.round(s.budgetPct)}%` : '--'}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Delete confirmation dialog -->
{#if deleteTarget}
  <div
    class="companies-overlay"
    onclick={(e) => {
      if (e.currentTarget === e.target) {
        deleteTarget = null;
      }
    }}
    role="presentation"
  >
    <div class="companies-dialog" role="dialog" tabindex="0" aria-modal="true">
      <h3 class="companies-dialog-title">Delete Company</h3>
      <p class="companies-dialog-body">
        Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone. All agents, issues, and data within this company will be permanently removed.
      </p>
      <div class="companies-dialog-actions">
        <button class="companies-btn-ghost" onclick={() => { deleteTarget = null; }}>Cancel</button>
        <button class="companies-btn-danger" onclick={executeDelete} disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete Company'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .companies-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    background: #050508;
    padding: 2rem;
  }

  .companies-container {
    width: 100%;
    max-width: 720px;
  }

  /* -- Logo -- */
  .companies-logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin-bottom: 2.5rem;
  }

  .companies-logo :global(svg) {
    color: #2563eb;
  }

  /* -- Header -- */
  .companies-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .companies-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .companies-subtitle {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0.25rem 0 0;
  }

  /* -- Buttons -- */
  .companies-btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 40px;
    padding: 0 1.125rem;
    border-radius: 10px;
    border: none;
    background: #2563eb;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  .companies-btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .companies-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .companies-btn-lg {
    height: 44px;
    padding: 0 1.5rem;
    font-size: 0.9375rem;
  }

  .companies-btn-ghost {
    display: inline-flex;
    align-items: center;
    height: 40px;
    padding: 0 1rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: transparent;
    color: #94a3b8;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }

  .companies-btn-ghost:hover {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .companies-btn-danger {
    display: inline-flex;
    align-items: center;
    height: 40px;
    padding: 0 1.125rem;
    border-radius: 10px;
    border: none;
    background: #dc2626;
    color: #fff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .companies-btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }

  .companies-btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* -- Create form -- */
  .companies-create-form {
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .companies-field label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #cbd5e1;
    margin-bottom: 0.375rem;
  }

  .companies-field input {
    width: 100%;
    height: 42px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .companies-field input::placeholder {
    color: #475569;
  }

  .companies-field input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .companies-field select {
    width: 100%;
    height: 42px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .companies-field select:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .companies-field-help {
    margin: 0.4rem 0 0;
    font-size: 0.75rem;
    line-height: 1.4;
    color: #64748b;
  }

  .companies-form-actions {
    display: flex;
    gap: 0.75rem;
  }

  /* -- Grid -- */
  .companies-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.875rem;
  }

  /* -- Skeleton -- */
  .companies-skeleton {
    height: 180px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* -- Card -- */
  .companies-card {
    display: flex;
    flex-direction: column;
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.02);
    text-align: left;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.1s;
    width: 100%;
    position: relative;
  }

  .companies-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .companies-card:active {
    transform: scale(0.99);
  }

  .companies-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.875rem;
  }

  .companies-card-top-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .companies-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
  }

  /* -- Status badge -- */
  .companies-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: 22px;
    padding: 0 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.04);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--status-color, #64748b);
    text-transform: capitalize;
  }

  .companies-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--status-color, #64748b);
  }

  /* -- Menu -- */
  .companies-menu-wrapper {
    position: relative;
  }

  .companies-menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #475569;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .companies-menu-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }

  .companies-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 140px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #1a1a2e;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 50;
  }

  .companies-dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #cbd5e1;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.15s;
    text-align: left;
  }

  .companies-dropdown-item:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .companies-dropdown-danger {
    color: #f87171;
  }

  .companies-dropdown-danger:hover {
    background: rgba(248, 113, 113, 0.1);
  }

  /* -- Rename inline -- */
  .companies-rename-form {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.25rem;
  }

  .companies-rename-input {
    flex: 1;
    height: 32px;
    padding: 0 8px;
    border-radius: 6px;
    border: 1px solid rgba(37, 99, 235, 0.5);
    background: #11111a;
    color: #f8fafc;
    font-size: 0.875rem;
    font-weight: 600;
    outline: none;
  }

  .companies-rename-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
  }

  .companies-rename-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }

  .companies-rename-action:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #f8fafc;
  }

  .companies-card-name {
    font-size: 1rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
    transition: color 0.2s;
  }

  .companies-card:hover .companies-card-name {
    color: #60a5fa;
  }

  .companies-card-desc {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0.25rem 0 0;
    line-height: 1.4;
  }

  .companies-card-slug {
    font-size: 0.75rem;
    color: #475569;
    margin: 0.25rem 0 0;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  /* -- Stats row -- */
  .companies-card-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.875rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .companies-stat {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.6875rem;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }

  .companies-stat :global(svg) {
    color: #475569;
  }

  /* -- Empty state -- */
  .companies-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 4rem 2rem;
    border-radius: 16px;
    border: 1px dashed rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.01);
  }

  .companies-empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: rgba(37, 99, 235, 0.1);
    color: #60a5fa;
    margin-bottom: 1.25rem;
  }

  .companies-empty h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0;
  }

  .companies-empty p {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0.375rem 0 1.5rem;
  }

  /* -- Delete dialog overlay -- */
  .companies-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 100;
  }

  .companies-dialog {
    width: 100%;
    max-width: 420px;
    padding: 1.5rem;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #11111a;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  }

  .companies-dialog-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #f8fafc;
    margin: 0 0 0.5rem;
  }

  .companies-dialog-body {
    font-size: 0.875rem;
    color: #94a3b8;
    line-height: 1.5;
    margin: 0 0 1.5rem;
  }

  .companies-dialog-body strong {
    color: #f8fafc;
  }

  .companies-dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  /* -- Responsive -- */
  @media (max-width: 640px) {
    .companies-header {
      flex-direction: column;
      gap: 1rem;
    }

    .companies-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
