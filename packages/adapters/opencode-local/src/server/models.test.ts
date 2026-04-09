import { afterEach, describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import {
  discoverOpenCodeModels,
  ensureOpenCodeModelConfiguredAndAvailable,
  listOpenCodeModels,
  resetOpenCodeModelsCacheForTests,
} from "./models.js";

describe("openCode models", () => {
  afterEach(() => {
    delete process.env.CLAWDEV_OPENCODE_COMMAND;
    resetOpenCodeModelsCacheForTests();
  });

  it("returns an empty list when discovery command is unavailable", async () => {
    process.env.CLAWDEV_OPENCODE_COMMAND = "__clawdev_missing_opencode_command__";
    await expect(listOpenCodeModels()).resolves.toEqual([]);
  });

  it("rejects when model is missing", async () => {
    await expect(
      ensureOpenCodeModelConfiguredAndAvailable({ model: "" }),
    ).rejects.toThrow("OpenCode requires `adapterConfig.model`");
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.CLAWDEV_OPENCODE_COMMAND = "__clawdev_missing_opencode_command__";
    await expect(
      ensureOpenCodeModelConfiguredAndAvailable({
        model: "openai/gpt-5",
      }),
    ).rejects.toThrow("`opencode models` failed");
  });

  it("parses JSON model discovery output from the CLI", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-models-"));
    const binDir = path.join(root, "bin");
    await fs.mkdir(binDir, { recursive: true });
    const commandPath = path.join(binDir, "opencode");
    await fs.writeFile(
      commandPath,
      `#!/usr/bin/env node
if (process.argv.includes("models")) {
  console.log(JSON.stringify([{ provider: "openrouter", model: "anthropic/claude-4", label: "Claude 4" }]));
  process.exit(0);
}
process.exit(1);
`,
      "utf8",
    );
    await fs.chmod(commandPath, 0o755);

    const models = await discoverOpenCodeModels({
      command: "opencode",
      cwd: root,
      env: { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    });
    expect(models).toEqual([
      expect.objectContaining({
        id: "anthropic/claude-4",
        label: "Claude 4",
        provider: "openrouter",
        status: "available",
      }),
    ]);

    await fs.rm(root, { recursive: true, force: true });
  });

  it("parses providerID/modelID JSON fields", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-models-json-"));
    const binDir = path.join(root, "bin");
    await fs.mkdir(binDir, { recursive: true });
    const commandPath = path.join(binDir, "opencode");
    await fs.writeFile(
      commandPath,
      `#!/usr/bin/env node
if (process.argv.includes("models")) {
  console.log(JSON.stringify({
    models: [
      { providerID: "openrouter", modelID: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { providerId: "groq", modelId: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", status: "available" }
    ]
  }));
  process.exit(0);
}
process.exit(1);
`,
      "utf8",
    );
    await fs.chmod(commandPath, 0o755);

    const models = await discoverOpenCodeModels({
      command: "opencode",
      cwd: root,
      env: { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    });

    expect(models).toEqual([
      expect.objectContaining({
        id: "anthropic/claude-sonnet-4-5",
        label: "Claude Sonnet 4.5",
        provider: "openrouter",
        status: "available",
      }),
      expect.objectContaining({
        id: "groq/llama-3.3-70b-versatile",
        label: "Llama 3.3 70B Versatile",
        provider: "groq",
        status: "available",
      }),
    ]);

    await fs.rm(root, { recursive: true, force: true });
  });

  it("parses table-style discovery output", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-models-table-"));
    const binDir = path.join(root, "bin");
    await fs.mkdir(binDir, { recursive: true });
    const commandPath = path.join(binDir, "opencode");
    await fs.writeFile(
      commandPath,
      `#!/usr/bin/env node
if (process.argv.includes("models")) {
  console.log("provider   model");
  console.log("openrouter anthropic/claude-sonnet-4-5");
  console.log("groq       llama-3.3-70b-versatile");
  process.exit(0);
}
process.exit(1);
`,
      "utf8",
    );
    await fs.chmod(commandPath, 0o755);

    const models = await discoverOpenCodeModels({
      command: "opencode",
      cwd: root,
      env: { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}` },
    });

    expect(models).toEqual([
      expect.objectContaining({
        id: "anthropic/claude-sonnet-4-5",
        provider: "openrouter",
        status: "available",
      }),
      expect.objectContaining({
        id: "groq/llama-3.3-70b-versatile",
        provider: "groq",
        status: "available",
      }),
    ]);

    await fs.rm(root, { recursive: true, force: true });
  });
});
