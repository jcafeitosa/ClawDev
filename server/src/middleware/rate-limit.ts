/**
 * Rate-limiting middleware placeholder.
 *
 * TODO: Implement a proper rate limiter using a sliding-window or token-bucket
 * algorithm backed by an in-memory store (for single-instance) or Redis (for
 * multi-instance deployments). Key considerations:
 *   - Per-IP and per-API-key limits
 *   - Configurable window size and max requests
 *   - Return standard 429 responses with Retry-After header
 *   - Exempt health-check and internal endpoints
 */

import { logger } from "./logger.js";

/**
 * Guard that can be called at route level to check rate limits.
 * Currently a no-op placeholder that logs a warning on first invocation.
 */
let warned = false;

export function rateLimitGuard(_identifier?: string): boolean {
  if (!warned) {
    logger.warn("rateLimitGuard called but rate limiting is not yet implemented");
    warned = true;
  }
  // Always allow — no rate limiting enforced yet
  return true;
}
