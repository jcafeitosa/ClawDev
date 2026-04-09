import { afterEach, describe, expect, it } from "vitest";
import {
  ensurePiModelConfiguredAndAvailable,
  listPiModels,
  resetPiModelsCacheForTests,
} from "./models.js";

describe("pi models", () => {
  afterEach(() => {
    delete process.env.CLAWDEV_PI_COMMAND;
    resetPiModelsCacheForTests();
  });

  it("returns an empty list when discovery command is unavailable", async () => {
    process.env.CLAWDEV_PI_COMMAND = "__clawdev_missing_pi_command__";
    await expect(listPiModels()).resolves.toEqual([]);
  });

  it("accepts router-managed selection when no explicit model is configured", async () => {
    process.env.CLAWDEV_PI_COMMAND = "__clawdev_missing_pi_command__";
    await expect(
      ensurePiModelConfiguredAndAvailable({ model: "auto", provider: "openrouter" }),
    ).rejects.toThrow();
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.CLAWDEV_PI_COMMAND = "__clawdev_missing_pi_command__";
    await expect(
      ensurePiModelConfiguredAndAvailable({
        model: "xai/grok-4",
      }),
    ).rejects.toThrow();
  });
});
