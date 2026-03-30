<script lang="ts">
  import { breadcrumbStore } from '$stores/breadcrumb.svelte.js';
  import { companyStore } from '$stores/company.svelte.js';
  import { toastStore } from '$stores/toast.svelte.js';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import MarkdownBody from '$lib/components/markdown-body.svelte';
  import {
    Search, ChevronDown, ChevronRight, Trash2, RefreshCw,
    Plus, FileCode2, FileText, Folder, FolderOpen, Eye, Code2,
    Boxes, Shield, ShieldCheck, Wrench
  } from 'lucide-svelte';

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Skill {
    id: string;
    name: string;
    description?: string | null;
    enabled: boolean;
    source?: string | null;
    sourceLabel?: string | null;
    key?: string | null;
    editable?: boolean;
    editableReason?: string | null;
    fileCount?: number | null;
    fileInventory?: FileInventoryEntry[];
    usedByAgents?: { id: string; name: string; urlKey?: string }[];
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface FileInventoryEntry {
    path: string;
    kind?: 'skill' | 'script' | 'reference' | 'other';
    [key: string]: unknown;
  }

  interface SkillFile {
    path: string;
    content?: string;
    markdown?: boolean;
    editable?: boolean;
    size?: number;
    [key: string]: unknown;
  }

  interface TreeNode {
    name: string;
    path: string | null;
    kind: 'dir' | 'file';
    fileKind?: string;
    children: TreeNode[];
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let skills = $state<Skill[]>([]);
  let loading = $state(true);
  let searchQuery = $state('');

  // Left panel
  let expandedSkillId = $state<string | null>(null);
  let expandedDirs = $state<Record<string, Set<string>>>({});

  // Right panel
  let selectedSkillId = $state<string | null>(null);
  let selectedFilePath = $state<string>('SKILL.md');
  let viewMode = $state<'view' | 'code'>('view');
  let selectedSkillDetail = $state<Skill | null>(null);
  let fileContent = $state<SkillFile | null>(null);
  let fileLoading = $state(false);

  // Import
  let importSource = $state('');
  let importing = $state(false);

  // Scan
  let scanning = $state(false);
  let scanStatusMessage = $state<string | null>(null);

  // Create
  let showCreateForm = $state(false);
  let createName = $state('');
  let createDescription = $state('');
  let creating = $state(false);

  // Delete
  let confirmDeleteId = $state<string | null>(null);
  let deletingId = $state<string | null>(null);

  let companyId = $derived(companyStore.selectedCompany?.id);

  let filteredSkills = $derived(
    searchQuery.trim()
      ? skills.filter(s => {
          const haystack = `${s.name} ${s.key ?? ''} ${s.sourceLabel ?? ''}`.toLowerCase();
          return haystack.includes(searchQuery.toLowerCase());
        })
      : skills
  );

  // ---------------------------------------------------------------------------
  // Tree building
  // ---------------------------------------------------------------------------
  function buildTree(entries: FileInventoryEntry[]): TreeNode[] {
    const root: TreeNode = { name: '', path: null, kind: 'dir', children: [] };
    for (const entry of entries) {
      const segments = entry.path.split('/').filter(Boolean);
      let current = root;
      let currentPath = '';
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        const isLeaf = i === segments.length - 1;
        let next = current.children.find(c => c.name === segment);
        if (!next) {
          next = {
            name: segment,
            path: isLeaf ? entry.path : currentPath,
            kind: isLeaf ? 'file' : 'dir',
            fileKind: isLeaf ? entry.kind : undefined,
            children: [],
          };
          current.children.push(next);
        }
        current = next;
      }
    }
    function sortNode(node: TreeNode) {
      node.children.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
        if (a.name === 'SKILL.md') return -1;
        if (b.name === 'SKILL.md') return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortNode);
    }
    sortNode(root);
    return root.children;
  }

  // ---------------------------------------------------------------------------
  // Data Fetching
  // ---------------------------------------------------------------------------
  onMount(() => breadcrumbStore.set([{ label: 'Skills' }]));

  $effect(() => {
    if (!companyId) return;
    loadSkills();
  });

  // Auto-select first skill when skills load
  $effect(() => {
    if (skills.length > 0 && !selectedSkillId) {
      selectSkill(skills[0].id);
    }
  });

  // Load file when selection changes
  $effect(() => {
    if (selectedSkillId && selectedFilePath) {
      loadFile(selectedSkillId, selectedFilePath);
    }
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

  async function loadFile(skillId: string, filePath: string) {
    fileLoading = true;
    fileContent = null;
    try {
      const encodedPath = encodeURIComponent(filePath);
      const res = await api(`/api/companies/${companyId}/skills/${skillId}/files?path=${encodedPath}`);
      if (!res.ok) throw new Error(await res.text());
      fileContent = await res.json();
    } catch {
      // File may not exist, that's ok - show empty state
      fileContent = null;
    } finally {
      fileLoading = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Selection
  // ---------------------------------------------------------------------------
  function selectSkill(skillId: string) {
    selectedSkillId = skillId;
    selectedFilePath = 'SKILL.md';
    viewMode = 'view';
    selectedSkillDetail = skills.find(s => s.id === skillId) ?? null;
    // Auto-expand the skill in the tree
    expandedSkillId = skillId;
  }

  function selectFile(skillId: string, filePath: string) {
    selectedSkillId = skillId;
    selectedFilePath = filePath;
    viewMode = 'view';
    selectedSkillDetail = skills.find(s => s.id === skillId) ?? null;
    loadFile(skillId, filePath);
  }

  function toggleSkillExpand(skillId: string) {
    expandedSkillId = expandedSkillId === skillId ? null : skillId;
  }

  function toggleDir(skillId: string, dirPath: string) {
    const current = expandedDirs[skillId] ?? new Set<string>();
    const next = new Set(current);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
    }
    expandedDirs = { ...expandedDirs, [skillId]: next };
  }

  function isDirExpanded(skillId: string, dirPath: string): boolean {
    return expandedDirs[skillId]?.has(dirPath) ?? false;
  }

  // ---------------------------------------------------------------------------
  // Toggle skill enabled
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
  // Import
  // ---------------------------------------------------------------------------
  async function handleImport() {
    const trimmed = importSource.trim();
    if (!trimmed) return;
    importing = true;
    try {
      const res = await api(`/api/companies/${companyId}/skills/import`, {
        method: 'POST',
        body: JSON.stringify({ source: trimmed }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: 'Skill imported', tone: 'success' });
      importSource = '';
      await loadSkills();
    } catch (err: any) {
      toastStore.push({ title: 'Failed to import skill', body: err?.message, tone: 'error' });
    } finally {
      importing = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async function handleCreate() {
    if (!createName.trim()) return;
    creating = true;
    try {
      const res = await api(`/api/companies/${companyId}/skills`, {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim(), description: createDescription.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const skill = await res.json();
      toastStore.push({ title: 'Skill created', tone: 'success' });
      createName = '';
      createDescription = '';
      showCreateForm = false;
      await loadSkills();
      if (skill?.id) selectSkill(skill.id);
    } catch (err: any) {
      toastStore.push({ title: 'Failed to create skill', body: err?.message, tone: 'error' });
    } finally {
      creating = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Scan Projects
  // ---------------------------------------------------------------------------
  async function scanProjects() {
    scanning = true;
    scanStatusMessage = 'Scanning project workspaces for skills...';
    try {
      const res = await api(`/api/companies/${companyId}/skills/scan-projects`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      const results = Array.isArray(d) ? d : d.skills ?? d.results ?? [];
      scanStatusMessage = `${results.length} skill(s) found.`;
      toastStore.push({ title: 'Scan complete', body: scanStatusMessage, tone: 'success' });
      await loadSkills();
    } catch (err: any) {
      scanStatusMessage = null;
      toastStore.push({ title: 'Failed to scan projects', body: err?.message, tone: 'error' });
    } finally {
      scanning = false;
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
      if (selectedSkillId === skillId) {
        selectedSkillId = null;
        selectedSkillDetail = null;
        fileContent = null;
      }
      toastStore.push({ title: 'Skill deleted', tone: 'success' });
    } catch (err: any) {
      toastStore.push({ title: 'Failed to delete skill', body: err?.message, tone: 'error' });
    } finally {
      deletingId = null;
      confirmDeleteId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function sourceLabel(source: string | null | undefined): string {
    return source ? source.charAt(0).toUpperCase() + source.slice(1) : 'Unknown';
  }

  function stripFrontmatter(md: string): string {
    const normalized = md.replace(/\r\n/g, '\n');
    if (!normalized.startsWith('---\n')) return normalized.trim();
    const closing = normalized.indexOf('\n---\n', 4);
    if (closing < 0) return normalized.trim();
    return normalized.slice(closing + 5).trim();
  }

  function isMarkdownFile(path: string): boolean {
    return path.endsWith('.md') || path.endsWith('.mdx');
  }
</script>

<div class="flex h-[calc(100vh-8rem)]">
  <!-- ===================================================================== -->
  <!-- LEFT PANEL: Skill list with search, import, file trees                -->
  <!-- ===================================================================== -->
  <aside class="w-[19rem] shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <h1 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">Skills</h1>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">{skills.length} available</p>
        </div>
        <div class="flex items-center gap-1">
          <button
            onclick={() => scanProjects()}
            disabled={scanning}
            title="Scan project workspaces for skills"
            class="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw class="w-4 h-4 {scanning ? 'animate-spin' : ''}" />
          </button>
          <button
            onclick={() => { showCreateForm = !showCreateForm; }}
            class="inline-flex items-center justify-center w-8 h-8 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <Plus class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Search -->
      <div class="mt-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
        <Search class="w-4 h-4 text-zinc-400 shrink-0" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter skills"
          class="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400"
        />
      </div>

      <!-- Import -->
      <div class="mt-3 flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
        <input
          type="text"
          bind:value={importSource}
          placeholder="Paste path, GitHub URL, or skills."
          class="w-full bg-transparent text-sm text-zinc-900 dark:text-zinc-100 outline-none placeholder:text-zinc-400"
          onkeydown={(e) => { if (e.key === 'Enter') handleImport(); }}
        />
        <button
          onclick={() => handleImport()}
          disabled={importing}
          class="shrink-0 text-sm text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50"
        >
          {importing ? '...' : 'Add'}
        </button>
      </div>

      {#if scanStatusMessage}
        <p class="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{scanStatusMessage}</p>
      {/if}
    </div>

    <!-- Create form -->
    {#if showCreateForm}
      <div class="border-b border-zinc-200 dark:border-zinc-800 px-4 py-4 space-y-3">
        <input
          bind:value={createName}
          placeholder="Skill name"
          class="w-full bg-transparent text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
        />
        <textarea
          bind:value={createDescription}
          placeholder="Short description"
          rows="2"
          class="w-full bg-transparent text-sm border-b border-zinc-200 dark:border-zinc-700 pb-2 outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none"
        ></textarea>
        <div class="flex items-center justify-end gap-2">
          <button
            onclick={() => { showCreateForm = false; }}
            class="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
          <button
            onclick={() => handleCreate()}
            disabled={creating || !createName.trim()}
            class="px-3 py-1.5 text-xs font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create skill'}
          </button>
        </div>
      </div>
    {/if}

    <!-- Skill list -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="space-y-2 p-4">
          {#each Array(5) as _}
            <div class="h-9 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>
          {/each}
        </div>
      {:else if filteredSkills.length === 0}
        <div class="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400">
          {searchQuery.trim() ? 'No skills match this filter.' : 'No skills configured.'}
        </div>
      {:else}
        {#each filteredSkills as skill (skill.id)}
          {@const isExpanded = expandedSkillId === skill.id}
          {@const isSelected = selectedSkillId === skill.id}
          {@const inventory = skill.fileInventory ?? []}
          {@const tree = inventory.length > 0 ? buildTree(inventory) : []}
          <div class="border-b border-zinc-200 dark:border-zinc-800">
            <!-- Skill row -->
            <div
              class="group grid grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-1 px-3 py-1.5 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 {isSelected ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-600 dark:text-zinc-400'}"
            >
              <button
                onclick={() => selectSkill(skill.id)}
                class="flex min-w-0 items-center gap-2 self-stretch pr-2 text-left"
              >
                <span class="flex h-4 w-4 shrink-0 items-center justify-center opacity-75">
                  {#if skill.source === 'trusted'}
                    <ShieldCheck class="w-3.5 h-3.5" />
                  {:else if skill.source === 'verified'}
                    <Shield class="w-3.5 h-3.5" />
                  {:else}
                    <Wrench class="w-3.5 h-3.5" />
                  {/if}
                </span>
                <span class="min-w-0 text-[13px] font-medium leading-5 truncate">
                  {skill.name}
                </span>
              </button>
              <button
                onclick={() => toggleSkillExpand(skill.id)}
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-80 group-hover:opacity-100 transition-all"
                aria-label={isExpanded ? `Collapse ${skill.name}` : `Expand ${skill.name}`}
              >
                {#if isExpanded}
                  <ChevronDown class="w-3.5 h-3.5" />
                {:else}
                  <ChevronRight class="w-3.5 h-3.5" />
                {/if}
              </button>
            </div>

            <!-- File tree (expanded) -->
            {#if isExpanded}
              <div class="overflow-hidden">
                {#if tree.length > 0}
                  {#snippet fileTree(nodes: TreeNode[], depth: number)}
                    {#each nodes as node}
                      {#if node.kind === 'dir'}
                        {@const dirExpanded = isDirExpanded(skill.id, node.path ?? '')}
                        <div>
                          <div
                            class="group/row grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-1 pr-3 text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 hover:text-zinc-700 dark:hover:text-zinc-200 min-h-9"
                          >
                            <button
                              onclick={() => node.path && toggleDir(skill.id, node.path)}
                              class="flex min-w-0 items-center gap-2 py-1 text-left"
                              style="padding-left: {16 + depth * 24}px"
                            >
                              <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                                {#if dirExpanded}
                                  <FolderOpen class="w-3.5 h-3.5" />
                                {:else}
                                  <Folder class="w-3.5 h-3.5" />
                                {/if}
                              </span>
                              <span class="truncate">{node.name}</span>
                            </button>
                            <button
                              onclick={() => node.path && toggleDir(skill.id, node.path)}
                              class="flex h-9 w-9 items-center justify-center rounded-sm text-zinc-400 opacity-70 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200 group-hover/row:opacity-100 transition-all"
                            >
                              {#if dirExpanded}
                                <ChevronDown class="w-3.5 h-3.5" />
                              {:else}
                                <ChevronRight class="w-3.5 h-3.5" />
                              {/if}
                            </button>
                          </div>
                          {#if dirExpanded}
                            {@render fileTree(node.children, depth + 1)}
                          {/if}
                        </div>
                      {:else}
                        {@const isFileSelected = selectedSkillId === skill.id && selectedFilePath === node.path}
                        <button
                          onclick={() => node.path && selectFile(skill.id, node.path)}
                          class="flex w-full items-center gap-2 pr-3 text-left text-sm min-h-9 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 {isFileSelected ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-500 dark:text-zinc-400'} hover:text-zinc-700 dark:hover:text-zinc-200"
                          style="padding-left: {16 + depth * 24}px"
                        >
                          <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                            {#if node.fileKind === 'script' || node.fileKind === 'reference'}
                              <FileCode2 class="w-3.5 h-3.5" />
                            {:else}
                              <FileText class="w-3.5 h-3.5" />
                            {/if}
                          </span>
                          <span class="truncate">{node.name}</span>
                        </button>
                      {/if}
                    {/each}
                  {/snippet}
                  {@render fileTree(tree, 1)}
                {:else}
                  <!-- Fallback: show SKILL.md link if no inventory -->
                  <button
                    onclick={() => selectFile(skill.id, 'SKILL.md')}
                    class="flex w-full items-center gap-2 pr-3 text-left text-sm min-h-9 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30 hover:text-zinc-700 dark:hover:text-zinc-200"
                    style="padding-left: 40px"
                  >
                    <span class="flex h-4 w-4 shrink-0 items-center justify-center">
                      <FileText class="w-3.5 h-3.5" />
                    </span>
                    <span class="truncate">SKILL.md</span>
                  </button>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      {/if}
    </div>
  </aside>

  <!-- ===================================================================== -->
  <!-- RIGHT PANEL: Skill detail + file viewer                               -->
  <!-- ===================================================================== -->
  <div class="flex-1 min-w-0 overflow-y-auto">
    {#if !selectedSkillDetail}
      {#if loading}
        <div class="p-6 space-y-4">
          {#each Array(4) as _}
            <div class="h-6 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800"></div>
          {/each}
        </div>
      {:else}
        <div class="flex items-center justify-center h-full text-zinc-400">
          <div class="text-center space-y-2">
            <Boxes class="w-10 h-10 mx-auto opacity-40" />
            <p class="text-sm">Select a skill to inspect its files.</p>
          </div>
        </div>
      {/if}
    {:else}
      {@const skill = selectedSkillDetail}
      {@const usedBy = skill.usedByAgents ?? []}

      <!-- Skill header -->
      <div class="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="flex items-center gap-2 truncate text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {#if skill.source === 'trusted'}
                <ShieldCheck class="w-5 h-5 shrink-0 text-zinc-400" />
              {:else if skill.source === 'verified'}
                <Shield class="w-5 h-5 shrink-0 text-zinc-400" />
              {:else}
                <Wrench class="w-5 h-5 shrink-0 text-zinc-400" />
              {/if}
              {skill.name}
            </h1>
            {#if skill.description}
              <p class="mt-2 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">{skill.description}</p>
            {/if}
          </div>
          <div class="flex items-center gap-2">
            <!-- Toggle switch -->
            <button
              onclick={() => toggle(skill)}
              aria-label="Toggle {skill.name}"
              class="relative shrink-0 h-6 w-11 rounded-full transition-colors {skill.enabled ? 'bg-green-600' : 'bg-zinc-300 dark:bg-zinc-700'}"
            >
              <span class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform {skill.enabled ? 'translate-x-5' : ''}"></span>
            </button>
            {#if !skill.editable && skill.editableReason}
              <span class="text-sm text-zinc-500 dark:text-zinc-400">{skill.editableReason}</span>
            {/if}
          </div>
        </div>

        <!-- Metadata row -->
        <div class="mt-4 space-y-3 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-sm">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div class="flex items-center gap-2">
              <span class="text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Source</span>
              <span class="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                {#if skill.source === 'trusted'}
                  <ShieldCheck class="w-3.5 h-3.5 text-zinc-400" />
                {:else if skill.source === 'verified'}
                  <Shield class="w-3.5 h-3.5 text-zinc-400" />
                {:else}
                  <Wrench class="w-3.5 h-3.5 text-zinc-400" />
                {/if}
                <span class="truncate">{sourceLabel(skill.source)}</span>
              </span>
            </div>
            {#if skill.key}
              <div class="flex items-center gap-2">
                <span class="text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Key</span>
                <span class="font-mono text-xs text-zinc-700 dark:text-zinc-300">{skill.key}</span>
              </div>
            {/if}
            <div class="flex items-center gap-2">
              <span class="text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Mode</span>
              <span class="text-zinc-700 dark:text-zinc-300">{skill.editable ? 'Editable' : 'Read only'}</span>
            </div>
          </div>
          <div class="flex flex-wrap items-start gap-x-3 gap-y-1">
            <span class="text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Used by</span>
            {#if usedBy.length === 0}
              <span class="text-zinc-500 dark:text-zinc-400">No agents attached</span>
            {:else}
              <div class="flex flex-wrap gap-x-3 gap-y-1">
                {#each usedBy as agent}
                  <span class="text-zinc-900 dark:text-zinc-100">{agent.name}</span>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Delete action -->
          <div class="flex items-center gap-2 pt-1">
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
      </div>

      <!-- File path + view/code toggle -->
      <div class="border-b border-zinc-200 dark:border-zinc-800 px-5 py-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <span class="truncate font-mono text-sm text-zinc-700 dark:text-zinc-300">{selectedFilePath}</span>
          </div>
          <div class="flex items-center gap-2">
            {#if isMarkdownFile(selectedFilePath)}
              <div class="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-sm">
                <button
                  onclick={() => { viewMode = 'view'; }}
                  class="px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors {viewMode === 'view' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}"
                >
                  <Eye class="w-3.5 h-3.5" />
                  View
                </button>
                <button
                  onclick={() => { viewMode = 'code'; }}
                  class="px-3 py-1.5 text-sm flex items-center gap-1.5 border-l border-zinc-200 dark:border-zinc-700 transition-colors {viewMode === 'code' ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}"
                >
                  <Code2 class="w-3.5 h-3.5" />
                  Code
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- File content -->
      <div class="min-h-[560px] px-5 py-5">
        {#if fileLoading}
          <div class="space-y-3">
            {#each Array(6) as _}
              <div class="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800 {Math.random() > 0.5 ? 'w-3/4' : 'w-1/2'}"></div>
            {/each}
          </div>
        {:else if !fileContent}
          <p class="text-sm text-zinc-500 dark:text-zinc-400">Select a file to inspect.</p>
        {:else if isMarkdownFile(selectedFilePath) && viewMode === 'view'}
          <MarkdownBody content={stripFrontmatter(fileContent.content ?? '')} />
        {:else}
          <pre class="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm text-zinc-800 dark:text-zinc-200"><code>{fileContent.content ?? ''}</code></pre>
        {/if}
      </div>
    {/if}
  </div>
</div>
