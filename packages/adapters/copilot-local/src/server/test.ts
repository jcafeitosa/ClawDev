import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@clawdev/adapter-utils";
import {
  asString,
  asBoolean,
  asNumber,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import path from "node:path";
import { detectCopilotLoginRequired, parseCopilotJsonOutput } from "./parse.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function summarizeProbeDetail(stdout: string, stderr: string): string | null {
  const raw = firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
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

  // Copilot uses GitHub auth (gh auth); check for GITHUB_TOKEN as an override
  const configGhToken = env.GITHUB_TOKEN;
  const hostGhToken = process.env.GITHUB_TOKEN;
  if (isNonEmpty(configGhToken) || isNonEmpty(hostGhToken)) {
    const source = isNonEmpty(configGhToken) ? "adapter config env" : "server environment";
    checks.push({
      code: "copilot_github_token_present",
      level: "info",
      message: "GITHUB_TOKEN is set. Copilot will use token-based auth.",
      detail: `Detected in ${source}.`,
    });
  } else {
    checks.push({
      code: "copilot_subscription_mode_possible",
      level: "info",
      message: "GITHUB_TOKEN is not set; GitHub Copilot subscription auth will be used if logged in.",
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "copilot_cwd_invalid" && check.code !== "copilot_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "copilot")) {
      checks.push({
        code: "copilot_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `copilot`.",
        detail: command,
        hint: "Use the `copilot` CLI command to run the automatic login and installation probe.",
      });
    } else {
      const model = asString(config.model, "").trim();
      const effort = asString(config.effort, "").trim();
      const maxTurns = asNumber(config.maxTurnsPerRun, 0);
      const allowAllTools = asBoolean(config.allowAllTools, false);
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const probePrompt = "Respond with hello.";
      const args = ["-p", probePrompt, "--output-format", "json"];
      if (allowAllTools) args.push("--allow-all-tools");
      if (model) args.push("--model", model);
      if (effort) args.push("--effort", effort);
      if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
      if (extraArgs.length > 0) args.push(...extraArgs);

      const probe = await runChildProcess(
        `copilot-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env,
          timeoutSec: 45,
          graceSec: 5,
          onLog: async () => {},
        },
      );

      const parsedStream = parseCopilotJsonOutput(probe.stdout);
      const parsed = parsedStream.resultJson;
      const loginMeta = detectCopilotLoginRequired({
        parsed,
        stdout: probe.stdout,
        stderr: probe.stderr,
      });
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "copilot_hello_probe_timed_out",
          level: "warn",
          message: "Copilot hello probe timed out.",
          hint: "Retry the probe. If this persists, verify Copilot can run from this directory manually.",
        });
      } else if (loginMeta.requiresLogin) {
        checks.push({
          code: "copilot_hello_probe_auth_required",
          level: "warn",
          message: "Copilot CLI is installed, but login is required.",
          ...(detail ? { detail } : {}),
          hint: loginMeta.loginUrl
            ? `Run \`gh auth login\` and complete sign-in at ${loginMeta.loginUrl}, then retry.`
            : "Run `gh auth login` in this environment, then retry the probe.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsedStream.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "copilot_hello_probe_passed" : "copilot_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "Copilot hello probe succeeded."
            : "Copilot probe ran but did not return `hello` as expected.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: 'Try the probe manually: `copilot -p "Respond with hello." --output-format json`',
              }),
        });
      } else {
        checks.push({
          code: "copilot_hello_probe_failed",
          level: "error",
          message: "Copilot hello probe failed.",
          ...(detail ? { detail } : {}),
          hint: 'Run `copilot -p "Respond with hello." --output-format json` manually in this directory to debug.',
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
