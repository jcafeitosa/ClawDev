import { describe, expect, it } from "vitest";
import { normalizeRuntimeConfigForAdapterType } from "../services/runtime-config.js";

describe("normalizeRuntimeConfigForAdapterType", () => {
  it("drops auto model selection for claude_local", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("claude_local", { model: "auto", heartbeat: { enabled: true } }),
    ).toEqual({ heartbeat: { enabled: true } });

    expect(
      normalizeRuntimeConfigForAdapterType("claude_local", { model: " AUTO ", heartbeat: { enabled: true } }),
    ).toEqual({ heartbeat: { enabled: true } });
  });

  it("keeps explicit Claude models intact", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("claude_local", { model: "claude-sonnet-4-6", heartbeat: { enabled: true } }),
    ).toEqual({ model: "claude-sonnet-4-6", heartbeat: { enabled: true } });
  });

  it("leaves other adapters untouched", () => {
    expect(
      normalizeRuntimeConfigForAdapterType("cursor", { model: "auto", mode: "plan" }),
    ).toEqual({ model: "auto", mode: "plan" });
  });
});
