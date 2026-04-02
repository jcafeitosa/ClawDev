import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimitGuard, resetRateLimitState } from "../middleware/rate-limit.js";

describe("rate limit guard", () => {
  afterEach(() => {
    resetRateLimitState();
    vi.useRealTimers();
  });

  it("allows requests until the configured limit is reached", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    expect(rateLimitGuard("company-a", { maxRequests: 2, windowMs: 1_000 })).toBe(true);
    expect(rateLimitGuard("company-a", { maxRequests: 2, windowMs: 1_000 })).toBe(true);
    expect(rateLimitGuard("company-a", { maxRequests: 2, windowMs: 1_000 })).toBe(false);
  });

  it("releases the bucket after the time window elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));

    expect(rateLimitGuard("company-b", { maxRequests: 1, windowMs: 1_000 })).toBe(true);
    expect(rateLimitGuard("company-b", { maxRequests: 1, windowMs: 1_000 })).toBe(false);

    vi.advanceTimersByTime(1_001);

    expect(rateLimitGuard("company-b", { maxRequests: 1, windowMs: 1_000 })).toBe(true);
  });
});
