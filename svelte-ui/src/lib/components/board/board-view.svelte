<script lang="ts">
  import BoardColumn from "./board-column.svelte";

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
    { status: "backlog", label: "Backlog", color: "#64748b" },
    { status: "todo", label: "To Do", color: "#2563eb" },
    { status: "in_progress", label: "In Progress", color: "#f59e0b" },
    { status: "in_review", label: "In Review", color: "#8b5cf6" },
    { status: "done", label: "Done", color: "#10b981" },
    { status: "blocked", label: "Blocked", color: "#ef4444" },
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
