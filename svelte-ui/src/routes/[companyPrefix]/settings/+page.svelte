<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    Settings, Save, AlertTriangle, Trash2, Palette, Building2,
    Upload, X, Users, Archive, Image as ImageIcon, Link, Copy,
    Download, Package, Sparkles,
  } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Settings' }]));

  // --- General state ---
  let saving = $state(false);
  let saved = $state(false);
  let deleting = $state(false);
  let confirmDelete = $state(false);
  let confirmText = $state('');
  let archiving = $state(false);
  let confirmArchive = $state(false);

  let companyName = $state('');
  let companyDescription = $state('');
  let companyId = $derived(companyStore.selectedCompany?.id);

  $effect(() => {
    companyName = companyStore.selectedCompany?.name ?? '';
    companyDescription = (companyStore.selectedCompany?.description as string) ?? '';
  });

  async function saveGeneral() {
    if (!companyId || !companyName.trim()) return;
    saving = true;
    saved = false;
    try {
      await api(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: companyName.trim(),
          description: companyDescription.trim() || null,
        }),
      });
      saved = true;
      toastStore.push({ title: 'Settings saved', tone: 'success' });
      setTimeout(() => (saved = false), 3000);
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to save settings', tone: 'error' });
    } finally {
      saving = false;
    }
  }

  // --- Appearance: Logo ---
  let logoUploading = $state(false);
  let logoPreview = $derived(companyStore.selectedCompany?.logoUrl as string | undefined);
  let logoInput: HTMLInputElement | undefined = $state();

  async function uploadLogo(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !companyId) return;

    if (file.size > 2 * 1024 * 1024) {
      toastStore.push({ title: 'File too large', body: 'Maximum file size is 2 MB', tone: 'warn' });
      return;
    }

    logoUploading = true;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/companies/${companyId}/logo`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      toastStore.push({ title: 'Logo uploaded', tone: 'success' });
      // Reload company data to get new logoUrl
      await refreshCompany();
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to upload logo', tone: 'error' });
    } finally {
      logoUploading = false;
      if (logoInput) logoInput.value = '';
    }
  }

  async function clearLogo() {
    if (!companyId) return;
    logoUploading = true;
    try {
      await api(`/api/companies/${companyId}/logo`, { method: 'DELETE' });
      toastStore.push({ title: 'Logo removed', tone: 'success' });
      await refreshCompany();
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to remove logo', tone: 'error' });
    } finally {
      logoUploading = false;
    }
  }

  // --- Appearance: Brand Color ---
  let brandColor = $state('#3B82F6');
  let savingBrandColor = $state(false);

  $effect(() => {
    const existing = companyStore.selectedCompany?.brandColor as string | undefined;
    if (existing) brandColor = existing;
  });

  async function saveBrandColor() {
    if (!companyId) return;
    savingBrandColor = true;
    try {
      await api(`/api/companies/${companyId}/branding`, {
        method: 'PATCH',
        body: JSON.stringify({ brandColor }),
      });
      toastStore.push({ title: 'Brand color saved', tone: 'success' });
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to save brand color', tone: 'error' });
    } finally {
      savingBrandColor = false;
    }
  }

  async function clearBrandColor() {
    if (!companyId) return;
    savingBrandColor = true;
    try {
      await api(`/api/companies/${companyId}/branding`, {
        method: 'PATCH',
        body: JSON.stringify({ brandColor: null }),
      });
      brandColor = '#3B82F6';
      toastStore.push({ title: 'Brand color reset', tone: 'success' });
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to reset brand color', tone: 'error' });
    } finally {
      savingBrandColor = false;
    }
  }

  // --- Hiring & Access ---
  let requireBoardApproval = $state(false);
  let savingHiring = $state(false);

  $effect(() => {
    requireBoardApproval = (companyStore.selectedCompany?.requireBoardApprovalForNewAgents as boolean) ?? false;
  });

  let inviteUrl = $derived(
    companyId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite?company=${companyId}` : '',
  );
  let inviteCopied = $state(false);

  async function saveHiring() {
    if (!companyId) return;
    savingHiring = true;
    try {
      await api(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ requireBoardApprovalForNewAgents: requireBoardApproval }),
      });
      toastStore.push({ title: 'Hiring settings saved', tone: 'success' });
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to save hiring settings', tone: 'error' });
    } finally {
      savingHiring = false;
    }
  }

  function copyInviteUrl() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    inviteCopied = true;
    setTimeout(() => (inviteCopied = false), 2000);
  }

  // --- Invite Prompt ---
  let generatingInvitePrompt = $state(false);

  async function generateInvitePrompt() {
    if (!companyId) return;
    generatingInvitePrompt = true;
    try {
      const res = await api(`/api/companies/${companyId}/openclaw/invite-prompt`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      const prompt = data.prompt ?? data.data?.prompt ?? JSON.stringify(data);
      await navigator.clipboard.writeText(prompt);
      toastStore.push({ title: 'Invite prompt copied to clipboard', tone: 'success' });
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to generate invite prompt', tone: 'error' });
    } finally {
      generatingInvitePrompt = false;
    }
  }

  // --- Company prefix for links ---
  let companyPrefix = $derived($page.params.companyPrefix);

  // --- Danger: Archive ---
  async function archiveCompany() {
    if (!companyId) return;
    archiving = true;
    try {
      await api(`/api/companies/${companyId}/archive`, { method: 'POST' });
      toastStore.push({ title: 'Company archived', tone: 'success' });
      window.location.href = '/companies';
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to archive company', tone: 'error' });
    } finally {
      archiving = false;
    }
  }

  // --- Danger: Delete ---
  async function deleteCompany() {
    if (!companyId || confirmText !== companyStore.selectedCompany?.name) return;
    deleting = true;
    try {
      await api(`/api/companies/${companyId}`, { method: 'DELETE' });
      window.location.href = '/companies';
    } catch (e) {
      console.error(e);
      toastStore.push({ title: 'Failed to delete company', tone: 'error' });
    } finally {
      deleting = false;
    }
  }

  // --- Helpers ---
  async function refreshCompany() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}`);
      if (res.ok) {
        const data = await res.json();
        const company = data.data ?? data;
        const idx = companyStore.companies.findIndex((c) => c.id === companyId);
        if (idx >= 0) {
          const updated = [...companyStore.companies];
          updated[idx] = { ...updated[idx], ...company };
          companyStore.setCompanies(updated);
        }
      }
    } catch {
      // silent
    }
  }
</script>

<div class="mx-auto max-w-3xl space-y-8 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-foreground">Company Settings</h1>
    <p class="mt-1 text-sm text-muted-foreground">Manage your company configuration</p>
  </div>

  <!-- General section -->
  <section class="rounded-xl border border-border bg-card overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-border/50">
      <div class="rounded-lg bg-blue-500/10 p-2">
        <Building2 class="h-4 w-4 text-blue-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-foreground">General</h2>
        <p class="text-xs text-muted-foreground">Basic company information</p>
      </div>
    </div>

    <div class="p-5 space-y-4">
      <div>
        <label for="company-name" class="block text-sm font-medium text-foreground mb-1">Company Name</label>
        <input
          id="company-name"
          bind:value={companyName}
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label for="company-description" class="block text-sm font-medium text-foreground mb-1">Description</label>
        <textarea
          id="company-description"
          bind:value={companyDescription}
          rows="3"
          placeholder="What does this company do?"
          class="w-full rounded-lg border border-border bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
        ></textarea>
      </div>

      {#if companyId}
        <div>
          <span class="block text-sm font-medium text-foreground mb-1">Company ID</span>
          <div class="rounded-lg border border-border bg-accent/25 px-4 py-2 text-sm text-muted-foreground font-mono select-all">
            {companyId}
          </div>
        </div>
      {/if}

      <div class="flex items-center gap-3 pt-2">
        <button
          onclick={saveGeneral}
          disabled={saving || !companyName.trim()}
          class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Save class="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {#if saved}
          <span class="text-sm text-emerald-400">Saved successfully</span>
        {/if}
      </div>
    </div>
  </section>

  <!-- Appearance section -->
  <section class="rounded-xl border border-border bg-card overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-border/50">
      <div class="rounded-lg bg-purple-500/10 p-2">
        <Palette class="h-4 w-4 text-purple-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-foreground">Appearance</h2>
        <p class="text-xs text-muted-foreground">Customize how your workspace looks</p>
      </div>
    </div>

    <div class="p-5 space-y-6">
      <!-- Theme Toggle -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Theme</p>
          <p class="text-xs text-muted-foreground">Switch between light and dark mode</p>
        </div>
        <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onclick={() => { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors bg-accent text-foreground"
          >Dark</button>
          <button
            onclick={() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
          >Light</button>
        </div>
      </div>

      <!-- Logo Upload -->
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium text-foreground">Company Logo</p>
          <p class="text-xs text-muted-foreground">PNG, JPEG, WebP, or SVG. Max 2 MB.</p>
        </div>

        <div class="flex items-center gap-4">
          {#if logoPreview}
            <div class="relative h-16 w-16 shrink-0 rounded-lg border border-border bg-accent/40 overflow-hidden">
              <img src={logoPreview} alt="Company logo" class="h-full w-full object-contain" />
            </div>
          {:else}
            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/[0.12] bg-accent/25">
              <ImageIcon class="h-6 w-6 text-muted-foreground" />
            </div>
          {/if}

          <div class="flex items-center gap-2">
            <input
              bind:this={logoInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onchange={uploadLogo}
              class="hidden"
              id="logo-upload"
            />
            <button
              onclick={() => logoInput?.click()}
              disabled={logoUploading}
              class="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
            >
              <Upload class="h-4 w-4" />
              {logoUploading ? 'Uploading...' : 'Upload Logo'}
            </button>
            {#if logoPreview}
              <button
                onclick={clearLogo}
                disabled={logoUploading}
                class="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-red-400 disabled:opacity-50"
              >
                <X class="h-4 w-4" />
                Clear
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Brand Color Picker -->
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium text-foreground">Brand Color</p>
          <p class="text-xs text-muted-foreground">Used as the accent color across your workspace</p>
        </div>

        <div class="flex items-center gap-3">
          <div
            class="h-10 w-10 shrink-0 rounded-lg border border-white/[0.12] cursor-pointer relative overflow-hidden"
            style="background-color: {brandColor};"
          >
            <input
              type="color"
              bind:value={brandColor}
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <input
            type="text"
            bind:value={brandColor}
            maxlength="7"
            placeholder="#3B82F6"
            class="w-28 rounded-lg border border-border bg-accent/60 px-3 py-2 text-sm text-foreground font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onclick={saveBrandColor}
            disabled={savingBrandColor}
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Save class="h-4 w-4" />
            {savingBrandColor ? 'Saving...' : 'Save'}
          </button>
          <button
            onclick={clearBrandColor}
            disabled={savingBrandColor}
            class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
          >
            <X class="h-3.5 w-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  </section>

  <!-- Hiring & Access section -->
  <section class="rounded-xl border border-border bg-card overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-border/50">
      <div class="rounded-lg bg-emerald-500/10 p-2">
        <Users class="h-4 w-4 text-emerald-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-foreground">Hiring & Access</h2>
        <p class="text-xs text-muted-foreground">Control how agents join and access is managed</p>
      </div>
    </div>

    <div class="p-5 space-y-5">
      <!-- Board Approval Toggle -->
      <div class="flex items-center justify-between">
        <div class="pr-4">
          <p class="text-sm font-medium text-foreground">Require board approval for new agent hires</p>
          <p class="text-xs text-muted-foreground">When enabled, new agents must be approved before they can operate</p>
        </div>
        <button
          onclick={() => { requireBoardApproval = !requireBoardApproval; }}
          role="switch"
          aria-checked={requireBoardApproval}
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#121218] {requireBoardApproval ? 'bg-blue-600' : 'bg-accent'}"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 {requireBoardApproval ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>

      <div class="flex items-center gap-3">
        <button
          onclick={saveHiring}
          disabled={savingHiring}
          class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Save class="h-4 w-4" />
          {savingHiring ? 'Saving...' : 'Save Hiring Settings'}
        </button>
      </div>

      <!-- Invite URL -->
      {#if inviteUrl}
        <div class="pt-2 border-t border-border/50">
          <p class="text-sm font-medium text-foreground mb-1">Company Invite URL</p>
          <p class="text-xs text-muted-foreground mb-2">Share this link to invite people to your company</p>
          <div class="flex items-center gap-2">
            <div class="flex-1 rounded-lg border border-border bg-accent/25 px-3 py-2 text-xs text-muted-foreground font-mono truncate select-all">
              {inviteUrl}
            </div>
            <button
              onclick={copyInviteUrl}
              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              {#if inviteCopied}
                <span class="text-emerald-400 text-xs">Copied</span>
              {:else}
                <Copy class="h-4 w-4" />
                <span class="text-xs">Copy</span>
              {/if}
            </button>
          </div>
        </div>
      {/if}

      <!-- Generate OpenClaw Invite Prompt -->
      <div class="pt-2 border-t border-border/50">
        <p class="text-sm font-medium text-foreground mb-1">OpenClaw Invite Prompt</p>
        <p class="text-xs text-muted-foreground mb-2">Generate a prompt that can be used to invite agents via OpenClaw</p>
        <button
          onclick={generateInvitePrompt}
          disabled={generatingInvitePrompt}
          class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60 disabled:opacity-50"
        >
          <Sparkles class="h-4 w-4" />
          {generatingInvitePrompt ? 'Generating...' : 'Generate OpenClaw Invite Prompt'}
        </button>
      </div>
    </div>
  </section>

  <!-- Company Packages section -->
  <section class="rounded-xl border border-border bg-card overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-border/50">
      <div class="rounded-lg bg-orange-500/10 p-2">
        <Package class="h-4 w-4 text-orange-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-foreground">Company Packages</h2>
        <p class="text-xs text-muted-foreground">Export or import your company configuration</p>
      </div>
    </div>

    <div class="p-5 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Export Company</p>
          <p class="text-xs text-muted-foreground">Download your company configuration as a portable package</p>
        </div>
        <a
          href="/{companyPrefix}/export"
          class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
        >
          <Download class="h-4 w-4" />
          Export
        </a>
      </div>

      <div class="border-t border-border/50"></div>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Import Company</p>
          <p class="text-xs text-muted-foreground">Import agents, configs, and data from a company package</p>
        </div>
        <a
          href="/{companyPrefix}/import"
          class="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
        >
          <Upload class="h-4 w-4" />
          Import
        </a>
      </div>
    </div>
  </section>

  <!-- Danger Zone -->
  <section class="rounded-xl border border-red-500/20 bg-card overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-red-500/10">
      <div class="rounded-lg bg-red-500/10 p-2">
        <AlertTriangle class="h-4 w-4 text-red-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-red-400">Danger Zone</h2>
        <p class="text-xs text-muted-foreground">Irreversible and destructive actions</p>
      </div>
    </div>

    <div class="p-5 space-y-4">
      <!-- Archive Company -->
      {#if !confirmArchive}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Archive this company</p>
            <p class="text-xs text-muted-foreground">Deactivates the company and hides it from the dashboard. Data is preserved.</p>
          </div>
          <button
            onclick={() => (confirmArchive = true)}
            class="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
          >
            <Archive class="h-4 w-4" />
            Archive Company
          </button>
        </div>
      {:else}
        <div class="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
          <p class="text-sm text-amber-400 font-medium">
            Are you sure you want to archive this company?
          </p>
          <p class="text-xs text-muted-foreground">
            The company will be deactivated and hidden. You can restore it later from the admin panel.
          </p>
          <div class="flex items-center gap-3">
            <button
              onclick={archiveCompany}
              disabled={archiving}
              class="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              <Archive class="h-4 w-4" />
              {archiving ? 'Archiving...' : 'Yes, Archive Company'}
            </button>
            <button
              onclick={() => (confirmArchive = false)}
              class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}

      <div class="border-t border-red-500/10"></div>

      <!-- Delete Company -->
      {#if !confirmDelete}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Delete this company</p>
            <p class="text-xs text-muted-foreground">Once deleted, all data will be permanently removed</p>
          </div>
          <button
            onclick={() => (confirmDelete = true)}
            class="inline-flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <Trash2 class="h-4 w-4" />
            Delete Company
          </button>
        </div>
      {:else}
        <div class="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-3">
          <p class="text-sm text-red-400 font-medium">
            Are you absolutely sure? This action cannot be undone.
          </p>
          <p class="text-xs text-muted-foreground">
            Type <span class="font-mono font-medium text-foreground">{companyStore.selectedCompany?.name}</span> to confirm.
          </p>
          <input
            bind:value={confirmText}
            placeholder="Type company name to confirm"
            class="w-full rounded-lg border border-red-500/20 bg-accent/60 px-4 py-2 text-sm text-foreground placeholder-[#94A3B8] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          <div class="flex items-center gap-3">
            <button
              onclick={deleteCompany}
              disabled={deleting || confirmText !== companyStore.selectedCompany?.name}
              class="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 class="h-4 w-4" />
              {deleting ? 'Deleting...' : 'Permanently Delete'}
            </button>
            <button
              onclick={() => { confirmDelete = false; confirmText = ''; }}
              class="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent/40"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>
