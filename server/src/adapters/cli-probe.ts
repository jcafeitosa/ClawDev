/**
 * Shared CLI model probing utility.
 *
 * Each adapter CLI has a different way to test model availability.
 * This module provides a generic probe function and adapter-specific
 * probe configurations.
 */

import type { AdapterModel, AdapterModelStatus } from "./types.js";
import { runChildProcess, defaultPathForPlatform } from "@clawdev/adapter-utils/server-utils";
import { normalizeClaudeModelArg } from "@clawdev/adapter-claude-local/server";
import { PROBE_PROMPT, classifyProbeOutput } from "@clawdev/adapter-utils";

const PROBE_TIMEOUT_SEC = 30;
const PROBE_CONCURRENCY = 3;

/**
 * Build a PATH that combines the default system paths with the current
 * process PATH. This ensures CLI tools in /opt/homebrew/bin, ~/.local/bin,
 * etc. are discoverable even when the server runs under a restricted
 * runtime PATH (e.g. Bun).
 */
function probeEnv(): Record<string, string> {
  const processPath = process.env.PATH ?? "";
  const defaultPath = defaultPathForPlatform();
  const homeBin = process.env.HOME ? `${process.env.HOME}/.local/bin:${process.env.HOME}/.bun/bin` : "";
  const parts = new Set([...processPath.split(":"), ...defaultPath.split(":"), ...homeBin.split(":")].filter(Boolean));
  return { PATH: [...parts].join(":") };
}

interface ProbeResult {
  status: AdapterModelStatus;
  statusDetail: string;
}

interface CliProbeConfig {
  /** CLI command name (e.g. "claude", "gemini", "cursor-agent") */
  command: string;
  /** Build CLI args for probing a specific model */
  buildArgs: (modelId: string) => string[];
  /** Optional stdin to send to the process */
  stdin?: string;
  /** Parse the combined output to determine status */
  parseOutput: (combined: string, exitCode: number | null) => ProbeResult;
}

// ── Shared output parser helpers ─────────────────────────────────────────

function defaultParseOutput(combined: string, exitCode: number | null): ProbeResult {
  const classified = classifyProbeOutput(combined, exitCode);
  return { status: classified.status, statusDetail: classified.statusDetail };
}

// ── Adapter-specific probe configs ───────────────────────────────────────

export const PROBE_CONFIGS: Record<string, CliProbeConfig> = {
  claude_local: {
    command: "claude",
    buildArgs: (modelId) => {
      const normalizedModel = normalizeClaudeModelArg(modelId);
      return normalizedModel
        ? ["-p", PROBE_PROMPT, "--model", normalizedModel, "--output-format", "json", "--max-turns", "1"]
        : ["-p", PROBE_PROMPT, "--output-format", "json", "--max-turns", "1"];
    },
    parseOutput(combined, exitCode) {
      if (combined.includes("\"status\":401") || combined.includes("Unauthorized")) {
        return { status: "auth_required", statusDetail: "Auth required" };
      }
      if (combined.includes("no quota") || combined.includes("\"status\":402") || combined.includes("over_limit")) {
        return { status: "quota_exceeded", statusDetail: "Quota exceeded" };
      }
      if (combined.includes("not supported") || combined.includes("invalid_model") || combined.includes("\"status\":404")) {
        return { status: "unavailable", statusDetail: "Model not supported" };
      }
      // Check for PONG response first (real ping/pong test)
      const hasPong = /pong/i.test(combined);
      if (hasPong) {
        return { status: "available", statusDetail: "PONG received — model operational" };
      }
      const classified = classifyProbeOutput(combined, exitCode);
      return { status: classified.status, statusDetail: classified.statusDetail };
    },
  },

  gemini_local: {
    command: "gemini",
    buildArgs: (modelId) => ["-p", PROBE_PROMPT, "--model", modelId, "--sandbox", "false"],
    parseOutput: defaultParseOutput,
  },

  cursor: {
    command: "cursor-agent",
    buildArgs: (modelId) => ["-p", PROBE_PROMPT, "--model", modelId],
    parseOutput: defaultParseOutput,
  },

  opencode_local: {
    command: "opencode",
    buildArgs: (modelId) => ["-p", PROBE_PROMPT, "--model", modelId],
    parseOutput: defaultParseOutput,
  },

  pi_local: {
    command: "pi",
    buildArgs: (modelId) => ["-p", PROBE_PROMPT, "--model", modelId],
    parseOutput: defaultParseOutput,
  },
};

// ── Core probe function ──────────────────────────────────────────────────

async function probeModel(config: CliProbeConfig, modelId: string): Promise<ProbeResult> {
  try {
    const proc = await runChildProcess(
      `probe-${config.command}-${modelId}-${Date.now()}`,
      config.command,
      config.buildArgs(modelId),
      {
        cwd: process.cwd(),
        env: probeEnv(),
        stdin: config.stdin ?? "",
        timeoutSec: PROBE_TIMEOUT_SEC,
        graceSec: 2,
        onLog: async () => {},
      },
    );
    const combined = proc.stderr + proc.stdout;
    return config.parseOutput(combined, proc.exitCode);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout") || message.includes("TIMEOUT") || message.includes("timed out")) {
      return { status: "unknown", statusDetail: "Probe timed out" };
    }
    if (message.includes("ENOENT") || message.includes("not found")) {
      return { status: "unavailable", statusDetail: "CLI not installed" };
    }
    return { status: "unknown", statusDetail: message.slice(0, 200) };
  }
}

/**
 * Probe a list of models using the appropriate CLI for the given adapter type.
 * Returns models with updated status fields.
 *
 * Only probes a sample of models (first N) to avoid long discovery times.
 * Probed models get real status; unprobed models inherit the result of
 * the first successful probe (if the CLI works, all listed models likely work).
 */
export async function probeAdapterModels(
  adapterType: string,
  models: AdapterModel[],
): Promise<AdapterModel[]> {
  const config = PROBE_CONFIGS[adapterType];
  if (!config || models.length === 0) return models;

  // Probe ALL models — each model gets a real PING/PONG test
  const allIds = models.map((m) => m.id);

  const probeResults = new Map<string, ProbeResult>();
  for (let i = 0; i < allIds.length; i += PROBE_CONCURRENCY) {
    const batch = allIds.slice(i, i + PROBE_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (id) => ({ id, result: await probeModel(config, id) })),
    );
    for (const entry of settled) {
      if (entry.status === "fulfilled") {
        probeResults.set(entry.value.id, entry.value.result);
      }
    }
  }

  // If any probe reports CLI not installed, mark all as unavailable
  const cliNotInstalled = [...probeResults.values()].some(
    (r) => r.statusDetail === "CLI not installed",
  );

  if (cliNotInstalled) {
    const probedAt = new Date().toISOString();
    return models.map((m) => ({
      ...m,
      status: "unavailable" as AdapterModelStatus,
      statusDetail: "CLI not installed",
      probedAt,
    }));
  }

  const probedAt = new Date().toISOString();

  return models.map((m) => {
    const probe = probeResults.get(m.id);
    if (probe) {
      return { ...m, status: probe.status, statusDetail: probe.statusDetail, probedAt };
    }
    // Should not happen since we probe all models, but safe fallback
    return { ...m, status: "unknown" as AdapterModelStatus, statusDetail: "Not probed", probedAt };
  });
}
