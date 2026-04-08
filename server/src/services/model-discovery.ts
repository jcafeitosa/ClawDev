import type { Db } from "@clawdev/db";
import type { AdapterModel, AdapterModelStatus } from "@clawdev/adapter-utils";
import { listServerAdapters, listAdapterModels } from "../adapters/registry.js";
import { createModelCatalogService, type SyncInput } from "./model-catalog.js";
import { createProviderStatusService, getCooldownDuration } from "./provider-status.js";
import { probeAdapterModels, PROBE_CONFIGS } from "../adapters/cli-probe.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "model-discovery" });

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

// ---------------------------------------------------------------------------
// Helpers – map adapter model status to provider_model_status values
// ---------------------------------------------------------------------------

function adapterStatusToProviderStatus(
  adapterStatus: AdapterModelStatus | undefined,
): "available" | "unavailable" | "cooldown" {
  switch (adapterStatus) {
    case "unavailable":
    case "auth_required":
    case "degraded":
      return "unavailable";
    case "quota_exceeded":
      return "cooldown";
    case "available":
      // If discovered at all, treat as available unless explicitly marked otherwise
      return "available";
    case "unknown":
    default:
      return "unavailable";
  }
}

export function createModelDiscoveryService(
  db: Db,
  catalogService: ReturnType<typeof createModelCatalogService>,
  providerStatusService?: ReturnType<typeof createProviderStatusService>,
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
      // Track raw adapter models so we can update provider status with their status fields
      const rawModelsByAdapter = new Map<string, AdapterModel[]>();
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
          log.warn(
            { category: "adapter", adapterType, err: errorMsg },
            `Adapter ${adapterType} probe failed`,
          );
          errors.push({ adapterType, error: errorMsg });
          continue;
        }

        adaptersProbed++;
        let { models } = result.value;

        // For adapters that only list models without probing,
        // run CLI probes to get real availability status.
        // Any model that remains unknown must not be promoted to available.
        const hasBuiltInProbing = models.some((m) => m.status && m.status !== "available");
        if (!hasBuiltInProbing && PROBE_CONFIGS[adapterType]) {
          try {
            models = await probeAdapterModels(adapterType, models);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.warn(
              { category: "adapter", adapterType, err: errMsg },
              `CLI probe for ${adapterType} failed`,
            );
          }
        }

        if (!hasBuiltInProbing && !PROBE_CONFIGS[adapterType]) {
          models = models.map((model) => ({
            ...model,
            status: model.status && model.status !== "available" ? model.status : "unknown",
            statusDetail: model.statusDetail ?? "Discovery only; no real probe available",
          }));
        }

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
        rawModelsByAdapter.set(adapterType, models);
      }

      // Sync all discovered models into the catalog
      const syncResult = await catalogService.syncFromAdapters(allModels);

      // Update provider_model_status for each discovered model
      if (providerStatusService) {
        for (const [adapterType, models] of rawModelsByAdapter) {
          for (const model of models) {
            try {
              const mappedStatus = adapterStatusToProviderStatus(model.status);

              if (mappedStatus === "cooldown") {
                // Use a 5-minute cooldown window for quota_exceeded models
                const cooldownUntil = new Date(Date.now() + getCooldownDuration(adapterType));
                await providerStatusService.markCooldown(
                  adapterType,
                  model.id,
                  cooldownUntil,
                  model.statusDetail ?? "quota_exceeded during discovery",
                );
              } else {
                await providerStatusService.updateStatus(
                  adapterType,
                  model.id,
                  mappedStatus,
                  model.statusDetail,
                );
              }

              // Record a successful probe result for each discovered model
              await providerStatusService.recordProbeResult(
                adapterType,
                model.id,
                mappedStatus === "available",
              );
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              log.warn(
                { category: "adapter", adapterType, modelId: model.id, err: errorMsg },
                `Failed to update provider status`,
              );
            }
          }
        }
      }

      // Mark stale models for each adapter that was successfully probed
      for (const [adapterType, freshIds] of freshModelsByAdapter) {
        try {
          await catalogService.markStaleModels(adapterType, freshIds);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          log.warn(
            { category: "adapter", adapterType, err: errorMsg },
            `Failed to mark stale models`,
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
        let models = await withTimeout(
          listAdapterModels(adapterType),
          PROBE_TIMEOUT_MS,
          `Probe timed out after ${Math.round(PROBE_TIMEOUT_MS / 1000)}s`,
        );

        // For adapters without built-in probing, run CLI probes
        const hasBuiltInProbing = models.some((m) => m.status && m.status !== "available");
        if (!hasBuiltInProbing && PROBE_CONFIGS[adapterType]) {
          try {
            models = await probeAdapterModels(adapterType, models);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.warn(
              { category: "adapter", adapterType, err: errMsg },
              `CLI probe for ${adapterType} failed`,
            );
          }
        }

        const syncInputs: SyncInput[] = models.map((model) => ({
          adapterType,
          modelId: model.id,
          label: model.label,
          provider: model.provider,
          source: "adapter_probe",
        }));

        await catalogService.syncFromAdapters(syncInputs);

        // Update provider_model_status for each discovered model
        if (providerStatusService) {
          for (const model of models) {
            try {
              const mappedStatus = adapterStatusToProviderStatus(model.status);

              if (mappedStatus === "cooldown") {
                const cooldownUntil = new Date(Date.now() + getCooldownDuration(adapterType));
                await providerStatusService.markCooldown(
                  adapterType,
                  model.id,
                  cooldownUntil,
                  model.statusDetail ?? "quota_exceeded during discovery",
                );
              } else {
                await providerStatusService.updateStatus(
                  adapterType,
                  model.id,
                  mappedStatus,
                  model.statusDetail,
                );
              }

              await providerStatusService.recordProbeResult(
                adapterType,
                model.id,
                mappedStatus === "available",
              );
            } catch (err) {
              const errorMsg = err instanceof Error ? err.message : String(err);
              log.warn(
                { category: "adapter", adapterType, modelId: model.id, err: errorMsg },
                `Failed to update provider status`,
              );
            }
          }
        }

        // Mark models not in this probe as stale
        const freshIds = models.map((m) => m.id);
        await catalogService.markStaleModels(adapterType, freshIds);

        return { models: models.length, status: "ok" };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        log.error(
          { category: "adapter", adapterType, err: errorMsg },
          `probeAdapter failed`,
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
