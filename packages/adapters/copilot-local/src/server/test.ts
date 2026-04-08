import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@clawdev/adapter-utils";
import {
  asString,
  parseObject,
  parseJson,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import { readFile } from "fs/promises";
import os from "os";
import path from "path";
import { classifyCopilotError } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "copilot");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "copilot_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "copilot_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv({ ...process.env, ...env });
  try {
    await ensureCommandResolvable(command, cwd, runtimeEnv);
    checks.push({
      code: "copilot_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "copilot_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "copilot_cwd_invalid" && check.code !== "copilot_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "copilot")) {
      checks.push({
        code: "copilot_probe_skipped_custom_command",
        level: "info",
        message: "Skipped version probe because command is not `copilot`.",
        detail: command,
      });
    } else {
      const probe = await runChildProcess(
        `copilot-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        ["--version"],
        {
          cwd,
          env,
          timeoutSec: 15,
          graceSec: 5,
          stdin: "",
          onLog: async () => {},
        },
      );

      if (probe.timedOut) {
        checks.push({
          code: "copilot_version_probe_timed_out",
          level: "warn",
          message: "Copilot version probe timed out.",
          hint: "Verify that the `copilot` CLI is installed correctly.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const versionLine = firstNonEmptyLine(probe.stdout) || firstNonEmptyLine(probe.stderr);
        checks.push({
          code: "copilot_version_probe_passed",
          level: "info",
          message: "Copilot CLI is available.",
          ...(versionLine ? { detail: versionLine.slice(0, 240) } : {}),
        });
      } else {
        const detail = firstNonEmptyLine(probe.stderr) || firstNonEmptyLine(probe.stdout);
        checks.push({
          code: "copilot_version_probe_failed",
          level: "error",
          message: "Copilot CLI version check failed.",
          ...(detail ? { detail: detail.slice(0, 240) } : {}),
          hint: "Run `copilot --version` manually to debug. Ensure GitHub Copilot CLI is installed and authenticated.",
        });
      }
    }
  }

  // Check authentication status from ~/.copilot/config.json
  try {
    const configPath = path.join(os.homedir(), ".copilot", "config.json");
    const raw = await readFile(configPath, "utf8");
    const cfg = parseJson(raw);
    if (cfg) {
      const lastUser = parseObject(cfg.last_logged_in_user ?? cfg.lastLoggedInUser);
      const login = asString(lastUser.login, "");
      const host = asString(lastUser.host, "");
      if (login) {
        checks.push({
          code: "copilot_auth_user",
          level: "info",
          message: `Authenticated as ${login}`,
          ...(host ? { detail: `Host: ${host}` } : {}),
        });
      } else {
        checks.push({
          code: "copilot_auth_missing",
          level: "warn",
          message: "No authenticated user found in Copilot config.",
          hint: "Run `copilot login` to authenticate.",
        });
      }
    }
  } catch {
    checks.push({
      code: "copilot_auth_config_missing",
      level: "warn",
      message: "Copilot config not found (~/.copilot/config.json).",
      hint: "Run `copilot login` to authenticate and create config.",
    });
  }

  // Check configured model and first-launch info from config
  try {
    const configPath = path.join(os.homedir(), ".copilot", "config.json");
    const raw = await readFile(configPath, "utf8");
    const cfg = parseJson(raw);
    if (cfg) {
      const model = asString(cfg.model, "");
      const firstLaunch = asString(cfg.firstLaunchAt, "");
      const details: string[] = [];
      if (model) details.push(`Model: ${model}`);
      if (firstLaunch) details.push(`First launch: ${firstLaunch}`);
      if (details.length > 0) {
        checks.push({
          code: "copilot_config_info",
          level: "info",
          message: "Copilot configuration loaded.",
          detail: details.join(", "),
        });
      }
    }
  } catch { /* config already checked above */ }

  // Detect BYOK (Bring Your Own Key) provider configuration
  const byokUrl = asString(envConfig.COPILOT_PROVIDER_BASE_URL, "") || process.env.COPILOT_PROVIDER_BASE_URL || "";
  if (byokUrl) {
    const byokType = asString(envConfig.COPILOT_PROVIDER_TYPE, "") || process.env.COPILOT_PROVIDER_TYPE || "openai";
    checks.push({
      code: "copilot_byok_configured",
      level: "info",
      message: `BYOK provider configured: ${byokType}`,
      detail: `Endpoint: ${byokUrl}`,
    });
  }

  // Real model test: send a PING prompt and verify the model responds
  const probeModel = asString(config.model, "gpt-4.1").split(":")[0]; // strip effort suffix
  if (canRunProbe && commandLooksLike(command, "copilot")) {
    const quotaProbe = await runChildProcess(
      `copilot-model-test-${Date.now()}`,
      command,
      ["-p", "When I say PING, you reply with only the word PONG. PING", "--model", probeModel, "--output-format", "json", "-s", "--no-auto-update", "--disable-builtin-mcps"],
      {
        cwd,
        env,
        timeoutSec: 20,
        graceSec: 5,
        stdin: "",
        onLog: async () => {},
      },
    );
    const combined = quotaProbe.stdout + quotaProbe.stderr;
    const lowerCombined = combined.toLowerCase();
    const classifiedError = classifyCopilotError(combined);
    if (classifiedError === "runtime_extract_failed") {
      checks.push({
        code: "copilot_runtime_extract_failed",
        level: "error",
        message: "Copilot runtime failed to extract bundled package (cache/permission error).",
        hint: "Clear Copilot cache and verify write permissions under ~/Library/Caches/copilot/pkg.",
      });
    } else if (classifiedError === "quota_exceeded" || lowerCombined.includes('"errortype":"quota"') || lowerCombined.includes("no quota") || lowerCombined.includes("402")) {
      checks.push({
        code: "copilot_model_no_quota",
        level: "error",
        message: `Model "${probeModel}" has no quota — requests will fail.`,
        hint: "Select a different model or check your GitHub Copilot subscription at https://github.com/settings/copilot",
      });
    } else if (classifiedError === "model_unavailable" || lowerCombined.includes("not available")) {
      checks.push({
        code: "copilot_model_unavailable",
        level: "error",
        message: `Model "${probeModel}" is not available on your Copilot plan.`,
        hint: "Select a model marked with ✅ in the model selector.",
      });
    } else if (classifiedError === "auth_required") {
      checks.push({
        code: "copilot_auth_required",
        level: "error",
        message: "Copilot authentication is required.",
        hint: "Run `copilot login` and retry the environment test.",
      });
    } else if (quotaProbe.timedOut) {
      checks.push({
        code: "copilot_model_test_timeout",
        level: "warn",
        message: `Model "${probeModel}" test timed out.`,
        hint: "The model may be slow or unresponsive. Try again.",
      });
    } else if (lowerCombined.includes("pong") || (quotaProbe.exitCode ?? 1) === 0) {
      const hasPong = lowerCombined.includes("pong");
      checks.push({
        code: "copilot_model_test_passed",
        level: "info",
        message: `Model "${probeModel}" responded successfully${hasPong ? " (PONG ✓)" : ""}.`,
      });
    } else {
      const detail = firstNonEmptyLine(quotaProbe.stderr) || firstNonEmptyLine(quotaProbe.stdout);
      checks.push({
        code: "copilot_model_test_failed",
        level: "error",
        message: `Model "${probeModel}" failed to respond.`,
        ...(detail ? { detail: detail.slice(0, 300) } : {}),
        hint: "Check if the model is available and your subscription is active.",
      });
    }

    // Check if GitHub MCP server is connected in the quota probe output
    if (combined.includes("mcp") || combined.includes("MCP")) {
      checks.push({
        code: "copilot_mcp_server_detected",
        level: "info",
        message: "GitHub MCP server connection detected in Copilot output.",
        detail: "MCP server appears to be connected.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
