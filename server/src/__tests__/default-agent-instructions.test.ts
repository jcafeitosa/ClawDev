import { describe, expect, it } from "vitest";
import { resolveDefaultAgentInstructionsBundleRole } from "../services/default-agent-instructions.js";

describe("default agent instructions bundle role resolution", () => {
  it("routes CEO to the CEO bundle", () => {
    expect(resolveDefaultAgentInstructionsBundleRole("ceo")).toBe("ceo");
  });

  it("routes non-CEO level C roles to the level C bundle", () => {
    expect(resolveDefaultAgentInstructionsBundleRole("cto")).toBe("level_c");
    expect(resolveDefaultAgentInstructionsBundleRole("cmo")).toBe("level_c");
    expect(resolveDefaultAgentInstructionsBundleRole("cfo")).toBe("level_c");
    expect(resolveDefaultAgentInstructionsBundleRole("coo")).toBe("level_c");
    expect(resolveDefaultAgentInstructionsBundleRole("hr")).toBe("level_c");
  });

  it("routes non level C roles to the default bundle", () => {
    expect(resolveDefaultAgentInstructionsBundleRole("engineer")).toBe("default");
  });
});
