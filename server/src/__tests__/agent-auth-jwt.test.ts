import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalAgentJwt, verifyLocalAgentJwt } from "../agent-auth-jwt.js";

describe("agent local JWT", () => {
  const secretEnv = "CLAWDEV_AGENT_JWT_SECRET";
  const ttlEnv = "CLAWDEV_AGENT_JWT_TTL_SECONDS";
  const issuerEnv = "CLAWDEV_AGENT_JWT_ISSUER";
  const audienceEnv = "CLAWDEV_AGENT_JWT_AUDIENCE";

  const originalEnv = {
    secret: process.env[secretEnv],
    ttl: process.env[ttlEnv],
    issuer: process.env[issuerEnv],
    audience: process.env[audienceEnv],
  };

  beforeEach(() => {
    process.env[secretEnv] = "test-secret";
    process.env[ttlEnv] = "3600";
    delete process.env[issuerEnv];
    delete process.env[audienceEnv];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalEnv.secret === undefined) delete process.env[secretEnv];
    else process.env[secretEnv] = originalEnv.secret;
    if (originalEnv.ttl === undefined) delete process.env[ttlEnv];
    else process.env[ttlEnv] = originalEnv.ttl;
    if (originalEnv.issuer === undefined) delete process.env[issuerEnv];
    else process.env[issuerEnv] = originalEnv.issuer;
    if (originalEnv.audience === undefined) delete process.env[audienceEnv];
    else process.env[audienceEnv] = originalEnv.audience;
  });

  it("creates and verifies a token", async () => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(typeof token).toBe("string");

    const claims = await verifyLocalAgentJwt(token!);
    expect(claims).toMatchObject({
      sub: "agent-1",
      company_id: "company-1",
      adapter_type: "claude_local",
      run_id: "run-1",
      iss: "clawdev",
      aud: "clawdev-api",
    });
  });

  it("returns null when secret is missing", async () => {
    process.env[secretEnv] = "";
    const token = await createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");
    expect(token).toBeNull();
    expect(await verifyLocalAgentJwt("abc.def.ghi")).toBeNull();
  });

  it("rejects expired tokens", async () => {
    process.env[ttlEnv] = "1";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await createLocalAgentJwt("agent-1", "company-1", "claude_local", "run-1");

    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    expect(await verifyLocalAgentJwt(token!)).toBeNull();
  });

  it("rejects issuer/audience mismatch", async () => {
    process.env[issuerEnv] = "custom-issuer";
    process.env[audienceEnv] = "custom-audience";
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = await createLocalAgentJwt("agent-1", "company-1", "codex_local", "run-1");

    process.env[issuerEnv] = "clawdev";
    process.env[audienceEnv] = "clawdev-api";
    expect(await verifyLocalAgentJwt(token!)).toBeNull();
  });
});
