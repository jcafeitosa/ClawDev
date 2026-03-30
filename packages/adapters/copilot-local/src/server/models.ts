import type { AdapterModel } from "@clawdev/adapter-utils";
import { runChildProcess } from "@clawdev/adapter-utils/server-utils";
import { BASE_MODELS, EFFORT_LEVELS } from "../index.js";

async function probeModel(modelId: string): Promise<boolean> {
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
    if (combined.includes("not available")) return false;
    return combined.includes("session.") || combined.includes("assistant.") || (proc.exitCode ?? 1) === 0;
  } catch {
    return false;
  }
}

/**
 * Lists available Copilot models by probing each base model in parallel.
 * Returns confirmed models with all effort level variations.
 */
export async function listCopilotModels(): Promise<AdapterModel[]> {
  const results = await Promise.all(
    BASE_MODELS.map(async (model) => {
      const available = await probeModel(model.id);
      return available ? model : null;
    }),
  );

  const available = results.filter((m): m is AdapterModel => m !== null);

  return available.flatMap((base) => [
    { id: base.id, label: base.label },
    ...EFFORT_LEVELS.map((effort) => ({
      id: `${base.id}:${effort}`,
      label: `${base.label} (${effort})`,
    })),
  ]);
}
