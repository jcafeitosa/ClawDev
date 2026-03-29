<script lang="ts">
  /**
   * KanbanBoard — Drag-and-drop Kanban board for issues.
   * Uses native HTML5 Drag & Drop API for cross-column moves.
   */
  import { cn } from '$utils/index.js';
  import { User, FolderKanban } from 'lucide-svelte';

  // ── Types ──────────────────────────────────────────────────────────
  interface Issue {
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    priority?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    assigneeName?: string | null;
    agentName?: string | null;
    projectId?: string | null;
    labels?: Array<{ id: string; name: string; color?: string | null }>;
    [key: string]: unknown;
  }

  interface Props {
    issues: Issue[];
    prefix: string;
    onStatusChange?: (issueId: string, newStatus: string) => Promise<void>;
  }

  let { issues, prefix, onStatusChange }: Props = $props();

  // ── Column definitions ─────────────────────────────────────────────
  const COLUMNS = [
    { status: 'backlog', label: 'Backlog', color: '#64748b', bgTint: 'rgba(100,116,139,0.06)' },
    { status: 'todo', label: 'To Do', color: '#2563eb', bgTint: 'rgba(37,99,235,0.06)' },
    { status: 'in_progress', label: 'In Progress', color: '#f59e0b', bgTint: 'rgba(245,158,11,0.06)' },
    { status: 'in_review', label: 'In Review', color: '#8b5cf6', bgTint: 'rgba(139,92,246,0.06)' },
    { status: 'done', label: 'Done', color: '#10b981', bgTint: 'rgba(16,185,129,0.06)' },
  ] as const;

  // ── Priority styling ───────────────────────────────────────────────
  const PRIORITY_DOT_COLORS: Record<string, string> = {
    critical: 'bg-[#EF4444]',
    high: 'bg-[#F97316]',
    medium: 'bg-[#F59E0B]',
    low: 'bg-[#64748B]',
  };

  const PRIORITY_LABELS: Record<string, string> = {
    critical: 'P0',
    high: 'P1',
    medium: 'P2',
    low: 'P3',
  };

  const PRIORITY_BADGE_CLASSES: Record<string, string> = {
    critical: 'text-[#EF4444] bg-red-500/10 border-red-500/20',
    high: 'text-[#F97316] bg-orange-500/10 border-orange-500/20',
    medium: 'text-[#F59E0B] bg-yellow-500/10 border-yellow-500/20',
    low: 'text-[#64748B] bg-zinc-500/10 border-zinc-500/20',
  };

  // ── Group issues by status ─────────────────────────────────────────
  let grouped = $derived.by(() => {
    const map = new Map<string, Issue[]>();
    for (const col of COLUMNS) map.set(col.status, []);
    for (const issue of issues) {
      const bucket = map.get(issue.status);
      if (bucket) {
        bucket.push(issue);
      } else {
        map.get('backlog')!.push(issue);
      }
    }
    return map;
  });

  // ── Drag & Drop state ─────────────────────────────────────────────
  let draggedIssueId = $state<string | null>(null);
  let dragOverColumn = $state<string | null>(null);
  let movingIssueId = $state<string | null>(null);

  function handleDragStart(e: DragEvent, issueId: string) {
    if (!e.dataTransfer) return;
    draggedIssueId = issueId;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', issueId);
  }

  function handleDragEnd() {
    draggedIssueId = null;
    dragOverColumn = null;
  }

  function handleDragOver(e: DragEvent, columnStatus: string) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = 'move';
    dragOverColumn = columnStatus;
  }

  function handleDragLeave(e: DragEvent, columnStatus: string) {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    const currentTarget = e.currentTarget as HTMLElement;
    if (relatedTarget && currentTarget.contains(relatedTarget)) return;
    if (dragOverColumn === columnStatus) {
      dragOverColumn = null;
    }
  }

  async function handleDrop(e: DragEvent, newStatus: string) {
    e.preventDefault();
    dragOverColumn = null;

    const issueId = e.dataTransfer?.getData('text/plain');
    if (!issueId || !onStatusChange) return;

    const issue = issues.find((i) => i.id === issueId);
    if (!issue || issue.status === newStatus) {
      draggedIssueId = null;
      return;
    }

    movingIssueId = issueId;
    draggedIssueId = null;

    try {
      await onStatusChange(issueId, newStatus);
    } finally {
      movingIssueId = null;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────
  function assigneeInitial(issue: Issue): string {
    const name = issue.assigneeName || issue.agentName;
    if (name) return name.charAt(0).toUpperCase();
    if (issue.assigneeAgentId) return 'A';
    if (issue.assigneeUserId) return 'U';
    return '';
  }

  function assigneeTooltip(issue: Issue): string {
    return issue.assigneeName || issue.agentName || '';
  }
</script>

<div class="kanban-root flex gap-3 overflow-x-auto pb-4 -mx-2 px-2" style="min-height: 420px;">
  {#each COLUMNS as col (col.status)}
    {@const columnIssues = grouped.get(col.status) ?? []}
    {@const isDropTarget = dragOverColumn === col.status}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class={cn(
        'flex h-full w-72 shrink-0 flex-col rounded-xl border transition-all duration-150',
        isDropTarget
          ? 'border-border bg-accent/50 shadow-lg shadow-black/20'
          : 'border-border/50 bg-accent/25',
      )}
      ondragover={(e) => handleDragOver(e, col.status)}
      ondragleave={(e) => handleDragLeave(e, col.status)}
      ondrop={(e) => handleDrop(e, col.status)}
    >
      <!-- Column header -->
      <div class="flex items-center gap-2.5 border-b border-border/50 px-3 py-2.5">
        <span class="size-2.5 shrink-0 rounded-full" style="background-color: {col.color};"></span>
        <span class="text-xs font-semibold uppercase tracking-wide text-foreground">
          {col.label}
        </span>
        <span
          class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/75 px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground"
        >
          {columnIssues.length}
        </span>
      </div>

      <!-- Scrollable card list -->
      <div class="flex-1 space-y-2 overflow-y-auto p-2">
        {#each columnIssues as issue (issue.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            draggable="true"
            ondragstart={(e) => handleDragStart(e, issue.id)}
            ondragend={handleDragEnd}
            class={cn(
              'group/card block cursor-grab rounded-lg border bg-secondary p-3 transition-all active:cursor-grabbing',
              draggedIssueId === issue.id
                ? 'border-border opacity-40'
                : 'border-border hover:border-border hover:bg-accent/40 hover:shadow-lg hover:shadow-black/20',
              movingIssueId === issue.id && 'animate-pulse opacity-60',
            )}
          >
            <a
              href="/{prefix}/issues/{issue.id}"
              class="block"
              ondragstart={(e) => e.preventDefault()}
            >
              <!-- Top row: identifier + priority -->
              <div class="mb-1.5 flex items-center gap-2">
                {#if issue.identifier}
                  <span class="text-[11px] font-mono tracking-tight text-muted-foreground">
                    {issue.identifier}
                  </span>
                {/if}
                {#if issue.priority && PRIORITY_LABELS[issue.priority]}
                  <span
                    class={cn(
                      'ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold leading-none',
                      PRIORITY_BADGE_CLASSES[issue.priority] ?? '',
                    )}
                  >
                    <span class={cn('size-1.5 rounded-full', PRIORITY_DOT_COLORS[issue.priority] ?? '')}></span>
                    {PRIORITY_LABELS[issue.priority]}
                  </span>
                {/if}
              </div>

              <!-- Title -->
              <p class="mb-2 line-clamp-2 text-sm leading-snug text-foreground">
                {issue.title}
              </p>

              <!-- Labels -->
              {#if issue.labels?.length}
                <div class="mb-2 flex flex-wrap gap-1">
                  {#each issue.labels.slice(0, 3) as label}
                    <span
                      class="inline-block rounded-full px-1.5 py-0 text-[10px] font-medium leading-relaxed"
                      style="background-color: {label.color ?? '#3b82f6'}15; color: {label.color ?? '#3b82f6'}; border: 1px solid {label.color ?? '#3b82f6'}30;"
                    >
                      {label.name}
                    </span>
                  {/each}
                  {#if issue.labels.length > 3}
                    <span class="text-[10px] text-muted-foreground">+{issue.labels.length - 3}</span>
                  {/if}
                </div>
              {/if}

              <!-- Bottom row: assignee -->
              <div class="mt-auto flex items-center gap-2">
                {#if assigneeInitial(issue)}
                  <div
                    class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-muted-foreground"
                    title={assigneeTooltip(issue)}
                  >
                    {assigneeInitial(issue)}
                  </div>
                  {#if assigneeTooltip(issue)}
                    <span class="truncate text-[11px] text-muted-foreground">{assigneeTooltip(issue)}</span>
                  {/if}
                {:else}
                  <div class="flex h-5 w-5 items-center justify-center rounded-full bg-accent/50">
                    <User class="size-3 text-muted-foreground/40" />
                  </div>
                {/if}

                {#if issue.projectId}
                  <FolderKanban class="ml-auto size-3 text-muted-foreground/50" />
                {/if}
              </div>
            </a>
          </div>
        {/each}

        {#if columnIssues.length === 0}
          <div
            class={cn(
              'flex items-center justify-center rounded-lg border-2 border-dashed py-10 transition-colors',
              isDropTarget ? 'border-border bg-accent/40' : 'border-border/50',
            )}
          >
            <p class="text-xs text-muted-foreground/50">No issues</p>
          </div>
        {/if}
      </div>

      <!-- Drop indicator at bottom of column -->
      {#if isDropTarget && columnIssues.length > 0}
        <div class="mx-2 mb-2 h-1 rounded-full bg-accent transition-all"></div>
      {/if}
    </div>
  {/each}
</div>
