<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  let issueId = $derived($page.params.issueId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let issue = $state<any>(null);
  let comments = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let newComment = $state("");
  let submittingComment = $state(false);

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500/10 text-red-500",
    high: "bg-orange-500/10 text-orange-500",
    medium: "bg-yellow-500/10 text-yellow-500",
    low: "bg-blue-500/10 text-blue-500",
    none: "bg-muted text-muted-foreground",
  };

  const statusColors: Record<string, string> = {
    open: "bg-blue-500/10 text-blue-500",
    "in_progress": "bg-yellow-500/10 text-yellow-500",
    "in_review": "bg-purple-500/10 text-purple-500",
    done: "bg-green-500/10 text-green-500",
    closed: "bg-muted text-muted-foreground",
    blocked: "bg-red-500/10 text-red-500",
  };

  $effect(() => {
    if (!issueId) return;
    loading = true;
    error = null;

    api.api.issues({ id: issueId }).get()
      .then((res) => {
        issue = res.data;
        comments = (issue as any)?.comments ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load issue";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Issues", href: `/${companyPrefix}/issues` },
      { label: issue?.title ?? `Issue` },
    ]);
  });

  async function submitComment() {
    if (!newComment.trim() || submittingComment) return;
    submittingComment = true;
    try {
      await api.api.issues({ id: issueId }).comments.post({ body: newComment.trim() });
      newComment = "";
      // Reload issue to get updated comments
      const res = await api.api.issues({ id: issueId }).get();
      issue = res.data;
      comments = (issue as any)?.comments ?? [];
    } catch {
      // Silently fail — toast could be added later
    } finally {
      submittingComment = false;
    }
  }
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-64 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-full max-w-lg rounded bg-muted animate-pulse"></div>
    <div class="h-32 rounded-lg bg-muted animate-pulse mt-4"></div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if issue}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="space-y-2">
      <div class="flex items-start gap-3">
        <h1 class="text-xl font-semibold text-foreground flex-1">{issue.title}</h1>
      </div>
      <div class="flex flex-wrap gap-2">
        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[issue.status] ?? 'bg-muted text-muted-foreground'}">
          {issue.status ?? "unknown"}
        </span>
        {#if issue.priority}
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {priorityColors[issue.priority] ?? 'bg-muted text-muted-foreground'}">
            {issue.priority}
          </span>
        {/if}
        {#if issue.assigneeId}
          <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            Assigned: {issue.assigneeName ?? issue.assigneeId}
          </span>
        {/if}
      </div>
    </div>

    <!-- Properties -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Project</dt>
        <dd class="mt-1 text-sm text-foreground">{issue.projectName ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent</dt>
        <dd class="mt-1 text-sm text-foreground">{issue.agentName ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</dt>
        <dd class="mt-1 text-sm text-foreground">
          {issue.createdAt ? new Date(issue.createdAt).toLocaleDateString() : "—"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Updated</dt>
        <dd class="mt-1 text-sm text-foreground">
          {issue.updatedAt ? new Date(issue.updatedAt).toLocaleDateString() : "—"}
        </dd>
      </div>
    </div>

    <!-- Description -->
    {#if issue.body}
      <div class="rounded-lg border border-border bg-card p-4">
        <h2 class="text-sm font-medium text-foreground mb-2">Description</h2>
        <div class="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground whitespace-pre-wrap">
          {issue.body}
        </div>
      </div>
    {/if}

    <!-- Comments -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium text-foreground">Comments ({comments.length})</h2>

      {#if comments.length > 0}
        <div class="space-y-3">
          {#each comments as comment}
            <div class="rounded-lg border border-border bg-card p-4">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-sm font-medium text-foreground">{comment.authorName ?? "System"}</span>
                <span class="text-xs text-muted-foreground">
                  {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}
                </span>
              </div>
              <p class="text-sm text-muted-foreground whitespace-pre-wrap">{comment.body ?? comment.text ?? ""}</p>
            </div>
          {/each}
        </div>
      {/if}

      <!-- New comment form -->
      <div class="space-y-2">
        <textarea
          bind:value={newComment}
          placeholder="Write a comment..."
          rows="3"
          class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        ></textarea>
        <div class="flex justify-end">
          <button
            onclick={submitComment}
            disabled={!newComment.trim() || submittingComment}
            class="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submittingComment ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
