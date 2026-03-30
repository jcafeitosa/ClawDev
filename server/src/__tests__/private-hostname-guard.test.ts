import { describe, expect, it } from "vitest";
import { checkPrivateHostname } from "../middleware/private-hostname-guard.js";

function makeRequest(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://localhost${path}`, { headers });
}

describe("privateHostnameGuard", () => {
  it("allows requests when disabled", () => {
    const result = checkPrivateHostname(
      makeRequest("/api/health", { host: "dotta-macbook-pro:3100" }),
      { enabled: false, allowedHostnames: [], bindHost: "0.0.0.0" },
    );
    expect(result).toBeUndefined();
  });

  it("allows loopback hostnames", () => {
    const result = checkPrivateHostname(
      makeRequest("/api/health", { host: "localhost:3100" }),
      { enabled: true, allowedHostnames: [], bindHost: "0.0.0.0" },
    );
    expect(result).toBeUndefined();
  });

  it("allows explicitly configured hostnames", () => {
    const result = checkPrivateHostname(
      makeRequest("/api/health", { host: "dotta-macbook-pro:3100" }),
      { enabled: true, allowedHostnames: ["dotta-macbook-pro"], bindHost: "0.0.0.0" },
    );
    expect(result).toBeUndefined();
  });

  it("blocks unknown hostnames with remediation command", () => {
    const result = checkPrivateHostname(
      makeRequest("/api/health", { host: "dotta-macbook-pro:3100", accept: "application/json" }),
      { enabled: true, allowedHostnames: ["some-other-host"], bindHost: "0.0.0.0" },
    );
    expect(result).toBeDefined();
    expect(result!.status).toBe(403);
    expect((result!.body as any).error).toContain("pnpm clawdev allowed-hostname dotta-macbook-pro");
  });

  it("blocks unknown hostnames on page routes with plain-text remediation command", () => {
    const result = checkPrivateHostname(
      makeRequest("/dashboard", { host: "dotta-macbook-pro:3100" }),
      { enabled: true, allowedHostnames: ["some-other-host"], bindHost: "0.0.0.0" },
    );
    expect(result).toBeDefined();
    expect(result!.status).toBe(403);
    expect(result!.body as string).toContain("pnpm clawdev allowed-hostname dotta-macbook-pro");
  });
});
