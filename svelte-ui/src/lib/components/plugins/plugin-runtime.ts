import { api } from "$lib/api";
import { toastStore } from "$stores/toast.svelte.js";
import type { PluginUiContribution, PluginUiContributionSlot } from "$stores/plugin-ui-contributions.svelte.js";
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as ReactDOMClient from "react-dom/client";

export type PluginHostRenderEnvironment = {
  environment: string | null;
  launcherId: string | null;
  bounds: string | null;
};

export type PluginHostContext = {
  companyId: string | null;
  companyPrefix: string | null;
  projectId: string | null;
  entityId: string | null;
  entityType: string | null;
  parentEntityId?: string | null;
  userId: string | null;
  renderEnvironment?: PluginHostRenderEnvironment | null;
};

type BridgeContextValue = {
  pluginId: string;
  hostContext: PluginHostContext;
};

type BridgeRegistry = {
  react?: typeof React | null;
  reactDom?: {
    createRoot?: typeof ReactDOMClient.createRoot;
    hydrateRoot?: typeof ReactDOMClient.hydrateRoot;
    createPortal?: typeof ReactDOM.createPortal;
    flushSync?: typeof ReactDOM.flushSync;
  } | null;
  sdkUi?: Record<string, unknown> | null;
};

declare global {
  interface Window {
    __clawdevPluginBridge__?: BridgeRegistry;
  }
}

const bridgeContext = React.createContext<BridgeContextValue | null>(null);

function useBridgeContext(): BridgeContextValue {
  const value = React.useContext(bridgeContext);
  if (!value) {
    throw new Error("Plugin UI rendered outside of a bridge provider.");
  }
  return value;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function extractBridgeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(toErrorMessage(error));
}

