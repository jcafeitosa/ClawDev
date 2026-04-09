import { createHash } from "crypto";
import os from "os";
import type { AdapterModel } from "@clawdev/adapter-utils";
import {
  asString,
  ensurePathInEnv,
  runChildProcess,
} from "@clawdev/adapter-utils/server-utils";

const MODELS_CACHE_TTL_MS = 10_000;
const MODELS_DISCOVERY_TIMEOUT_MS = 20_000;

function resolveOpenCodeCommand(input: unknown): string {
  const envOverride =
    typeof process.env.CLAWDEV_OPENCODE_COMMAND === "string" &&
    process.env.CLAWDEV_OPENCODE_COMMAND.trim().length > 0
      ? process.env.CLAWDEV_OPENCODE_COMMAND.trim()
      : "opencode";
  return asString(input, envOverride);
}

const discoveryCache = new Map<string, { expiresAt: number; models: AdapterModel[] }>();
const VOLATILE_ENV_KEY_PREFIXES = ["CLAWDEV_", "npm_", "NPM_"] as const;
const VOLATILE_ENV_KEY_EXACT = new Set(["PWD", "OLDPWD", "SHLVL", "_", "TERM_SESSION_ID", "HOME"]);

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({
      ...model,
      id,
      label: model.label.trim() || id,
    });
  }
  return deduped;
}

function sortModels(models: AdapterModel[]): AdapterModel[] {
  return [...models].sort((a, b) =>
    a.id.localeCompare(b.id, "en", { numeric: true, sensitivity: "base" }),
  );
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function pushModel(
  parsed: AdapterModel[],
  input: {
    provider: string;
    model: string;
    label?: string;
    status?: AdapterModel["status"];
    statusDetail?: string;
  },
) {
  const provider = input.provider.trim();
  const model = input.model.trim();
  if (!provider || !model) return;
  const id = model.includes("/") ? model : `${provider}/${model}`;
  parsed.push({
    id,
    label: input.label?.trim() || model,
    status: input.status ?? "available",
    statusDetail: input.statusDetail?.trim() || undefined,
    provider,
    probedAt: new Date().toISOString(),
  });
}

function parseJsonModels(stdout: string): AdapterModel[] {
  const parsed: AdapterModel[] = [];
  const trimmed = stdout.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return parsed;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return parsed;
  }

  const items = Array.isArray(value)
    ? value
    : Array.isArray((value as Record<string, unknown> | null)?.models)
      ? ((value as Record<string, unknown>).models as unknown[])
      : Array.isArray((value as Record<string, unknown> | null)?.data)
        ? ((value as Record<string, unknown>).data as unknown[])
        : [];

  for (const item of items) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const provider =
      asString(record.provider, "").trim() ||
      asString(record.providerID, "").trim() ||
      asString(record.providerId, "").trim();
    const rawModel =
      asString(record.model, "").trim() ||
      asString(record.modelID, "").trim() ||
      asString(record.modelId, "").trim() ||
      asString(record.id, "").trim();
    const label = asString(record.label, "").trim() || asString(record.name, "").trim();
    const status = asString(record.status, "available").trim() as AdapterModel["status"];
    const statusDetail = asString(record.statusDetail, "").trim() || asString(record.detail, "").trim();
    if (!provider || !rawModel) continue;
    const model = rawModel.includes("/") ? rawModel.slice(rawModel.indexOf("/") + 1) : rawModel;
    pushModel(parsed, { provider, model: rawModel, label: label || model, status, statusDetail });
  }

  return parsed;
}

function parseModelsOutput(stdout: string): AdapterModel[] {
  const parsed: AdapterModel[] = [];
  const jsonModels = parseJsonModels(stdout);
  if (jsonModels.length > 0) {
    return dedupeModels(jsonModels);
  }
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const firstToken = line.split(/\s+/)[0]?.trim() ?? "";
    if (firstToken.includes("/")) {
      const provider = firstToken.slice(0, firstToken.indexOf("/")).trim();
      const model = firstToken.slice(firstToken.indexOf("/") + 1).trim();
      if (!provider || !model) continue;
      pushModel(parsed, { provider, model, label: model });
      continue;
    }
    const parts = line.split(/\s{2,}|\t+|\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const provider = parts[0]?.trim() ?? "";
    const model = parts[1]?.trim() ?? "";
    if (!provider || !model) continue;
    if (provider === "provider" && model === "model") continue;
    pushModel(parsed, { provider, model, label: model });
  }
  return dedupeModels(parsed);
}

function normalizeEnv(input: unknown): Record<string, string> {
  const envInput = typeof input === "object" && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envInput)) {
    if (typeof value === "string") env[key] = value;
  }
  return env;
}

