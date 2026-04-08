import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { testEnvironment } from "@clawdev/adapter-copilot-local/server";
import { listAdapterModels } from "../adapters/index.js";

const isWindows = process.platform === "win32";

async function writeFakeCopilot(commandPath: string): Promise<void> {
  const script = isWindows
    ? [
        "@echo off",
        "set args=%*",
        "echo %args% | findstr /C:\"--version\" >nul",
        "if %errorlevel%==0 (",
        "  echo GitHub Copilot CLI 1.0.20.",
        "  exit /b 0",
        ")",
        "echo Failed to extract bundled package: Error: EPERM: operation not permitted, mkdir 'C:\\\\tmp\\\\.extracting-1.0.20' 1>&2",
        "exit /b 1",
        "",
      ].join("\r\n")
    : [
        "#!/bin/sh",
        "if printf '%s' \"$*\" | grep -q -- '--version'; then",
        "  echo 'GitHub Copilot CLI 1.0.20.'",
        "  exit 0",
        "fi",
        "echo \"Failed to extract bundled package: Error: EPERM: operation not permitted, mkdir '/tmp/.extracting-1.0.20'\" 1>&2",
        "exit 1",
        "",
      ].join("\n");
  await fs.writeFile(commandPath, script, "utf8");
  if (!isWindows) {
    await fs.chmod(commandPath, 0o755);
  }
}

async function writeFakeCopilotAuthError(commandPath: string): Promise<void> {
  const script = isWindows
    ? [
        "@echo off",
        "set args=%*",
        "echo %args% | findstr /C:\"--version\" >nul",
        "if %errorlevel%==0 (",
        "  echo GitHub Copilot CLI 1.0.20.",
        "  exit /b 0",
        ")",
        "echo Unauthorized: auth required 1>&2",
        "exit /b 1",
        "",
      ].join("\r\n")
    : [
        "#!/bin/sh",
        "if printf '%s' \"$*\" | grep -q -- '--version'; then",
        "  echo 'GitHub Copilot CLI 1.0.20.'",
        "  exit 0",
        "fi",
        "echo 'Unauthorized: auth required' 1>&2",
        "exit 1",
        "",
      ].join("\n");
  await fs.writeFile(commandPath, script, "utf8");
  if (!isWindows) {
    await fs.chmod(commandPath, 0o755);
  }
}

async function writeFakeCopilotQuotaError(commandPath: string): Promise<void> {
  const script = isWindows
    ? [
        "@echo off",
        "set args=%*",
        "echo %args% | findstr /C:\"--version\" >nul",
        "if %errorlevel%==0 (",
        "  echo GitHub Copilot CLI 1.0.20.",
        "  exit /b 0",
        ")",
        "echo no quota remaining 1>&2",
        "exit /b 1",
        "",
      ].join("\r\n")
    : [
        "#!/bin/sh",
        "if printf '%s' \"$*\" | grep -q -- '--version'; then",
        "  echo 'GitHub Copilot CLI 1.0.20.'",
        "  exit 0",
        "fi",
        "echo 'no quota remaining' 1>&2",
        "exit 1",
        "",
      ].join("\n");
  await fs.writeFile(commandPath, script, "utf8");
  if (!isWindows) {
    await fs.chmod(commandPath, 0o755);
  }
}

describe("copilot_local environment diagnostics", () => {
  it("reports runtime extract failure with actionable check", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-copilot-env-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, isWindows ? "copilot.cmd" : "copilot");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeCopilot(commandPath);
    try {
      const result = await testEnvironment({
        companyId: "company-1",
        adapterType: "copilot_local",
        config: {
          command: commandPath,
          cwd: workspace,
          model: "gpt-5-mini",
        },
      });
      expect(result.status).toBe("fail");
      expect(result.checks.some((check) => check.code === "copilot_runtime_extract_failed")).toBe(true);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("marks models unavailable when runtime extraction fails", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-copilot-models-"));
    const binDir = path.join(root, "bin");
    const commandPath = path.join(binDir, isWindows ? "copilot.cmd" : "copilot");
    await fs.mkdir(binDir, { recursive: true });
    await writeFakeCopilot(commandPath);

    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ""}`;
    try {
      const models = await listAdapterModels("copilot_local");
      expect(models.length).toBeGreaterThan(0);
      const gpt5Mini = models.find((model) => model.id === "gpt-5-mini");
      expect(gpt5Mini).toBeDefined();
      expect(gpt5Mini?.status).toBe("unavailable");
      expect(gpt5Mini?.statusDetail).toContain("runtime extraction failed");
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("marks models auth_required when CLI reports auth error", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-copilot-auth-"));
    const binDir = path.join(root, "bin");
    const commandPath = path.join(binDir, isWindows ? "copilot.cmd" : "copilot");
    await fs.mkdir(binDir, { recursive: true });
    await writeFakeCopilotAuthError(commandPath);

    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ""}`;
    try {
      const models = await listAdapterModels("copilot_local");
      const gpt5Mini = models.find((model) => model.id === "gpt-5-mini");
      expect(gpt5Mini).toBeDefined();
      expect(gpt5Mini?.status).toBe("auth_required");
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("marks models quota_exceeded when CLI reports quota exhaustion", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-copilot-quota-"));
    const binDir = path.join(root, "bin");
    const commandPath = path.join(binDir, isWindows ? "copilot.cmd" : "copilot");
    await fs.mkdir(binDir, { recursive: true });
    await writeFakeCopilotQuotaError(commandPath);

    const previousPath = process.env.PATH;
    process.env.PATH = `${binDir}${path.delimiter}${previousPath ?? ""}`;
    try {
      const models = await listAdapterModels("copilot_local");
      const gpt5Mini = models.find((model) => model.id === "gpt-5-mini");
      expect(gpt5Mini).toBeDefined();
      expect(gpt5Mini?.status).toBe("quota_exceeded");
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

