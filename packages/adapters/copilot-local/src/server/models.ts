import type { AdapterModel, AdapterModelStatus } from "@clawdev/adapter-utils";
import { runChildProcess, defaultPathForPlatform } from "@clawdev/adapter-utils/server-utils";
import { BASE_MODELS, EFFORT_LEVELS } from "../index.js";
import { classifyCopilotError } from "./parse.js";

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
        env: probeEnv(),
        stdin: "",
        timeoutSec: 8,
        graceSec: 2,
        onLog: async () => {},
      },
    );
    const combined = proc.stderr + proc.stdout;
    const classifiedError = classifyCopilotError(combined);

    if (classifiedError === "runtime_extract_failed") {
      return { status: "unavailable", statusDetail: "Copilot runtime extraction failed (cache/permission)" };
    }
    if (classifiedError === "auth_required") {
      return { status: "auth_required", statusDetail: combined.trim() };
    }
    if (classifiedError === "quota_exceeded") {
      return { status: "quota_exceeded", statusDetail: combined.trim() };
    }
    if (classifiedError === "model_unavailable") {
      return { status: "unavailable", statusDetail: combined.trim() };
    }

    if (combined.includes("no quota") || combined.includes("402")) {
      return { status: "quota_exceeded", statusDetail: combined.trim() };
    }

    if (combined.includes("not available")) {
      return { status: "unavailable", statusDetail: combined.trim() };
    }

    const hasPong = /pong/i.test(combined);
    const isAvailable = hasPong || combined.includes("session.") || combined.includes("assistant.");
    if (isAvailable) {
      return { status: "available", statusDetail: combined.trim() };
    }

    return { status: "unknown", statusDetail: combined.trim() || `no response from model` };
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
