<script lang="ts" module>
  /**
   * NewIssueDialog — global modal for quickly creating new issues.
   * Import and call `openNewIssueDialog()` from anywhere to open.
   * Optionally pass `{ assigneeAgentId }` to pre-fill the assignee.
   */
  let _openFn: ((opts?: { assigneeAgentId?: string }) => void) | null = null;

  export function openNewIssueDialog(opts?: { assigneeAgentId?: string; companyId?: string }) {
    _openFn?.(opts);
  }
</script>

<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import {
    X, Loader2, AlertCircle, Tag, Maximize2, Minimize2,
    Paperclip, FileText, MoreHorizontal, Calendar,
    CircleDot, Minus, ArrowUp, ArrowDown, AlertTriangle,
  } from 'lucide-svelte';
  import { api } from '$lib/api';
  import { companyStore, resolveCompanyIdFromPrefix } from '$lib/stores/company.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';

  const DRAFT_KEY = 'clawdev:issue-draft';
  const DEBOUNCE_MS = 800;

  interface Agent {
    id: string;
    name: string;
    role?: string;
  }

  interface Project {
    id: string;
    name: string;
    prefix?: string;
  }

  interface Label {
    id: string;
    name: string;
    color: string;
  }

  interface CreatedIssue {
    id: string;
    title: string;
    [key: string]: unknown;
  }

  interface IssueDraft {
    title: string;
    description: string;
    status: string;
    priority: string;
    assigneeAgentId: string;
    projectId: string;
  }

  interface StagedFile {
    id: string;
    file: File;
    kind: 'attachment';
  }

  let visible = $state(false);
  let submitting = $state(false);
  let errorMessage = $state('');
  let expanded = $state(false);

  // Form fields
  let title = $state('');
  let description = $state('');
  let status = $state('todo');
  let priority = $state('medium');
  let assigneeAgentId = $state('');
  let projectId = $state('');
  let labelIds = $state<string[]>([]);

  // File upload
  let stagedFiles = $state<StagedFile[]>([]);
  let isFileDragOver = $state(false);
  let fileInputEl = $state<HTMLInputElement | null>(null);

  // Draft
  let hasSavedDraft = $state(false);
  let draftTimer: ReturnType<typeof setTimeout> | null = null;

  // Popover states
  let statusOpen = $state(false);
  let priorityOpen = $state(false);
  let moreOpen = $state(false);

  // Dropdown data
  let agents = $state<Agent[]>([]);
  let projects = $state<Project[]>([]);
  let labels = $state<Label[]>([]);
  let loadingDropdowns = $state(false);

  // Element refs
  let titleInputEl = $state<HTMLTextAreaElement | null>(null);
  let dialogEl = $state<HTMLDivElement | null>(null);

  // Expose the open function to the module-level export
  let explicitCompanyId = $state<string | null>(null);

  _openFn = open;

  function resolveCompanyId(): string | null {
    return explicitCompanyId ?? resolveCompanyIdFromPrefix($page.params.companyPrefix ?? "") ?? companyStore.selectedCompanyId ?? null;
  }

  // ── Draft persistence ─────────────────────────────────────────────
  function loadDraft(): IssueDraft | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as IssueDraft;
    } catch { return null; }
  }

  function saveDraft(draft: IssueDraft) {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    hasSavedDraft = true;
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    hasSavedDraft = false;
  }

  function scheduleSaveDraft() {
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      if (title.trim()) {
        saveDraft({ title, description, status, priority, assigneeAgentId, projectId });
      }
    }, DEBOUNCE_MS);
  }

  // Track changes for auto-save
  $effect(() => {
    if (!visible) return;
    // Touch all reactive values to subscribe
    void title; void description; void status; void priority; void assigneeAgentId; void projectId;
    scheduleSaveDraft();
  });

  function open(opts?: { assigneeAgentId?: string; companyId?: string }) {
    resetForm();
    explicitCompanyId = opts?.companyId ?? null;

    // Restore draft
    const draft = loadDraft();
    if (draft) {
      title = draft.title ?? '';
      description = draft.description ?? '';
      status = draft.status ?? 'todo';
      priority = draft.priority ?? 'medium';
      assigneeAgentId = opts?.assigneeAgentId ?? draft.assigneeAgentId ?? '';
      projectId = draft.projectId ?? '';
      hasSavedDraft = true;
    } else if (opts?.assigneeAgentId) {
      assigneeAgentId = opts.assigneeAgentId;
    }

    visible = true;
    fetchDropdownData();
    requestAnimationFrame(() => titleInputEl?.focus());
  }

  function close() {
    if (submitting) return;
    visible = false;
    errorMessage = '';
    expanded = false;
  }

  function resetForm() {
    title = '';
    description = '';
    status = 'todo';
    priority = 'medium';
    assigneeAgentId = '';
    projectId = '';
    labelIds = [];
    errorMessage = '';
    submitting = false;
    stagedFiles = [];
    isFileDragOver = false;
    expanded = false;
    hasSavedDraft = !!loadDraft();
  }

  function discardDraft() {
    clearDraft();
    resetForm();
    requestAnimationFrame(() => titleInputEl?.focus());
  }

  let canDiscardDraft = $derived(
    hasSavedDraft || title.trim() !== '' || description.trim() !== ''
  );

  async function fetchDropdownData() {
    const companyId = resolveCompanyId();
    if (!companyId) return;

    loadingDropdowns = true;
    try {
      const [agentsRes, projectsRes, labelsRes] = await Promise.all([
        api(`/api/companies/${companyId}/agents`),
        api(`/api/companies/${companyId}/projects`),
        api(`/api/companies/${companyId}/labels`),
      ]);

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        agents = Array.isArray(data) ? data : data.agents ?? data.data ?? [];
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        projects = Array.isArray(data) ? data : data.projects ?? data.data ?? [];
      }
      if (labelsRes.ok) {
        const data = await labelsRes.json();
        labels = Array.isArray(data) ? data : data.labels ?? data.data ?? [];
      }
    } catch {
      // Silently fail — dropdowns will simply be empty
    } finally {
      loadingDropdowns = false;
    }
  }

  function toggleLabel(labelId: string) {
    labelIds = labelIds.includes(labelId)
      ? labelIds.filter((id) => id !== labelId)
      : [...labelIds, labelId];
  }

  function labelDotStyle(color: string) {
    const map: Record<string, string> = {
      red: "#ef4444",
      orange: "#f97316",
      yellow: "#eab308",
      green: "#22c55e",
      blue: "#3b82f6",
      purple: "#a855f7",
      pink: "#ec4899",
      zinc: "#71717a",
    };
    return `background-color: ${map[color] ?? map.blue};`;
  }

  // ── File upload ───────────────────────────────────────────────────
  function formatFileSize(file: File): string {
    if (file.size < 1024) return `${file.size} B`;
    if (file.size < 1024 * 1024) return `${(file.size / 1024).toFixed(1)} KB`;
    return `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function addStagedFiles(files: FileList | File[]) {
    const newFiles: StagedFile[] = [];
    for (const file of files) {
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        kind: 'attachment',
      });
    }
    stagedFiles = [...stagedFiles, ...newFiles];
  }

  function removeStagedFile(id: string) {
    stagedFiles = stagedFiles.filter((f) => f.id !== id);
  }

  function handleFileInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      addStagedFiles(input.files);
      input.value = '';
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    isFileDragOver = true;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isFileDragOver = false;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isFileDragOver = false;
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      addStagedFiles(e.dataTransfer.files);
    }
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!title.trim()) {
      errorMessage = 'Title is required.';
      titleInputEl?.focus();
      return;
    }

    const companyId = resolveCompanyId();
    if (!companyId) {
      errorMessage = 'No company selected.';
      return;
    }

    submitting = true;
    errorMessage = '';

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        status,
        priority,
      };
      if (description.trim()) body.description = description.trim();
      if (assigneeAgentId) body.assigneeAgentId = assigneeAgentId;
      if (projectId) body.projectId = projectId;
      if (labelIds.length > 0) body.labelIds = labelIds;

      const res = await api(`/api/companies/${companyId}/issues`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message ?? errData?.error ?? `Server error (${res.status})`);
      }

      const created: CreatedIssue = await res.json();

      // Upload staged attachments
      const failures: string[] = [];
      for (const staged of stagedFiles) {
        try {
          const formData = new FormData();
          formData.append('file', staged.file);
          const uploadRes = await api(`/api/companies/${companyId}/issues/${created.id}/attachments`, {
            method: 'POST',
            body: formData,
            headers: {}, // Let browser set Content-Type for FormData
          });
          if (!uploadRes.ok) failures.push(staged.file.name);
        } catch {
          failures.push(staged.file.name);
        }
      }

      if (failures.length > 0) {
        toastStore.push({
          title: `Issue created with upload warnings`,
          body: `${failures.length} file(s) could not be attached.`,
          tone: 'warn',
        });
      } else {
        toastStore.push({
          title: 'Issue created',
          body: created.title ?? title.trim(),
          tone: 'success',
        });
      }

      if (draftTimer) clearTimeout(draftTimer);
      clearDraft();
      visible = false;
      resetForm();
      explicitCompanyId = null;
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
    } finally {
      submitting = false;
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === dialogEl) close();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const textarea = dialogEl?.querySelector('#issue-description') as HTMLTextAreaElement | null;
      textarea?.focus();
    }
  }

  function handleTitleInput(e: Event) {
    const el = e.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  // ── Status / Priority options ─────────────────────────────────────
  const statusOptions = [
    { value: 'backlog', label: 'Backlog', colorClass: 'text-zinc-500' },
    { value: 'todo', label: 'Todo', colorClass: 'text-blue-500' },
    { value: 'in_progress', label: 'In Progress', colorClass: 'text-amber-500' },
    { value: 'in_review', label: 'In Review', colorClass: 'text-purple-500' },
    { value: 'done', label: 'Done', colorClass: 'text-emerald-500' },
  ];

  const priorityOptions = [
    { value: 'critical', label: 'Critical', icon: AlertTriangle, colorClass: 'text-red-500' },
    { value: 'high', label: 'High', icon: ArrowUp, colorClass: 'text-orange-500' },
    { value: 'medium', label: 'Medium', icon: Minus, colorClass: 'text-muted-foreground' },
    { value: 'low', label: 'Low', icon: ArrowDown, colorClass: 'text-blue-400' },
  ];

  let currentStatus = $derived(statusOptions.find((s) => s.value === status) ?? statusOptions[1]);
  let currentPriority = $derived(priorityOptions.find((p) => p.value === priority));

  const STAGED_FILE_ACCEPT = "image/*,application/pdf,text/plain,text/markdown,application/json,text/csv,text/html,.md,.markdown";
</script>

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={dialogEl}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    tabindex="0"
    aria-modal="true"
    aria-label="Create new issue"
  >
    <div
      class="mx-4 flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-border bg-background shadow-2xl transition-all duration-200
        {expanded ? 'sm:max-w-2xl h-[calc(100dvh-2rem)]' : 'sm:max-w-lg'}"
    >
      <!-- Header bar -->
      <div class="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div class="flex items-center gap-2 text-sm text-muted-foreground">
          <span class="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
            {$page.params.companyPrefix?.toUpperCase() ?? 'NEW'}
          </span>
          <span class="text-muted-foreground/60">&rsaquo;</span>
          <span>New issue</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            onclick={() => (expanded = !expanded)}
            disabled={submitting}
            class="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/75 transition-colors disabled:opacity-50"
            aria-label={expanded ? 'Minimize' : 'Expand'}
          >
            {#if expanded}
              <Minimize2 class="h-3.5 w-3.5" />
            {:else}
              <Maximize2 class="h-3.5 w-3.5" />
            {/if}
          </button>
          <button
            onclick={close}
            disabled={submitting}
            class="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/75 transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      </div>

      <!-- Title (auto-growing textarea like Paperclip) -->
      <div class="shrink-0 px-4 pb-2 pt-4">
        <textarea
          id="issue-title-input"
          bind:this={titleInputEl}
          bind:value={title}
          oninput={handleTitleInput}
          onkeydown={handleTitleKeydown}
          placeholder="Issue title"
          rows="1"
          disabled={submitting}
          class="w-full resize-none overflow-hidden bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
        ></textarea>
      </div>

      <!-- Assignee + Project inline row -->
      <div class="shrink-0 overflow-x-auto px-4 pb-2">
        <div class="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <span>For</span>
          <select
            bind:value={assigneeAgentId}
            disabled={submitting || loadingDropdowns}
            class="rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none transition-colors hover:bg-accent/50 focus:border-blue-500"
          >
            <option value="">Assignee</option>
            {#each agents as agent}
              <option value={agent.id}>{agent.name}{agent.role ? ` (${agent.role})` : ''}</option>
            {/each}
          </select>
          <span>in</span>
          <select
            bind:value={projectId}
            disabled={submitting || loadingDropdowns}
            class="rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none transition-colors hover:bg-accent/50 focus:border-blue-500"
          >
            <option value="">Project</option>
            {#each projects as project}
              <option value={project.id}>{project.prefix ? `[${project.prefix}] ` : ''}{project.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Description (with drag-and-drop zone) -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="min-h-0 shrink-0 overflow-y-auto border-t border-border/60 px-4 pb-2 pt-3 {expanded ? 'flex-1' : ''}"
        ondragenter={handleDragEnter}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
      >
        <div class="rounded-md transition-colors {isFileDragOver ? 'bg-accent/20 ring-2 ring-blue-500/30 ring-dashed' : ''}">
          <textarea
            id="issue-description"
            bind:value={description}
            placeholder="Add description..."
            rows={expanded ? 10 : 5}
            disabled={submitting}
            class="w-full resize-y rounded-md bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50
                   {expanded ? 'min-h-[220px]' : 'min-h-[120px]'}"
          ></textarea>
        </div>

        <!-- Staged files -->
        {#if stagedFiles.length > 0}
          <div class="mt-4 space-y-2 rounded-lg border border-border/70 p-3">
            <div class="text-xs font-medium text-muted-foreground">Attachments</div>
            {#each stagedFiles as staged (staged.id)}
              <div class="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2">
                <div class="flex min-w-0 items-center gap-2">
                  <Paperclip class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span class="truncate text-sm">{staged.file.name}</span>
                  <span class="shrink-0 text-[11px] text-muted-foreground">
                    {staged.file.type || 'application/octet-stream'} &middot; {formatFileSize(staged.file)}
                  </span>
                </div>
                <button
                  type="button"
                  onclick={() => removeStagedFile(staged.id)}
                  disabled={submitting}
                  class="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent/75 transition-colors disabled:opacity-50"
                  aria-label="Remove attachment"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Labels (collapsible if present) -->
      {#if labels.length > 0}
        <div class="shrink-0 border-t border-border/60 px-4 py-2">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <span class="text-xs font-medium text-muted-foreground">Labels</span>
            {#if labelIds.length > 0}
              <span class="text-[11px] text-muted-foreground">{labelIds.length} selected</span>
            {/if}
          </div>
          <div class="flex flex-wrap gap-2">
            {#each labels as label}
              {@const selected = labelIds.includes(label.id)}
              <button
                type="button"
                onclick={() => toggleLabel(label.id)}
                class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors {selected
                  ? 'border-blue-500/40 bg-blue-500/10 text-blue-200'
                  : 'border-border bg-card text-muted-foreground hover:border-blue-500/30 hover:text-foreground'}"
              >
                <span class="h-2 w-2 rounded-full" style={labelDotStyle(label.color)}></span>
                {label.name}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Property chips bar (status, priority, labels, upload, more) -->
      <div class="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border px-4 py-2">
        <!-- Status chip -->
        <div class="relative">
          <button
            type="button"
            onclick={() => { statusOpen = !statusOpen; priorityOpen = false; moreOpen = false; }}
            class="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent/50"
          >
            <CircleDot class="h-3 w-3 {currentStatus.colorClass}" />
            {currentStatus.label}
          </button>
          {#if statusOpen}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute left-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg"
              onkeydown={(e) => { if (e.key === 'Escape') statusOpen = false; }}
            >
              {#each statusOptions as s}
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent/50 {s.value === status ? 'bg-accent' : ''}"
                  onclick={() => { status = s.value; statusOpen = false; }}
                >
                  <CircleDot class="h-3 w-3 {s.colorClass}" />
                  {s.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Priority chip -->
        <div class="relative">
          <button
            type="button"
            onclick={() => { priorityOpen = !priorityOpen; statusOpen = false; moreOpen = false; }}
            class="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-accent/50"
          >
            {#if currentPriority}
              {@const CurrentPriorityIcon = currentPriority.icon}
              <CurrentPriorityIcon class="h-3 w-3 {currentPriority.colorClass}" />
              {currentPriority.label}
            {:else}
              <Minus class="h-3 w-3 text-muted-foreground" />
              Priority
            {/if}
          </button>
          {#if priorityOpen}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute left-0 top-full z-10 mt-1 w-36 rounded-lg border border-border bg-popover p-1 shadow-lg"
              onkeydown={(e) => { if (e.key === 'Escape') priorityOpen = false; }}
            >
              {#each priorityOptions as p}
                {@const PriorityOptionIcon = p.icon}
                <button
                  type="button"
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-accent/50 {p.value === priority ? 'bg-accent' : ''}"
                  onclick={() => { priority = p.value; priorityOpen = false; }}
                >
                  <PriorityOptionIcon class="h-3 w-3 {p.colorClass}" />
                  {p.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Labels chip -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
        >
          <Tag class="h-3 w-3" />
          Labels
          {#if labelIds.length > 0}
            <span class="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium text-blue-300">{labelIds.length}</span>
          {/if}
        </button>

        <!-- Upload chip -->
        <input
          bind:this={fileInputEl}
          type="file"
          accept={STAGED_FILE_ACCEPT}
          class="hidden"
          onchange={handleFileInputChange}
          multiple
        />
        <button
          type="button"
          onclick={() => fileInputEl?.click()}
          disabled={submitting}
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
        >
          <Paperclip class="h-3 w-3" />
          Upload
          {#if stagedFiles.length > 0}
            <span class="rounded-full bg-blue-500/20 px-1.5 text-[10px] font-medium text-blue-300">{stagedFiles.length}</span>
          {/if}
        </button>

        <!-- More (dates) -->
        <div class="relative">
          <button
            type="button"
            onclick={() => { moreOpen = !moreOpen; statusOpen = false; priorityOpen = false; }}
            class="inline-flex items-center justify-center rounded-md border border-border p-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <MoreHorizontal class="h-3 w-3" />
          </button>
          {#if moreOpen}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg"
              onkeydown={(e) => { if (e.key === 'Escape') moreOpen = false; }}
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
              >
                <Calendar class="h-3 w-3" />
                Start date
              </button>
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
              >
                <Calendar class="h-3 w-3" />
                Due date
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Error -->
      {#if errorMessage}
        <div class="shrink-0 px-4 pb-2">
          <div class="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle class="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      {/if}

      <!-- Footer -->
      <div class="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5">
        <button
          type="button"
          onclick={discardDraft}
          disabled={submitting || !canDiscardDraft}
          class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-accent/75 disabled:opacity-50"
        >
          Discard Draft
        </button>
        <div class="flex items-center gap-3">
          <div class="min-h-5 text-right">
            {#if submitting}
              <span class="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Loader2 class="h-3 w-3 animate-spin" />
                Creating issue...
              </span>
            {/if}
          </div>
          <button
            type="button"
            onclick={handleSubmit}
            disabled={submitting || !title.trim()}
            class="inline-flex min-w-[8.5rem] items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if submitting}
              <Loader2 class="h-3.5 w-3.5 animate-spin" />
              Creating...
            {:else}
              Create Issue
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