function makeSdkUiBridge() {
  return {
    useHostContext(): PluginHostContext {
      return useBridgeContext().hostContext;
    },
    usePluginData<T = unknown>(key: string, params?: Record<string, unknown>) {
      const { pluginId, hostContext } = useBridgeContext();
      const paramsKey = React.useMemo(() => {
        try {
          return JSON.stringify(params ?? {});
        } catch {
          return "";
        }
      }, [params]);

      const [data, setData] = React.useState<T | null>(null);
      const [loading, setLoading] = React.useState(true);
      const [error, setError] = React.useState<Error | null>(null);
      const [refreshTick, setRefreshTick] = React.useState(0);
      const refresh = React.useCallback(() => {
        setRefreshTick((tick) => tick + 1);
      }, []);

      React.useEffect(() => {
        let cancelled = false;

        async function load() {
          setLoading(true);
          setError(null);
          try {
            const response = await api(`/api/plugins/${encodeURIComponent(pluginId)}/data/${encodeURIComponent(key)}`, {
              method: "POST",
              body: JSON.stringify({
                params: params ?? {},
                companyId: hostContext.companyId,
                renderEnvironment: hostContext.renderEnvironment ?? null,
              }),
            });

            if (!response.ok) {
              const body = await response.text();
              throw new Error(body || `HTTP ${response.status}`);
            }

            const payload = await response.json();
            if (!cancelled) {
              setData((payload?.data ?? payload) as T | null);
            }
          } catch (err) {
            if (!cancelled) {
              setData(null);
              setError(extractBridgeError(err));
            }
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        }

        void load();
        return () => {
          cancelled = true;
        };
      }, [hostContext.companyId, hostContext.renderEnvironment, key, paramsKey, pluginId, refreshTick]);

      return { data, loading, error, refresh };
    },
    usePluginAction(key: string) {
      const { pluginId, hostContext } = useBridgeContext();
      return React.useCallback(async (params?: Record<string, unknown>) => {
        const response = await api(`/api/plugins/${encodeURIComponent(pluginId)}/actions/${encodeURIComponent(key)}`, {
          method: "POST",
          body: JSON.stringify({
            ...(params ?? {}),
            companyId: hostContext.companyId,
            renderEnvironment: hostContext.renderEnvironment ?? null,
          }),
        });
        if (!response.ok) {
          const body = await response.text();
          throw extractBridgeError(body || `HTTP ${response.status}`);
        }
        const payload = await response.json().catch(() => null);
        return payload?.data ?? payload;
      }, [hostContext.companyId, hostContext.renderEnvironment, key, pluginId]);
    },
    usePluginStream<T = unknown>(channel: string, options?: { companyId?: string }) {
      const { pluginId } = useBridgeContext();
      const companyId = options?.companyId ?? null;
      const [events, setEvents] = React.useState<T[]>([]);
      const [lastEvent, setLastEvent] = React.useState<T | null>(null);
      const [connecting, setConnecting] = React.useState(true);
      const [connected, setConnected] = React.useState(false);
      const [error, setError] = React.useState<Error | null>(null);
      const sourceRef = React.useRef<EventSource | null>(null);

      const close = React.useCallback(() => {
        sourceRef.current?.close();
        sourceRef.current = null;
        setConnected(false);
        setConnecting(false);
      }, []);

      React.useEffect(() => {
        let cancelled = false;
        close();
        setEvents([]);
        setLastEvent(null);
        setError(null);
        setConnecting(true);
        const params = new URLSearchParams();
        if (companyId) params.set("companyId", companyId);
        const source = new EventSource(`/api/plugins/${encodeURIComponent(pluginId)}/bridge/stream/${encodeURIComponent(channel)}?${params.toString()}`);
        sourceRef.current = source;

        source.onopen = () => {
          if (cancelled) return;
          setConnecting(false);
          setConnected(true);
        };
        source.onerror = () => {
          if (cancelled) return;
          setError(new Error("Plugin stream disconnected"));
          setConnected(false);
          setConnecting(false);
        };
        source.onmessage = (event) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse(event.data) as T;
            setEvents((prev) => [...prev, parsed]);
            setLastEvent(parsed);
          } catch {
            // ignore malformed stream payloads
          }
        };

        return () => {
          cancelled = true;
          source.close();
          if (sourceRef.current === source) {
            sourceRef.current = null;
          }
        };
      }, [channel, close, companyId, pluginId]);

      return { events, lastEvent, connecting, connected, error, close };
    },
    usePluginToast() {
      return React.useCallback((input: { title: string; body?: string; tone?: "info" | "success" | "warn" | "error"; ttlMs?: number; action?: { label: string; href: string }; }) => {
        toastStore.push({
          title: input.title,
          body: input.body,
          tone: input.tone,
          ttlMs: input.ttlMs,
          action: input.action,
        });
        return null;
      }, []);
    },
  };
}

export function ensurePluginBridgeRuntime(): void {
  const globalBridge = globalThis as typeof globalThis & { __clawdevPluginBridge__?: BridgeRegistry };
  if (!globalBridge.__clawdevPluginBridge__) {
    globalBridge.__clawdevPluginBridge__ = {};
  }
  globalBridge.__clawdevPluginBridge__.react = React;
  globalBridge.__clawdevPluginBridge__.reactDom = {
    createRoot: ReactDOMClient.createRoot,
    hydrateRoot: ReactDOMClient.hydrateRoot,
    createPortal: ReactDOM.createPortal,
    flushSync: ReactDOM.flushSync,
  };
  globalBridge.__clawdevPluginBridge__.sdkUi = makeSdkUiBridge() as Record<string, unknown>;
}

export function createPluginBridgeContextValue(pluginId: string, hostContext: PluginHostContext): BridgeContextValue {
  return { pluginId, hostContext };
}

export const PluginBridgeProvider = bridgeContext.Provider;

function toRoutePathParts(routePath?: string | null): string {
  return routePath ? routePath.trim().replace(/^\/+|\/+$/g, "") : "";
}

