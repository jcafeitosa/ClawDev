import { createHash } from "node:crypto";
import type { ProviderQuotaResult } from "@clawdev/shared";
import { listServerAdapters } from "../adapters/registry.js";
import { isRedisConfigured, getRedis } from "../redis.js";
import { logger } from "../middleware/logger.js";

const QUOTA_PROVIDER_TIMEOUT_MS = 20_000;
const QUOTA_CACHE_TTL_SECONDS = 300; // 5 minutes

function providerSlugForAdapterType(type: string): string {
  switch (type) {
    case "claude_local":
      return "anthropic";
    case "codex_local":
      return "openai";
    default:
      return type;
  }
}

/**
 * Build a deterministic cache key from the set of adapter types that support quota windows.
 */
function buildCacheKey(adapterTypes: string[]): string {
  const hash = createHash("sha256")
    .update(adapterTypes.slice().sort().join(","))
    .digest("hex")
    .slice(0, 16);
  return `clawdev:quota-windows:${hash}`;
}

/**
 * Asks each registered adapter for its provider quota windows and aggregates the results.
 * Adapters that don't implement getQuotaWindows() are silently skipped.
 * Individual adapter failures are caught and returned as error results rather than
 * letting one provider's outage block the entire response.
 *
 * Results are cached in Redis (when configured) with a 5-minute TTL to reduce
 * redundant provider API calls across concurrent requests.
 */
export async function fetchAllQuotaWindows(): Promise<ProviderQuotaResult[]> {
  const adapters = listServerAdapters().filter((a) => a.getQuotaWindows != null);
  const adapterTypes = adapters.map((a) => a.type);

  // Attempt to read from Redis cache
  if (isRedisConfigured()) {
    const cacheKey = buildCacheKey(adapterTypes);
    try {
      const redis = getRedis();
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, "Quota windows cache hit");
        return JSON.parse(cached) as ProviderQuotaResult[];
      }
    } catch (err: unknown) {
      logger.warn({ err }, "Failed to read quota windows from Redis cache, falling back to adapters");
    }
  }

  // Cache miss (or Redis not configured): fetch from adapters
  const results = await fetchFromAdapters(adapters);

  // Write results to Redis cache (fire-and-forget)
  if (isRedisConfigured()) {
    const cacheKey = buildCacheKey(adapterTypes);
    try {
      const redis = getRedis();
      await redis.set(cacheKey, JSON.stringify(results), "EX", QUOTA_CACHE_TTL_SECONDS);
      logger.debug({ cacheKey, ttl: QUOTA_CACHE_TTL_SECONDS }, "Quota windows cached");
    } catch (err: unknown) {
      logger.warn({ err }, "Failed to write quota windows to Redis cache");
    }
  }

  return results;
}

/**
 * Fetches quota windows from all adapters with timeout and error isolation.
 */
async function fetchFromAdapters(
  adapters: ReturnType<typeof listServerAdapters>,
): Promise<ProviderQuotaResult[]> {
  const settled = await Promise.allSettled(
    adapters.map((adapter) => withQuotaTimeout(adapter.type, adapter.getQuotaWindows!())),
  );

  return settled.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    const adapterType = adapters[i]!.type;
    return {
      provider: providerSlugForAdapterType(adapterType),
      ok: false,
      error: String(result.reason),
      windows: [],
    };
  });
}

async function withQuotaTimeout(
  adapterType: string,
  task: Promise<ProviderQuotaResult>,
): Promise<ProviderQuotaResult> {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<ProviderQuotaResult>((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({
            provider: providerSlugForAdapterType(adapterType),
            ok: false,
            error: `quota polling timed out after ${Math.round(QUOTA_PROVIDER_TIMEOUT_MS / 1000)}s`,
            windows: [],
          });
        }, QUOTA_PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
