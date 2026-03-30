import type { Db } from "@clawdev/db";
import { listServerAdapters, listAdapterModels } from "../adapters/registry.js";
import { createModelCatalogService, type SyncInput } from "./model-catalog.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveryCycleResult {
  adaptersProbed: number;
  modelsDiscovered: number;
  added: number;
  updated: number;
  errors: Array<{ adapterType: string; error: string }>;
}

export interface ProbeAdapterResult {
  models: number;
  status: "ok" | "error";
  error?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 30_000;

export function createModelDiscoveryService(
  db: Db,
  catalogService: ReturnType<typeof createModelCatalogService>,
) {
  return {
    /**
     * Run a full discovery cycle across all registered adapters.
     *
     * 1. Lists all server adapters from the registry.
     * 2. For each adapter, calls listAdapterModels() to probe available models.
     * 3. Collects all discovered models and syncs them into the catalog.
     * 4. Marks stale models per adapter (models no longer reported by a probe).
     *
     * Individual adapter failures are caught so one broken adapter does not
     * prevent discovery of others.
     */
    async runDiscoveryCycle(): Promise<DiscoveryCycleResult> {
      const adapters = listServerAdapters();
      const allModels: SyncInput[] = [];
      const errors: Array<{ adapterType: string; error: string }> = [];
      const freshModelsByAdapter = new Map<string, string[]>();
      let adaptersProbed = 0;

      const probeResults = await Promise.allSettled(
        adapters.map(async (adapter) => {
          const models = await withTimeout(
            listAdapterModels(adapter.type),
            PROBE_TIMEOUT_MS,
            `Probe timed out after ${Math.round(PROBE_TIMEOUT_MS / 1000)}s`,
          );
          return { adapterType: adapter.type, models };
        }),
      );

      for (let i = 0; i < probeResults.length; i++) {
        const result = probeResults[i]!;
        const adapterType = adapters[i]!.type;

        if (result.status === "rejected") {
          const errorMsg = result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
          console.log(
            `[model-discovery] adapter ${adapterType} probe failed: ${errorMsg}`,
          );
          errors.push({ adapterType, error: errorMsg });
          continue;
        }

        adaptersProbed++;
        const { models } = result.value;
        const modelIds: string[] = [];

        for (const model of models) {
          modelIds.push(model.id);
          allModels.push({
            adapterType,
            modelId: model.id,
            label: model.label,
            provider: model.provider,
            source: "adapter_probe",
          });
        }

        freshModelsByAdapter.set(adapterType, modelIds);
      }

      // Sync all discovered models into the catalog
      const syncResult = await catalogService.syncFromAdapters(allModels);

      // Mark stale models for each adapter that was successfully probed
      for (const [adapterType, freshIds] of freshModelsByAdapter) {
        try {
          await catalogService.markStaleModels(adapterType, freshIds);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.log(
            `[model-discovery] failed to mark stale models for ${adapterType}: ${errorMsg}`,
          );
        }
      }

      return {
        adaptersProbed,
        modelsDiscovered: allModels.length,
        added: syncResult.added,
        updated: syncResult.updated,
        errors,
      };
    },

    /**
     * Probe a single adapter by type and sync its models into the catalog.
     * Returns the count of models discovered and whether the probe succeeded.
     */
    async probeAdapter(adapterType: string): Promise<ProbeAdapterResult> {
      try {
        const models = await withTimeout(
          listAdapterModels(adapterType),
          PROBE_TIMEOUT_MS,
          `Probe timed out after ${Math.round(PROBE_TIMEOUT_MS / 1000)}s`,
        );

        const syncInputs: SyncInput[] = models.map((model) => ({
          adapterType,
          modelId: model.id,
          label: model.label,
          provider: model.provider,
          source: "adapter_probe",
        }));

        await catalogService.syncFromAdapters(syncInputs);

        // Mark models not in this probe as stale
        const freshIds = models.map((m) => m.id);
        await catalogService.markStaleModels(adapterType, freshIds);

        return { models: models.length, status: "ok" };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.log(
          `[model-discovery] probeAdapter(${adapterType}) failed: ${errorMsg}`,
        );
        return { models: 0, status: "error", error: errorMsg };
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function withTimeout<T>(
  task: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
