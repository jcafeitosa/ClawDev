import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@clawdev/adapter-utils";
import {
  asString,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
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

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
