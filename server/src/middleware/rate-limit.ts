import { logger } from "./logger.js";

type RateLimitBucket = {
  hits: number[];
  lastSeenAt: number;
};

type RateLimitOptions = {
  maxRequests?: number;
  windowMs?: number;
};

const DEFAULT_MAX_REQUESTS = 120;
const DEFAULT_WINDOW_MS = 60_000;
const buckets = new Map<string, RateLimitBucket>();

function resolveLimits(options?: RateLimitOptions) {
  return {
    maxRequests: options?.maxRequests ?? DEFAULT_MAX_REQUESTS,
    windowMs: options?.windowMs ?? DEFAULT_WINDOW_MS,
  };
}

function pruneBuckets(now: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);
    if (bucket.hits.length === 0 && now - bucket.lastSeenAt > windowMs) {
      buckets.delete(key);
    }
  }
}

export function resetRateLimitState() {
  buckets.clear();
}

export function rateLimitGuard(identifier?: string, options?: RateLimitOptions): boolean {
  const { maxRequests, windowMs } = resolveLimits(options);
  const key = identifier?.trim() || "anonymous";
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [], lastSeenAt: now };

  bucket.hits = bucket.hits.filter((hit) => now - hit < windowMs);
  bucket.lastSeenAt = now;

  if (bucket.hits.length >= maxRequests) {
    buckets.set(key, bucket);
    pruneBuckets(now, windowMs);
    logger.warn(`Rate limit exceeded for ${key}`);
    return false;
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  pruneBuckets(now, windowMs);
  return true;
}
