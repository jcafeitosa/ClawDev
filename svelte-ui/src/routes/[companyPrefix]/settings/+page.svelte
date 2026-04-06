<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore, resolveCompanyIdFromPrefix } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import {
    Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
    Badge, Button, Input, Separator, Alert, AlertTitle, AlertDescription,
  } from '$lib/components/ui/index.js';
  import {
    Settings, Save, AlertTriangle, Trash2, Palette, Building2,
    Upload, X, Users, Archive, Image as ImageIcon, Link, Copy,
    Download, Package, Sparkles,
  } from 'lucide-svelte';
  import { PageLayout } from '$components/layout/index.js';

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
  let routeCompanyId = $derived(resolveCompanyIdFromPrefix($page.params.companyPrefix));
  let companyId = $derived(routeCompanyId);
  let currentCompany = $derived.by(() => {
    if (!companyId) return null;
    return companyStore.companies.find((company) => company.id === companyId) ?? null;
  });

  $effect(() => {
    companyName = currentCompany?.name ?? '';
    companyDescription = (currentCompany?.description as string) ?? '';
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
  let logoPreview = $derived(currentCompany?.logoUrl as string | undefined);
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
    const existing = currentCompany?.brandColor as string | undefined;
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
    requireBoardApproval = (currentCompany?.requireBoardApprovalForNewAgents as boolean) ?? false;
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
    if (!companyId || confirmText !== currentCompany?.name) return;
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

<PageLayout title="Company Settings" description="Manage your company configuration">

  <!-- General section -->
  <Card class="p-0 overflow-hidden">
    <CardHeader>
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-blue-500/10 p-2">
          <Building2 class="h-4 w-4 text-blue-400" />
        </div>
        <div>
          <CardTitle class="text-sm">General</CardTitle>
          <CardDescription>Basic company information</CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <div>
        <label for="company-name" class="block text-sm font-medium text-foreground mb-1">Company Name</label>
        <Input id="company-name" bind:value={companyName} />
      </div>

      <div>
        <label for="company-description" class="block text-sm font-medium text-foreground mb-1">Description</label>
        <textarea
          id="company-description"
          bind:value={companyDescription}
          rows="3"
          placeholder="What does this company do?"
          class="border-input dark:bg-input/30 h-auto w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-y"
        ></textarea>
      </div>

      {#if companyId}
        <div>
          <span class="block text-sm font-medium text-foreground mb-1">Company ID</span>
          <div class="rounded-lg border border-border bg-accent/25 px-3 py-2 text-sm text-muted-foreground font-mono select-all">
            {companyId}
          </div>
        </div>
      {/if}
    </CardContent>

    <CardFooter class="gap-3">
      <Button size="sm" onclick={saveGeneral} disabled={saving || !companyName.trim()}>
        <Save class="h-4 w-4" />
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
      {#if saved}
        <span class="text-sm text-emerald-400">Saved successfully</span>
      {/if}
    </CardFooter>
  </Card>

  <!-- Appearance section -->
  <Card class="p-0 overflow-hidden">
    <CardHeader>
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-purple-500/10 p-2">
          <Palette class="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <CardTitle class="text-sm">Appearance</CardTitle>
          <CardDescription>Customize how your workspace looks</CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-6">
      <!-- Theme Toggle -->
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Theme</p>
          <p class="text-xs text-muted-foreground">Switch between light and dark mode</p>
        </div>
        <div class="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onclick={() => { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }}
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors bg-accent text-foreground"
          >Dark</button>
          <button
            onclick={() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); }}
            class="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-muted-foreground hover:text-foreground"
          >Light</button>
        </div>
      </div>

      <Separator />

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
            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-accent/25">
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
            <Button size="sm" variant="outline" onclick={() => logoInput?.click()} disabled={logoUploading}>
              <Upload class="h-4 w-4" />
              {logoUploading ? 'Uploading...' : 'Upload Logo'}
            </Button>
            {#if logoPreview}
              <Button size="sm" variant="outline" onclick={clearLogo} disabled={logoUploading} class="text-muted-foreground hover:text-red-400">
                <X class="h-4 w-4" />
                Clear
              </Button>
            {/if}
          </div>
        </div>
      </div>

      <Separator />

      <!-- Brand Color Picker -->
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium text-foreground">Brand Color</p>
          <p class="text-xs text-muted-foreground">Used as the accent color across your workspace</p>
        </div>

        <div class="flex items-center gap-3">
          <div
            class="h-10 w-10 shrink-0 rounded-lg border border-border cursor-pointer relative overflow-hidden"
            style="background-color: {brandColor};"
          >
            <input
              type="color"
              bind:value={brandColor}
              class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <Input
            type="text"
            bind:value={brandColor}
            maxlength={7}
            placeholder="#3B82F6"
            class="w-28 font-mono"
          />
          <Button size="sm" onclick={saveBrandColor} disabled={savingBrandColor}>
            <Save class="h-4 w-4" />
            {savingBrandColor ? 'Saving...' : 'Save'}
          </Button>
          <Button size="sm" variant="outline" onclick={clearBrandColor} disabled={savingBrandColor} class="text-muted-foreground">
            <X class="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>

  <!-- Hiring & Access section -->
  <Card class="p-0 overflow-hidden">
    <CardHeader>
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-emerald-500/10 p-2">
          <Users class="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <CardTitle class="text-sm">Hiring & Access</CardTitle>
          <CardDescription>Control how agents join and access is managed</CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-5">
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
          aria-label="Require board approval for new agent hires"
          title="Require board approval for new agent hires"
          class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background {requireBoardApproval ? 'bg-primary' : 'bg-accent'}"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200 {requireBoardApproval ? 'translate-x-5' : 'translate-x-0'}"
          ></span>
        </button>
      </div>

      <Button size="sm" onclick={saveHiring} disabled={savingHiring}>
        <Save class="h-4 w-4" />
        {savingHiring ? 'Saving...' : 'Save Hiring Settings'}
      </Button>

      <!-- Invite URL -->
      {#if inviteUrl}
        <Separator />
        <div>
          <p class="text-sm font-medium text-foreground mb-1">Company Invite URL</p>
          <p class="text-xs text-muted-foreground mb-2">Share this link to invite people to your company</p>
          <div class="flex items-center gap-2">
            <div class="flex-1 rounded-lg border border-border bg-accent/25 px-3 py-2 text-xs text-muted-foreground font-mono truncate select-all">
              {inviteUrl}
            </div>
            <Button variant="outline" size="sm" onclick={copyInviteUrl}>
              {#if inviteCopied}
                <span class="text-emerald-400 text-xs">Copied</span>
              {:else}
                <Copy class="h-4 w-4" />
                <span class="text-xs">Copy</span>
              {/if}
            </Button>
          </div>
        </div>
      {/if}

      <!-- Generate OpenClaw Invite Prompt -->
      <Separator />
      <div>
        <p class="text-sm font-medium text-foreground mb-1">OpenClaw Invite Prompt</p>
        <p class="text-xs text-muted-foreground mb-2">Generate a prompt that can be used to invite agents via OpenClaw</p>
        <Button size="sm" variant="outline" onclick={generateInvitePrompt} disabled={generatingInvitePrompt}>
          <Sparkles class="h-4 w-4" />
          {generatingInvitePrompt ? 'Generating...' : 'Generate OpenClaw Invite Prompt'}
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- Company Packages section -->
  <Card class="p-0 overflow-hidden">
    <CardHeader>
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-orange-500/10 p-2">
          <Package class="h-4 w-4 text-orange-400" />
        </div>
        <div>
          <CardTitle class="text-sm">Company Packages</CardTitle>
          <CardDescription>Export or import your company configuration</CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Export Company</p>
          <p class="text-xs text-muted-foreground">Download your company configuration as a portable package</p>
        </div>
        <Button size="sm" variant="outline" href="/{companyPrefix}/export">
          <Download class="h-4 w-4" />
          Export
        </Button>
      </div>

      <Separator />

      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-foreground">Import Company</p>
          <p class="text-xs text-muted-foreground">Import agents, configs, and data from a company package</p>
        </div>
        <Button size="sm" variant="outline" href="/{companyPrefix}/import">
          <Upload class="h-4 w-4" />
          Import
        </Button>
      </div>
    </CardContent>
  </Card>

  <!-- Danger Zone -->
  <Card class="p-0 overflow-hidden border-red-500/20">
    <CardHeader>
      <div class="flex items-center gap-3">
        <div class="rounded-lg bg-red-500/10 p-2">
          <AlertTriangle class="h-4 w-4 text-red-400" />
        </div>
        <div>
          <CardTitle class="text-sm text-red-400">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </div>
      </div>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- Archive Company -->
      {#if !confirmArchive}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Archive this company</p>
            <p class="text-xs text-muted-foreground">Deactivates the company and hides it from the dashboard. Data is preserved.</p>
          </div>
          <Button size="sm" variant="outline" onclick={() => (confirmArchive = true)} class="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            <Archive class="h-4 w-4" />
            Archive Company
          </Button>
        </div>
      {:else}
        <Alert variant="warning">
          <AlertTriangle class="h-4 w-4" />
          <AlertTitle>Are you sure you want to archive this company?</AlertTitle>
          <AlertDescription>
            <p>The company will be deactivated and hidden. You can restore it later from the admin panel.</p>
            <div class="flex items-center gap-3 mt-3">
              <Button size="sm" variant="destructive" onclick={archiveCompany} disabled={archiving} class="bg-amber-600 hover:bg-amber-700">
                <Archive class="h-4 w-4" />
                {archiving ? 'Archiving...' : 'Yes, Archive Company'}
              </Button>
              <Button size="sm" variant="outline" onclick={() => (confirmArchive = false)}>
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      {/if}

      <Separator class="bg-red-500/10" />

      <!-- Delete Company -->
      {#if !confirmDelete}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-foreground">Delete this company</p>
            <p class="text-xs text-muted-foreground">Once deleted, all data will be permanently removed</p>
          </div>
          <Button size="sm" variant="outline" onclick={() => (confirmDelete = true)} class="border-red-500/30 text-red-400 hover:bg-red-500/10">
            <Trash2 class="h-4 w-4" />
            Delete Company
          </Button>
        </div>
      {:else}
        <Alert variant="destructive">
          <AlertTriangle class="h-4 w-4" />
          <AlertTitle>Are you absolutely sure? This action cannot be undone.</AlertTitle>
          <AlertDescription>
            <p>
              Type <span class="font-mono font-medium text-foreground">{currentCompany?.name}</span> to confirm.
            </p>
            <Input
              bind:value={confirmText}
              placeholder="Type company name to confirm"
              class="mt-2 border-red-500/20 focus-visible:border-red-500 focus-visible:ring-red-500/50"
            />
            <div class="flex items-center gap-3 mt-3">
              <Button size="sm" variant="destructive" onclick={deleteCompany} disabled={deleting || confirmText !== currentCompany?.name}>
                <Trash2 class="h-4 w-4" />
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </Button>
              <Button size="sm" variant="outline" onclick={() => { confirmDelete = false; confirmText = ''; }}>
                Cancel
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      {/if}
    </CardContent>
  </Card>
</PageLayout>
