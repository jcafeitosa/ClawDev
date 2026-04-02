<script lang="ts" module>
  /**
   * NewIssueDialog — global modal for quickly creating new issues.
   * Import and call `openNewIssueDialog()` from anywhere to open.
   * Optionally pass `{ assigneeAgentId }` to pre-fill the assignee.
   */
  let _openFn: ((opts?: { assigneeAgentId?: string }) => void) | null = null;

  export function openNewIssueDialog(opts?: { assigneeAgentId?: string }) {
    _openFn?.(opts);
  }
</script>

<script lang="ts">
  import { X, Loader2, AlertCircle } from 'lucide-svelte';
  import { api } from '$lib/api';
  import { companyStore } from '$lib/stores/company.svelte';
  import { toastStore } from '$lib/stores/toast.svelte';

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

  interface CreatedIssue {
    id: string;
    title: string;
    [key: string]: unknown;
  }

  let visible = $state(false);
  let submitting = $state(false);
  let errorMessage = $state('');

  // Form fields
  let title = $state('');
  let description = $state('');
  let status = $state('todo');
  let priority = $state('medium');
  let assigneeAgentId = $state('');
  let projectId = $state('');

  // Dropdown data
  let agents = $state<Agent[]>([]);
  let projects = $state<Project[]>([]);
  let loadingDropdowns = $state(false);

  // Element refs
  let titleInputEl = $state<HTMLInputElement | null>(null);
  let dialogEl = $state<HTMLDivElement | null>(null);

  // Expose the open function to the module-level export
  _openFn = open;

  function open(opts?: { assigneeAgentId?: string }) {
    resetForm();
    if (opts?.assigneeAgentId) {
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
  }

  function resetForm() {
    title = '';
    description = '';
    status = 'todo';
    priority = 'medium';
    assigneeAgentId = '';
    projectId = '';
    errorMessage = '';
    submitting = false;
  }

  async function fetchDropdownData() {
    const companyId = companyStore.selectedCompanyId;
    if (!companyId) return;

    loadingDropdowns = true;
    try {
      const [agentsRes, projectsRes] = await Promise.all([
        api(`/api/companies/${companyId}/agents`),
        api(`/api/companies/${companyId}/projects`),
      ]);

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        agents = Array.isArray(data) ? data : data.agents ?? data.data ?? [];
      }
      if (projectsRes.ok) {
        const data = await projectsRes.json();
        projects = Array.isArray(data) ? data : data.projects ?? data.data ?? [];
      }
    } catch {
      // Silently fail — dropdowns will simply be empty
    } finally {
      loadingDropdowns = false;
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      errorMessage = 'Title is required.';
      titleInputEl?.focus();
      return;
    }

    const companyId = companyStore.selectedCompanyId;
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

      const res = await api(`/api/companies/${companyId}/issues`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.message ?? errData?.error ?? `Server error (${res.status})`);
      }

      const created: CreatedIssue = await res.json();

      toastStore.push({
        title: 'Issue created',
        body: created.title ?? title.trim(),
        tone: 'success',
      });

      visible = false;
      resetForm();
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
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus description textarea
      const textarea = dialogEl?.querySelector('textarea');
      textarea?.focus();
    }
  }

  const statusOptions = [
    { value: 'backlog', label: 'Backlog' },
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
  ];

  const priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  const selectClasses =
    'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';
  const labelClasses = 'block text-xs font-medium text-muted-foreground mb-1.5';
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
    <div class="w-full max-w-lg mx-4 bg-background border border-border rounded-2xl shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-5 pb-3">
        <h2 class="text-lg font-semibold text-foreground">New Issue</h2>
        <button
          onclick={close}
          disabled={submitting}
          class="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/75 transition-colors disabled:opacity-50"
          aria-label="Close dialog"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- Form -->
      <form
        onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        class="px-6 pb-6 space-y-4"
      >
        <!-- Title -->
        <div>
          <label for="issue-title" class={labelClasses}>Title</label>
          <input
            id="issue-title"
            bind:this={titleInputEl}
            bind:value={title}
            onkeydown={handleTitleKeydown}
            placeholder="Issue title..."
            required
            disabled={submitting}
            class="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground
                   placeholder:text-muted-foreground/50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                   transition-colors disabled:opacity-50"
          />
        </div>

        <!-- Description -->
        <div>
          <label for="issue-description" class={labelClasses}>Description</label>
          <textarea
            id="issue-description"
            bind:value={description}
            placeholder="Describe the issue (supports markdown)..."
            rows="3"
            disabled={submitting}
            class="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground
                   placeholder:text-muted-foreground/50 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                   transition-colors resize-y min-h-[72px] disabled:opacity-50"
          ></textarea>
        </div>

        <!-- Status + Priority row -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="issue-status" class={labelClasses}>Status</label>
            <select id="issue-status" bind:value={status} disabled={submitting} class={selectClasses}>
              {#each statusOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="issue-priority" class={labelClasses}>Priority</label>
            <select id="issue-priority" bind:value={priority} disabled={submitting} class={selectClasses}>
              {#each priorityOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Assignee + Project row -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="issue-assignee" class={labelClasses}>Assignee Agent</label>
            <select id="issue-assignee" bind:value={assigneeAgentId} disabled={submitting || loadingDropdowns} class={selectClasses}>
              <option value="">Unassigned</option>
              {#each agents as agent}
                <option value={agent.id}>{agent.name}{agent.role ? ` (${agent.role})` : ''}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="issue-project" class={labelClasses}>Project</label>
            <select id="issue-project" bind:value={projectId} disabled={submitting || loadingDropdowns} class={selectClasses}>
              <option value="">No project</option>
              {#each projects as project}
                <option value={project.id}>{project.prefix ? `[${project.prefix}] ` : ''}{project.name}</option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Error -->
        {#if errorMessage}
          <div class="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-sm text-red-400">
            <AlertCircle class="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-between pt-2">
          <span class="text-xs text-muted-foreground">
            {#if submitting}
              Creating issue...
            {:else}
              <kbd class="px-1.5 py-0.5 rounded bg-accent/75 text-[10px] font-mono">Ctrl+Enter</kbd> to submit
            {/if}
          </span>
          <div class="flex gap-2">
            <button
              type="button"
              onclick={close}
              disabled={submitting}
              class="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent/75
                     transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              class="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center gap-2"
            >
              {#if submitting}
                <Loader2 class="h-4 w-4 animate-spin" />
              {/if}
              Create Issue
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
