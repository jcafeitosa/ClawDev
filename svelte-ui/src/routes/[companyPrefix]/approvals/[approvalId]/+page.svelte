<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageLayout } from "$components/layout/index.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Textarea } from "$components/ui/index.js";
  import CommentThread from "$lib/components/comment-thread.svelte";
  import { onMount, onDestroy } from "svelte";
  import { Zap, Timer } from "lucide-svelte";

  // ---------------------------------------------------------------------------
  // Auto-approve countdown
  // ---------------------------------------------------------------------------
  const AUTO_APPROVE_SECONDS = 60;
  let now = $state(Date.now());
  let tickInterval: ReturnType<typeof setInterval> | undefined;

  function autoApproveTimeLeft(createdAt: string | undefined): number {
    if (!createdAt) return 0;
    return Math.max(0, AUTO_APPROVE_SECONDS - Math.floor((now - new Date(createdAt).getTime()) / 1000));
  }

  function isAutoApproved(a: Approval | null): boolean {
    if (!a) return false;
    return a.status === "approved" && Boolean(
      a.decidedByUserId?.startsWith("ceo:") || a.decidedByUserId?.startsWith("system:auto"),
    );
  }

  // ---------------------------------------------------------------------------
  // Types
  // ---------------------------------------------------------------------------
  interface Approval {
    id: string;
    type: string;
    status: string;
    title?: string | null;
    description?: string | null;
    payload: Record<string, unknown>;
    requestedByAgentId?: string | null;
    requestedByUserId?: string | null;
    decidedByUserId?: string | null;
    decisionNote?: string | null;
    decidedAt?: string | null;
    companyId: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  }

  interface ApprovalComment {
    id: string;
    body: string;
    agentId?: string | null;
    userId?: string | null;
    createdAt?: string;
    [key: string]: unknown;
  }

  interface LinkedIssue {
    id: string;
    identifier?: string;
    title: string;
    status: string;
    [key: string]: unknown;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let approval = $state<Approval | null>(null);
  let comments = $state<ApprovalComment[]>([]);
  let linkedIssues = $state<LinkedIssue[]>([]);
  let loading = $state(true);
  let notFound = $state(false);
  let activeTab = $state("details");
  let decisionNote = $state("");
  let processingAction = $state<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------
  let approvalId = $derived($page.params.approvalId);
  let isPending = $derived(approval?.status === "pending");
  let isRejected = $derived(approval?.status === "rejected");
  let payloadEntries = $derived(
    approval ? Object.entries(approval.payload).filter(([, v]) => v !== null && v !== undefined) : [],
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  async function loadApproval() {
    if (!approvalId) return;
    loading = true;
    notFound = false;
    try {
      const res = await api(`/api/approvals/${approvalId}`);
      if (!res.ok) {
        if (res.status === 404) { notFound = true; return; }
        throw new Error(await res.text());
      }
      approval = (await res.json()) as Approval;
      breadcrumbStore.set([
        { label: "Approvals", href: `/${$page.params.companyPrefix}/approvals` },
        { label: approval.title ?? `${approval.type} approval` },
      ]);
    } catch (err: any) {
      if (!notFound) {
        toastStore.push({ title: "Failed to load approval", body: err?.message, tone: "error" });
      }
    } finally {
      loading = false;
    }
  }

  async function loadComments() {
    if (!approvalId) return;
    try {
      const res = await api(`/api/approvals/${approvalId}/comments`);
      comments = res.ok ? ((await res.json()) as ApprovalComment[]) ?? [] : [];
    } catch {
      comments = [];
    }
  }

  async function loadLinkedIssues() {
    if (!approvalId) return;
    try {
      const res = await api(`/api/approvals/${approvalId}/issues`);
      linkedIssues = res.ok ? ((await res.json()) as LinkedIssue[]) ?? [] : [];
    } catch {
      linkedIssues = [];
    }
  }

  async function submitComment(body: string) {
    if (!approvalId || !body.trim()) return;
    const res = await api(`/api/approvals/${approvalId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body: body.trim() }),
    });
    if (!res.ok) throw new Error(await res.text());
    toastStore.push({ title: "Comment added", tone: "success" });
    await loadComments();
  }

  async function deleteComment(commentId: string) {
    const res = await api(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    toastStore.push({ title: "Comment deleted", tone: "success" });
    await loadComments();
  }

  async function handleApprove() {
    if (!approvalId) return;
    processingAction = "approve";
    try {
      const res = await api(`/api/approvals/${approvalId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          decidedByUserId: null,
          decisionNote: decisionNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Approval approved", tone: "success" });
      decisionNote = "";
      await loadApproval();
    } catch (err: any) {
      toastStore.push({ title: "Failed to approve", body: err?.message, tone: "error" });
    } finally {
      processingAction = null;
    }
  }

  async function handleReject() {
    if (!approvalId) return;
    processingAction = "reject";
    try {
      const res = await api(`/api/approvals/${approvalId}/reject`, {
        method: "POST",
        body: JSON.stringify({
          decidedByUserId: null,
          decisionNote: decisionNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Approval rejected", tone: "success" });
      decisionNote = "";
      await loadApproval();
    } catch (err: any) {
      toastStore.push({ title: "Failed to reject", body: err?.message, tone: "error" });
    } finally {
      processingAction = null;
    }
  }

  async function handleRequestRevision() {
    if (!approvalId) return;
    processingAction = "request-revision";
    try {
      const res = await api(`/api/approvals/${approvalId}/request-revision`, {
        method: "POST",
        body: JSON.stringify({
          note: decisionNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Revision requested", tone: "success" });
      decisionNote = "";
      await loadApproval();
    } catch (err: any) {
      toastStore.push({ title: "Failed to request revision", body: err?.message, tone: "error" });
    } finally {
      processingAction = null;
    }
  }

  async function handleResubmit() {
    if (!approvalId) return;
    processingAction = "resubmit";
    try {
      const res = await api(`/api/approvals/${approvalId}/resubmit`, {
        method: "POST",
        body: JSON.stringify({
          payload: approval?.payload ?? null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toastStore.push({ title: "Approval resubmitted", tone: "success" });
      await loadApproval();
    } catch (err: any) {
      toastStore.push({ title: "Failed to resubmit", body: err?.message, tone: "error" });
    } finally {
      processingAction = null;
    }
  }

  onMount(() => {
    loadApproval();
    loadComments();
    loadLinkedIssues();
    tickInterval = setInterval(() => { now = Date.now(); }, 1000);
  });

  onDestroy(() => { if (tickInterval) clearInterval(tickInterval); });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function formatPayloadValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value, null, 2);
  }

  function approvalTypeLabel(type: string): string {
    const map: Record<string, string> = {
      hire_agent: "Hire Agent",
      budget_increase: "Budget Increase",
      deployment: "Deployment",
      configuration_change: "Configuration Change",
    };
    return map[type] ?? type.replace(/_/g, " ");
  }
</script>

{#if loading}
  <div class="p-6">
    <PageSkeleton lines={8} />
  </div>
{:else if notFound}
  <div class="p-6">
    <EmptyState title="Approval not found" description="The approval you're looking for doesn't exist or you don't have access." icon="✅">
      <a href="/{$page.params.companyPrefix}/approvals" class="text-sm text-primary hover:underline">Back to approvals</a>
    </EmptyState>
  </div>
{:else if approval}
  <PageLayout title={approval.title ?? approvalTypeLabel(approval.type)} description={approval.description ?? undefined} fullWidth>
    {#snippet actions()}
      <div class="flex items-center gap-2">
        <StatusBadge status={approval!.status} />
        <Badge variant="outline" class="capitalize">{approvalTypeLabel(approval!.type)}</Badge>
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/approvals">
          Back
        </Button>
      </div>
    {/snippet}

    <!-- Auto-approve countdown for hire_agent -->
    {#if isPending && approval.type === "hire_agent"}
      {@const timeLeft = autoApproveTimeLeft(approval.createdAt)}
      <div class="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
        {#if timeLeft > 0}
          <Timer class="h-4 w-4 shrink-0" />
          <span>This hire approval will be auto-approved by the CEO in <strong>{timeLeft}s</strong> if no action is taken.</span>
        {:else}
          <Zap class="h-4 w-4 shrink-0" />
          <span>Time expired. The CEO is auto-approving this request...</span>
        {/if}
      </div>
    {/if}

    <!-- Auto-approved badge for resolved approvals -->
    {#if isAutoApproved(approval)}
      <div class="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 p-3 mb-4 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
        <Zap class="h-4 w-4 shrink-0" />
        <span>This approval was auto-approved by the CEO after the 1-minute timeout.</span>
      </div>
    {/if}

    <!-- Action bar (approve/reject) -->
    {#if isPending}
      <Card class="mb-6">
        <CardContent class="pt-6">
          <div class="space-y-3">
            <Textarea
              bind:value={decisionNote}
              placeholder="Decision note (optional)..."
              class="min-h-[60px] resize-y"
            />
            <div class="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={processingAction !== null}
                onclick={handleRequestRevision}
              >
                {processingAction === "request-revision" ? "Requesting..." : "Request Revision"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={processingAction !== null}
                onclick={handleReject}
              >
                {processingAction === "reject" ? "Rejecting..." : "Reject"}
              </Button>
              <Button
                size="sm"
                disabled={processingAction !== null}
                onclick={handleApprove}
              >
                {processingAction === "approve" ? "Approving..." : "Approve"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Resubmit action (rejected approvals) -->
    {#if isRejected}
      <Card class="mb-6">
        <CardContent class="pt-6">
          <div class="flex items-center justify-between">
            <div class="text-sm text-muted-foreground">
              This approval was rejected. You can resubmit it for review.
            </div>
            <Button
              size="sm"
              disabled={processingAction !== null}
              onclick={handleResubmit}
            >
              {processingAction === "resubmit" ? "Resubmitting..." : "Resubmit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    {/if}

    <!-- Decision note (when resolved) -->
    {#if approval.decisionNote && !isPending}
      <Card class="mb-6">
        <CardContent class="pt-6">
          <div class="flex items-start gap-3">
            <StatusBadge status={approval!.status} />
            <div class="text-sm">
              <p class="whitespace-pre-wrap">{approval.decisionNote}</p>
              {#if approval.decidedAt}
                <TimeAgo date={approval.decidedAt} class="text-xs mt-1 block" />
              {/if}
            </div>
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
            <TabsTrigger value="details">Payload</TabsTrigger>
            <TabsTrigger value="issues">Linked Issues ({linkedIssues.length})</TabsTrigger>
            <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <div class="mt-4">
              {#if payloadEntries.length === 0}
                <EmptyState title="Empty payload" description="This approval has no payload data." icon="📦" />
              {:else}
                <Card>
                  <CardContent class="pt-6">
                    <div class="space-y-3">
                      {#each payloadEntries as [key, value]}
                        <div class="text-sm">
                          <span class="text-muted-foreground font-medium">{key}</span>
                          <div class="mt-0.5">
                            {#if typeof value === "object" && value !== null}
                              <pre class="text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{formatPayloadValue(value)}</pre>
                            {:else}
                              <span class="text-foreground">{formatPayloadValue(value)}</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </CardContent>
                </Card>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="issues">
            <div class="mt-4">
              {#if linkedIssues.length === 0}
                <EmptyState title="No linked issues" description="No issues are linked to this approval." icon="📋" />
              {:else}
                <div class="border rounded-lg divide-y divide-border border-border">
                  {#each linkedIssues as issue}
                    <a
                      href="/{$page.params.companyPrefix}/issues/{issue.id}"
                      class="flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={issue.status} />
                        {#if issue.identifier}
                          <span class="text-xs font-mono text-muted-foreground shrink-0">{issue.identifier}</span>
                        {/if}
                        <span class="truncate">{issue.title}</span>
                      </div>
                    </a>
                  {/each}
                </div>
              {/if}
            </div>
          </TabsContent>

          <TabsContent value="comments">
            <div class="mt-4">
              <CommentThread
                {comments}
                onSubmit={submitComment}
                onDelete={deleteComment}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status">
          <StatusBadge status={approval!.status} />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Type">
          <span class="capitalize">{approvalTypeLabel(approval.type)}</span>
        </PropertyRow>
        {#if approval.requestedByAgentId}
          <Separator />
          <PropertyRow label="Requested by">
            <a href="/{$page.params.companyPrefix}/agents/{approval.requestedByAgentId}" class="text-primary hover:underline text-xs font-mono">
              {approval.requestedByAgentId.slice(0, 8)}...
            </a>
          </PropertyRow>
        {/if}
        {#if approval.decidedByUserId}
          <Separator />
          <PropertyRow label="Decided by">
            {#if approval.decidedByUserId.startsWith('ceo:') || approval.decidedByUserId.startsWith('system:auto')}
              <Badge class="bg-blue-500/15 text-blue-500 border-blue-500/30 text-xs">
                <Zap class="h-3 w-3 mr-1" />
                Auto-approved (CEO)
              </Badge>
            {:else}
              <span class="text-xs font-mono">{approval.decidedByUserId}</span>
            {/if}
          </PropertyRow>
        {/if}
        {#if approval.decidedAt}
          <Separator />
          <PropertyRow label="Decided at">
            <TimeAgo date={approval.decidedAt} class="text-xs" />
          </PropertyRow>
        {/if}
        <Separator />
        <PropertyRow label="Linked issues">
          <span class="font-medium">{linkedIssues.length}</span>
        </PropertyRow>
        <Separator />
        <PropertyRow label="Created">
          <TimeAgo date={approval.createdAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="Updated">
          <TimeAgo date={approval.updatedAt} class="text-xs" />
        </PropertyRow>
        <Separator />
        <PropertyRow label="ID">
          <span class="font-mono text-xs break-all">{approval.id}</span>
        </PropertyRow>
      </PropertiesPanel>
    </div>
  </PageLayout>
{/if}
