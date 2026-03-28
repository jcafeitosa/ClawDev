<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { toastStore } from "$stores/toast.svelte.js";
  import { PageSkeleton, PropertiesPanel, PropertyRow, StatusBadge, TimeAgo, EmptyState } from "$components/index.js";
  import { Button, Badge, Card, CardHeader, CardTitle, CardContent, Separator, Tabs, TabsList, TabsTrigger, TabsContent, Textarea } from "$components/ui/index.js";
  import { onMount } from "svelte";

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
  });

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
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-semibold truncate">{approval.title ?? approvalTypeLabel(approval.type)}</h1>
          <StatusBadge status={approval.status} />
          <Badge variant="outline" class="capitalize">{approvalTypeLabel(approval.type)}</Badge>
        </div>
        {#if approval.description}
          <p class="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{approval.description}</p>
        {/if}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" href="/{$page.params.companyPrefix}/approvals">
          Back
        </Button>
      </div>
    </div>

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
            <div class="text-sm text-zinc-500 dark:text-zinc-400">
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
            <StatusBadge status={approval.status} />
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
                          <span class="text-zinc-500 dark:text-zinc-400 font-medium">{key}</span>
                          <div class="mt-0.5">
                            {#if typeof value === "object" && value !== null}
                              <pre class="text-xs font-mono bg-zinc-50 dark:bg-zinc-800/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{formatPayloadValue(value)}</pre>
                            {:else}
                              <span class="text-zinc-900 dark:text-zinc-100">{formatPayloadValue(value)}</span>
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
                <div class="border rounded-lg divide-y divide-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {#each linkedIssues as issue}
                    <a
                      href="/{$page.params.companyPrefix}/issues/{issue.id}"
                      class="flex items-center justify-between p-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <StatusBadge status={issue.status} />
                        {#if issue.identifier}
                          <span class="text-xs font-mono text-zinc-500 shrink-0">{issue.identifier}</span>
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
              {#if comments.length === 0}
                <EmptyState title="No comments" description="No discussion on this approval yet." icon="💬" />
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
        </Tabs>
      </div>

      <!-- Sidebar properties -->
      <PropertiesPanel>
        <PropertyRow label="Status">
          <StatusBadge status={approval.status} />
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
            <span class="text-xs font-mono">{approval.decidedByUserId}</span>
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
  </div>
{/if}
