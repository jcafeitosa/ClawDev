<script lang="ts">
  /**
   * Plugin Slot — renders plugin UI contributions for a given slot name.
   *
   * In the React UI, plugins register UI contributions (toolbar items, sidebar sections, pages).
   * This component resolves and renders contributions for a specific slot.
   */
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import { Badge } from "$components/ui/index.js";
  import { pluginUiContributionsStore, type PluginUiContribution } from "$stores/plugin-ui-contributions.svelte.js";

  type Props = {
    /** Slot name where plugins can contribute UI */
    name: string;
    /** Optional plugin ID to narrow contributions to a single plugin */
    pluginId?: string | null;
    /** Optional route path used to narrow page slots to a specific company route segment */
    routePath?: string | null;
    /** Fallback content when no plugins contribute */
    fallback?: Snippet;
  };

  let { name, pluginId, routePath, fallback }: Props = $props();

  function slotOrder(slot: { order?: number; displayName?: string; id?: string }) {
    return [slot.order ?? Number.MAX_SAFE_INTEGER, slot.displayName ?? slot.id ?? ""];
  }

  let loading = $state(true);
  let contributions = $state<PluginUiContribution[]>([]);

  onMount(() => {
    loading = true;
    void pluginUiContributionsStore
      .load()
      .then(() => {
        const list = pluginUiContributionsStore.contributions;
        contributions = list
          .filter((entry) =>
            entry?.slots?.some(
              (slot) =>
                slot.type === name &&
                (pluginId ? entry.pluginId === pluginId : true) &&
                (routePath ? slot.routePath === routePath : true),
            ),
          )
          .sort((a, b) => (a.displayName ?? a.pluginKey ?? "").localeCompare(b.displayName ?? b.pluginKey ?? ""));

        contributions = contributions.map((entry) => ({
          ...entry,
          slots: [...(entry.slots ?? [])]
            .filter((slot) => slot.type === name && (routePath ? slot.routePath === routePath : true))
            .sort((a, b) => slotOrder(a).join("|").localeCompare(slotOrder(b).join("|"))),
          launchers: [...(entry.launchers ?? [])].sort((a, b) =>
            (a.displayName ?? a.id ?? "").localeCompare(b.displayName ?? b.id ?? ""),
          ),
        }));
      })
      .catch(() => {
        contributions = [];
      })
      .finally(() => {
        loading = false;
      });
  });
</script>

{#if loading}
  <div class="rounded-lg border border-dashed border-zinc-300 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
    Loading plugin contributions...
  </div>
{:else if contributions.length === 0}
  {#if fallback}
    {@render fallback()}
  {/if}
{:else}
  <div class="space-y-3">
    {#each contributions as contribution (contribution.pluginId)}
      {@const slots = contribution.slots ?? []}
      <div class="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium text-zinc-900 dark:text-zinc-100">
                {contribution.displayName ?? contribution.pluginKey ?? contribution.pluginId}
              </p>
              <Badge variant="outline">{name}</Badge>
              <Badge variant="secondary">v{contribution.version ?? "0.0.0"}</Badge>
            </div>
            <p class="mt-1 break-all font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {contribution.pluginId}
              {#if contribution.pluginKey && contribution.pluginKey !== contribution.pluginId}
                <span class="mx-1">•</span>{contribution.pluginKey}
              {/if}
            </p>
          </div>
          {#if contribution.uiEntryFile}
            <span class="text-xs text-zinc-500 dark:text-zinc-400">{contribution.uiEntryFile}</span>
          {/if}
        </div>

        <div class="mt-3 space-y-2">
          {#each slots as slot}
            <div class="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
              <div class="flex items-center justify-between gap-3">
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
      </div>
    {/each}
  </div>
{/if}
