<script lang="ts">
  import { page } from "$app/stores";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { onMount } from "svelte";

  let approvalId = $derived($page.params.approvalId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let approval = $state<any>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let acting = $state(false);

  $effect(() => {
    if (!approvalId) return;
    loading = true;
    error = null;

    api.api.approvals({ id: approvalId }).get()
      .then((res) => {
        approval = res.data;
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load approval";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Approvals", href: `/${companyPrefix}/approvals` },
      { label: approval?.title ?? `Approval` },
    ]);
  });

  async function handleAction(action: "approve" | "reject") {
    if (acting) return;
    acting = true;
    try {
      await api.api.approvals({ id: approvalId })[action].post();
      // Reload
      const res = await api.api.approvals({ id: approvalId }).get();
      approval = res.data;
    } catch (err) {
      error = err instanceof Error ? err.message : `Failed to ${action}`;
    } finally {
      acting = false;
    }
  }
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-56 rounded bg-muted animate-pulse"></div>
    <div class="h-4 w-96 rounded bg-muted animate-pulse"></div>
    <div class="h-32 rounded-lg bg-muted animate-pulse mt-4"></div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if approval}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="space-y-2">
      <h1 class="text-xl font-semibold text-foreground">{approval.title ?? "Approval Request"}</h1>
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium
            {approval.status === 'approved' ? 'bg-green-500/10 text-green-500' :
             approval.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
             approval.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
             'bg-muted text-muted-foreground'}"
        >
          {approval.status ?? "pending"}
        </span>
        <span class="text-xs text-muted-foreground">
          Requested {approval.createdAt ? new Date(approval.createdAt).toLocaleString() : ""}
        </span>
      </div>
    </div>

    <!-- Properties -->
    <div class="grid gap-4 sm:grid-cols-2">
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Requested By</dt>
        <dd class="mt-1 text-sm text-foreground">{approval.requestedBy ?? approval.agentName ?? "—"}</dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</dt>
        <dd class="mt-1 text-sm text-foreground">{approval.type ?? approval.approvalType ?? "—"}</dd>
      </div>
      {#if approval.issueId}
        <div class="rounded-lg border border-border bg-card p-3">
          <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issue</dt>
          <dd class="mt-1">
            <a href="/{companyPrefix}/issues/{approval.issueId}" class="text-sm text-primary hover:underline">
              {approval.issueTitle ?? approval.issueId}
            </a>
          </dd>
        </div>
      {/if}
      {#if approval.resolvedAt}
        <div class="rounded-lg border border-border bg-card p-3">
          <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Resolved At</dt>
          <dd class="mt-1 text-sm text-foreground">{new Date(approval.resolvedAt).toLocaleString()}</dd>
        </div>
      {/if}
    </div>

    <!-- Payload -->
    {#if approval.payload}
      <div class="rounded-lg border border-border bg-card p-4">
        <h2 class="text-sm font-medium text-foreground mb-2">Request Details</h2>
        <pre class="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 rounded p-3 max-h-64 overflow-y-auto">{typeof approval.payload === "string" ? approval.payload : JSON.stringify(approval.payload, null, 2)}</pre>
      </div>
    {/if}

    <!-- Actions -->
    {#if approval.status === "pending"}
      <div class="flex items-center gap-3 pt-2">
        <button
          onclick={() => handleAction("approve")}
          disabled={acting}
          class="inline-flex h-9 items-center justify-center rounded-md bg-green-600 px-4 text-sm font-medium text-white shadow hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {acting ? "Processing..." : "Approve"}
        </button>
        <button
          onclick={() => handleAction("reject")}
          disabled={acting}
          class="inline-flex h-9 items-center justify-center rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground shadow hover:bg-destructive/90 transition-colors disabled:opacity-50"
        >
          {acting ? "Processing..." : "Reject"}
        </button>
      </div>
    {/if}
  </div>
{/if}
