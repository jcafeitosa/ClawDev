/**
 * Shared CLI model probing utility.
 *
 * Each adapter CLI has a different way to test model availability.
 * This module provides a generic probe function and adapter-specific
 * probe configurations.
 */

import type { AdapterModel, AdapterModelStatus } from "./types.js";
import { runChildProcess } from "@clawdev/adapter-utils/server-utils";

const PROBE_TIMEOUT_SEC = 15;
const PROBE_CONCURRENCY = 3;

interface ProbeResult {
  status: AdapterModelStatus;
  statusDetail: string;
}

interface CliProbeConfig {
  /** CLI command name (e.g. "claude", "gemini", "agent") */
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
  if (combined.includes("no quota") || combined.includes("\"status\":402")) {
    return { status: "quota_exceeded", statusDetail: "Quota exceeded" };
  }
  if (combined.includes("\"status\":401") || combined.includes("Unauthorized")) {
    return { status: "auth_required", statusDetail: "Auth required" };
  }
  if (combined.includes("not supported") || combined.includes("not available") || combined.includes("\"status\":404")) {
    return { status: "unavailable", statusDetail: "Model not supported" };
  }
  if (combined.includes("command not found") || combined.includes("ENOENT")) {
    return { status: "unavailable", statusDetail: "CLI not installed" };
  }

  // Check for success indicators
  const hasResponse =
    combined.includes("item.completed") ||
    combined.includes("turn.completed") ||
    combined.includes("assistant.") ||
    combined.includes('"result"') ||
    combined.includes('"content"') ||
    combined.includes('"text"');

  if (hasResponse || (exitCode ?? 1) === 0) {
    return { status: "available", statusDetail: "Probe succeeded" };
  }

  return { status: "unknown", statusDetail: combined.trim().slice(0, 200) || `exit code ${exitCode}` };
}

// ── Adapter-specific probe configs ───────────────────────────────────────

export const PROBE_CONFIGS: Record<string, CliProbeConfig> = {
  claude_local: {
    command: "claude",
    buildArgs: (modelId) => ["-p", "hi", "--model", modelId, "--output-format", "json", "--max-turns", "1"],
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
      // Claude outputs JSON with result field on success
      if (combined.includes('"result"') || combined.includes('"content"') || (exitCode ?? 1) === 0) {
        return { status: "available", statusDetail: "Probe succeeded" };
      }
      return { status: "unknown", statusDetail: combined.trim().slice(0, 200) || `exit code ${exitCode}` };
    },
  },

  gemini_local: {
    command: "gemini",
    buildArgs: (modelId) => ["-p", "hi", "--model", modelId, "--sandbox", "false"],
    parseOutput: defaultParseOutput,
  },

  cursor: {
    command: "agent",
    buildArgs: (modelId) => ["-p", "hi", "--model", modelId],
    parseOutput: defaultParseOutput,
  },

  opencode_local: {
    command: "opencode",
    buildArgs: (modelId) => ["-p", "hi", "--model", modelId],
    parseOutput: defaultParseOutput,
  },

  pi_local: {
    command: "pi",
    buildArgs: (modelId) => ["-p", "hi", "--model", modelId],
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
        env: {},
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

  // Probe a sample: first model + up to 2 random others
  const sampleIds = [models[0]!.id];
  if (models.length > 3) {
    const mid = Math.floor(models.length / 2);
    sampleIds.push(models[mid]!.id);
  }
  if (models.length > 6) {
    sampleIds.push(models[models.length - 1]!.id);
  }

  const probeResults = new Map<string, ProbeResult>();
  for (let i = 0; i < sampleIds.length; i += PROBE_CONCURRENCY) {
    const batch = sampleIds.slice(i, i + PROBE_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map(async (id) => ({ id, result: await probeModel(config, id) })),
    );
    for (const entry of settled) {
      if (entry.status === "fulfilled") {
        probeResults.set(entry.value.id, entry.value.result);
      }
    }
  }

  // Determine the "overall" status: if any probe succeeded, assume CLI works
  const anyAvailable = [...probeResults.values()].some((r) => r.status === "available");
  const allFailed = [...probeResults.values()].every(
    (r) => r.status === "unavailable" || r.status === "auth_required",
  );
  const cliNotInstalled = [...probeResults.values()].some(
    (r) => r.statusDetail === "CLI not installed",
  );

  // If CLI not installed, don't change any status (leave as default)
  if (cliNotInstalled) return models;

  const probedAt = new Date().toISOString();

  return models.map((m) => {
    const probe = probeResults.get(m.id);
    if (probe) {
      return { ...m, status: probe.status, statusDetail: probe.statusDetail, probedAt };
    }
    // Unprobed models: inherit overall CLI status
    if (anyAvailable) {
      return { ...m, status: "available" as AdapterModelStatus, statusDetail: "CLI available", probedAt };
    }
    if (allFailed) {
      const firstResult = [...probeResults.values()][0];
      return {
        ...m,
        status: (firstResult?.status ?? "unknown") as AdapterModelStatus,
        statusDetail: firstResult?.statusDetail ?? "Probe failed",
        probedAt,
      };
    }
    return { ...m, probedAt };
  });
}
