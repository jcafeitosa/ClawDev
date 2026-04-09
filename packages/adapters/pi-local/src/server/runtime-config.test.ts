import { describe, expect, it } from "vitest";
import { normalizePiModelSelection, resolvePiPaths } from "./runtime-config.js";

describe("normalizePiModelSelection", () => {
  it("parses provider/model and thinking suffixes", () => {
    expect(
      normalizePiModelSelection({
        model: "groq/qwen-qwq-32b:high",
      }),
    ).toEqual({
      provider: "groq",
      modelId: "qwen-qwq-32b",
      canonicalModel: "groq/qwen-qwq-32b",
      thinking: "high",
      hasExplicitModel: true,
    });
  });

  it("uses configured provider when model omits the provider prefix", () => {
    expect(
      normalizePiModelSelection({
        provider: "xai",
        model: "grok-4",
        thinking: "medium",
      }),
    ).toEqual({
      provider: "xai",
      modelId: "grok-4",
      canonicalModel: "xai/grok-4",
      thinking: "medium",
      hasExplicitModel: true,
    });
  });

  it("treats auto as router-managed selection", () => {
    expect(
      normalizePiModelSelection({
        provider: "openrouter",
        model: "auto",
      }),
    ).toEqual({
      provider: "openrouter",
      modelId: null,
      canonicalModel: null,
      thinking: null,
      hasExplicitModel: false,
    });
  });
});

describe("resolvePiPaths", () => {
  it("respects HOME from the runtime environment", () => {
    const paths = resolvePiPaths({ HOME: "/tmp/clawdev-pi-home" });
    expect(paths.sessionsDir).toBe("/tmp/clawdev-pi-home/.pi/clawdevs");
    expect(paths.skillsDir).toBe("/tmp/clawdev-pi-home/.pi/agent/skills");
  });
});
