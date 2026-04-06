<script lang="ts">
  import BoardColumn from "./board-column.svelte";
  import { ISSUE_STATUS_VISUALS } from "$lib/constants/visual";

  interface Issue {
    id: string;
    identifier?: string | null;
    title: string;
    status: string;
    priority?: string | null;
    assigneeAgentId?: string | null;
    assigneeName?: string | null;
    agentName?: string | null;
    projectId?: string | null;
    labels?: Array<{ id: string; name: string; color?: string | null }>;
    [key: string]: unknown;
  }

  interface Props {
    issues: Issue[];
    companyPrefix: string;
  }

  let { issues, companyPrefix }: Props = $props();

  // ---------------------------------------------------------------------------
  // Status column definitions (ordered)
  // ---------------------------------------------------------------------------
  const COLUMNS = [
    { status: "backlog", label: "Backlog", color: ISSUE_STATUS_VISUALS.backlog.hex },
    { status: "todo", label: "To Do", color: ISSUE_STATUS_VISUALS.todo.hex },
    { status: "in_progress", label: "In Progress", color: ISSUE_STATUS_VISUALS.in_progress.hex },
    { status: "in_review", label: "In Review", color: ISSUE_STATUS_VISUALS.in_review.hex },
    { status: "done", label: "Done", color: ISSUE_STATUS_VISUALS.done.hex },
    { status: "blocked", label: "Blocked", color: ISSUE_STATUS_VISUALS.blocked.hex },
  ] as const;

  // ---------------------------------------------------------------------------
  // Group issues by status
  // ---------------------------------------------------------------------------
  let grouped = $derived.by(() => {
    const map = new Map<string, Issue[]>();
    for (const col of COLUMNS) {
      map.set(col.status, []);
    }
    for (const issue of issues) {
      const bucket = map.get(issue.status);
      if (bucket) {
        bucket.push(issue);
      } else {
        // Unknown status goes to backlog
        map.get("backlog")!.push(issue);
      }
    }
    return map;
  });
</script>

<div class="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2" style="min-height: 400px;">
  {#each COLUMNS as col (col.status)}
    <BoardColumn
      status={col.status}
      label={col.label}
      color={col.color}
      issues={grouped.get(col.status) ?? []}
      {companyPrefix}
    />
  {/each}
</div>
