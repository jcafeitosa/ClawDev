<script lang="ts">
  import BoardCard from "./board-card.svelte";
  import { Plus } from "lucide-svelte";

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
    status: string;
    label: string;
    color: string;
    issues: Issue[];
    companyPrefix: string;
  }

  let { status, label, color, issues, companyPrefix }: Props = $props();
</script>

<div class="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border/50 bg-accent/25">
  <!-- Column header -->
  <div class="flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50">
    <span class="size-2.5 rounded-full shrink-0" style="background-color: {color};"></span>
    <span class="text-xs font-semibold text-[var(--clawdev-text-primary)] uppercase tracking-wide">
      {label}
    </span>
    <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/75 px-1.5 text-[10px] font-medium text-[var(--clawdev-text-muted)] tabular-nums">
      {issues.length}
    </span>
  </div>

  <!-- Scrollable card list -->
  <div class="flex-1 overflow-y-auto p-2 space-y-2">
    {#each issues as issue (issue.id)}
      <BoardCard {issue} {companyPrefix} />
    {/each}

    {#if issues.length === 0}
      <div class="flex items-center justify-center py-8">
        <p class="text-xs text-[var(--clawdev-text-muted)]/50">No issues</p>
      </div>
    {/if}
  </div>

  <!-- Add task footer -->
  <div class="border-t border-border/50 px-2 py-1.5">
    <a
      href="/{companyPrefix}/issues/new?status={status}"
      class="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--clawdev-text-muted)] transition-colors hover:bg-accent/60 hover:text-[var(--clawdev-text-primary)]"
    >
      <Plus class="size-3.5" />
      Add Issue
    </a>
  </div>
</div>
