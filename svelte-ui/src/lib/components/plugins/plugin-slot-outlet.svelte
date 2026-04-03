<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { pluginUiContributionsStore } from "$stores/plugin-ui-contributions.svelte.js";
  import PluginRenderer from "./plugin-renderer.svelte";
  import { getSlotTypeForView, pickPluginSlot, type PluginHostContext } from "./plugin-runtime.js";

  type View = "page" | "settings" | "dashboard" | "detailTab" | "sidebar" | "sidebarPanel" | "globalToolbar" | "toolbar";

  type Props = {
    pluginId?: string | null;
    slotTypes: View[];
    context: PluginHostContext;
    routePath?: string | null;
    class?: string;
    itemClassName?: string;
    fallback?: Snippet;
  };

  let { pluginId, slotTypes, context, routePath, class: className, itemClassName, fallback }: Props = $props();

  let loading = $state(true);
  let contributions = $state<Array<{ pluginId: string; slotType: View }>>([]);

  const slotTypeSet = $derived(new Set(slotTypes.map((view) => getSlotTypeForView(view))));

  onMount(() => {
    loading = true;
    void pluginUiContributionsStore.load()
      .then(() => {
        const matches: Array<{ pluginId: string; slotType: View }> = [];
        for (const contribution of pluginUiContributionsStore.contributions) {
          if (pluginId && contribution.pluginId !== pluginId) continue;
          for (const slot of contribution.slots ?? []) {
            if (!slotTypeSet.has(slot.type)) continue;
            if (slot.type === "page") {
              const matched = routePath
                ? pickPluginSlot(contribution, slot.type, routePath)
                : pickPluginSlot(contribution, slot.type);
              if (matched) {
                matches.push({ pluginId: contribution.pluginId, slotType: slot.type as View });
              }
              continue;
            }
            if (pickPluginSlot(contribution, slot.type)) {
              matches.push({ pluginId: contribution.pluginId, slotType: slot.type as View });
            }
          }
        }
        const unique = new Map<string, { pluginId: string; slotType: View }>();
        for (const entry of matches) {
          unique.set(`${entry.pluginId}:${entry.slotType}`, entry);
        }
        contributions = Array.from(unique.values()).sort((a, b) => {
          const left = `${a.slotType}:${a.pluginId}`;
          const right = `${b.slotType}:${b.pluginId}`;
          return left.localeCompare(right);
        });
      })
      .finally(() => {
        loading = false;
      });
  });
</script>

{#if loading}
  <div class={className ?? ""} aria-live="polite">Loading plugin extensions...</div>
{:else if contributions.length === 0}
  {#if fallback}
    {@render fallback()}
  {/if}
{:else}
  <div class={className ?? ""}>
    {#each contributions as entry (entry.pluginId + ":" + entry.slotType)}
      <div class={itemClassName ?? ""}>
        <PluginRenderer
          pluginId={entry.pluginId}
          view={entry.slotType}
          {context}
          {routePath}
        />
      </div>
    {/each}
  </div>
{/if}
