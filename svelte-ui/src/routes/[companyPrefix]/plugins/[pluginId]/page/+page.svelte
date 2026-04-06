<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { breadcrumbStore } from "$stores/breadcrumb.svelte.js";
  import { PluginSlot } from "$lib/components/plugins";
  import { api } from "$lib/api";
  import { onMount } from "svelte";
  import { AlertTriangle } from "lucide-svelte";
  import { PageLayout } from "$components/layout/index.js";

  interface PluginRecord {
    id: string;
    name: string;
    manifestJson?: {
      displayName?: string;
    };
  }

  interface UiContribution {
    pluginId: string;
    pluginKey?: string;
    displayName?: string;
    version?: string;
    uiEntryFile?: string;
    slots?: Array<{
      id: string;
      type: string;
      displayName?: string;
      exportName?: string;
      routePath?: string;
      order?: number;
    }>;
  }

  const pluginId = $derived($page.params.pluginId ?? "");
  const companyPrefix = $derived($page.params.companyPrefix ?? "");

  let plugin = $state<PluginRecord | null>(null);
  let loading = $state(true);
  let uiContributions = $state<UiContribution[]>([]);
  let uiLoading = $state(false);
  let redirectedToSettings = $state(false);

  const contribution = $derived(uiContributions.find((entry) => entry.pluginId === pluginId) ?? null);

  function setBreadcrumbsForPlugin(name?: string) {
    breadcrumbStore.set([
      { label: "Plugins", href: `/${companyPrefix}/plugins` },
      { label: name ?? (pluginId || "Plugin page") },
    ]);
  }

  async function loadPlugin() {
    if (!pluginId) return;
    loading = true;
    try {
      const res = await api(`/api/plugins/${pluginId}`);
      if (res.ok) {
        plugin = (await res.json()) as PluginRecord;
        setBreadcrumbsForPlugin(plugin?.manifestJson?.displayName ?? plugin?.name);
      } else {
        plugin = null;
      }
    } finally {
      loading = false;
    }
  }

  async function loadUiContributions() {
    if (!pluginId) return;
    uiLoading = true;
    try {
      const res = await api("/api/plugins/ui-contributions");
      if (res.ok) {
        const data = await res.json();
        uiContributions = Array.isArray(data) ? data : data.contributions ?? [];
      } else {
        uiContributions = [];
      }
    } finally {
      uiLoading = false;
    }
  }

  onMount(() => {
    setBreadcrumbsForPlugin();
    void loadPlugin();
    void loadUiContributions();
  });

  $effect(() => {
    if (loading || !plugin || contribution || redirectedToSettings) return;
    redirectedToSettings = true;
    void goto(`/${companyPrefix}/plugins/${pluginId}/settings`, { replaceState: true });
  });

  const pageSlots = $derived(contribution?.slots?.filter((slot) => slot.type === "page") ?? []);
</script>

<PageLayout title="Plugin Page" description="This page hosts the UI contribution declared by the installed plugin." fullWidth>
  <div class="space-y-6">
    <div class="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div class="space-y-1 text-sm">
        <p class="font-medium text-foreground">Plugin page</p>
        <p class="text-muted-foreground">
          This page hosts the UI contribution declared by the installed plugin.
        </p>
      </div>
    </div>

  {#if loading}
    <div class="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      Loading plugin page...
    </div>
  {:else if !contribution}
    <div class="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
      Redirecting to plugin settings...
    </div>
  {:else}
    {#snippet fallback()}
      <div class="rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No installed plugin declares a page slot for this plugin.
      </div>
    {/snippet}

    <PluginSlot name="page" {pluginId} {fallback} />

    <div class="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {plugin?.manifestJson?.displayName ?? plugin?.name ?? pluginId}
          </p>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            {#if uiLoading}
              Loading UI contributions...
            {:else}
              {pageSlots.length} page slot(s)
            {/if}
          </p>
        </div>
      </div>

      {#if pageSlots.length > 0}
        <div class="space-y-2">
          {#each pageSlots as slot}
            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-medium text-zinc-900 dark:text-zinc-100">{slot.displayName ?? slot.id}</p>
                  {#if slot.exportName}
                    <p class="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Export: {slot.exportName}</p>
                  {/if}
                </div>
                {#if slot.routePath}
                  <span class="rounded-full border border-zinc-300 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                    /{slot.routePath}
                  </span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
  </div>
</PageLayout>
