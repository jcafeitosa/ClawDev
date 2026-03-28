<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Textarea, Input, Label } from "$components/ui/index.js";
  import { onMount } from "svelte";
  import { Pencil, GitBranchPlus, GitMerge, Eye, Trash2, Plus, Download, X, Upload, FileText, ExternalLink } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Issue {
    id: string;
    identifier?: string;
    title: string;
    description?: string | null;
    status: string;
    priority?: string | null;
    assigneeAgentId?: string | null;
    assigneeUserId?: string | null;
    projectId?: string | null;
    goalId?: string | null;
    parentId?: string | null;
    companyId: string;
    checkedOutBy?: string | null;
    createdAt?: string;
    updatedAt?: string;
    project?: { id: string; name: string } | null;
    goal?: { id: string; title: string } | null;
    ancestors?: Array<{ id: string; identifier?: string; title: string; status: string }>;
    workProducts?: WorkProduct[];
    documents?: Record<string, unknown>;
    descriptionDocument?: { content?: string } | null;
    planDocument?: { content?: string } | null;
    [key: string]: unknown;
  }

  interface Comment {
    id: string;
    body: string;
    agentId?: string | null;
    userId?: string | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface WorkProduct {
    id: string;
    title?: string | null;
    kind?: string;
    url?: string | null;
    status?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface IssueDocument {
    id: string;
    key: string;
    content?: string | null;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface Agent {
    id: string;
    name: string;
    [key: string]: unknown;
  }

  interface Attachment {
    id: string;
    filename: string;
    size?: number;
    mimeType?: string;
    createdAt?: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "blocked", "completed", "cancelled"] as const;
  const ISSUE_PRIORITIES = ["critical", "high", "medium", "low"] as const;
  const WP_KINDS = ["code_pull_request", "document", "report", "other"] as const;
  const WP_STATUSES = ["draft", "in_review", "approved", "rejected"] as const;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let issue = $state<Issue | null>(null);
  let comments = $state<Comment[]>([]);
  let documents = $state<IssueDocument[]>([]);
  let attachments = $state<Attachment[]>([]);
  let agents = $state<Agent[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("details");
  let newComment = $state("");
  let submittingComment = $state(false);

  // -- Inline edit state
  let editing = $state(false);
  let editTitle = $state("");
  let editStatus = $state("");
  let editPriority = $state("");
  let editAssigneeAgentId = $state("");
  let savingEdit = $state(false);

  // -- Delete confirmation state
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  // -- Checkout/Release state
  let checkingOut = $state(false);
  let markingRead = $state(false);

  // -- Work product form state
  let showWpForm = $state(false);
  let wpTitle = $state("");
  let wpKind = $state<string>(WP_KINDS[0]);
  let wpUrl = $state("");
  let wpStatus = $state<string>(WP_STATUSES[0]);
  let submittingWp = $state(false);

  // -- Work product edit state
  let editingWpId = $state<string | null>(null);
  let editWpTitle = $state("");
  let editWpKind = $state<string>(WP_KINDS[0]);
  let editWpUrl = $state("");
  let editWpStatus = $state<string>(WP_STATUSES[0]);
  let savingWpEdit = $state(false);

  // -- Attachment upload state
  let uploading = $state(false);
  let fileInput = $state<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let issueId = $derived($page.params.issueId);
  let companyId = $derived(companyStore.selectedCompanyId);
  let isCheckedOut = $derived(!!issue?.checkedOutBy);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadIssue() {
    if (!issueId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/issues/${issueId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      issue = (await res.json()) as Issue;
      breadcrumbStore.set([
        { label: "Issues", href: `/${$page.params.companyPrefix}/issues` },
        { label: issue.identifier ?? issue.title },
      ]);
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: "Failed to load issue", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadComments() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/comments`);
      comments = res.ok ? ((await res.json()) as Comment[]) ?? [] : [];
    } catch {
      comments = [];
    }
  }

  async function loadDocuments() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/documents`);
      documents = res.ok ? ((await res.json()) as IssueDocument[]) ?? [] : [];
    } catch {
      documents = [];
    }
  }

  async function loadAttachments() {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/attachments`);
      attachments = res.ok ? ((await res.json()) as Attachment[]) ?? [] : [];
    } catch {
      attachments = [];
    }
  }

  async function loadAgents() {
    if (!companyId) return;
    try {
      const res = await api(`/api/companies/${companyId}/agents`);
      agents = res.ok ? ((await res.json()) as Agent[]) ?? [] : [];
    } catch {
      agents = [];
    }
  }

  async function submitComment() {
    if (!issueId || !newComment.trim()) return;
    submittingComment = true;
    try {
      const res = await api(`/api/issues/${issueId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      newComment = "";
      toastStore.push({ title: "Comment added", tone: "success" });
      await loadComments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to add comment", body: err?.message, tone: "error" });
    } finally {
      submittingComment = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------
  function startEdit() {
    if (!issue) return;
    editTitle = issue.title;
    editStatus = issue.status;
    editPriority = issue.priority ?? "";
    editAssigneeAgentId = issue.assigneeAgentId ?? "";
    editing = true;
    if (agents.length === 0) loadAgents();
  }

  function cancelEdit() {
    editing = false;
  }

  async function saveEdit() {
    if (!issue || !issueId) return;
    savingEdit = true;
    try {
      const body: Record<string, unknown> = {};
      if (editTitle !== issue.title) body.title = editTitle;
      if (editStatus !== issue.status) body.status = editStatus;
      if (editPriority !== (issue.priority ?? "")) body.priority = editPriority || null;
      if (editAssigneeAgentId !== (issue.assigneeAgentId ?? "")) body.assigneeAgentId = editAssigneeAgentId || null;

      if (Object.keys(body).length === 0) {
        editing = false;
        return;
      }

      const res = await api(`/api/issues/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue updated", tone: "success" });
      editing = false;
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to update issue", body: err?.message, tone: "error" });
    } finally {
      savingEdit = false;
    }
  }

  async function checkoutIssue() {
    if (!issueId) return;
    checkingOut = true;
    try {
      const res = await api(`/api/issues/${issueId}/checkout`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue checked out", tone: "success" });
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to checkout issue", body: err?.message, tone: "error" });
    } finally {
      checkingOut = false;
    }
  }

  async function releaseIssue() {
    if (!issueId) return;
    checkingOut = true;
    try {
      const res = await api(`/api/issues/${issueId}/release`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue released", tone: "success" });
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to release issue", body: err?.message, tone: "error" });
    } finally {
      checkingOut = false;
    }
  }

  async function markRead() {
    if (!issueId) return;
    markingRead = true;
    try {
      const res = await api(`/api/issues/${issueId}/read`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Marked as read", tone: "success" });
    } catch (err: any) {
      toastStore.push({ title: "Failed to mark as read", body: err?.message, tone: "error" });
    } finally {
      markingRead = false;
    }
  }

  async function deleteIssue() {
    if (!issueId) return;
    deleting = true;
    try {
      const res = await api(`/api/issues/${issueId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Issue deleted", tone: "success" });
      goto(`/${$page.params.companyPrefix}/issues`);
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete issue", body: err?.message, tone: "error" });
    } finally {
      deleting = false;
      showDeleteConfirm = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Work Product handlers
  // ---------------------------------------------------------------------------
  function resetWpForm() {
    wpTitle = "";
    wpKind = WP_KINDS[0];
    wpUrl = "";
    wpStatus = WP_STATUSES[0];
    showWpForm = false;
  }

  async function submitWorkProduct() {
    if (!issueId || !wpTitle.trim()) return;
    submittingWp = true;
    try {
      const body: Record<string, unknown> = {
        title: wpTitle.trim(),
        kind: wpKind,
        status: wpStatus,
      };
      if (wpUrl.trim()) body.url = wpUrl.trim();

      const res = await api(`/api/issues/${issueId}/work-products`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Work product added", tone: "success" });
      resetWpForm();
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to add work product", body: err?.message, tone: "error" });
    } finally {
      submittingWp = false;
    }
  }

  function startEditWp(wp: WorkProduct) {
    editingWpId = wp.id;
    editWpTitle = wp.title ?? "";
    editWpKind = wp.kind ?? WP_KINDS[0];
    editWpUrl = wp.url ?? "";
    editWpStatus = wp.status ?? WP_STATUSES[0];
  }

  function cancelEditWp() {
    editingWpId = null;
  }

  async function saveEditWp() {
    if (!editingWpId || !issueId) return;
    savingWpEdit = true;
    try {
      const body: Record<string, unknown> = {
        title: editWpTitle.trim(),
        kind: editWpKind,
        status: editWpStatus,
      };
      if (editWpUrl.trim()) body.url = editWpUrl.trim();
      else body.url = null;

      const res = await api(`/api/issues/${issueId}/work-products/${editingWpId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Work product updated", tone: "success" });
      editingWpId = null;
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to update work product", body: err?.message, tone: "error" });
    } finally {
      savingWpEdit = false;
    }
  }

  async function deleteWorkProduct(wpId: string) {
    if (!issueId) return;
    try {
      const res = await api(`/api/issues/${issueId}/work-products/${wpId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Work product removed", tone: "success" });
      await loadIssue();
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete work product", body: err?.message, tone: "error" });
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment handlers
  // ---------------------------------------------------------------------------
  function triggerFileUpload() {
    fileInput?.click();
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file || !issueId || !companyId) return;

    uploading = true;
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/companies/${companyId}/issues/${issueId}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Attachment uploaded", tone: "success" });
      target.value = "";
      await loadAttachments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to upload attachment", body: err?.message, tone: "error" });
    } finally {
      uploading = false;
    }
  }

  async function deleteAttachment(attachmentId: string) {
    try {
      const res = await api(`/api/attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Attachment deleted", tone: "success" });
      await loadAttachments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to delete attachment", body: err?.message, tone: "error" });
    }
  }

  function formatFileSize(bytes?: number): string {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  onMount(() => {
    loadIssue();
    loadComments();
    loadDocuments();
    loadAttachments();
  });
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={10} />
  </div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Issue not found" description="The issue you're looking for doesn't exist or you don't have access." icon="📋">
      <a href="/{$page.params.companyPrefix}/issues" class="text-sm text-primary hover:underline">Back to issues</a>
    </EmptyState>
  </div>
{:else if issue}
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          {#if issue.identifier}
            <span class="text-sm font-mono text-zinc-500 dark:text-zinc-400">{issue.identifier}</span>
          {/if}
          <h1 class="text-xl font-semibold truncate">{issue.title}</h1>
        </div>
        <!-- Ancestors -->
        {#if issue.ancestors && issue.ancestors.length > 0}
          <div class="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {#each issue.ancestors as ancestor, i}
              <a href="/{$page.params.companyPrefix}/issues/{ancestor.id}" class="hover:text-primary hover:underline">
                {ancestor.identifier ?? ancestor.title}
              </a>
              {#if i < issue.ancestors.length - 1}
                <span>/</span>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0 flex-wrap">
        <Button variant="outline" size="sm" onclick={startEdit} disabled={editing}>
          <Pencil class="size-3.5 mr-1" />
          Edit
        </Button>
        {#if isCheckedOut}
          <Button variant="outline" size="sm" onclick={releaseIssue} disabled={checkingOut}>
            <GitMerge class="size-3.5 mr-1" />
            {checkingOut ? "Releasing..." : "Release"}
          </Button>
        {:else}
          <Button variant="outline" size="sm" onclick={checkoutIssue} disabled={checkingOut}>
            <GitBranchPlus class="size-3.5 mr-1" />
            {checkingOut ? "Checking out..." : "Checkout"}
          </Button>
        {/if}
        <Button variant="outline" size="sm" onclick={markRead} disabled={markingRead}>
          <Eye class="size-3.5 mr-1" />
          {markingRead ? "Marking..." : "Mark Read"}
        </Button>
        {#if showDeleteConfirm}
          <div class="flex items-center gap-1.5 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-2.5 py-1">
            <span class="text-xs text-red-700 dark:text-red-400">Delete this issue?</span>
            <Button variant="destructive" size="sm" onclick={deleteIssue} disabled={deleting}>
              {deleting ? "Deleting..." : "Confirm"}
            </Button>
            <Button variant="outline" size="sm" onclick={() => showDeleteConfirm = false}>
              Cancel
            </Button>
          </div>
        {:else}
          <Button variant="outline" size="sm" class="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/40" onclick={() => showDeleteConfirm = true}>
            <Trash2 class="size-3.5 mr-1" />
            Delete
          </Button>
        {/if}
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/issues">
          Back
        </Button>
      </div>
    </div>

    <!-- Inline Edit Form -->
    {#if editing}
      <Card class="mb-6">
        <CardContent class="pt-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Title</Label>
              <Input bind:value={editTitle} placeholder="Issue title" />
            </div>
            <div>
              <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Status</Label>
              <select
                bind:value={editStatus}
                class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                {#each ISSUE_STATUSES as s}
                  <option value={s}>{s.replace(/_/g, " ")}</option>
                {/each}
              </select>
            </div>
            <div>
              <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Priority</Label>
              <select
                bind:value={editPriority}
                class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">None</option>
                {#each ISSUE_PRIORITIES as p}
                  <option value={p}>{p}</option>
                {/each}
              </select>
            </div>
            <div>
              <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Assignee Agent</Label>
              <select
                bind:value={editAssigneeAgentId}
                class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="">Unassigned</option>
                {#each agents as agent}
                  <option value={agent.id}>{agent.name}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <Button size="sm" onclick={saveEdit} disabled={savingEdit || !editTitle.trim()}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" size="sm" onclick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Main content + sidebar -->
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Main content area -->
      <div class="flex-1 min-w-0">
        <Tabs bind:value={activeTab}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
            <TabsTrigger value="work-products">Work Products</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div class="space-y-6 mt-4">
              <!-- Description -->
              <Card>
                <CardHeader>
                  <CardTitle>Description</CardTitle>
                </CardHeader>
                <CardContent>
                  {#if issue.description}
                    <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                      {issue.description}
                    </div>
                  {:else}
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 italic">No description provided.</p>
                  {/if}
                </CardContent>
              </Card>

              <!-- Plan Document (if exists) -->
              {#if issue.planDocument?.content}
                <Card>
                  <CardHeader>
                    <CardTitle>Plan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                      {issue.planDocument.content}
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Attachments -->
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between w-full">
                    <CardTitle>Attachments</CardTitle>
                    <div>
                      <input
                        type="file"
                        class="hidden"
                        bind:this={fileInput}
                        onchange={handleFileUpload}
                      />
                      <Button variant="outline" size="sm" onclick={triggerFileUpload} disabled={uploading}>
                        <Upload class="size-3.5 mr-1" />
                        {uploading ? "Uploading..." : "Upload"}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {#if attachments.length === 0}
                    <p class="text-sm text-zinc-500 dark:text-zinc-400 italic">No attachments.</p>
                  {:else}
                    <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                      {#each attachments as att}
                        <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                          <div class="flex items-center gap-2 min-w-0">
                            <FileText class="size-4 text-zinc-400 shrink-0" />
                            <div class="min-w-0">
                              <p class="font-medium truncate">{att.filename}</p>
                              {#if att.size != null}
                                <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{formatFileSize(att.size)}</p>
                              {/if}
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0">
                            <a
                              href="/api/attachments/{att.id}/content"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <Download class="size-3" />
                              Download
                            </a>
                            <Button variant="ghost" size="sm" class="h-7 px-2 text-red-600 hover:text-red-700 dark:text-red-400" onclick={() => deleteAttachment(att.id)}>
                              <Trash2 class="size-3" />
                            </Button>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="comments">
            <div class="mt-4 space-y-4">
              <!-- Comment input -->
              <div class="space-y-2">
                <Textarea
                  bind:value={newComment}
                  placeholder="Add a comment..."
                  class="min-h-[80px] resize-y"
                />
                <div class="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!newComment.trim() || submittingComment}
                    onclick={submitComment}
                  >
                    {submittingComment ? "Posting..." : "Comment"}
                  </Button>
                </div>
              </div>

              <Separator />

              <!-- Comments list -->
              {#if comments.length === 0}
                <EmptyState title="No comments yet" description="Be the first to add a comment." icon="💬" />
              {:else}
                <div class="space-y-3">
                  {#each comments as comment}
                    <div class="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          {#if comment.agentId}
                            <Badge variant="outline" class="text-xs">Agent</Badge>
                          {:else}
                            <Badge variant="secondary" class="text-xs">Board</Badge>
                          {/if}
                          <span class="font-mono">{(comment.agentId ?? comment.userId ?? "unknown").slice(0, 8)}</span>
                        </div>
                        <TimeAgo date={comment.createdAt} class="text-xs" />
                      </div>
                      <div class="text-sm whitespace-pre-wrap">{comment.body}</div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="work-products">
            <div class="mt-4 space-y-4">
              <!-- Add Work Product button -->
              <div class="flex justify-end">
                <Button variant="outline" size="sm" onclick={() => showWpForm = !showWpForm}>
                  {#if showWpForm}
                    <X class="size-3.5 mr-1" />
                    Cancel
                  {:else}
                    <Plus class="size-3.5 mr-1" />
                    Add Work Product
                  {/if}
                </Button>
              </div>

              <!-- Create Work Product form -->
              {#if showWpForm}
                <Card>
                  <CardContent class="pt-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="md:col-span-2">
                        <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Title</Label>
                        <Input bind:value={wpTitle} placeholder="Work product title" />
                      </div>
                      <div>
                        <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Kind</Label>
                        <select
                          bind:value={wpKind}
                          class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {#each WP_KINDS as k}
                            <option value={k}>{k.replace(/_/g, " ")}</option>
                          {/each}
                        </select>
                      </div>
                      <div>
                        <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">Status</Label>
                        <select
                          bind:value={wpStatus}
                          class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                        >
                          {#each WP_STATUSES as s}
                            <option value={s}>{s.replace(/_/g, " ")}</option>
                          {/each}
                        </select>
                      </div>
                      <div class="md:col-span-2">
                        <Label class="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 block">URL (optional)</Label>
                        <Input bind:value={wpUrl} placeholder="https://..." />
                      </div>
                    </div>
                    <div class="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <Button size="sm" onclick={submitWorkProduct} disabled={submittingWp || !wpTitle.trim()}>
                        {submittingWp ? "Adding..." : "Add Work Product"}
                      </Button>
                      <Button variant="outline" size="sm" onclick={resetWpForm}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              {/if}

              <!-- Work products list -->
              {#if !issue.workProducts || issue.workProducts.length === 0}
                <EmptyState title="No work products" description="No work products have been attached to this issue yet." icon="📦" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each issue.workProducts as wp}
                    {#if editingWpId === wp.id}
                      <!-- Inline edit row -->
                      <div class="p-3 space-y-3 bg-zinc-50 dark:bg-zinc-800/30">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div class="md:col-span-2">
                            <Input bind:value={editWpTitle} placeholder="Title" class="text-sm" />
                          </div>
                          <select
                            bind:value={editWpKind}
                            class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            {#each WP_KINDS as k}
                              <option value={k}>{k.replace(/_/g, " ")}</option>
                            {/each}
                          </select>
                          <select
                            bind:value={editWpStatus}
                            class="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-xs dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                          >
                            {#each WP_STATUSES as s}
                              <option value={s}>{s.replace(/_/g, " ")}</option>
                            {/each}
                          </select>
                          <div class="md:col-span-2">
                            <Input bind:value={editWpUrl} placeholder="URL (optional)" class="text-sm" />
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <Button size="sm" onclick={saveEditWp} disabled={savingWpEdit || !editWpTitle.trim()}>
                            {savingWpEdit ? "Saving..." : "Save"}
                          </Button>
                          <Button variant="outline" size="sm" onclick={cancelEditWp}>Cancel</Button>
                        </div>
                      </div>
                    {:else}
                      <!-- Display row -->
                      <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <div class="min-w-0">
                          <p class="font-medium truncate">{wp.title ?? "Untitled"}</p>
                          {#if wp.kind}
                            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{wp.kind.replace(/_/g, " ")}</p>
                          {/if}
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                          {#if wp.status}
                            <StatusBadge status={wp.status} />
                          {/if}
                          {#if wp.url}
                            <a href={wp.url} target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline inline-flex items-center gap-1">
                              <ExternalLink class="size-3" />
                              Open
                            </a>
                          {/if}
                          <Button variant="ghost" size="sm" class="h-7 px-2" onclick={() => startEditWp(wp)}>
                            <Pencil class="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" class="h-7 px-2 text-red-600 hover:text-red-700 dark:text-red-400" onclick={() => deleteWorkProduct(wp.id)}>
                            <Trash2 class="size-3" />
                          </Button>
                        </div>
                      </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <div class="mt-4">
              {#if documents.length === 0}
                <EmptyState title="No documents" description="No documents have been attached to this issue yet." icon="📄" />
              {:else}
                <div class="space-y-4">
                  {#each documents as doc}
                    <Card>
                      <CardHeader>
                        <CardTitle class="capitalize">{doc.key.replace(/_/g, " ")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {#if doc.content}
                          <div class="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm">
                            {doc.content}
                          </div>
                        {:else}
                          <p class="text-sm text-zinc-500 italic">No content.</p>
                        {/if}
                        {#if doc.updatedAt}
                          <div class="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                            <TimeAgo date={doc.updatedAt} class="text-xs" />
                          </div>
                        {/if}
                      </CardContent>
                    </Card>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status">
          <StatusBadge status={issue.status} />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Priority">
          <div class="flex items-center gap-1.5">
            <PriorityIcon priority={issue.priority} />
            <span class="capitalize">{issue.priority ?? "normal"}</span>
          </div>
        </PropertyRow>
        {#if issue.assigneeAgentId}
          <Separator />
          <PropertyRow label="Assignee (Agent)">
            <a href="/{$page.params.companyPrefix}/agents/{issue.assigneeAgentId}" class="text-primary hover:underline text-xs font-mono">
              {issue.assigneeAgentId.slice(0, 8)}...
            </a>
          </PropertyRow>
        {/if}
        {#if issue.project}
          <Separator />
          <PropertyRow label="Project">
            <a href="/{$page.params.companyPrefix}/projects/{issue.project.id}" class="text-primary hover:underline">
              {issue.project.name}
            </a>
          </PropertyRow>
        {/if}
        {#if issue.goal}
          <Separator />
          <PropertyRow label="Goal">
            <a href="/{$page.params.companyPrefix}/goals/{issue.goal.id}" class="text-primary hover:underline">
              {issue.goal.title}
            </a>
          </PropertyRow>
        {/if}
        {#if issue.parentId}
          <Separator />
          <PropertyRow label="Parent">
            <a href="/{$page.params.companyPrefix}/issues/{issue.parentId}" class="text-primary hover:underline text-xs font-mono">
              {issue.parentId.slice(0, 8)}...
            </a>
          </PropertyRow>
        {/if}
        <Separator />
        <PropertyRow label="Created">
          <TimeAgo date={issue.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={issue.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{issue.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </div>
{/if}
