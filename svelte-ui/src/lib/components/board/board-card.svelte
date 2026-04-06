<script lang="ts">
  import { cn } from "$utils/index.js";
  import { User, FolderKanban } from "lucide-svelte";
  import { DEFAULT_ENTITY_COLOR, PRIORITY_VISUALS } from "$lib/constants/visual";

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
  function assigneeInitial(iss: Issue): string {
    const name = iss.assigneeName || iss.agentName;
    if (name) return name.charAt(0).toUpperCase();
    if (iss.assigneeAgentId) return "A";
    return "";
  }
</script>

<a
  href="/{companyPrefix}/issues/{issue.id}"
  class="group block rounded-lg border border-border/50 bg-[var(--clawdev-card-bg)] p-3 transition-all hover:border-border hover:bg-accent/40 hover:shadow-lg hover:shadow-black/20"
>
  <!-- Top row: identifier + priority -->
  <div class="flex items-center gap-2 mb-1.5">
    {#if issue.identifier}
      <span class="text-[11px] font-mono text-[var(--clawdev-text-muted)] tracking-tight">
        {issue.identifier}
      </span>
    {/if}
    {#if issue.priority && PRIORITY_VISUALS[issue.priority]}
      <span
        class={cn(
          "ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none",
          "border",
          PRIORITY_VISUALS[issue.priority]?.badgeClass ?? "text-muted-foreground bg-zinc-500/10 border-zinc-500/20",
        )}
      >
        <span class={cn("size-1.5 rounded-full", PRIORITY_VISUALS[issue.priority]?.dotClass ?? "bg-zinc-500")}></span>
        {PRIORITY_VISUALS[issue.priority]?.label}
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
          style="background-color: {label.color ?? DEFAULT_ENTITY_COLOR}15; color: {label.color ?? DEFAULT_ENTITY_COLOR}; border: 1px solid {label.color ?? DEFAULT_ENTITY_COLOR}30;"
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
      <div class="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-[var(--clawdev-text-muted)]" title={issue.assigneeName || issue.agentName || ""}>
        {assigneeInitial(issue)}
      </div>
    {:else}
      <div class="flex h-5 w-5 items-center justify-center rounded-full bg-accent/50">
        <User class="size-3 text-[var(--clawdev-text-muted)]/40" />
      </div>
    {/if}

    {#if issue.projectId}
      <FolderKanban class="size-3 text-[var(--clawdev-text-muted)]/50 ml-auto" />
    {/if}
  </div>
</a>
