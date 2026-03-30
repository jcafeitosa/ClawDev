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
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

  // Probe a quick request to check quota/subscription status
  if (canRunProbe && commandLooksLike(command, "copilot")) {
    const quotaProbe = await runChildProcess(
      `copilot-quota-probe-${Date.now()}`,
      command,
      ["-p", "hi", "--model", "gpt-4.1", "--output-format", "json", "-s", "--disable-builtin-mcps"],
      {
        cwd,
        env,
        timeoutSec: 15,
        graceSec: 5,
        stdin: "",
        onLog: async () => {},
      },
    );
    const combined = quotaProbe.stdout + quotaProbe.stderr;
    if (combined.includes('"errorType":"quota"') || combined.includes("no quota")) {
      checks.push({
        code: "copilot_quota_exhausted",
        level: "warn",
        message: "Copilot quota exhausted — requests may fail until quota resets.",
        hint: "Check your GitHub Copilot subscription at https://github.com/settings/copilot",
      });
    } else if ((quotaProbe.exitCode ?? 1) === 0) {
      checks.push({
        code: "copilot_subscription_active",
        level: "info",
        message: "Copilot subscription is active and quota is available.",
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
