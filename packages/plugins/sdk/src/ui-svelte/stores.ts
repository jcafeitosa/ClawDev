/**
 * Svelte stores for plugin UI bridge communication.
 *
 * These are the Svelte equivalents of the React hooks in `../ui/hooks.ts`.
 * They delegate to the same bridge-injected implementations but expose
 * Svelte-native reactive stores instead of React hook return values.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { pluginData, pluginAction, hostContext } from "@clawdev/plugin-sdk/ui-svelte";
 *
 *   const health = pluginData<SyncHealth>("sync-health", { companyId: "..." });
 *   const resync = pluginAction("resync");
 *   const ctx = hostContext();
 * </script>
 *
 * {#if $health.loading}
 *   <p>Loading…</p>
 * {:else if $health.error}
 *   <p>Error: {$health.error.message}</p>
 * {:else}
 *   <p>Synced: {$health.data.syncedCount}</p>
 *   <button onclick={() => $resync({ companyId: $ctx.companyId })}>Resync</button>
 * {/if}
 * ```
 */

import { readable, writable, type Readable } from "svelte/store";
import type {
  PluginDataResult,
  PluginActionFn,
  PluginHostContext,
  PluginStreamResult,
  PluginToastFn,
} from "../ui/types.js";
import { getSdkUiRuntimeValue } from "./runtime.js";

// ---------------------------------------------------------------------------
// pluginData — equivalent to usePluginData
// ---------------------------------------------------------------------------

/**
 * Create a readable store that fetches data from the plugin worker.
 *
 * The store value follows the same `PluginDataResult<T>` shape as the
 * React hook, so plugin authors familiar with the React SDK will find
 * the same `data`, `loading`, `error`, and `refresh` properties.
 *
 * @param key - Data key matching `ctx.data.register(key, handler)` in worker
 * @param params - Optional parameters forwarded to the handler
 */
export function pluginData<T = unknown>(
  key: string,
  params?: Record<string, unknown>,
): Readable<PluginDataResult<T>> {
  const impl = getSdkUiRuntimeValue<
    (nextKey: string, nextParams?: Record<string, unknown>) => PluginDataResult<T>
  >("usePluginData");

  // The bridge implementation returns a reactive object.
  // Wrap it in a Svelte readable store.
  const result = impl(key, params);

  return readable<PluginDataResult<T>>(result, (set) => {
    // Poll for changes since bridge uses React-style state internally.
    // In future, bridge can push updates via callback registration.
    const interval = setInterval(() => {
      set(impl(key, params));
    }, 500);
    return () => clearInterval(interval);
  });
}

// ---------------------------------------------------------------------------
// pluginAction — equivalent to usePluginAction
// ---------------------------------------------------------------------------

/**
 * Get a callable function to invoke a worker action.
 *
 * Unlike the React hook, this returns the function directly (not a store)
 * since actions are fire-and-forget and don't need reactivity.
 *
 * @param key - Action key matching `ctx.actions.register(key, handler)` in worker
 */
export function pluginAction(key: string): PluginActionFn {
  const impl = getSdkUiRuntimeValue<(nextKey: string) => PluginActionFn>("usePluginAction");
  return impl(key);
}

// ---------------------------------------------------------------------------
// hostContext — equivalent to useHostContext
// ---------------------------------------------------------------------------

/**
 * Read the current host context as a readable store.
 *
 * Provides: companyId, projectId, entityId, entityType, userId, etc.
 */
export function hostContext(): Readable<PluginHostContext> {
  const impl = getSdkUiRuntimeValue<() => PluginHostContext>("useHostContext");
  const ctx = impl();

  return readable<PluginHostContext>(ctx, (set) => {
    const interval = setInterval(() => set(impl()), 1000);
    return () => clearInterval(interval);
  });
}

// ---------------------------------------------------------------------------
// pluginStream — equivalent to usePluginStream
// ---------------------------------------------------------------------------

/**
 * Subscribe to a real-time event stream from the plugin worker.
 *
 * @param channel - Stream channel name matching `ctx.streams.emit(channel, event)`
 * @param options - Optional configuration
 */
export function pluginStream<T = unknown>(
  channel: string,
  options?: { companyId?: string },
): Readable<PluginStreamResult<T>> {
  const impl = getSdkUiRuntimeValue<
    (nextChannel: string, nextOptions?: { companyId?: string }) => PluginStreamResult<T>
  >("usePluginStream");

  const result = impl(channel, options);

  return readable<PluginStreamResult<T>>(result, (set) => {
    const interval = setInterval(() => set(impl(channel, options)), 250);
    return () => clearInterval(interval);
  });
}

// ---------------------------------------------------------------------------
// pluginToast — equivalent to usePluginToast
// ---------------------------------------------------------------------------

/**
 * Get the toast function for triggering host notifications.
 *
 * Returns the function directly since it doesn't need reactivity.
 */
export function pluginToast(): PluginToastFn {
  const impl = getSdkUiRuntimeValue<() => PluginToastFn>("usePluginToast");
  return impl();
}
