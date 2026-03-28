<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { Settings, Save, AlertTriangle, Trash2, Palette, Building2 } from 'lucide-svelte';

  onMount(() => breadcrumbStore.set([{ label: 'Settings' }]));

  let saving = $state(false);
  let saved = $state(false);
  let deleting = $state(false);
  let confirmDelete = $state(false);
  let confirmText = $state('');

  let companyName = $state('');
  let companyId = $derived(companyStore.selectedCompany?.id);

  $effect(() => {
    companyName = companyStore.selectedCompany?.name ?? '';
  });

  async function saveGeneral() {
    if (!companyId || !companyName.trim()) return;
    saving = true;
    saved = false;
    try {
      await api(`/api/companies/${companyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: companyName.trim() }),
      });
      saved = true;
      setTimeout(() => (saved = false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      saving = false;
    }
  }

  async function deleteCompany() {
    if (!companyId || confirmText !== companyStore.selectedCompany?.name) return;
    deleting = true;
    try {
      await api(`/api/companies/${companyId}`, { method: 'DELETE' });
      window.location.href = '/companies';
    } catch (e) {
      console.error(e);
    } finally {
      deleting = false;
    }
  }
</script>

<div class="mx-auto max-w-3xl space-y-8 p-6">
  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-[#F8FAFC]">Company Settings</h1>
    <p class="mt-1 text-sm text-[#94A3B8]">Manage your company configuration</p>
  </div>

  <!-- General section -->
  <section class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
      <div class="rounded-lg bg-blue-500/10 p-2">
        <Building2 class="h-4 w-4 text-blue-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-[#F8FAFC]">General</h2>
        <p class="text-xs text-[#94A3B8]">Basic company information</p>
      </div>
    </div>

    <div class="p-5 space-y-4">
      <div>
        <label for="company-name" class="block text-sm font-medium text-[#F8FAFC] mb-1">Company Name</label>
        <input
          id="company-name"
          bind:value={companyName}
          class="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {#if companyId}
        <div>
          <span class="block text-sm font-medium text-[#F8FAFC] mb-1">Company ID</span>
          <div class="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-sm text-[#94A3B8] font-mono select-all">
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
  <section class="rounded-xl border border-white/[0.08] bg-[#121218] overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05]">
      <div class="rounded-lg bg-purple-500/10 p-2">
        <Palette class="h-4 w-4 text-purple-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-[#F8FAFC]">Appearance</h2>
        <p class="text-xs text-[#94A3B8]">Customize how your workspace looks</p>
      </div>
    </div>

    <div class="p-5 space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-[#F8FAFC]">Theme</p>
          <p class="text-xs text-[#94A3B8]">Switch between light and dark mode</p>
        </div>
        <div class="flex items-center gap-1 rounded-lg border border-white/[0.08] p-0.5">
          <button
            onclick={() => { document.documentElement.classList.remove('light'); document.documentElement.classList.add('dark'); }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors bg-white/[0.1] text-[#F8FAFC]"
          >Dark</button>
          <button
            onclick={() => { document.documentElement.classList.remove('dark'); document.documentElement.classList.add('light'); }}
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors text-[#94A3B8] hover:text-[#F8FAFC]"
          >Light</button>
        </div>
      </div>
      <div>
        <p class="text-sm font-medium text-[#F8FAFC]">Brand Color</p>
        <p class="text-xs text-[#94A3B8] mb-2">Additional branding settings coming in a future update</p>
      </div>
    </div>
  </section>

  <!-- Danger Zone -->
  <section class="rounded-xl border border-red-500/20 bg-[#121218] overflow-hidden">
    <div class="flex items-center gap-3 px-5 py-4 border-b border-red-500/10">
      <div class="rounded-lg bg-red-500/10 p-2">
        <AlertTriangle class="h-4 w-4 text-red-400" />
      </div>
      <div>
        <h2 class="text-sm font-semibold text-red-400">Danger Zone</h2>
        <p class="text-xs text-[#94A3B8]">Irreversible and destructive actions</p>
      </div>
    </div>

    <div class="p-5 space-y-4">
      {#if !confirmDelete}
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-[#F8FAFC]">Delete this company</p>
            <p class="text-xs text-[#94A3B8]">Once deleted, all data will be permanently removed</p>
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
          <p class="text-xs text-[#94A3B8]">
            Type <span class="font-mono font-medium text-[#F8FAFC]">{companyStore.selectedCompany?.name}</span> to confirm.
          </p>
          <input
            bind:value={confirmText}
            placeholder="Type company name to confirm"
            class="w-full rounded-lg border border-red-500/20 bg-white/[0.05] px-4 py-2 text-sm text-[#F8FAFC] placeholder-[#94A3B8] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
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
              class="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/[0.03]"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
    </div>
  </section>
</div>
