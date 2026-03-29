<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import StatusBadge from '$lib/components/status-badge.svelte';
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import { Search, ChevronDown, ChevronRight, Trash2, RefreshCw, FolderTree, Download, ScanSearch, FileCode2, X, Shield, ShieldCheck, Wrench } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Skill {
    id: string;
    name: string;
    description?: string | null;
    enabled: boolean;
    source?: string | null;
    fileCount?: number | null;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface SkillFile {
    path: string;
    content?: string;
    size?: number;
    [key: string]: unknown;
  }

  interface UpdateStatus {
    hasUpdate: boolean;
    currentVersion?: string;
    latestVersion?: string;
    message?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let skills = $state<Skill[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let expandedSkillId = $state<string | null>(null);
  let skillFiles = $state<Record<string, SkillFile[]>>({});
  let skillUpdateStatus = $state<Record<string, UpdateStatus>>({});
  let loadingFiles = $state<string | null>(null);
  let checkingUpdate = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);

  // Import form
  let showImportForm = $state(false);
  let importSource = $state<'github' | 'local'>('github');
  let importPath = $state('');
  let importing = $state(false);

  // Scan projects
  let scanning = $state(false);
  let scanResults = $state<any[] | null>(null);

  let companyId = $derived(companyStore.selectedCompany?.id);

  let filteredSkills = $derived(
    searchQuery.trim()
      ? skills.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : skills
  );

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  onMount(() => breadcrumbStore.set([{ label: 'Skills' }]));

  $effect(() => {
    if (!companyId) return;
    loadSkills();
  });

  async function loadSkills() {
    if (!companyId) return;
    loading = true;
    try {
      const res = await api(`/api/companies/${companyId}/skills`);
      const d = await res.json();
      skills = Array.isArray(d) ? d : d.skills ?? [];
    } catch (err: any) {
      toastStore.push({ title: 'Failed to load skills', body: err?.message, tone: 'error' });
    } finally {
      loading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle
  // ---------------------------------------------------------------------------
  async function toggle(skill: Skill) {
    try {
      await api(`/api/companies/${companyId}/skills/${skill.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      skills = skills.map(s => s.id === skill.id ? { ...s, enabled: !s.enabled } : s);
    } catch (err: any) {
      toastStore.push({ title: 'Failed to toggle skill', body: err?.message, tone: 'error' });
    }
  }

  // ---------------------------------------------------------------------------
  // Expand / Collapse
  // ---------------------------------------------------------------------------
  function toggleExpand(skillId: string) {
    expandedSkillId = expandedSkillId === skillId ? null : skillId;
  }

  // ---------------------------------------------------------------------------
  // View Files
  // ---------------------------------------------------------------------------
  async function loadFiles(skillId: string) {
    if (skillFiles[skillId]) return;
    loadingFiles = skillId;
    try {
      const res = await api(`/api/companies/${companyId}/skills/${skillId}/files`);
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      skillFiles[skillId] = Array.isArray(d) ? d : d.files ?? [];
    } catch (err: any) {
      toastStore.push({ title: 'Failed to load files', body: err?.message, tone: 'error' });
    } finally {
      loadingFiles = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Check Updates
  // ---------------------------------------------------------------------------
  async function checkUpdate(skillId: string) {
    checkingUpdate = skillId;
    try {
      const res = await api(`/api/companies/${companyId}/skills/${skillId}/update-status`);
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      skillUpdateStatus[skillId] = d;
      if (d.hasUpdate) {
        toastStore.push({ title: 'Update available', body: d.message ?? `${d.currentVersion} → ${d.latestVersion}`, tone: 'info' });
      } else {
        toastStore.push({ title: 'Up to date', body: d.message ?? 'Skill is at the latest version.', tone: 'success' });
      }
    } catch (err: any) {
      toastStore.push({ title: 'Failed to check updates', body: err?.message, tone: 'error' });
    } finally {
      checkingUpdate = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------
  async function deleteSkill(skillId: string) {
    deletingId = skillId;
    try {
      const res = await api(`/api/companies/${companyId}/skills/${skillId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
      skills = skills.filter(s => s.id !== skillId);
      if (expandedSkillId === skillId) expandedSkillId = null;
      toastStore.push({ title: 'Skill deleted', tone: 'success' });
    } catch (err: any) {
      toastStore.push({ title: 'Failed to delete skill', body: err?.message, tone: 'error' });
    } finally {
      deletingId = null;
      confirmDeleteId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Import Skills
  // ---------------------------------------------------------------------------
  async function importSkill() {
    if (!importPath.trim()) return;
    importing = true;
    try {
      const res = await api(`/api/companies/${companyId}/skills/import`, {
        method: 'POST',
        body: JSON.stringify({ source: importSource, path: importPath.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: 'Skill imported', tone: 'success' });
      importPath = '';
      showImportForm = false;
      await loadSkills();
    } catch (err: any) {
      toastStore.push({ title: 'Failed to import skill', body: err?.message, tone: 'error' });
    } finally {
      importing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Scan Projects
  // ---------------------------------------------------------------------------
  async function scanProjects() {
    scanning = true;
    scanResults = null;
    try {
      const res = await api(`/api/companies/${companyId}/skills/scan-projects`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      scanResults = Array.isArray(d) ? d : d.skills ?? d.results ?? [];
      if (scanResults && scanResults.length === 0) {
        toastStore.push({ title: 'Scan complete', body: 'No new skills found in projects.', tone: 'info' });
      } else {
        toastStore.push({ title: 'Scan complete', body: `Found ${scanResults?.length ?? 0} skill(s).`, tone: 'success' });
      }
    } catch (err: any) {
      toastStore.push({ title: 'Failed to scan projects', body: err?.message, tone: 'error' });
    } finally {
      scanning = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function sourceColor(source: string | null | undefined): string {
    switch (source) {
      case 'trusted': return 'bg-green-500';
      case 'verified': return 'bg-blue-500';
      case 'custom': return 'bg-amber-500';
      default: return 'bg-zinc-500';
    }
  }

  function sourceLabel(source: string | null | undefined): string {
    return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Unknown';
  }

  function sourceIcon(source: string | null | undefined) {
    switch (source) {
      case 'trusted': return ShieldCheck;
      case 'verified': return Shield;
      default: return Wrench;
    }
  }
</script>

<div class="p-6 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between gap-4">
    <h1 class="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Company Skills</h1>
    <div class="flex items-center gap-2">
      <button
        onclick={() => scanProjects()}
        disabled={scanning}
        class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
      >
        <ScanSearch class="w-3.5 h-3.5" />
        {scanning ? 'Scanning...' : 'Scan Projects'}
      </button>
      <button
        onclick={() => { showImportForm = !showImportForm; }}
        class="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
      >
        <Download class="w-3.5 h-3.5" />
        Import Skills
      </button>
    </div>
  </div>

  <!-- Import form -->
  {#if showImportForm}
    <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-zinc-900 dark:text-zinc-100">Import Skill</h2>
        <button onclick={() => { showImportForm = false; }} class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          <X class="w-4 h-4" />
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); importSkill(); }} class="space-y-3">
        <div>
          <label for="import-source" class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Source</label>
          <select
            id="import-source"
            bind:value={importSource}
            class="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
          >
            <option value="github">GitHub Repository</option>
            <option value="local">Local Path</option>
          </select>
        </div>
        <div>
          <label for="import-path" class="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
            {importSource === 'github' ? 'Repository URL' : 'Local Path'}
          </label>
          <input
            id="import-path"
            bind:value={importPath}
            placeholder={importSource === 'github' ? 'https://github.com/org/repo' : '/path/to/skills'}
            class="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-100 placeholder:text-zinc-400"
          />
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            onclick={() => { showImportForm = false; }}
            class="rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={importing || !importPath.trim()}
            class="rounded-md bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  <!-- Scan results -->
  {#if scanResults && scanResults.length > 0}
    <div class="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-medium text-blue-900 dark:text-blue-200">Found Skills ({scanResults.length})</h2>
        <button onclick={() => { scanResults = null; }} class="text-blue-400 hover:text-blue-600 dark:hover:text-blue-300">
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="space-y-1">
        {#each scanResults as result}
          <div class="flex items-center justify-between rounded-md bg-blue-100/50 dark:bg-blue-900/20 px-3 py-2 text-sm">
            <div>
              <p class="font-medium text-blue-900 dark:text-blue-100">{result.name ?? result.path ?? 'Unknown'}</p>
              {#if result.path}
                <p class="text-xs text-blue-600 dark:text-blue-400 font-mono">{result.path}</p>
              {/if}
            </div>
            {#if result.alreadyImported}
              <span class="text-xs text-blue-500">Already imported</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Search -->
  <div class="relative">
    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search skills..."
      class="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent pl-10 pr-4 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>

  <!-- Skills list -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(4) as _}
        <div class="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"></div>
      {/each}
    </div>
  {:else if filteredSkills.length === 0}
    <p class="text-sm text-zinc-500 py-8 text-center">
      {searchQuery.trim() ? 'No skills match your search.' : 'No skills configured.'}
    </p>
  {:else}
    <div class="space-y-2">
      {#each filteredSkills as skill (skill.id)}
        {@const isExpanded = expandedSkillId === skill.id}
        {@const SourceIcon = sourceIcon(skill.source)}
        <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden transition-colors {isExpanded ? 'ring-1 ring-zinc-300 dark:ring-zinc-700' : ''}">
          <!-- Skill header row -->
          <div class="flex items-center gap-3 p-4">
            <!-- Expand toggle -->
            <button
              onclick={() => toggleExpand(skill.id)}
              class="shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Expand {skill.name}"
            >
              {#if isExpanded}
                <ChevronDown class="w-4 h-4" />
              {:else}
                <ChevronRight class="w-4 h-4" />
              {/if}
            </button>

            <!-- Skill info (clickable to expand) -->
            <button onclick={() => toggleExpand(skill.id)} class="flex-1 min-w-0 text-left">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{skill.name}</p>
                <!-- Source badge -->
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <span class="w-1.5 h-1.5 rounded-full {sourceColor(skill.source)}"></span>
                  {sourceLabel(skill.source)}
                </span>
                {#if skill.fileCount}
                  <span class="text-[10px] text-zinc-400">{skill.fileCount} file{skill.fileCount !== 1 ? 's' : ''}</span>
                {/if}
              </div>
              {#if skill.description && !isExpanded}
                <p class="text-xs text-zinc-500 truncate mt-0.5">{skill.description}</p>
              {/if}
            </button>

            <!-- Toggle switch -->
            <button
              onclick={(e) => { e.stopPropagation(); toggle(skill); }}
              aria-label="Toggle {skill.name}"
              class="relative shrink-0 h-6 w-11 rounded-full transition-colors {skill.enabled ? 'bg-green-600' : 'bg-zinc-300 dark:bg-zinc-700'}"
            >
              <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform {skill.enabled ? 'translate-x-5' : ''}"></span>
            </button>
          </div>

          <!-- Expanded content -->
          {#if isExpanded}
            <div class="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-4 space-y-4">
              <!-- Description -->
              {#if skill.description}
                <div>
                  <h3 class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Description</h3>
                  <MarkdownBody content={skill.description} class="text-sm" />
                </div>
              {/if}

              <!-- Metadata row -->
              <div class="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                <div class="flex items-center gap-1.5">
                  <svelte:component this={SourceIcon} class="w-3.5 h-3.5" />
                  <span>{sourceLabel(skill.source)}</span>
                </div>
                {#if skill.fileCount}
                  <div class="flex items-center gap-1.5">
                    <FileCode2 class="w-3.5 h-3.5" />
                    <span>{skill.fileCount} file{skill.fileCount !== 1 ? 's' : ''}</span>
                  </div>
                {/if}
                {#if skill.createdAt}
                  <span>Created: {new Date(skill.createdAt).toLocaleDateString()}</span>
                {/if}
              </div>

              <!-- Update status -->
              {#if skillUpdateStatus[skill.id]}
                {@const us = skillUpdateStatus[skill.id]}
                <div class="rounded-md px-3 py-2 text-xs {us.hasUpdate ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300' : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'}">
                  {#if us.hasUpdate}
                    Update available: {us.currentVersion ?? '?'} &rarr; {us.latestVersion ?? 'latest'}
                  {:else}
                    {us.message ?? 'Skill is up to date.'}
                  {/if}
                </div>
              {/if}

              <!-- Files panel -->
              {#if skillFiles[skill.id]}
                <div>
                  <h3 class="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Files</h3>
                  <div class="rounded-md border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-200 dark:divide-zinc-700 max-h-64 overflow-y-auto">
                    {#each skillFiles[skill.id] as file}
                      <div class="px-3 py-2 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
                        <div class="flex items-center gap-2">
                          <FileCode2 class="w-3 h-3 text-zinc-400 shrink-0" />
                          <span class="font-mono text-zinc-700 dark:text-zinc-300 truncate">{file.path}</span>
                          {#if file.size}
                            <span class="text-zinc-400 shrink-0">{(file.size / 1024).toFixed(1)} KB</span>
                          {/if}
                        </div>
                        {#if file.content}
                          <pre class="mt-1 p-2 rounded bg-[#0a0a0f] text-[#e2e8f0] text-[11px] font-mono overflow-x-auto max-h-32">{file.content}</pre>
                        {/if}
                      </div>
                    {/each}
                    {#if skillFiles[skill.id].length === 0}
                      <div class="px-3 py-3 text-center text-zinc-400">No files found.</div>
                    {/if}
                  </div>
                </div>
              {/if}

              <!-- Action buttons -->
              <div class="flex items-center gap-2 pt-1">
                <button
                  onclick={() => loadFiles(skill.id)}
                  disabled={loadingFiles === skill.id}
                  class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <FolderTree class="w-3.5 h-3.5" />
                  {loadingFiles === skill.id ? 'Loading...' : (skillFiles[skill.id] ? 'Refresh Files' : 'View Files')}
                </button>
                <button
                  onclick={() => checkUpdate(skill.id)}
                  disabled={checkingUpdate === skill.id}
                  class="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <RefreshCw class="w-3.5 h-3.5 {checkingUpdate === skill.id ? 'animate-spin' : ''}" />
                  {checkingUpdate === skill.id ? 'Checking...' : 'Check Updates'}
                </button>
                {#if confirmDeleteId === skill.id}
                  <button
                    onclick={() => deleteSkill(skill.id)}
                    disabled={deletingId === skill.id}
                    class="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deletingId === skill.id ? 'Deleting...' : 'Confirm Delete'}
                  </button>
                  <button
                    onclick={() => { confirmDeleteId = null; }}
                    class="inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                {:else}
                  <button
                    onclick={() => { confirmDeleteId = skill.id; }}
                    class="inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                    Delete
                  </button>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
