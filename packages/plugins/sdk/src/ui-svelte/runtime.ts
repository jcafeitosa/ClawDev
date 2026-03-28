/**
 * Bridge runtime for Svelte plugin UIs.
 *
 * Same bridge registry as React version — plugins communicate with
 * the host via globalThis.__clawdevPluginBridge__.sdkUi.
 *
 * The bridge is framework-agnostic (plain functions). Only the
 * consumer layer changes (React hooks → Svelte stores).
 */

type PluginBridgeRegistry = {
  svelte?: {
    /** Svelte component constructor — injected by host for shared components. */
    createComponent?: (
      component: unknown,
      options: { target: HTMLElement; props?: Record<string, unknown> },
    ) => unknown;
  } | null;
  /** Bridge-injected hook/store implementations. Framework-agnostic functions. */
  sdkUi?: Record<string, unknown> | null;
};

type GlobalBridge = typeof globalThis & {
  __clawdevPluginBridge__?: PluginBridgeRegistry;
};

function getBridgeRegistry(): PluginBridgeRegistry | undefined {
  return (globalThis as GlobalBridge).__clawdevPluginBridge__;
}

function missingBridgeValueError(name: string): Error {
  return new Error(
    `ClawDev plugin UI runtime is not initialized for "${name}". ` +
      "Ensure the host loaded the plugin bridge before rendering this UI module.",
  );
}

/**
 * Retrieve a bridge-injected value by name.
 * Same function as React version — the bridge is framework-agnostic.
 */
export function getSdkUiRuntimeValue<T>(name: string): T {
  const value = getBridgeRegistry()?.sdkUi?.[name];
  if (value === undefined) {
    throw missingBridgeValueError(name);
  }
  return value as T;
}
