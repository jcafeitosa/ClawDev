<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, PriorityIcon, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Textarea } from "$components/ui/index.js";
  import { onMount } from "svelte";

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

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let issue = $state<Issue | null>(null);
  let comments = $state<Comment[]>([]);
  let documents = $state<IssueDocument[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("details");
  let newComment = $state("");
  let submittingComment = $state(false);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let issueId = $derived($page.params.issueId);
  let companyId = $derived(companyStore.selectedCompanyId);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadIssue() {
    if (!issueId) return;
    loading = true;
    notFound = false;
    try {
      const result = await (api as any).api.issues({ id: issueId }).get();
      issue = unwrap(result) as Issue;
      breadcrumbStore.set([
        { label: "Issues", href: `/${$page.params.companyPrefix}/issues` },
        { label: issue.identifier ?? issue.title },
      ]);
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.status === 404) {
        notFound = true;
      } else {
        toastStore.push({ title: "Failed to load issue", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadComments() {
    if (!issueId) return;
    try {
      const result = await (api as any).api.issues({ id: issueId }).comments.get();
      comments = (unwrap(result) as Comment[]) ?? [];
    } catch {
      comments = [];
    }
  }

  async function loadDocuments() {
    if (!issueId) return;
    try {
      const result = await (api as any).api.issues({ id: issueId }).documents.get();
      documents = (unwrap(result) as IssueDocument[]) ?? [];
    } catch {
      documents = [];
    }
  }

  async function submitComment() {
    if (!issueId || !newComment.trim()) return;
    submittingComment = true;
    try {
      await (api as any).api.issues({ id: issueId }).comments.post({ body: newComment.trim() });
      newComment = "";
      toastStore.push({ title: "Comment added", tone: "success" });
      await loadComments();
    } catch (err: any) {
      toastStore.push({ title: "Failed to add comment", body: err?.message, tone: "error" });
    } finally {
      submittingComment = false;
    }
  }

  onMount(() => {
    loadIssue();
    loadComments();
    loadDocuments();
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
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/issues">
          Back
        </Button>
      </div>
    </div>

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
            <div class="mt-4">
              {#if !issue.workProducts || issue.workProducts.length === 0}
                <EmptyState title="No work products" description="No work products have been attached to this issue yet." icon="📦" />
              {:else}
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each issue.workProducts as wp}
                    <div class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div class="min-w-0">
                        <p class="font-medium truncate">{wp.title ?? "Untitled"}</p>
                        {#if wp.kind}
                          <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{wp.kind}</p>
                        {/if}
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        {#if wp.status}
                          <StatusBadge status={wp.status} />
                        {/if}
                        {#if wp.url}
                          <a href={wp.url} target="_blank" rel="noopener noreferrer" class="text-xs text-primary hover:underline">Open</a>
                        {/if}
                      </div>
                    </div>
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