export function getSlotTypeForView(
  view: "page" | "settings" | "dashboard" | "detailTab" | "sidebar" | "sidebarPanel" | "globalToolbar" | "toolbar",
): string {
  switch (view) {
    case "page":
      return "page";
    case "settings":
      return "settingsPage";
    case "dashboard":
      return "dashboardWidget";
    case "detailTab":
      return "detailTab";
    case "sidebar":
      return "sidebar";
    case "sidebarPanel":
      return "sidebarPanel";
    case "globalToolbar":
      return "globalToolbarButton";
    case "toolbar":
    default:
      return "toolbarButton";
  }
}

export function pickPluginSlot(
  contribution: PluginUiContribution | null | undefined,
  slotType: string,
  routePath?: string | null,
): PluginUiContributionSlot | null {
  if (!contribution?.slots?.length) return null;
  const normalizedRoutePath = toRoutePathParts(routePath);
  const matches = contribution.slots.filter((slot) => {
    if (slot.type !== slotType) return false;
    if (normalizedRoutePath && slot.type === "page") {
      return toRoutePathParts(slot.routePath) === normalizedRoutePath;
    }
    return true;
  });
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const ao = a.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return (a.displayName ?? a.id).localeCompare(b.displayName ?? b.id);
  });
  return matches[0] ?? null;
}

export function pickPluginExport<T extends React.ComponentType<{ context: PluginHostContext }>>(
  moduleExports: Record<string, unknown> | null | undefined,
  exportName: string | null | undefined,
): T | null {
  if (!moduleExports || !exportName) return null;
  const exported = moduleExports[exportName];
  if (!exported) return null;
  return exported as T;
}

const uiModuleCache = new Map<string, Promise<Record<string, unknown>>>();

function buildPluginUiUrl(contribution: PluginUiContribution): string {
  const cacheHint = encodeURIComponent(contribution.updatedAt ?? contribution.version ?? "0");
  const entryFile = contribution.uiEntryFile ?? "index.js";
  return `/_plugins/${encodeURIComponent(contribution.pluginId)}/ui/${entryFile}?v=${cacheHint}`;
}

