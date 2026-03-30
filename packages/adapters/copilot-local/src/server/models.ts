import type { AdapterModel } from "@clawdev/adapter-utils";
import { runChildProcess } from "@clawdev/adapter-utils/server-utils";

/**
 * Known Copilot CLI models. Probed at runtime to confirm availability.
 */
const KNOWN_MODELS: AdapterModel[] = [
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "gpt-5.4", label: "GPT 5.4" },
  { id: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
  { id: "gpt-5.2-codex", label: "GPT 5.2 Codex" },
  { id: "gpt-5.2", label: "GPT 5.2" },
  { id: "gpt-5.1-codex-max", label: "GPT 5.1 Codex Max" },
  { id: "gpt-5.1-codex", label: "GPT 5.1 Codex" },
  { id: "gpt-5.1", label: "GPT 5.1" },
  { id: "gpt-5.4-mini", label: "GPT 5.4 Mini" },
  { id: "gpt-5.1-codex-mini", label: "GPT 5.1 Codex Mini" },
  { id: "gpt-5-mini", label: "GPT 5 Mini" },
  { id: "gpt-4.1", label: "GPT 4.1" },
];

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
    // Model accepted if we see session events or exit code 0
    return combined.includes("session.") || combined.includes("assistant.") || (proc.exitCode ?? 1) === 0;
  } catch {
    return false;
  }
}

/**
 * Lists available Copilot models by probing each known model in parallel.
 * Only returns models confirmed available by the Copilot CLI.
 */
export async function listCopilotModels(): Promise<AdapterModel[]> {
  const results = await Promise.all(
    KNOWN_MODELS.map(async (model) => {
      const available = await probeModel(model.id);
      return available ? model : null;
    }),
  );
  return results.filter((m): m is AdapterModel => m !== null);
}
