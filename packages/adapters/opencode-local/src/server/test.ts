import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@clawdev/adapter-utils";
import {
  asBoolean,
  asString,
  asStringArray,
  parseObject,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";
import { PROBE_PROMPT } from "@clawdev/adapter-utils";
import { discoverOpenCodeModels, ensureOpenCodeModelConfiguredAndAvailable } from "./models.js";
import { parseOpenCodeJsonl } from "./parse.js";
import { prepareOpenCodeRuntimeConfig } from "./runtime-config.js";

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

function summarizeProbeDetail(stdout: string, stderr: string, parsedError: string | null): string | null {
  const raw = parsedError?.trim() || firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

function parseOpenCodeHelpCommands(stdout: string, stderr: string): string[] {
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
    if (inCommands && /^Options:$/i.test(line)) break;
    if (!inCommands) continue;
    const match = line.match(/^opencode\s+([a-z][a-z0-9-]+)/i);
    if (!match) continue;
    const name = match[1]!.toLowerCase();
    if (!commands.includes(name)) commands.push(name);
  }
  return commands;
}

function normalizeEnv(input: unknown): Record<string, string> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

const OPENCODE_AUTH_REQUIRED_RE =
  /(?:auth(?:entication)?\s+required|api\s*key|invalid\s*api\s*key|not\s+logged\s+in|opencode\s+auth\s+login|free\s+usage\s+exceeded)/i;

const OPENCODE_MODEL_UNAVAILABLE_RE =
  /ProviderModelNotFoundError|model\s+not\s+found|unknown\s+model|unsupported\s+model/i;

function isPingPongProbeSuccessful(summary: string, stdout: string, stderr: string): boolean {
  return /\bPONG\b/i.test(`${summary}\n${stdout}\n${stderr}`);
}

function buildModelProbeCheck(
  modelId: string,
  probe: {
    timedOut: boolean;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    errorMessage: string | null;
  },
): AdapterEnvironmentCheck {
  const evidence = `${probe.errorMessage ?? ""}\n${probe.stdout}\n${probe.stderr}`.trim();
  const detail = summarizeProbeDetail(probe.stdout, probe.stderr, probe.errorMessage);

  if (probe.timedOut) {
    return {
      code: "opencode_model_probe_timed_out",
      level: "warn",
      message: `OpenCode probe timed out for model ${modelId}.`,
      ...(detail ? { detail } : {}),
      hint: "Retry the probe. If this persists, run OpenCode manually for this model in the same working directory.",
    };
  }

  if ((probe.exitCode ?? 1) === 0 && !probe.errorMessage && isPingPongProbeSuccessful(probe.stdout, probe.stdout, probe.stderr)) {
    return {
      code: "opencode_model_probe_passed",
      level: "info",
      message: `OpenCode model probe passed: ${modelId}`,
      ...(detail ? { detail } : {}),
    };
  }

  if (/ProviderModelNotFoundError/i.test(evidence) || OPENCODE_MODEL_UNAVAILABLE_RE.test(evidence)) {
    return {
      code: "opencode_model_probe_unavailable",
      level: "warn",
      message: `OpenCode model unavailable: ${modelId}`,
      ...(detail ? { detail } : {}),
      hint: "Run `opencode models` and choose an available provider/model ID.",
    };
  }

  if (OPENCODE_AUTH_REQUIRED_RE.test(evidence)) {
    return {
      code: "opencode_model_probe_auth_required",
      level: "warn",
      message: `OpenCode auth required for model ${modelId}.`,
      ...(detail ? { detail } : {}),
      hint: "Run `opencode auth login` or set provider credentials, then retry the probe.",
    };
  }

  return {
    code: "opencode_model_probe_failed",
    level: "error",
    message: `OpenCode model probe failed for ${modelId}.`,
    ...(detail ? { detail } : {}),
    hint: "Run `opencode run --format json` manually for this model with the PING/PONG prompt to debug.",
  };
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "opencode");
  const cwd = asString(config.cwd, process.cwd());

  try {
    await ensureAbsoluteDirectory(cwd, { createIfMissing: false });
    checks.push({
      code: "opencode_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "opencode_cwd_invalid",
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

  const openaiKeyOverride = "OPENAI_API_KEY" in envConfig ? asString(envConfig.OPENAI_API_KEY, "") : null;
  if (openaiKeyOverride !== null && openaiKeyOverride.trim() === "") {
    checks.push({
      code: "opencode_openai_api_key_missing",
      level: "warn",
      message: "OPENAI_API_KEY override is empty.",
      hint: "The OPENAI_API_KEY override is empty. Set a valid key or remove the override.",
    });
  }

  // Prevent OpenCode from writing an opencode.json into the working directory.
  env.OPENCODE_DISABLE_PROJECT_CONFIG = "true";
  const preparedRuntimeConfig = await prepareOpenCodeRuntimeConfig({ env, config });
  if (asBoolean(config.dangerouslySkipPermissions, true)) {
    checks.push({
      code: "opencode_headless_permissions_enabled",
      level: "info",
      message: "Headless OpenCode external-directory permissions are auto-approved for unattended runs.",
    });
  }
  try {
    const runtimeEnv = normalizeEnv(ensurePathInEnv({ ...process.env, ...preparedRuntimeConfig.env }));

    const cwdInvalid = checks.some((check) => check.code === "opencode_cwd_invalid");
    if (cwdInvalid) {
      checks.push({
        code: "opencode_command_skipped",
        level: "warn",
        message: "Skipped command check because working directory validation failed.",
        detail: command,
      });
    } else {
      try {
        await ensureCommandResolvable(command, cwd, runtimeEnv);
        checks.push({
          code: "opencode_command_resolvable",
          level: "info",
          message: `Command is executable: ${command}`,
        });
      } catch (err) {
        checks.push({
          code: "opencode_command_unresolvable",
          level: "error",
          message: err instanceof Error ? err.message : "Command is not executable",
          detail: command,
        });
      }
    }

    const canRunProbe =
      checks.every((check) => check.code !== "opencode_cwd_invalid" && check.code !== "opencode_command_unresolvable");

    const configuredModel = asString(config.model, "").trim();
    let discoveredModels: Awaited<ReturnType<typeof discoverOpenCodeModels>> = [];

    if (canRunProbe) {
      try {
        const helpResult = await runChildProcess(
          `opencode-help-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          ["--help"],
          {
            cwd,
            env: runtimeEnv,
            timeoutSec: 10,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        const helpCommands = parseOpenCodeHelpCommands(helpResult.stdout, helpResult.stderr);
        if (helpCommands.length > 0) {
          checks.push({
            code: "opencode_command_surface",
            level: "info",
            message: "OpenCode CLI command surface detected",
            detail: helpCommands.join(", "),
          });
        }
      } catch {
        // Help probe failed — skip silently
      }
    }

    if (canRunProbe) {
      try {
        discoveredModels = await discoverOpenCodeModels({ command, cwd, env: runtimeEnv });
        if (discoveredModels.length > 0) {
          checks.push({
            code: "opencode_models_discovered",
            level: "info",
            message: `Discovered ${discoveredModels.length} model(s) from OpenCode providers.`,
            detail: discoveredModels.slice(0, 10).map((entry) => entry.id).join(", ") + (discoveredModels.length > 10 ? ", ..." : ""),
          });
        } else {
          checks.push({
            code: "opencode_models_empty",
            level: "error",
            message: "OpenCode returned no models.",
            hint: "Run `opencode models` and verify provider authentication.",
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (/ProviderModelNotFoundError/i.test(errMsg)) {
          checks.push({
            code: "opencode_hello_probe_model_unavailable",
            level: "warn",
            message: "The configured model was not found by the provider.",
            detail: errMsg,
            hint: "Run `opencode models` and choose an available provider/model ID.",
          });
        } else {
          checks.push({
            code: "opencode_models_discovery_failed",
            level: "error",
            message: errMsg || "OpenCode model discovery failed.",
            hint: "Run `opencode models` manually to verify provider auth and config.",
          });
        }
      }
    }

    const modelUnavailable = checks.some((check) => check.code === "opencode_hello_probe_model_unavailable");
    if (!configuredModel && !modelUnavailable) {
      // No model configured – skip model requirement if no model-related checks exist
    } else if (configuredModel && canRunProbe) {
      try {
        await ensureOpenCodeModelConfiguredAndAvailable({
          model: configuredModel,
          command,
          cwd,
          env: runtimeEnv,
        });
        checks.push({
          code: "opencode_model_configured",
          level: "info",
          message: `Configured model: ${configuredModel}`,
        });
      } catch (err) {
        checks.push({
          code: "opencode_model_invalid",
          level: "error",
          message: err instanceof Error ? err.message : "Configured model is unavailable.",
          hint: "Run `opencode models` and choose a currently available provider/model ID.",
        });
      }
    }

    const probeOpenCodeModel = async (modelId: string) => {
      const extraArgs = (() => {
        const fromExtraArgs = asStringArray(config.extraArgs);
        if (fromExtraArgs.length > 0) return fromExtraArgs;
        return asStringArray(config.args);
      })();
      const variant = asString(config.variant, "").trim();
      const args = ["run", "--format", "json", "--model", modelId];
      if (variant) args.push("--variant", variant);
      if (extraArgs.length > 0) args.push(...extraArgs);

      const probe = await runChildProcess(
        `opencode-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        command,
        args,
        {
          cwd,
          env: runtimeEnv,
          timeoutSec: 60,
          graceSec: 5,
          stdin: PROBE_PROMPT,
          onLog: async () => {},
        },
      );

      const parsed = parseOpenCodeJsonl(probe.stdout);
      return buildModelProbeCheck(modelId, {
        timedOut: probe.timedOut,
        exitCode: probe.exitCode,
        stdout: probe.stdout,
        stderr: `${probe.stderr}\n${parsed.errorMessage ?? ""}`.trim(),
        errorMessage: parsed.errorMessage,
      });
    };

    if (canRunProbe && discoveredModels.length > 0) {
      const modelsToProbe = configuredModel
        ? discoveredModels.filter((entry) => entry.id === configuredModel)
        : discoveredModels;

      for (const discoveredModel of modelsToProbe) {
        try {
          checks.push(await probeOpenCodeModel(discoveredModel.id));
        } catch (err) {
          checks.push({
            code: "opencode_model_probe_failed",
            level: "error",
            message: `OpenCode model probe failed for ${discoveredModel.id}.`,
            detail: err instanceof Error ? err.message : String(err),
            hint: "Run `opencode run --format json --model <provider/model>` manually with the PING/PONG question to debug.",
          });
        }
      }
    } else if (canRunProbe && configuredModel) {
      try {
        checks.push(await probeOpenCodeModel(configuredModel));
      } catch (err) {
        checks.push({
          code: "opencode_model_probe_failed",
          level: "error",
          message: `OpenCode model probe failed for ${configuredModel}.`,
          detail: err instanceof Error ? err.message : String(err),
          hint: "Run `opencode run --format json --model <provider/model>` manually with the PING/PONG question to debug.",
        });
      }
    }
    // ── Version check ──
    if (canRunProbe) {
      try {
        const versionResult = await runChildProcess(
          `opencode-version-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          ["--version"],
          {
            cwd,
            env: runtimeEnv,
            timeoutSec: 15,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        const versionLine = firstNonEmptyLine(versionResult.stdout) || firstNonEmptyLine(versionResult.stderr);
        if ((versionResult.exitCode ?? 1) === 0 && versionLine) {
          checks.push({
            code: "opencode_version",
            level: "info",
            message: `OpenCode version: ${versionLine}`,
            detail: versionLine,
          });
        } else {
          checks.push({
            code: "opencode_version_unknown",
            level: "warn",
            message: "Could not determine OpenCode version.",
            detail: versionLine || undefined,
          });
        }
      } catch (err) {
        checks.push({
          code: "opencode_version_failed",
          level: "warn",
          message: "Failed to probe OpenCode version.",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Auth / Providers check ──
    if (canRunProbe) {
      try {
        const providersResult = await runChildProcess(
          `opencode-providers-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          ["providers", "list"],
          {
            cwd,
            env: runtimeEnv,
            timeoutSec: 15,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        const providerOutput = providersResult.stdout + "\n" + providersResult.stderr;
        const credentialsMatch = providerOutput.match(/(\d+)\s+credential/i);
        const credentialCount = credentialsMatch ? parseInt(credentialsMatch[1], 10) : null;

        if ((providersResult.exitCode ?? 1) === 0 && credentialCount !== null) {
          checks.push({
            code: "opencode_auth_credentials",
            level: credentialCount > 0 ? "info" : "warn",
            message: credentialCount > 0
              ? `${credentialCount} credential(s) configured.`
              : "No credentials configured.",
            detail: `${credentialCount} credential(s)`,
            ...(credentialCount === 0
              ? { hint: "Run `opencode auth login` to configure provider credentials." }
              : {}),
          });
        } else {
          checks.push({
            code: "opencode_auth_credentials_unknown",
            level: "warn",
            message: "Could not determine configured credentials.",
            detail: firstNonEmptyLine(providersResult.stderr) || firstNonEmptyLine(providersResult.stdout) || undefined,
          });
        }
      } catch (err) {
        checks.push({
          code: "opencode_auth_credentials_failed",
          level: "warn",
          message: "Failed to probe OpenCode provider credentials.",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Available models check ──
    if (canRunProbe) {
      try {
        const modelsResult = await runChildProcess(
          `opencode-models-probe-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          ["models"],
          {
            cwd,
            env: runtimeEnv,
            timeoutSec: 20,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        if ((modelsResult.exitCode ?? 1) === 0) {
          const modelLines = modelsResult.stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && l.includes("/"));
          checks.push({
            code: "opencode_available_models",
            level: modelLines.length > 0 ? "info" : "warn",
            message: modelLines.length > 0
              ? `${modelLines.length} model(s) available.`
              : "No models available from OpenCode.",
            detail: modelLines.length > 0
              ? modelLines.slice(0, 10).join(", ") + (modelLines.length > 10 ? ", ..." : "")
              : undefined,
            ...(modelLines.length === 0
              ? { hint: "Verify provider credentials and run `opencode models` manually." }
              : {}),
          });
        } else {
          checks.push({
            code: "opencode_available_models_failed",
            level: "warn",
            message: "Could not list available models.",
            detail: firstNonEmptyLine(modelsResult.stderr) || firstNonEmptyLine(modelsResult.stdout) || undefined,
          });
        }
      } catch (err) {
        checks.push({
          code: "opencode_available_models_failed",
          level: "warn",
          message: "Failed to probe available models.",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // ── Agents check ──
    if (canRunProbe) {
      try {
        const agentsResult = await runChildProcess(
          `opencode-agents-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          command,
          ["agent", "list"],
          {
            cwd,
            env: runtimeEnv,
            timeoutSec: 15,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        if ((agentsResult.exitCode ?? 1) === 0) {
          const agentLines = agentsResult.stdout
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          checks.push({
            code: "opencode_agents",
            level: "info",
            message: agentLines.length > 0
              ? `${agentLines.length} agent(s) available.`
              : "No agents reported by OpenCode.",
            detail: agentLines.length > 0
              ? agentLines.slice(0, 10).join(", ") + (agentLines.length > 10 ? ", ..." : "")
              : undefined,
          });
        } else {
          checks.push({
            code: "opencode_agents_failed",
            level: "warn",
            message: "Could not list OpenCode agents.",
            detail: firstNonEmptyLine(agentsResult.stderr) || firstNonEmptyLine(agentsResult.stdout) || undefined,
          });
        }
      } catch (err) {
        checks.push({
          code: "opencode_agents_failed",
          level: "warn",
          message: "Failed to probe OpenCode agents.",
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    await preparedRuntimeConfig.cleanup();
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
