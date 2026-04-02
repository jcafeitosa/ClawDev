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
  parseJson,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import path from "node:path";
import { detectClaudeLoginRequired, parseClaudeStreamJson } from "./parse.js";
import { normalizeClaudeModelArg, sanitizeClaudeExtraArgs } from "./execute.js";

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
  const command = asString(config.command, "claude");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: true });
    checks.push({
      code: "claude_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "claude_cwd_invalid",
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
      code: "claude_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "claude_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const configApiKey = env.ANTHROPIC_API_KEY;
  const hostApiKey = process.env.ANTHROPIC_API_KEY;
  if (isNonEmpty(configApiKey) || isNonEmpty(hostApiKey)) {
    const source = isNonEmpty(configApiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "claude_anthropic_api_key_overrides_subscription",
      level: "warn",
      message:
        "ANTHROPIC_API_KEY is set. Claude will use API-key auth instead of subscription credentials.",
      detail: `Detected in ${source}.`,
      hint: "Unset ANTHROPIC_API_KEY if you want subscription-based Claude login behavior.",
    });
  } else {
    checks.push({
      code: "claude_subscription_mode_possible",
      level: "info",
      message: "ANTHROPIC_API_KEY is not set; subscription-based auth can be used if Claude is logged in.",
    });
  }

  const canRunProbe =
    checks.every((check) => check.code !== "claude_cwd_invalid" && check.code !== "claude_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "claude")) {
      checks.push({
        code: "claude_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `claude`.",
        detail: command,
        hint: "Use the `claude` CLI command to run the automatic login and installation probe.",
      });
    } else {
      const model = normalizeClaudeModelArg(config.model);
      const effort = asString(config.effort, "").trim();
      const chrome = asBoolean(config.chrome, false);
      const maxTurns = asNumber(config.maxTurnsPerRun, 0);
      const dangerouslySkipPermissions = asBoolean(config.dangerouslySkipPermissions, false);
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();
      const sanitizedExtraArgs = sanitizeClaudeExtraArgs(extraArgs);

      const args = ["--print", "-", "--output-format", "stream-json", "--verbose"];
      if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
      if (chrome) args.push("--chrome");
      if (model) args.push("--model", model);
      if (effort) args.push("--effort", effort);
      if (maxTurns > 0) args.push("--max-turns", String(maxTurns));
      if (sanitizedExtraArgs.length > 0) args.push(...sanitizedExtraArgs);

      const probe = await runChildProcess(
        `claude-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

      const parsedStream = parseClaudeStreamJson(probe.stdout);
      const parsed = parsedStream.resultJson;
      const loginMeta = detectClaudeLoginRequired({
        parsed,
        stdout: probe.stdout,
        stderr: probe.stderr,
      });
      const detail = summarizeProbeDetail(probe.stdout, probe.stderr);

      if (probe.timedOut) {
        checks.push({
          code: "claude_hello_probe_timed_out",
          level: "warn",
          message: "Claude hello probe timed out.",
          hint: "Retry the probe. If this persists, verify Claude can run `Respond with hello` from this directory manually.",
        });
      } else if (loginMeta.requiresLogin) {
        checks.push({
          code: "claude_hello_probe_auth_required",
          level: "warn",
          message: "Claude CLI is installed, but login is required.",
          ...(detail ? { detail } : {}),
          hint: loginMeta.loginUrl
            ? `Run \`claude login\` and complete sign-in at ${loginMeta.loginUrl}, then retry.`
            : "Run `claude login` in this environment, then retry the probe.",
        });
      } else if ((probe.exitCode ?? 1) === 0) {
        const summary = parsedStream.summary.trim();
        const hasHello = /\bhello\b/i.test(summary);
        checks.push({
          code: hasHello ? "claude_hello_probe_passed" : "claude_hello_probe_unexpected_output",
          level: hasHello ? "info" : "warn",
          message: hasHello
            ? "Claude hello probe succeeded."
            : "Claude probe ran but did not return `hello` as expected.",
          ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
          ...(hasHello
            ? {}
            : {
                hint: "Try the probe manually (`claude --print - --output-format stream-json --verbose`) and prompt `Respond with hello`.",
              }),
        });
      } else {
        checks.push({
          code: "claude_hello_probe_failed",
          level: "error",
          message: "Claude hello probe failed.",
          ...(detail ? { detail } : {}),
          hint: "Run `claude --print - --output-format stream-json --verbose` manually in this directory and prompt `Respond with hello` to debug.",
        });
      }
    }
  }

  // --- Auth status via `claude auth status --json` ---
  if (canRunProbe && commandLooksLike(command, "claude")) {
    try {
      const authProbe = await runChildProcess(
        `claude-auth-status-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        ["auth", "status", "--json"],
        {
          cwd,
          env,
          timeoutSec: 10,
          graceSec: 3,
          onLog: async () => {},
        },
      );

      const authJson = parseJson(authProbe.stdout.trim());
      if (authJson) {
        const loggedIn = authJson.loggedIn === true;
        const authMethod = asString(authJson.authMethod, "unknown");
        const email = asString(authJson.email, "");
        const orgName = asString(authJson.orgName, "");
        const subscriptionType = asString(authJson.subscriptionType, "");

        if (loggedIn) {
          const detailParts: string[] = [];
          if (email) detailParts.push(`email: ${email}`);
          if (orgName) detailParts.push(`org: ${orgName}`);
          if (subscriptionType) detailParts.push(`subscription: ${subscriptionType}`);

          checks.push({
            code: "claude_auth_status",
            level: "info",
            message: `Authenticated via ${authMethod}`,
            ...(detailParts.length > 0 ? { detail: detailParts.join(", ") } : {}),
          });
        } else {
          checks.push({
            code: "claude_auth_status",
            level: "warn",
            message: "Not authenticated",
            hint: "Run `claude login` to authenticate.",
          });
        }

        // --- Subscription type detection ---
        const apiKeySet = isNonEmpty(env.ANTHROPIC_API_KEY) || isNonEmpty(process.env.ANTHROPIC_API_KEY);
        if (apiKeySet) {
          checks.push({
            code: "claude_subscription_type",
            level: "info",
            message: "Using API key (ANTHROPIC_API_KEY)",
          });
        } else if (subscriptionType) {
          const subscriptionLabels: Record<string, string> = {
            max: "Claude Max subscription (unlimited)",
            pro: "Claude Pro subscription",
            free: "Claude Free tier",
            api: "API key authentication",
          };
          const label = subscriptionLabels[subscriptionType] ?? `Subscription: ${subscriptionType}`;
          checks.push({
            code: "claude_subscription_type",
            level: "info",
            message: label,
          });
        }
      }
    } catch {
      // Auth status probe failed — skip silently
    }
  }

  // --- Claude Code version (enhanced detail) ---
  if (canRunProbe && commandLooksLike(command, "claude")) {
    try {
      const versionProbe = await runChildProcess(
        `claude-version-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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

      const versionString = firstNonEmptyLine(versionProbe.stdout) || firstNonEmptyLine(versionProbe.stderr);
      if (versionString) {
        checks.push({
          code: "claude_version",
          level: "info",
          message: "Claude Code version detected",
          detail: versionString,
        });
      }
    } catch {
      // Version probe failed — skip silently
    }
  }

  // --- Available agents check ---
  if (canRunProbe && commandLooksLike(command, "claude")) {
    try {
      const agentsProbe = await runChildProcess(
        `claude-agents-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        ["agents"],
        {
          cwd,
          env,
          timeoutSec: 10,
          graceSec: 3,
          onLog: async () => {},
        },
      );

      const combined = (agentsProbe.stdout + "\n" + agentsProbe.stderr).trim();
      const agentLines = combined
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const agentCount = agentLines.length;

      if (agentCount > 0) {
        checks.push({
          code: "claude_agents_available",
          level: "info",
          message: `${agentCount} agent${agentCount === 1 ? "" : "s"} available`,
          detail: agentLines.slice(0, 10).join(", ") + (agentCount > 10 ? `, ... (+${agentCount - 10} more)` : ""),
        });
      } else {
        checks.push({
          code: "claude_agents_available",
          level: "info",
          message: "No agents detected",
        });
      }
    } catch {
      // Agents probe failed — skip silently
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
