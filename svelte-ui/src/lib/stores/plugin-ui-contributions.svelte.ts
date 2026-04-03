/** Plugin UI contributions store — centralizes discovery of plugin UI slots and launchers. */

import { api } from "$lib/api";
import type {
  PluginLauncherActionDeclaration,
  PluginLauncherRenderDeclaration,
  PluginLauncherPlacementZone,
  PluginUiSlotEntityType,
} from "@clawdev/shared";

export interface PluginUiContributionSlot {
  id: string;
  type: string;
  displayName?: string;
  exportName?: string;
  routePath?: string;
  order?: number;
}

export interface PluginUiContributionLauncher {
  id: string;
  displayName?: string;
  description?: string;
  placementZone?: PluginLauncherPlacementZone;
  entityTypes?: PluginUiSlotEntityType[];
  exportName?: string;
  order?: number;
  action: PluginLauncherActionDeclaration;
  render?: PluginLauncherRenderDeclaration;
}

export interface PluginUiContribution {
  pluginId: string;
  pluginKey?: string;
  displayName?: string;
  version?: string;
  updatedAt?: string;
  uiEntryFile?: string;
  slots?: PluginUiContributionSlot[];
  launchers?: PluginUiContributionLauncher[];
}

let contributions = $state<PluginUiContribution[]>([]);
let loading = $state(false);
let error = $state<string | null>(null);
let loadedAt = $state<number | null>(null);
let inFlight: Promise<PluginUiContribution[]> | null = null;

async function fetchContributions(force = false) {
  if (inFlight && !force) return inFlight;

  if (contributions.length > 0 && loadedAt && !force) {
    return Promise.resolve(contributions);
  }

  loading = true;
  error = null;

  inFlight = (async () => {
    try {
      const res = await api("/api/plugins/ui-contributions");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      contributions = Array.isArray(data) ? data : data.contributions ?? [];
      loadedAt = Date.now();
      return contributions;
    } catch (err: any) {
      contributions = [];
      error = err?.message ?? "Unable to load plugin UI contributions.";
      throw err;
    } finally {
      loading = false;
      inFlight = null;
    }
  })();

  return inFlight;
}

export const pluginUiContributionsStore = {
  get contributions() {
    return contributions;
  },
  get loading() {
    return loading;
  },
  get error() {
    return error;
  },
  get loadedAt() {
    return loadedAt;
  },
  load(force = false) {
    return fetchContributions(force);
  },
  refresh() {
    return fetchContributions(true);
  },
  clear() {
    contributions = [];
    loading = false;
    error = null;
    loadedAt = null;
    inFlight = null;
  },
};
