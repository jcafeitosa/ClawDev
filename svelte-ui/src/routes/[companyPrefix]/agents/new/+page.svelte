<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { api, unwrap } from "$lib/api/client";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { companyStore } from "$stores/company.svelte.js";
  import { onMount } from "svelte";

  let companyPrefix = $derived($page.params.companyPrefix);

  let name = $state("");
  let role = $state("");
  let adapterType = $state("claude-local");
  let model = $state("");
  let systemPrompt = $state("");
  let maxConcurrent = $state(1);
  let reportsTo = $state("");
  let submitting = $state(false);
  let error = $state<string | null>(null);
  let agents = $state<any[]>([]);

  const adapterOptions = [
    { value: "claude-local", label: "Claude (Local)" },
    { value: "codex-local", label: "Codex (Local)" },
    { value: "cursor-local", label: "Cursor (Local)" },
    { value: "gemini-local", label: "Gemini (Local)" },
    { value: "opencode-local", label: "OpenCode (Local)" },
    { value: "pi-local", label: "Pi (Local)" },
    { value: "openclaw-gateway", label: "OpenClaw Gateway" },
  ];

  onMount(() => {
    breadcrumbStore.set([
      { label: "Agents", href: `/${companyPrefix}/agents` },
      { label: "New Agent" },
    ]);

    // Load existing agents for "reports to" picker
    api.api.agents.get({ query: { companyId: companyStore.selectedCompanyId ?? undefined } })
      .then((res) => {
        agents = (res.data as any[]) ?? [];
      })
      .catch(() => {});
  });

  async function handleSubmit() {
    if (!name.trim()) {
      error = "Agent name is required";
      return;
    }
    submitting = true;
    error = null;

    try {
      const result = await api.api.agents.post({
        name: name.trim(),
        role: role.trim() || undefined,
        adapterType,
        model: model.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        maxConcurrent,
        reportsTo: reportsTo || undefined,
        companyId: companyStore.selectedCompanyId ?? undefined,
      });

      const newAgent = result.data as any;
      if (newAgent?.id) {
        goto(`/${companyPrefix}/agents/${newAgent.id}`);
      } else {
        goto(`/${companyPrefix}/agents`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create agent";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="p-6 max-w-2xl">
  <h1 class="text-xl font-semibold text-foreground mb-6">New Agent</h1>

  <form class="space-y-5" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
    <!-- Name -->
    <div class="space-y-1.5">
      <label for="agent-name" class="text-sm font-medium text-foreground">Name *</label>
      <input
        id="agent-name"
        type="text"
        bind:value={name}
        required
        placeholder="e.g. Frontend Developer"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>

    <!-- Role -->
    <div class="space-y-1.5">
      <label for="agent-role" class="text-sm font-medium text-foreground">Role</label>
      <input
        id="agent-role"
        type="text"
        bind:value={role}
        placeholder="e.g. Builds React components"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>

    <!-- Adapter Type -->
    <div class="space-y-1.5">
      <label for="adapter-type" class="text-sm font-medium text-foreground">Adapter</label>
      <select
        id="adapter-type"
        bind:value={adapterType}
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {#each adapterOptions as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>

    <!-- Model -->
    <div class="space-y-1.5">
      <label for="agent-model" class="text-sm font-medium text-foreground">Model</label>
      <input
        id="agent-model"
        type="text"
        bind:value={model}
        placeholder="e.g. claude-sonnet-4-20250514"
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>

    <!-- Max Concurrent -->
    <div class="space-y-1.5">
      <label for="max-concurrent" class="text-sm font-medium text-foreground">Max Concurrent Tasks</label>
      <input
        id="max-concurrent"
        type="number"
        min="1"
        max="10"
        bind:value={maxConcurrent}
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>

    <!-- Reports To -->
    <div class="space-y-1.5">
      <label for="reports-to" class="text-sm font-medium text-foreground">Reports To</label>
      <select
        id="reports-to"
        bind:value={reportsTo}
        class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="">None (CEO-level)</option>
        {#each agents as agent}
          <option value={agent.id}>{agent.name}</option>
        {/each}
      </select>
    </div>

    <!-- System Prompt -->
    <div class="space-y-1.5">
      <label for="system-prompt" class="text-sm font-medium text-foreground">System Prompt</label>
      <textarea
        id="system-prompt"
        bind:value={systemPrompt}
        rows="6"
        placeholder="Instructions for this agent..."
        class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y font-mono"
      ></textarea>
    </div>

    {#if error}
      <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
        <p class="text-sm text-destructive">{error}</p>
      </div>
    {/if}

    <!-- Actions -->
    <div class="flex items-center gap-3 pt-2">
      <button
        type="submit"
        disabled={submitting}
        class="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {submitting ? "Creating..." : "Create Agent"}
      </button>
      <a
        href="/{companyPrefix}/agents"
        class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
      >
        Cancel
      </a>
    </div>
  </form>
</div>
