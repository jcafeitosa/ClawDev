import type { AdapterModel, AdapterModelStatus } from "@clawdev/adapter-utils";
import { runChildProcess } from "@clawdev/adapter-utils/server-utils";
import { BASE_MODELS, EFFORT_LEVELS } from "../index.js";

interface ProbeResult {
  status: AdapterModelStatus;
  statusDetail: string;
}

function inferProvider(modelId: string): string | undefined {
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gpt-")) return "openai";
  if (modelId.startsWith("gemini-")) return "google";
  return undefined;
}

async function probeModel(modelId: string): Promise<ProbeResult> {
  try {
    const proc = await runChildProcess(
      `copilot-probe-${modelId}-${Date.now()}`,
      "copilot",
      ["-p", "hi", "--model", modelId, "--output-format", "json", "-s", "--no-auto-update", "--disable-builtin-mcps"],
      {
        cwd: process.cwd(),
        env: {},
        stdin: "",
        timeoutSec: 8,
        graceSec: 2,
        onLog: async () => {},
      },
    );
    const combined = proc.stderr + proc.stdout;

    if (combined.includes("no quota") || combined.includes("402")) {
      return { status: "quota_exceeded", statusDetail: combined.trim() };
    }

    if (combined.includes("not available")) {
      return { status: "unavailable", statusDetail: combined.trim() };
    }

    const isAvailable = combined.includes("session.") || combined.includes("assistant.") || (proc.exitCode ?? 1) === 0;
    if (isAvailable) {
      return { status: "available", statusDetail: combined.trim() };
    }

    return { status: "unknown", statusDetail: combined.trim() || `exit code ${proc.exitCode}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout") || message.includes("TIMEOUT") || message.includes("timed out")) {
      return { status: "unknown", statusDetail: `Probe timed out: ${message}` };
    }
    return { status: "unknown", statusDetail: message };
  }
}

/**
 * Lists all Copilot models by probing each base model in parallel.
 * Returns every model with a status field indicating availability.
 * Effort variations inherit the base model's probe status.
 */
export async function listCopilotModels(): Promise<AdapterModel[]> {
  const results = await Promise.all(
    BASE_MODELS.map(async (model) => {
      const probe = await probeModel(model.id);
      const probedAt = new Date().toISOString();
      return { model, probe, probedAt };
    }),
  );

  return results.flatMap(({ model, probe, probedAt }) => {
    const provider = model.provider ?? inferProvider(model.id);
    const base: AdapterModel = {
      id: model.id,
      label: model.label,
      status: probe.status,
      statusDetail: probe.statusDetail,
      provider,
      probedAt,
    };

    const variations: AdapterModel[] = EFFORT_LEVELS.map((effort) => ({
      id: `${model.id}:${effort}`,
      label: `${model.label} (${effort})`,
      status: probe.status,
      statusDetail: probe.statusDetail,
      provider,
      probedAt,
    }));

    return [base, ...variations];
  });
}
