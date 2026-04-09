import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { testEnvironment } from "@clawdev/adapter-opencode-local/server";

describe("opencode_local environment diagnostics", () => {
  it("reports a missing working directory as an error when cwd is absolute", async () => {
    const cwd = path.join(
      os.tmpdir(),
      `clawdev-opencode-local-cwd-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      "workspace",
    );

    await fs.rm(path.dirname(cwd), { recursive: true, force: true });

    const result = await testEnvironment({
      companyId: "company-1",
      adapterType: "opencode_local",
      config: {
        command: process.execPath,
        cwd,
      },
    });

    expect(result.checks.some((check) => check.code === "opencode_cwd_invalid")).toBe(true);
    expect(result.checks.some((check) => check.level === "error")).toBe(true);
    expect(result.status).toBe("fail");
  });

  it(
    "treats an empty OPENAI_API_KEY override as missing",
    async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-env-empty-key-"));
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "sk-host-value";

    try {
      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "opencode_local",
        config: {
          command: process.execPath,
          cwd,
          env: {
            OPENAI_API_KEY: "",
          },
        },
      });

      const missingCheck = result.checks.find((check) => check.code === "opencode_openai_api_key_missing");
      expect(missingCheck).toBeTruthy();
      expect(missingCheck?.hint).toContain("empty");
    } finally {
      if (originalOpenAiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalOpenAiKey;
      }
      await fs.rm(cwd, { recursive: true, force: true });
    }
    },
    15_000,
  );

  it(
    "classifies ProviderModelNotFoundError probe output as model-unavailable warning",
    async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-env-probe-cwd-"));
    const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-env-probe-bin-"));
    const fakeOpencode = path.join(binDir, "opencode");
    const script = [
      "#!/bin/sh",
      "echo 'ProviderModelNotFoundError: ProviderModelNotFoundError' 1>&2",
      "echo 'data: { providerID: \"openai\", modelID: \"gpt-5.3-codex\", suggestions: [] }' 1>&2",
      "exit 1",
      "",
    ].join("\n");

    try {
      await fs.writeFile(fakeOpencode, script, "utf8");
      await fs.chmod(fakeOpencode, 0o755);

      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "opencode_local",
        config: {
          command: fakeOpencode,
          cwd,
        },
      });

      const modelCheck = result.checks.find((check) => check.code === "opencode_hello_probe_model_unavailable");
      expect(modelCheck).toBeTruthy();
      expect(modelCheck?.level).toBe("warn");
      expect(result.status).toBe("warn");
    } finally {
      await fs.rm(cwd, { recursive: true, force: true });
      await fs.rm(binDir, { recursive: true, force: true });
    }
    },
    15000,
  );

  it(
    "probes each discovered OpenCode model individually when no model is configured",
    async () => {
      const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-env-models-"));
      const binDir = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-opencode-env-models-bin-"));
      const fakeOpencode = path.join(binDir, "opencode");
      const script = [
        "#!/bin/sh",
        "set -eu",
        "if [ \"${1:-}\" = \"--help\" ]; then",
        "  echo 'Commands:'",
        "  echo '  opencode models'",
        "  echo '  opencode providers'",
        "  echo 'Options:'",
        "  exit 0",
        "fi",
        "if [ \"${1:-}\" = \"--version\" ]; then",
        "  echo '1.2.3'",
        "  exit 0",
        "fi",
        "if [ \"${1:-}\" = \"providers\" ] && [ \"${2:-}\" = \"list\" ]; then",
        "  echo '2 credential(s) configured.'",
        "  exit 0",
        "fi",
        "if [ \"${1:-}\" = \"models\" ]; then",
        "  echo '[{\"provider\":\"openrouter\",\"model\":\"anthropic/claude-sonnet-4-5\",\"label\":\"Claude Sonnet 4.5\"},{\"provider\":\"groq\",\"model\":\"llama-3.3-70b-versatile\",\"label\":\"Llama 3.3 70B Versatile\"}]'",
        "  exit 0",
        "fi",
        "if [ \"${1:-}\" = \"agent\" ] && [ \"${2:-}\" = \"list\" ]; then",
        "  echo 'general'",
        "  exit 0",
        "fi",
        "if [ \"${1:-}\" = \"run\" ]; then",
        "  echo 'PONG'",
        "  exit 0",
        "fi",
        "echo 'unsupported' 1>&2",
        "exit 1",
        "",
      ].join("\n");

      try {
        await fs.writeFile(fakeOpencode, script, "utf8");
        await fs.chmod(fakeOpencode, 0o755);

        const result = await testEnvironment({
          companyId: "company-1",
          adapterType: "opencode_local",
          config: {
            command: fakeOpencode,
            cwd,
          },
        });

        const probeChecks = result.checks.filter((check) => check.code === "opencode_model_probe_passed");
        expect(probeChecks).toHaveLength(2);
        expect(probeChecks.some((check) => (check.message ?? "").includes("anthropic/claude-sonnet-4-5"))).toBe(true);
        expect(probeChecks.some((check) => (check.message ?? "").includes("llama-3.3-70b-versatile"))).toBe(true);
        expect(result.status).toBe("pass");
      } finally {
        await fs.rm(cwd, { recursive: true, force: true });
        await fs.rm(binDir, { recursive: true, force: true });
      }
    },
    15_000,
  );
});