function getShimBlobUrl(specifier: "react" | "react-dom" | "react-dom/client" | "react/jsx-runtime" | "sdk-ui"): string {
  const existing = (globalThis as typeof globalThis & { __clawdevPluginShimBlobUrls__?: Record<string, string> }).__clawdevPluginShimBlobUrls__ ?? {};
  const cacheKey = specifier;
  if (existing[cacheKey]) return existing[cacheKey];

  let source: string;
  switch (specifier) {
    case "react":
      source = `
        const R = globalThis.__clawdevPluginBridge__?.react;
        export default R;
        const {
          createElement,
          createFactory,
          Fragment,
          Component,
          PureComponent,
          StrictMode,
          Suspense,
          Profiler,
          Children,
          cloneElement,
          createContext,
          createRef,
          forwardRef,
          isValidElement,
          lazy,
          memo,
          startTransition,
          useCallback,
          useContext,
          useDebugValue,
          useDeferredValue,
          useEffect,
          useId,
          useImperativeHandle,
          useInsertionEffect,
          useLayoutEffect,
          useMemo,
          useReducer,
          useRef,
          useState,
          useSyncExternalStore,
          useTransition
        } = R;
        export {
          createElement,
          createFactory,
          Fragment,
          Component,
          PureComponent,
          StrictMode,
          Suspense,
          Profiler,
          Children,
          cloneElement,
          createContext,
          createRef,
          forwardRef,
          isValidElement,
          lazy,
          memo,
          startTransition,
          useCallback,
          useContext,
          useDebugValue,
          useDeferredValue,
          useEffect,
          useId,
          useImperativeHandle,
          useInsertionEffect,
          useLayoutEffect,
          useMemo,
          useReducer,
          useRef,
          useState,
          useSyncExternalStore,
          useTransition
        };
      `;
      break;
    case "react/jsx-runtime":
      source = `
        const R = globalThis.__clawdevPluginBridge__?.react;
        const withKey = (props, key) => key === undefined ? (props ?? {}) : { ...(props ?? {}), key };
        export const jsx = (type, props, key) => R.createElement(type, withKey(props, key));
        export const jsxs = (type, props, key) => R.createElement(type, withKey(props, key));
        export const Fragment = R.Fragment;
      `;
      break;
    case "react-dom":
    case "react-dom/client":
      source = `
        const RD = globalThis.__clawdevPluginBridge__?.reactDom;
        export default RD;
        const { createRoot, hydrateRoot, createPortal, flushSync } = RD ?? {};
        export { createRoot, hydrateRoot, createPortal, flushSync };
      `;
      break;
    case "sdk-ui":
      source = `
        const SDK = globalThis.__clawdevPluginBridge__?.sdkUi ?? {};
        const { usePluginData, usePluginAction, useHostContext, usePluginStream, usePluginToast } = SDK;
        export { usePluginData, usePluginAction, useHostContext, usePluginStream, usePluginToast };
      `;
      break;
  }

  const blob = new Blob([source], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  const store = (globalThis as typeof globalThis & { __clawdevPluginShimBlobUrls__?: Record<string, string> });
  store.__clawdevPluginShimBlobUrls__ = { ...(store.__clawdevPluginShimBlobUrls__ ?? {}), [cacheKey]: url };
  return url;
}

function rewriteBareSpecifiers(source: string): string {
  const rewrites: Record<string, string> = {
    '"@clawdev/plugin-sdk/ui"': `"${getShimBlobUrl("sdk-ui")}"`,
    "'@clawdev/plugin-sdk/ui'": `'${getShimBlobUrl("sdk-ui")}'`,
    '"@clawdev/plugin-sdk/ui/hooks"': `"${getShimBlobUrl("sdk-ui")}"`,
    "'@clawdev/plugin-sdk/ui/hooks'": `'${getShimBlobUrl("sdk-ui")}'`,
    '"react/jsx-runtime"': `"${getShimBlobUrl("react/jsx-runtime")}"`,
    "'react/jsx-runtime'": `'${getShimBlobUrl("react/jsx-runtime")}'`,
    '"react-dom/client"': `"${getShimBlobUrl("react-dom/client")}"`,
    "'react-dom/client'": `'${getShimBlobUrl("react-dom/client")}'`,
    '"react-dom"': `"${getShimBlobUrl("react-dom")}"`,
    "'react-dom'": `'${getShimBlobUrl("react-dom")}'`,
    '"react"': `"${getShimBlobUrl("react")}"`,
    "'react'": `'${getShimBlobUrl("react")}'`,
  };

  let result = source;
  for (const [from, to] of Object.entries(rewrites)) {
    result = result.replaceAll(` from ${from}`, ` from ${to}`);
    result = result.replaceAll(`import ${from}`, `import ${to}`);
    result = result.replaceAll(`export * from ${from}`, `export * from ${to}`);
    result = result.replaceAll(`export {`, `export {`);
  }
  return result;
}

async function importPluginModule(url: string): Promise<Record<string, unknown>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch plugin module: HTTP ${response.status}`);
  }
  const source = await response.text();
  const rewritten = rewriteBareSpecifiers(source);
  const blob = new Blob([rewritten], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    return await import(/* @vite-ignore */ blobUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export async function loadPluginUiModule(contribution: PluginUiContribution): Promise<Record<string, unknown>> {
  const cacheKey = `${contribution.pluginId}:${contribution.updatedAt ?? contribution.version ?? "0"}`;
  const inFlight = uiModuleCache.get(cacheKey);
  if (inFlight) return inFlight;

  ensurePluginBridgeRuntime();
  const promise = importPluginModule(buildPluginUiUrl(contribution));
  uiModuleCache.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    uiModuleCache.delete(cacheKey);
    throw error;
  }
}

export function clearPluginUiModuleCache(): void {
  uiModuleCache.clear();
}

export async function importPluginUiModule(contribution: PluginUiContribution): Promise<Record<string, unknown>> {
  return loadPluginUiModule(contribution);
}
