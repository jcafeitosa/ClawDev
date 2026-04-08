import { beforeEach, describe, expect, it, vi } from "vitest";
import { models as codexFallbackModels } from "@clawdev/adapter-codex-local";
import { models as cursorFallbackModels } from "@clawdev/adapter-cursor-local";
import { resetOpenCodeModelsCacheForTests } from "@clawdev/adapter-opencode-local/server";
import { listAdapterModels } from "../adapters/index.js";
import { resetCodexModelsCacheForTests } from "../adapters/codex-models.js";
import { resetCursorModelsCacheForTests, setCursorModelsRunnerForTests } from "../adapters/cursor-models.js";

describe("adapter model listing", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.CLAWDEV_OPENCODE_COMMAND;
    resetCodexModelsCacheForTests();
    resetCursorModelsCacheForTests();
    setCursorModelsRunnerForTests(null);
    resetOpenCodeModelsCacheForTests();
    vi.restoreAllMocks();
  });

  it("returns an empty list for unknown adapters", async () => {
    const models = await listAdapterModels("unknown_adapter");
    expect(models).toEqual([]);
  });

  it("returns codex fallback models when no OpenAI key is available", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const models = await listAdapterModels("codex_local");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(models).toHaveLength(codexFallbackModels.length);
    for (const model of models) {
      expect(model.provider).toBe("openai");
      expect(model.status).toBe("auth_required");
      expect(model.statusDetail).toBe("No OpenAI API key configured");
      expect(model.probedAt).toBeDefined();
    }
    expect(models.map((m) => m.id)).toEqual(codexFallbackModels.map((m) => m.id));
  });

  it("loads codex models dynamically and merges fallback options", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "gpt-5-pro" },
          { id: "gpt-5" },
        ],
      }),
    } as Response);

    const first = await listAdapterModels("codex_local");
    const second = await listAdapterModels("codex_local");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((model) => model.id === "gpt-5-pro")).toBe(true);
    expect(first.some((model) => model.id === "codex-mini-latest")).toBe(true);
  });

  it("falls back to static codex models when OpenAI model discovery fails", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
    } as Response);

    const models = await listAdapterModels("codex_local");
    expect(models).toHaveLength(codexFallbackModels.length);
    for (const model of models) {
      expect(model.provider).toBe("openai");
      expect(model.status).toBe("auth_required");
      expect(model.statusDetail).toBe("OpenAI API 401 Unauthorized");
      expect(model.probedAt).toBeDefined();
    }
    expect(models.map((m) => m.id)).toEqual(codexFallbackModels.map((m) => m.id));
  });


  it("returns cursor fallback models when CLI discovery is unavailable", async () => {
    setCursorModelsRunnerForTests(() => ({
      status: null,
      stdout: "",
      stderr: "",
      hasError: true,
    }));

    const models = await listAdapterModels("cursor");
    expect(models).toHaveLength(cursorFallbackModels.length);
    expect(models.map((model) => model.id)).toEqual(cursorFallbackModels.map((model) => model.id));
    for (const model of models) {
      expect(model.status).toBe("unavailable");
      expect(model.statusDetail).toBe("CLI not installed");
      expect(model.probedAt).toBeDefined();
    }
  });

  it("loads cursor models dynamically and caches them", async () => {
    const runner = vi.fn(() => ({
      status: 0,
      stdout: "Available models: auto, composer-1.5, gpt-5.3-codex-high, sonnet-4.6",
      stderr: "",
      hasError: false,
    }));
    setCursorModelsRunnerForTests(runner);

    const first = await listAdapterModels("cursor");
    const second = await listAdapterModels("cursor");

    expect(runner).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first.some((model) => model.id === "auto")).toBe(true);
    expect(first.some((model) => model.id === "gpt-5.3-codex-high")).toBe(true);
    expect(first.some((model) => model.id === "composer-1")).toBe(true);
  });

  it("returns no opencode models when opencode command is unavailable", async () => {
    process.env.CLAWDEV_OPENCODE_COMMAND = "__clawdev_missing_opencode_command__";

    const models = await listAdapterModels("opencode_local");
    expect(models).toEqual([]);
  });
});