function isVolatileEnvKey(key: string): boolean {
  if (VOLATILE_ENV_KEY_EXACT.has(key)) return true;
  return VOLATILE_ENV_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function discoveryCacheKey(command: string, cwd: string, env: Record<string, string>) {
  const envKey = Object.entries(env)
    .filter(([key]) => !isVolatileEnvKey(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${hashValue(value)}`)
    .join("\n");
  return `${command}\n${cwd}\n${envKey}`;
}

function pruneExpiredDiscoveryCache(now: number) {
  for (const [key, value] of discoveryCache.entries()) {
    if (value.expiresAt <= now) discoveryCache.delete(key);
  }
}

export async function discoverOpenCodeModels(input: {
  command?: unknown;
  cwd?: unknown;
  env?: unknown;
} = {}): Promise<AdapterModel[]> {
  const command = resolveOpenCodeCommand(input.command);
  const cwd = asString(input.cwd, process.cwd());
  const env = normalizeEnv(input.env);
  // Ensure HOME points to the actual running user's home directory.
  // When the server is started via `runuser -u <user>`, HOME may still
  // reflect the parent process (e.g. /root), causing OpenCode to miss
  // provider auth credentials stored under the target user's home.
  let resolvedHome: string | undefined;
  try {
    resolvedHome = os.userInfo().homedir || undefined;
  } catch {
    // os.userInfo() throws a SystemError when the current UID has no
    // /etc/passwd entry (e.g. `docker run --user 1234` with a minimal
    // image). Fall back to process.env.HOME.
  }
  // Prevent OpenCode from writing an opencode.json into the working directory.
  const runtimeEnv = normalizeEnv(ensurePathInEnv({ ...process.env, ...env, ...(resolvedHome ? { HOME: resolvedHome } : {}), OPENCODE_DISABLE_PROJECT_CONFIG: "true" }));

  const result = await runChildProcess(
    `opencode-models-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    command,
    ["models"],
    {
      cwd,
      env: runtimeEnv,
      timeoutSec: MODELS_DISCOVERY_TIMEOUT_MS / 1000,
      graceSec: 3,
      onLog: async () => {},
    },
  );

  if (result.timedOut) {
    throw new Error(`\`opencode models\` timed out after ${MODELS_DISCOVERY_TIMEOUT_MS / 1000}s.`);
  }
  if ((result.exitCode ?? 1) !== 0) {
    const detail = firstNonEmptyLine(result.stderr) || firstNonEmptyLine(result.stdout);
    throw new Error(detail ? `\`opencode models\` failed: ${detail}` : "`opencode models` failed.");
  }

  return sortModels(parseModelsOutput(result.stdout));
}

export async function discoverOpenCodeModelsCached(input: {
  command?: unknown;
  cwd?: unknown;
  env?: unknown;
} = {}): Promise<AdapterModel[]> {
  const command = resolveOpenCodeCommand(input.command);
  const cwd = asString(input.cwd, process.cwd());
  const env = normalizeEnv(input.env);
  const key = discoveryCacheKey(command, cwd, env);
  const now = Date.now();
  pruneExpiredDiscoveryCache(now);
  const cached = discoveryCache.get(key);
  if (cached && cached.expiresAt > now) return cached.models;

  const models = await discoverOpenCodeModels({ command, cwd, env });
  discoveryCache.set(key, { expiresAt: now + MODELS_CACHE_TTL_MS, models });
  return models;
}

export async function ensureOpenCodeModelConfiguredAndAvailable(input: {
  model?: unknown;
  command?: unknown;
  cwd?: unknown;
  env?: unknown;
}): Promise<AdapterModel[]> {
  const model = asString(input.model, "").trim();
  if (!model) {
    throw new Error("OpenCode requires `adapterConfig.model` in provider/model format.");
  }

  const models = await discoverOpenCodeModelsCached({
    command: input.command,
    cwd: input.cwd,
    env: input.env,
  });

  if (models.length === 0) {
    throw new Error("OpenCode returned no models. Run `opencode models` and verify provider auth.");
  }

  if (!models.some((entry) => entry.id === model)) {
    const sample = models.slice(0, 12).map((entry) => entry.id).join(", ");
    throw new Error(
      `Configured OpenCode model is unavailable: ${model}. Available models: ${sample}${models.length > 12 ? ", ..." : ""}`,
    );
  }

  return models;
}

export async function listOpenCodeModels(): Promise<AdapterModel[]> {
  try {
    return await discoverOpenCodeModelsCached();
  } catch {
    return [];
  }
}

export function resetOpenCodeModelsCacheForTests() {
  discoveryCache.clear();
}
