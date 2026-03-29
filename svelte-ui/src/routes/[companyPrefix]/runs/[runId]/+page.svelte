<script lang="ts">
  import { page } from "$app/stores";
  import { api } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { Play, Clock, Wrench, MessageSquare, AlertCircle, ChevronDown, ChevronRight, Bot, User } from "lucide-svelte";

  let runId = $derived($page.params.runId);
  let companyPrefix = $derived($page.params.companyPrefix);
  let run = $state<any>(null);
  let transcript = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let expandedTools = $state<Set<number>>(new Set());

  $effect(() => {
    if (!runId) return;
    loading = true;
    error = null;

    Promise.all([
      api.api.runs({ id: runId }).get(),
      api.api.runs({ id: runId }).transcript.get().catch(() => ({ data: [] })),
    ])
      .then(([runRes, transcriptRes]) => {
        run = runRes.data;
        transcript = (transcriptRes.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load run";
      })
      .finally(() => {
        loading = false;
      });
  });

  $effect(() => {
    breadcrumbStore.set([
      { label: "Agents", href: `/${companyPrefix}/agents` },
      ...(run?.agentName ? [{ label: run.agentName, href: `/${companyPrefix}/agents/${run.agentId}` }] : []),
      { label: `Run ${runId?.slice(0, 8) ?? ""}` },
    ]);
  });

  function toggleTool(index: number) {
    const next = new Set(expandedTools);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    expandedTools = next;
  }

  function formatDuration(ms: number | null | undefined): string {
    if (!ms) return "—";
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  function formatTimestamp(ts: string | null | undefined): string {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString();
  }

  const statusConfig: Record<string, { color: string; bg: string }> = {
    running: { color: "text-blue-500", bg: "bg-blue-500/10" },
    completed: { color: "text-green-500", bg: "bg-green-500/10" },
    failed: { color: "text-destructive", bg: "bg-destructive/10" },
    cancelled: { color: "text-muted-foreground", bg: "bg-muted" },
    pending: { color: "text-yellow-500", bg: "bg-yellow-500/10" },
  };
</script>

{#if loading}
  <div class="p-6 space-y-4">
    <div class="h-8 w-48 rounded bg-muted animate-pulse"></div>
    <div class="grid gap-4 md:grid-cols-4">
      {#each Array(4) as _}
        <div class="h-16 rounded-lg border border-border bg-card animate-pulse"></div>
      {/each}
    </div>
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="h-20 rounded-lg bg-muted animate-pulse"></div>
      {/each}
    </div>
  </div>
{:else if error}
  <div class="p-6">
    <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <p class="text-sm text-destructive">{error}</p>
    </div>
  </div>
{:else if run}
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <Play class="size-4 text-muted-foreground" />
          <h1 class="text-xl font-semibold text-foreground">
            {run.issueTitle ?? `Run ${runId?.slice(0, 8)}`}
          </h1>
        </div>
        {#if run.agentName}
          <p class="text-sm text-muted-foreground">
            Agent: <a href="/{companyPrefix}/agents/{run.agentId}" class="hover:underline">{run.agentName}</a>
          </p>
        {/if}
      </div>
      {@const st = statusConfig[run.status] ?? { color: "text-muted-foreground", bg: "bg-muted" }}
      <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {st.color} {st.bg}">
        {run.status ?? "unknown"}
      </span>
    </div>

    <!-- Timing -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Clock class="size-3" />
          Started
        </dt>
        <dd class="mt-1 text-sm text-foreground">
          {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ended</dt>
        <dd class="mt-1 text-sm text-foreground">
          {run.endedAt ? new Date(run.endedAt).toLocaleString() : "—"}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</dt>
        <dd class="mt-1 text-sm text-foreground">
          {formatDuration(run.durationMs ?? (run.startedAt && run.endedAt ? new Date(run.endedAt).getTime() - new Date(run.startedAt).getTime() : null))}
        </dd>
      </div>
      <div class="rounded-lg border border-border bg-card p-3">
        <dt class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</dt>
        <dd class="mt-1 text-sm text-foreground">
          {run.costCents != null ? `$${(run.costCents / 100).toFixed(4)}` : "—"}
        </dd>
      </div>
    </div>

    <!-- Transcript -->
    <div class="space-y-3">
      <h2 class="text-sm font-medium text-foreground">Transcript ({transcript.length} entries)</h2>

      {#if transcript.length === 0}
        <p class="text-sm text-muted-foreground">No transcript data available.</p>
      {:else}
        <div class="space-y-2">
          {#each transcript as entry, i}
            <div class="rounded-lg border border-border bg-card overflow-hidden">
              {#if entry.type === "tool_call" || entry.type === "tool_use"}
                <!-- Tool call -->
                <button
                  onclick={() => toggleTool(i)}
                  class="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {#if expandedTools.has(i)}
                    <ChevronDown class="size-3.5 text-muted-foreground shrink-0" />
                  {:else}
                    <ChevronRight class="size-3.5 text-muted-foreground shrink-0" />
                  {/if}
                  <Wrench class="size-3.5 text-orange-500 shrink-0" />
                  <span class="text-sm font-mono text-foreground">{entry.toolName ?? entry.name ?? "tool_call"}</span>
                  {#if entry.timestamp}
                    <span class="ml-auto text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                  {/if}
                </button>

                {#if expandedTools.has(i)}
                  <div class="border-t border-border p-3 bg-muted/30">
                    {#if entry.input}
                      <div class="mb-2">
                        <p class="text-xs font-medium text-muted-foreground mb-1">Input</p>
                        <pre class="text-xs text-foreground font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{typeof entry.input === "string" ? entry.input : JSON.stringify(entry.input, null, 2)}</pre>
                      </div>
                    {/if}
                    {#if entry.output ?? entry.result}
                      <div>
                        <p class="text-xs font-medium text-muted-foreground mb-1">Output</p>
                        <pre class="text-xs text-foreground font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">{typeof (entry.output ?? entry.result) === "string" ? (entry.output ?? entry.result) : JSON.stringify(entry.output ?? entry.result, null, 2)}</pre>
                      </div>
                    {/if}
                  </div>
                {/if}

              {:else if entry.type === "assistant" || entry.role === "assistant"}
                <!-- Assistant message -->
                <div class="p-3">
                  <div class="flex items-start gap-2">
                    <Bot class="size-4 text-primary shrink-0 mt-0.5" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-medium text-primary">Assistant</span>
                        {#if entry.timestamp}
                          <span class="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                        {/if}
                      </div>
                      <div class="text-sm text-foreground whitespace-pre-wrap">{entry.content ?? entry.text ?? ""}</div>
                    </div>
                  </div>
                </div>

              {:else if entry.type === "user" || entry.role === "user"}
                <!-- User/system message -->
                <div class="p-3">
                  <div class="flex items-start gap-2">
                    <User class="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs font-medium text-muted-foreground">User</span>
                        {#if entry.timestamp}
                          <span class="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                        {/if}
                      </div>
                      <div class="text-sm text-muted-foreground whitespace-pre-wrap">{entry.content ?? entry.text ?? ""}</div>
                    </div>
                  </div>
                </div>

              {:else if entry.type === "error"}
                <!-- Error -->
                <div class="p-3">
                  <div class="flex items-start gap-2">
                    <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
                    <div class="min-w-0 flex-1">
                      <span class="text-xs font-medium text-destructive">Error</span>
                      <div class="text-sm text-destructive whitespace-pre-wrap mt-0.5">{entry.content ?? entry.message ?? entry.text ?? ""}</div>
                    </div>
                  </div>
                </div>

              {:else}
                <!-- Generic entry -->
                <div class="p-3">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-xs font-medium text-muted-foreground capitalize">{entry.type ?? entry.role ?? "entry"}</span>
                    {#if entry.timestamp}
                      <span class="text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                    {/if}
                  </div>
                  <div class="text-sm text-foreground whitespace-pre-wrap">{entry.content ?? entry.text ?? JSON.stringify(entry)}</div>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
