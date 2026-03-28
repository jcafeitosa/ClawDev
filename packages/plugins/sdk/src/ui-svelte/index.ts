/**
 * `@clawdev/plugin-sdk/ui-svelte` — ClawDev plugin UI SDK for Svelte.
 *
 * Svelte-native stores that communicate with the plugin worker through the
 * same bridge as the React SDK. Import this in Svelte plugin UI components.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { pluginData, pluginAction, hostContext } from "@clawdev/plugin-sdk/ui-svelte";
 *   import type { PluginWidgetProps } from "@clawdev/plugin-sdk/ui-svelte";
 *
 *   let { context }: PluginWidgetProps = $props();
 *
 *   const health = pluginData<SyncHealth>("sync-health", {
 *     companyId: context.companyId,
 *   });
 *   const resync = pluginAction("resync");
 * </script>
 *
 * {#if $health.loading}
 *   <p>Loading…</p>
 * {:else if $health.error}
 *   <p>Error: {$health.error.message}</p>
 * {:else}
 *   <p>Synced Issues: {$health.data.syncedCount}</p>
 *   <button onclick={() => resync({ companyId: context.companyId })}>
 *     Resync Now
 *   </button>
 * {/if}
 * ```
 */

// Svelte stores (equivalents of React hooks)
export { pluginData, pluginAction, hostContext, pluginStream, pluginToast } from "./stores.js";

// Re-export all types from the shared type definitions
export type {
  PluginBridgeError,
  PluginBridgeErrorCode,
  PluginHostContext,
  PluginModalBoundsRequest,
  PluginRenderCloseEvent,
  PluginRenderCloseHandler,
  PluginRenderCloseLifecycle,
  PluginRenderEnvironmentContext,
  PluginLauncherBounds,
  PluginLauncherRenderEnvironment,
  PluginDataResult,
  PluginActionFn,
  PluginStreamResult,
  PluginToastTone,
  PluginToastAction,
  PluginToastInput,
  PluginToastFn,
  PluginPageProps,
  PluginWidgetProps,
  PluginDetailTabProps,
  PluginSidebarProps,
  PluginProjectSidebarItemProps,
  PluginCommentAnnotationProps,
  PluginCommentContextMenuItemProps,
  PluginSettingsPageProps,
} from "../ui/types.js";
