import { describe, expect, it } from "vitest";
import { resolveJoinRequestAgentManagerId } from "../routes/access.js";

describe("resolveJoinRequestAgentManagerId", () => {
  it("returns null when no level C agent exists in the company agent list", () => {
    const managerId = resolveJoinRequestAgentManagerId([
      { id: "a1", role: "engineer", reportsTo: null },
      { id: "a2", role: "general", reportsTo: "a1" },
    ]);

    expect(managerId).toBeNull();
  });

  it("selects the root CEO when available", () => {
    const managerId = resolveJoinRequestAgentManagerId([
      { id: "ceo-child", role: "ceo", reportsTo: "manager-1" },
      { id: "manager-1", role: "cto", reportsTo: null },
      { id: "ceo-root", role: "ceo", reportsTo: null },
    ]);

    expect(managerId).toBe("ceo-root");
  });

  it("falls back to the root level C agent when no root CEO is present", () => {
    const managerId = resolveJoinRequestAgentManagerId([
      { id: "cto-1", role: "cto", reportsTo: "mgr" },
      { id: "coo-2", role: "coo", reportsTo: "mgr" },
      { id: "mgr", role: "cto", reportsTo: null },
    ]);

    expect(managerId).toBe("mgr");
  });
});
