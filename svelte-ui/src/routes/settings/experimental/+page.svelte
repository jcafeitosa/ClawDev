<script lang="ts">
  import { FlaskConical, Save, AlertCircle } from "lucide-svelte";
  import { api } from "$lib/api/client";
  import { toastStore } from "$stores/toast.svelte.js";
  import { onMount } from "svelte";

  interface ExperimentalFeature {
    key: string;
    label: string;
    description: string;
    enabled: boolean;
  }

  let features = $state<ExperimentalFeature[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const res = await api.api["instance-settings"].get();
      const data = res.data as any;
      const experimental = data?.experimental ?? {};

      // Build feature list from server data
      features = [
        {
          key: "worktrees",
          label: "Git Worktrees",
          description: "Enable git worktree isolation for agent execution workspaces.",
          enabled: experimental.worktrees ?? false,
        },
        {
          key: "plugins",
          label: "Plugin System",
          description: "Enable the plugin system for extending workspace capabilities.",
          enabled: experimental.plugins ?? false,
        },
        {
          key: "routines",
          label: "Routines",
          description: "Enable scheduled routine execution for agents.",
          enabled: experimental.routines ?? false,
        },
        {
          key: "budgets",
          label: "Budget Policies",
          description: "Enable budget tracking and enforcement for agent spending.",
          enabled: experimental.budgets ?? false,
        },
        {
          key: "approvals",
          label: "Approval Workflows",
          description: "Require human approval for agent actions above a threshold.",
          enabled: experimental.approvals ?? false,
        },
      ];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load settings";
    } finally {
      loading = false;
    }
  });

  function toggleFeature(key: string) {
    features = features.map((f) =>
      f.key === key ? { ...f, enabled: !f.enabled } : f,
    );
  }

  async function handleSave() {
    saving = true;
    error = null;

    try {
      const experimental: Record<string, boolean> = {};
      for (const f of features) {
        experimental[f.key] = f.enabled;
      }
      await api.api["instance-settings"].put({ experimental });
      toastStore.push({ title: "Experimental settings saved", tone: "success" });
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save settings";
    } finally {
      saving = false;
    }
  }
</script>

<div class="p-6 max-w-2xl">
  <div class="flex items-center gap-3 mb-6">
    <FlaskConical class="size-5 text-muted-foreground" />
    <h1 class="text-xl font-semibold text-foreground">Experimental Features</h1>
  </div>

  <nav class="flex gap-1 mb-6">
    <a
      href="/settings/general"
      class="inline-flex h-8 items-center justify-center rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
    >
      General
    </a>
    <a
      href="/settings/experimental"
      class="inline-flex h-8 items-center justify-center rounded-md bg-primary/10 px-3 text-xs font-medium text-primary"
    >
      Experimental
    </a>
  </nav>

  <div class="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 mb-6">
    <p class="text-xs text-yellow-600 dark:text-yellow-400">
      These features are experimental and may change or be removed in future releases. Enable at your own risk.
    </p>
  </div>

  {#if loading}
    <div class="space-y-4">
      {#each Array(5) as _}
        <div class="flex items-center justify-between p-4 rounded-lg border border-border bg-card animate-pulse">
          <div class="space-y-1">
            <div class="h-4 w-32 rounded bg-muted"></div>
            <div class="h-3 w-64 rounded bg-muted"></div>
          </div>
          <div class="h-6 w-10 rounded-full bg-muted"></div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="space-y-3">
      {#each features as feature}
        <div class="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
          <div class="space-y-0.5 pr-4">
            <p class="text-sm font-medium text-foreground">{feature.label}</p>
            <p class="text-xs text-muted-foreground">{feature.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={feature.enabled}
            onclick={() => toggleFeature(feature.key)}
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors
              {feature.enabled ? 'bg-primary' : 'bg-muted'}"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform
                {feature.enabled ? 'translate-x-5' : 'translate-x-0'}"
            ></span>
          </button>
        </div>
      {/each}
    </div>

    {#if error}
      <div class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 mt-4">
        <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
        <p class="text-sm text-destructive">{error}</p>
      </div>
    {/if}

    <div class="mt-6">
      <button
        onclick={handleSave}
        disabled={saving}
        class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <Save class="size-4" />
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  {/if}
</div>
