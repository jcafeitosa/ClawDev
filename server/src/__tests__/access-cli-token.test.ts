import { describe, expect, it } from "vitest";
import { accessService } from "../services/access.js";

describe("cli token helpers", () => {
  it("creates and verifies a signed, time-limited token", async () => {
    const service = accessService({} as any);
    const generated = await service.generateCliToken();
    const verified = await service.verifyCliToken(generated.token);

    expect(verified).toEqual({ valid: true, userId: null });
    expect(new Date(generated.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects tampered tokens", async () => {
    const service = accessService({} as any);
    const generated = await service.generateCliToken();
    const tampered = generated.token.replace(/.$/, (char) => (char === "a" ? "b" : "a"));

    const verified = await service.verifyCliToken(tampered);

    expect(verified.valid).toBe(false);
    expect(verified.userId).toBeNull();
  });
});
