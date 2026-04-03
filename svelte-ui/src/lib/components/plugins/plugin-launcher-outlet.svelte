<script lang="ts">
  import type { Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import { api } from "$lib/api";
  import PluginRenderer from "./plugin-renderer.svelte";
  import { pluginUiContributionsStore, type PluginUiContribution, type PluginUiContributionLauncher } from "$stores/plugin-ui-contributions.svelte.js";
  import type { PluginHostContext, PluginHostRenderEnvironment } from "./plugin-runtime.js";
  import type { PluginLauncherPlacementZone } from "@clawdev/shared";

  type Props = {
    placementZones: PluginLauncherPlacementZone[];
    context: PluginHostContext;
    pluginId?: string | null;
    class?: string;
    itemClassName?: string;
    fallback?: Snippet;
  };

  type ActiveLauncher = {
    contribution: PluginUiContribution;
    launcher: PluginUiContributionLauncher;
  } | null;

  let { placementZones, context, pluginId = null, class: className, itemClassName, fallback }: Props = $props();

  let contributions = $state<PluginUiContribution[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let activeLauncher = $state<ActiveLauncher>(null);

  const launchers = $derived.by(() => {
    const normalizedZones = new Set(placementZones);
    return contributions
      .filter((entry) => (pluginId ? entry.pluginId === pluginId : true))
      .flatMap((entry) =>
        (entry.launchers ?? [])
          .filter((launcher) => {
            if (!launcher.placementZone || !normalizedZones.has(launcher.placementZone)) return false;
            if (launcher.entityTypes?.length && context.entityType) {
              return launcher.entityTypes.includes(context.entityType as any);
            }
            if (launcher.entityTypes?.length && !context.entityType) return false;
            return true;
          })
          .map((launcher) => ({
            contribution: entry,
            launcher,
          })),
      )
      .sort((a, b) => {
        const ao = a.launcher.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.launcher.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return (a.launcher.displayName ?? a.launcher.id).localeCompare(b.launcher.displayName ?? b.launcher.id);
      });
  });

  function buildRenderEnvironment(launcher: PluginUiContributionLauncher): PluginHostRenderEnvironment | null {
    if (!launcher.render) return null;
    return {
      environment: launcher.render.environment ?? null,
      launcherId: launcher.id,
      bounds: launcher.render.bounds ?? null,
    };
  }

  function resolveHostRoute(target: string): string {
    if (/^https?:\/\//i.test(target)) return target;
    if (target.startsWith("/")) return target;
    const normalizedTarget = target.replace(/^\/+/, "");
    const prefix = context.companyPrefix?.replace(/^\/+|\/+$/g, "") ?? "";
    return prefix ? `/${prefix}/${normalizedTarget}` : `/${normalizedTarget}`;
  }

  async function activate(launcher: PluginUiContributionLauncher, contribution: PluginUiContribution) {
    const action = launcher.action;
    const renderEnvironment = buildRenderEnvironment(launcher);

    if (action.type === "navigate") {
      await goto(resolveHostRoute(action.target));
      return;
    }

    if (action.type === "deepLink") {
      window.open(action.target, "_blank", "noopener,noreferrer");
      return;
    }

    if (action.type === "performAction") {
      const response = await api(`/api/plugins/${encodeURIComponent(contribution.pluginId)}/actions/${encodeURIComponent(action.target)}`, {
        method: "POST",
        body: JSON.stringify({
          companyId: context.companyId,
          params: action.params ?? {},
          renderEnvironment,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }
      return;
    }

    activeLauncher = { launcher, contribution };
  }

  async function loadLaunchers() {
    loading = true;
    error = null;
    try {
      const loaded = await pluginUiContributionsStore.load();
      contributions = loaded;
    } catch (err) {
      contributions = [];
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    placementZones;
    pluginId;
    context.companyId;
    context.companyPrefix;
    context.projectId;
    context.entityId;
    context.entityType;
    void loadLaunchers();
  });
</script>

<div class={className ?? ""}>
  {#if loading}
    <div class="text-xs text-zinc-500 dark:text-zinc-400">Loading launchers...</div>
  {:else if error}
    <div class="text-xs text-red-600 dark:text-red-300">{error}</div>
  {:else if launchers.length === 0}
    {#if fallback}
      {@render fallback()}
    {/if}
  {:else}
    <div class={itemClassName ?? "flex flex-wrap gap-2"}>
      {#each launchers as entry (entry.contribution.pluginId + ":" + entry.launcher.id)}
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
          onclick={() => {
            void activate(entry.launcher, entry.contribution).catch((err) => {
              error = err instanceof Error ? err.message : String(err);
            });
          }}
        >
          <span>{entry.launcher.displayName ?? entry.launcher.id}</span>
          {#if entry.launcher.placementZone}
            <span class="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{entry.launcher.placementZone}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if activeLauncher}
    <div class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4">
      <div class="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <div class="mb-3 flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{activeLauncher.launcher.displayName ?? activeLauncher.launcher.id}</p>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              {activeLauncher.launcher.action.type}
              {#if activeLauncher.launcher.action.target}
                · {activeLauncher.launcher.action.target}
              {/if}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-md border border-zinc-200 px-3 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
            onclick={() => {
              activeLauncher = null;
            }}
          >
            Close
          </button>
        </div>

        <PluginRenderer
          pluginId={activeLauncher.contribution.pluginId}
          view="toolbar"
          exportName={activeLauncher.launcher.exportName ?? activeLauncher.launcher.action.target}
          context={{
            ...context,
            renderEnvironment: buildRenderEnvironment(activeLauncher.launcher),
          }}
        />
      </div>
    </div>
  {/if}
</div>
