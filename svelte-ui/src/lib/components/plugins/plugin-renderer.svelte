<script lang="ts">
  /**
   * Plugin Renderer — mounts a single plugin UI contribution inside the host.
   *
   * This component dynamically loads the plugin UI bundle, selects the matching
   * slot export, and mounts the React component into the Svelte host surface.
   */
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { createRoot, type Root } from "react-dom/client";
  import * as React from "react";
  import {
    ensurePluginBridgeRuntime,
    getSlotTypeForView,
    importPluginUiModule,
    pickPluginExport,
    pickPluginSlot,
    PluginBridgeProvider,
    type PluginHostContext,
  } from "./plugin-runtime.js";
  import { pluginUiContributionsStore, type PluginUiContribution } from "$stores/plugin-ui-contributions.svelte.js";

  type View = "page" | "settings" | "dashboard" | "detailTab" | "sidebar" | "sidebarPanel" | "globalToolbar" | "toolbar";

  type Props = {
    pluginId: string;
    view: View;
    context: PluginHostContext;
    routePath?: string | null;
    exportName?: string | null;
    fallback?: Snippet;
    class?: string;
  };

  let { pluginId, view, context, routePath, exportName, fallback, class: className }: Props = $props();

  let container: HTMLDivElement | null = null;
  let loading = $state(true);
  let error = $state<string | null>(null);
  let root: Root | null = null;
  let renderToken = 0;
  let contributions = $state<PluginUiContribution[]>([]);

  const slotType = $derived(getSlotTypeForView(view));
  const contribution = $derived(contributions.find((entry) => entry.pluginId === pluginId) ?? null);
  const slot = $derived(exportName ? null : pickPluginSlot(contribution, slotType, routePath));

  async function renderContribution() {
    if (!container) return;
    const token = ++renderToken;
    ensurePluginBridgeRuntime();
    loading = true;
    error = null;

    try {
      const loaded = await pluginUiContributionsStore.load();
      if (token !== renderToken) return;
      contributions = loaded;
      const currentContribution = loaded.find((entry) => entry.pluginId === pluginId) ?? null;
      const currentSlot = exportName ? null : pickPluginSlot(currentContribution, slotType, routePath);
      const exportNameToRender = exportName ?? currentSlot?.exportName ?? null;

      if (!currentContribution || (!currentSlot && !exportNameToRender)) {
        root?.unmount();
        root = null;
        return;
      }

      const mod = await importPluginUiModule(currentContribution);
      if (token !== renderToken) return;

      const exported = pickPluginExport(mod, exportNameToRender);
      if (!exported) {
        throw new Error(
          `Plugin "${currentContribution.pluginKey ?? currentContribution.pluginId}" does not export "${exportNameToRender}".`,
        );
      }

      const Component = exported as React.ComponentType<{ context: PluginHostContext }>;
      const element = React.createElement(
        PluginBridgeProvider,
        {
          value: {
            pluginId: currentContribution.pluginId,
            hostContext: context,
          },
        },
        React.createElement(Component, { context }),
      );

      root ??= createRoot(container);
      root.render(element);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      root?.unmount();
      root = null;
    } finally {
      if (token === renderToken) {
        loading = false;
      }
    }
  }

  onMount(() => {
    ensurePluginBridgeRuntime();
    void renderContribution();
    return () => {
      renderToken += 1;
      root?.unmount();
      root = null;
    };
  });

  $effect(() => {
    pluginId;
    view;
    routePath;
    exportName;
    context.companyId;
    context.companyPrefix;
    context.projectId;
    context.entityId;
    context.entityType;
    context.parentEntityId;
    context.userId;
    context.renderEnvironment;
    void renderContribution();
  });
</script>

<div class={className ?? ""}>
  {#if loading}
    <div aria-live="polite" class="text-sm text-zinc-500 dark:text-zinc-400">Loading plugin UI...</div>
  {:else if error}
    <div class="text-sm text-red-600 dark:text-red-300">
      {error}
    </div>
  {:else if !slot}
    {#if fallback}
      {@render fallback()}
    {/if}
  {/if}

  <div bind:this={container} class={slot ? "min-h-0" : "hidden"}></div>
</div>
