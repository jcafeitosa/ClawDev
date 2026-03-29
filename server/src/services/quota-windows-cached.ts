/**
 * Quota Windows with Redis TTL Cache.
 *
 * Wraps the existing fetchAllQuotaWindows() with a Redis-backed cache.
 * Each provider's quota result is cached with a TTL key, avoiding
 * redundant API calls to LLM providers within the cache window.
 *
 * Cache key format: `quota:{provider}` with TTL of 60 seconds.
 *
 * Falls back to the uncached implementation if Redis is unavailable.
 */

import type { ProviderQuotaResult } from "@clawdev/shared";
import { fetchAllQuotaWindows } from "./quota-windows.js";
import { getRedis, isRedisAvailable } from "./redis.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ service: "quota-windows-cached" });

/** Cache TTL in seconds. */
const CACHE_TTL_SECONDS = 60;

/** Redis key prefix for quota caches. */
const KEY_PREFIX = "quota:";

/**
 * Fetch all provider quota windows with Redis caching.
 *
 * - First checks Redis for cached results.
 * - For any providers not in cache, calls the real adapter.
 * - Caches fresh results with a TTL.
 * - Falls back to uncached if Redis is down.
 */
export async function fetchAllQuotaWindowsCached(): Promise<ProviderQuotaResult[]> {
  const redisOk = await isRedisAvailable();
  if (!redisOk) {
    log.debug("Redis unavailable — falling back to uncached quota fetch");
    return fetchAllQuotaWindows();
  }

  const redis = getRedis();

  // Try to load all cached results
  try {
    const keys = await redis.keys(`${KEY_PREFIX}*`);
    if (keys.length > 0) {
      const cached = await redis.mget(keys);
      const results: ProviderQuotaResult[] = [];
      let allCached = true;

      for (const val of cached) {
        if (val) {
          results.push(JSON.parse(val) as ProviderQuotaResult);
        } else {
          allCached = false;
        }
      }

      if (allCached && results.length > 0) {
        log.debug({ count: results.length }, "returning cached quota windows");
        return results;
      }
    }
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Redis cache read failed — fetching fresh");
  }

  // Fetch fresh results
  const fresh = await fetchAllQuotaWindows();

  // Cache each result with TTL
  try {
    const pipeline = redis.pipeline();
    for (const result of fresh) {
      const key = `${KEY_PREFIX}${result.provider}`;
      pipeline.set(key, JSON.stringify(result), "EX", CACHE_TTL_SECONDS);
    }
    await pipeline.exec();
    log.debug({ count: fresh.length }, "cached quota windows in Redis");
  } catch (err) {
    log.warn({ err: (err as Error).message }, "Redis cache write failed");
  }

  return fresh;
}
