<script lang="ts">
  import { cn } from "$utils/index.js";
  import { User, FolderKanban } from "lucide-svelte";

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
    issue: Issue;
    companyPrefix: string;
  }

  let { issue, companyPrefix }: Props = $props();

  // ---------------------------------------------------------------------------
  // Priority
  // ---------------------------------------------------------------------------
  const PRIORITY_DOT_COLORS: Record<string, string> = {
    critical: "bg-[#EF4444]",
    high: "bg-[#F97316]",
    medium: "bg-[#F59E0B]",
    low: "bg-[#64748B]",
  };

  const PRIORITY_LABELS: Record<string, string> = {
    critical: "P0",
    high: "P1",
    medium: "P2",
    low: "P3",
  };

  function assigneeInitial(iss: Issue): string {
    const name = iss.assigneeName || iss.agentName;
    if (name) return name.charAt(0).toUpperCase();
    if (iss.assigneeAgentId) return "A";
    return "";
  }
</script>

<a
  href="/{companyPrefix}/issues/{issue.id}"
  class="group block rounded-lg border border-white/[0.06] bg-[var(--clawdev-card-bg)] p-3 transition-all hover:border-white/[0.12] hover:bg-white/[0.03] hover:shadow-lg hover:shadow-black/20"
>
  <!-- Top row: identifier + priority -->
  <div class="flex items-center gap-2 mb-1.5">
    {#if issue.identifier}
      <span class="text-[11px] font-mono text-[var(--clawdev-text-muted)] tracking-tight">
        {issue.identifier}
      </span>
    {/if}
    {#if issue.priority && PRIORITY_DOT_COLORS[issue.priority]}
      <span
        class={cn(
          "ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none",
          "border",
          issue.priority === "critical" && "text-[#EF4444] bg-red-500/10 border-red-500/20",
          issue.priority === "high" && "text-[#F97316] bg-orange-500/10 border-orange-500/20",
          issue.priority === "medium" && "text-[#F59E0B] bg-yellow-500/10 border-yellow-500/20",
          issue.priority === "low" && "text-[#64748B] bg-zinc-500/10 border-zinc-500/20",
        )}
      >
        <span class={cn("size-1.5 rounded-full", PRIORITY_DOT_COLORS[issue.priority])}></span>
        {PRIORITY_LABELS[issue.priority]}
      </span>
    {/if}
  </div>

  <!-- Title -->
  <p class="text-sm text-[var(--clawdev-text-primary)] leading-snug line-clamp-2 mb-2.5">
    {issue.title}
  </p>

  <!-- Labels -->
  {#if issue.labels?.length}
    <div class="flex flex-wrap gap-1 mb-2">
      {#each issue.labels.slice(0, 3) as label}
        <span
          class="inline-block rounded-full px-1.5 py-0 text-[10px] font-medium leading-relaxed"
          style="background-color: {label.color ?? '#3b82f6'}15; color: {label.color ?? '#3b82f6'}; border: 1px solid {label.color ?? '#3b82f6'}30;"
        >
          {label.name}
        </span>
      {/each}
      {#if issue.labels.length > 3}
        <span class="text-[10px] text-[var(--clawdev-text-muted)]">+{issue.labels.length - 3}</span>
      {/if}
    </div>
  {/if}

  <!-- Bottom row: assignee + metadata -->
  <div class="flex items-center gap-2 mt-auto">
    {#if assigneeInitial(issue)}
      <div class="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-[10px] font-medium text-[var(--clawdev-text-muted)]" title={issue.assigneeName || issue.agentName || ""}>
        {assigneeInitial(issue)}
      </div>
    {:else}
      <div class="flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)]">
        <User class="size-3 text-[var(--clawdev-text-muted)]/40" />
      </div>
    {/if}

    {#if issue.projectId}
      <FolderKanban class="size-3 text-[var(--clawdev-text-muted)]/50 ml-auto" />
    {/if}
  </div>
</a>
