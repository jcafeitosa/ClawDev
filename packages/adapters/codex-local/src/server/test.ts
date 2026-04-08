import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@clawdev/adapter-utils";
import {
  asString,
  asBoolean,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import fs from "fs/promises";
import path from "path";
import { parseCodexJsonl } from "./parse.js";
import { codexHomeDir, readCodexAuthInfo } from "./quota.js";

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

function summarizeProbeDetail(stdout: string, stderr: string, parsedError: string | null): string | null {
  const raw = parsedError?.trim() || firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function parseCodexHelpCommands(stdout: string, stderr: string): string[] {
  const text = `${stdout}\n${stderr}`;
  const commands: string[] = [];
  let inCommands = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^Commands:$/i.test(line)) {
      inCommands = true;
      continue;
    }
    if (inCommands && /^[A-Z][A-Za-z0-9 -]+:/.test(line)) break;
    if (!inCommands) continue;
    const match = line.match(/^([a-z][a-z0-9-]*)\b/i);
    if (!match) continue;
    const name = match[1]!.toLowerCase();
    if (!commands.includes(name)) commands.push(name);
  }
  return commands;
}

const CODEX_AUTH_REQUIRED_RE =
  /(?:not\s+logged\s+in|login\s+required|authentication\s+required|unauthorized|invalid(?:\s+or\s+missing)?\s+api(?:[_\s-]?key)?|openai[_\s-]?api[_\s-]?key|api[_\s-]?key.*required|please\s+run\s+`?codex\s+login`?)/i;

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "codex");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "codex_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_cwd_invalid",
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
      code: "codex_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const configOpenAiKey = env.OPENAI_API_KEY;
  const hostOpenAiKey = process.env.OPENAI_API_KEY;
  if (isNonEmpty(configOpenAiKey) || isNonEmpty(hostOpenAiKey)) {
    const source = isNonEmpty(configOpenAiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "codex_openai_api_key_present",
      level: "info",
      message: "OPENAI_API_KEY is set for Codex authentication.",
      detail: `Detected in ${source}.`,
    });
  } else {
    const codexHome = isNonEmpty(env.CODEX_HOME) ? env.CODEX_HOME : undefined;
    const codexAuth = await readCodexAuthInfo(codexHome).catch(() => null);
    if (codexAuth) {
      checks.push({
        code: "codex_native_auth_present",
        level: "info",
        message: "Codex is authenticated via its own auth configuration.",
        detail: codexAuth.email ? `Logged in as ${codexAuth.email}.` : `Credentials found in ${path.join(codexHome ?? codexHomeDir(), "auth.json")}.`,
      });
    } else {
      checks.push({
        code: "codex_openai_api_key_missing",
        level: "warn",
        message: "OPENAI_API_KEY is not set. Codex runs may fail until authentication is configured.",
        hint: "Set OPENAI_API_KEY in adapter env, shell environment, or run `codex auth` to log in.",
      });
    }
  }

  const canRunProbe =
    checks.every((check) => check.code !== "codex_cwd_invalid" && check.code !== "codex_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "codex")) {
      checks.push({
        code: "codex_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `codex`.",
        detail: command,
        hint: "Use the `codex` CLI command to run the automatic login and installation probe.",
      });
    } else {
      try {
        const helpProbe = await runChildProcess(
          `codex-help-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          ["help"],
          {
            cwd,
            env,
            timeoutSec: 10,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        const helpCommands = parseCodexHelpCommands(helpProbe.stdout, helpProbe.stderr);
        if (helpCommands.length > 0) {
          checks.push({
            code: "codex_command_surface",
            level: "info",
            message: "Codex CLI command surface detected",
            detail: helpCommands.join(", "),
          });
        }
      } catch {
        // Help probe failed — skip silently
      }

      const model = asString(config.model, "").trim();
      const modelReasoningEffort = asString(
        config.modelReasoningEffort,
        asString(config.reasoningEffort, ""),
      ).trim();
      const search = asBoolean(config.search, false);
      const bypass = asBoolean(
        config.dangerouslyBypassApprovalsAndSandbox,
        asBoolean(config.dangerouslyBypassSandbox, false),
      );
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();

      const args = ["exec", "--json"];
      if (search) args.unshift("--search");
      if (bypass) args.push("--dangerously-bypass-approvals-and-sandbox");
      if (model) args.push("--model", model);
      if (modelReasoningEffort) {
        args.push("-c", `model_reasoning_effort=${JSON.stringify(modelReasoningEffort)}`);
      }
      if (extraArgs.length > 0) args.push(...extraArgs);
      args.push("-");

      const probe = await runChildProcess(
        `codex-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env,
          timeoutSec: 45,
          graceSec: 5,
          stdin: "Respond with hello.",
          onLog: async () => {},
        },
      );
      const parsed = parseCodexJsonl(probe.stdout);
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr, parsed.errorMessage);
      const authEvidence = `${parsed.errorMessage ?? ""}\n${probe.stdout}\n${probe.stderr}`.trim();

      if (probe.timedOut) {
        checks.push({
          code: "codex_hello_probe_timed_out",
          level: "warn",
          message: "Codex hello probe timed out.",
          hint: "Retry the probe. If this persists, verify Codex can run `Respond with hello` from this directory manually.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsed.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "codex_hello_probe_passed" : "codex_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "Codex hello probe succeeded."
            : "Codex probe ran but did not return `hello` as expected.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: "Try the probe manually (`codex exec --json -` then prompt: Respond with hello) to inspect full output.",
              }),
        });
      } else if (CODEX_AUTH_REQUIRED_RE.test(authEvidence)) {
        checks.push({
          code: "codex_hello_probe_auth_required",
          level: "warn",
          message: "Codex CLI is installed, but authentication is not ready.",
          ...(detail ? { detail } : {}),
          hint: "Configure OPENAI_API_KEY in adapter env/shell or run `codex login`, then retry the probe.",
        });
      } else {
        checks.push({
          code: "codex_hello_probe_failed",
          level: "error",
          message: "Codex hello probe failed.",
          ...(detail ? { detail } : {}),
          hint: "Run `codex exec --json -` manually in this working directory and prompt `Respond with hello` to debug.",
        });
      }
    }
  }

  // --- Auth type detection ---
  const resolvedCodexHome = isNonEmpty(env.CODEX_HOME) ? env.CODEX_HOME : codexHomeDir();
  try {
    const authRaw = await fs.readFile(path.join(resolvedCodexHome, "auth.json"), "utf8");
    const authJson = JSON.parse(authRaw) as Record<string, unknown>;
    const authMode = typeof authJson.auth_mode === "string" ? authJson.auth_mode : null;
    const codexAuth = await readCodexAuthInfo(resolvedCodexHome).catch(() => null);
    const emailSuffix = codexAuth?.email ? ` (${codexAuth.email})` : "";

    if (authMode === "chatgpt") {
      checks.push({
        code: "codex_auth_mode",
        level: "info",
        message: "Authenticated via ChatGPT subscription",
        detail: `auth_mode=chatgpt${emailSuffix}`,
      });
    } else if (authMode === "api_key") {
      checks.push({
        code: "codex_auth_mode",
        level: "info",
        message: "Authenticated via API key",
        detail: `auth_mode=api_key${emailSuffix}`,
      });
    } else if (authMode) {
      checks.push({
        code: "codex_auth_mode",
        level: "info",
        message: `Auth mode: ${authMode}`,
        detail: `auth_mode=${authMode}${emailSuffix}`,
      });
    }
  } catch {
    // auth.json not readable or missing — skip auth mode detection
  }

  // --- Codex version check ---
  if (canRunProbe && commandLooksLike(command, "codex")) {
    try {
      const versionProbe = await runChildProcess(
        `codex-version-${Date.now()}`,
        command,
        ["--version"],
        {
          cwd,
          env,
          timeoutSec: 10,
          graceSec: 3,
          onLog: async () => {},
        },
      );
      const versionOutput = `${versionProbe.stdout}\n${versionProbe.stderr}`.trim();
      const versionMatch = versionOutput.match(/\d+\.\d+\.\d+/);
      if (versionMatch) {
        checks.push({
          code: "codex_version",
          level: "info",
          message: `Codex CLI version: ${versionMatch[0]}`,
        });
      }
    } catch {
      // version check is best-effort — skip on failure
    }
  }

  // --- Config info from config.toml ---
  try {
    const configRaw = await fs.readFile(path.join(resolvedCodexHome, "config.toml"), "utf8");
    const configDetails: string[] = [];

    const modelMatch = configRaw.match(/^\s*model\s*=\s*"([^"]+)"/m);
    if (modelMatch?.[1]) configDetails.push(`model=${modelMatch[1]}`);

    const personalityMatch = configRaw.match(/^\s*personality\s*=\s*"([^"]+)"/m);
    if (personalityMatch?.[1]) configDetails.push(`personality=${personalityMatch[1]}`);

    const effortMatch = configRaw.match(/^\s*model_reasoning_effort\s*=\s*"([^"]+)"/m);
    if (effortMatch?.[1]) configDetails.push(`model_reasoning_effort=${effortMatch[1]}`);

    if (configDetails.length > 0) {
      checks.push({
        code: "codex_config_info",
        level: "info",
        message: "Codex configuration detected.",
        detail: configDetails.join(", "),
      });
    }
  } catch {
    // config.toml not readable or missing — skip
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
