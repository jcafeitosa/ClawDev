<script lang="ts">
  /**
   * CommentThread — reusable threaded comment component.
   * Renders a list of comments with author badges, timestamps, markdown bodies,
   * optional delete, and a composer at the bottom.
   */
  import MarkdownBody from "$lib/components/markdown-body.svelte";
  import TimeAgo from "$lib/components/time-ago.svelte";
  import { Button, Textarea, Skeleton, Separator } from "$components/ui/index.js";
  import { MessageSquare, Trash2, Send } from "lucide-svelte";

  interface Props {
    comments: any[];
    onSubmit: (text: string, options?: { reopen?: boolean; interrupt?: boolean }) => Promise<void>;
    onDelete?: (commentId: string) => Promise<void>;
    loading?: boolean;
    allowReopen?: boolean;
    allowInterrupt?: boolean;
    activeRunLabel?: string | null;
  }

  let {
    comments,
    onSubmit,
    onDelete,
    loading = false,
    allowReopen = true,
    allowInterrupt = false,
    activeRunLabel = null,
  }: Props = $props();

  let newComment = $state("");
  let submitting = $state(false);
  let deletingId = $state<string | null>(null);
  let confirmDeleteId = $state<string | null>(null);
  let reopenIssue = $state(true);
  let interruptActiveRun = $state(false);

  async function handleSubmit() {
    const text = newComment.trim();
    if (!text || submitting) return;
    submitting = true;
    try {
      await onSubmit(text, {
        ...(allowReopen ? { reopen: reopenIssue } : {}),
        ...(allowInterrupt ? { interrupt: interruptActiveRun } : {}),
      });
      newComment = "";
      reopenIssue = true;
      interruptActiveRun = false;
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  async function handleDelete(commentId: string) {
    if (!onDelete) return;
    deletingId = commentId;
    try {
      await onDelete(commentId);
    } finally {
      deletingId = null;
      confirmDeleteId = null;
    }
  }

  function requestDelete(commentId: string) {
    if (confirmDeleteId === commentId) {
      handleDelete(commentId);
    } else {
      confirmDeleteId = commentId;
      // Auto-dismiss confirmation after 3 seconds
      setTimeout(() => {
        if (confirmDeleteId === commentId) confirmDeleteId = null;
      }, 3000);
    }
  }

  function authorBadge(comment: any): { label: string; variant: "outline" | "secondary" | "default"; colorClass: string } {
    if (comment.agentId) {
      return { label: "Agent", variant: "outline", colorClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800" };
    }
    return { label: "Board", variant: "secondary", colorClass: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700" };
  }

  function authorId(comment: any): string {
    return (comment.agentId ?? comment.userId ?? "unknown").slice(0, 8);
  }
</script>

<div class="space-y-4">
  <!-- Comments list -->
  {#if loading}
    <div class="space-y-3">
      {#each Array(3) as _}
        <div class="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div class="flex items-center gap-2 mb-3">
            <Skeleton class="h-5 w-14 rounded" />
            <Skeleton class="h-4 w-16 rounded" />
            <div class="flex-1"></div>
            <Skeleton class="h-4 w-20 rounded" />
          </div>
          <Skeleton class="h-4 w-full rounded mb-1" />
          <Skeleton class="h-4 w-3/4 rounded" />
        </div>
      {/each}
    </div>
  {:else if comments.length === 0}
    <div class="flex flex-col items-center justify-center py-10 text-center">
      <div class="rounded-full bg-zinc-100 p-3 dark:bg-zinc-800 mb-3">
        <MessageSquare class="h-6 w-6 text-zinc-400" />
      </div>
      <p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">No comments yet.</p>
      <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Start the conversation.</p>
    </div>
  {:else}
    <div class="space-y-3">
      {#each comments as comment (comment.id)}
        {@const badge = authorBadge(comment)}
        <div class="group rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider {badge.colorClass}">
                {badge.label}
              </span>
              <span class="font-mono text-zinc-600 dark:text-zinc-400">{authorId(comment)}</span>
            </div>
            <div class="flex items-center gap-2">
              <TimeAgo date={comment.createdAt} class="text-xs" />
              {#if onDelete}
                <button
                  class="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                  disabled={deletingId === comment.id}
                  onclick={() => requestDelete(comment.id)}
                  title={confirmDeleteId === comment.id ? "Click again to confirm" : "Delete comment"}
                >
                  {#if deletingId === comment.id}
                    <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  {:else}
                    <Trash2 class="h-3.5 w-3.5 {confirmDeleteId === comment.id ? 'text-red-500 dark:text-red-400' : ''}" />
                  {/if}
                </button>
              {/if}
            </div>
          </div>
          <div class="text-sm">
            <MarkdownBody content={comment.body} />
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <Separator />

  <!-- Composer -->
  <div class="space-y-2">
    <Textarea
      bind:value={newComment}
      placeholder="Write a comment... (Ctrl+Enter to submit)"
      class="min-h-[80px] resize-y"
      onkeydown={handleKeydown}
    />
    {#if allowReopen || allowInterrupt}
      <div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        {#if allowReopen}
          <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={reopenIssue}
              class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            Re-open issue
          </label>
        {/if}
        {#if allowInterrupt}
          <label class="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={interruptActiveRun}
              class="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            Interrupt active run{#if activeRunLabel} ({activeRunLabel}){/if}
          </label>
        {/if}
      </div>
    {/if}
    <div class="flex items-center justify-between">
      <span class="text-[11px] text-zinc-400">Markdown supported</span>
      <Button
        size="sm"
        disabled={!newComment.trim() || submitting}
        onclick={handleSubmit}
      >
        {#if submitting}
          <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent mr-1.5"></span>
          Posting...
        {:else}
          <Send class="h-3.5 w-3.5 mr-1.5" />
          Comment
        {/if}
      </Button>
    </div>
  </div>
</div>
