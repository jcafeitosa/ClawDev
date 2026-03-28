/**
 * Shared helpers for agent routes — extracted from routes/agents.ts
 * Used by both the legacy Express routes and Elysia routes during migration.
 */
import { generateKeyPairSync } from "node:crypto";
import path from "node:path";
import type { Db } from "@clawdev/db";
import {
  deriveAgentUrlKey,
  isUuidLike,
  type AgentSkillSnapshot,
  type InstanceSchedulerHeartbeatAgent,
} from "@clawdev/shared";
import {
  readClawDevSkillSyncPreference,
  writeClawDevSkillSyncPreference,
} from "@clawdev/adapter-utils/server-utils";
import {
  agentService,
  agentInstructionsService,
  accessService,
  companySkillService,
  secretService,
} from "../services/index.js";
import { conflict, forbidden, notFound, unprocessable } from "../errors.js";
import { redactEventPayload } from "../redaction.js";
import { instanceSettingsService } from "../services/instance-settings.js";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@clawdev/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@clawdev/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@clawdev/adapter-gemini-local";
import { ensureOpenCodeModelConfiguredAndAvailable } from "@clawdev/adapter-opencode-local/server";
import {
  loadDefaultAgentInstructionsBundle,
  resolveDefaultAgentInstructionsBundleRole,
} from "../services/default-agent-instructions.js";
import type { Actor } from "../elysia-plugins/auth.js";

export const DEFAULT_INSTRUCTIONS_PATH_KEYS: Record<string, string> = {
  claude_local: "instructionsFilePath",
  codex_local: "instructionsFilePath",
  gemini_local: "instructionsFilePath",
  opencode_local: "instructionsFilePath",
  cursor: "instructionsFilePath",
  pi_local: "instructionsFilePath",
};
export const DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES = new Set(Object.keys(DEFAULT_INSTRUCTIONS_PATH_KEYS));
export const KNOWN_INSTRUCTIONS_PATH_KEYS = new Set(["instructionsFilePath", "agentsMdPath"]);
export const KNOWN_INSTRUCTIONS_BUNDLE_KEYS = [
  "instructionsBundleMode",
  "instructionsRootPath",
  "instructionsEntryFile",
  "instructionsFilePath",
  "agentsMdPath",
] as const;

export function canCreateAgents(agent: { role: string; permissions: Record<string, unknown> | null | undefined }) {
  if (!agent.permissions || typeof agent.permissions !== "object") return false;
  return Boolean((agent.permissions as Record<string, unknown>).canCreateAgents);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

export function parseNumberLike(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSchedulerHeartbeatPolicy(runtimeConfig: unknown) {
  const heartbeat = asRecord(asRecord(runtimeConfig)?.heartbeat) ?? {};
  return {
    enabled: parseBooleanLike(heartbeat.enabled) ?? true,
    intervalSec: Math.max(0, parseNumberLike(heartbeat.intervalSec) ?? 0),
  };
}

export function generateEd25519PrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

export function ensureGatewayDeviceKey(
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  if (adapterType !== "openclaw_gateway") return adapterConfig;
  if (parseBooleanLike(adapterConfig.disableDeviceAuth) === true) return adapterConfig;
  if (asNonEmptyString(adapterConfig.devicePrivateKeyPem)) return adapterConfig;
  return { ...adapterConfig, devicePrivateKeyPem: generateEd25519PrivateKeyPem() };
}

export function applyCreateDefaultsByAdapterType(
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...adapterConfig };
  if (adapterType === "codex_local") {
    if (!asNonEmptyString(next.model)) next.model = DEFAULT_CODEX_LOCAL_MODEL;
    const hasBypassFlag = typeof next.dangerouslyBypassApprovalsAndSandbox === "boolean" || typeof next.dangerouslyBypassSandbox === "boolean";
    if (!hasBypassFlag) next.dangerouslyBypassApprovalsAndSandbox = DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
    return ensureGatewayDeviceKey(adapterType, next);
  }
  if (adapterType === "gemini_local" && !asNonEmptyString(next.model)) {
    next.model = DEFAULT_GEMINI_LOCAL_MODEL;
    return ensureGatewayDeviceKey(adapterType, next);
  }
  if (adapterType === "cursor" && !asNonEmptyString(next.model)) {
    next.model = DEFAULT_CURSOR_LOCAL_MODEL;
  }
  return ensureGatewayDeviceKey(adapterType, next);
}

export function preserveInstructionsBundleConfig(
  existingAdapterConfig: Record<string, unknown>,
  nextAdapterConfig: Record<string, unknown>,
) {
  const nextKeys = new Set(Object.keys(nextAdapterConfig));
  if (KNOWN_INSTRUCTIONS_BUNDLE_KEYS.some((key) => nextKeys.has(key))) return nextAdapterConfig;
  const merged = { ...nextAdapterConfig };
  for (const key of KNOWN_INSTRUCTIONS_BUNDLE_KEYS) {
    if (merged[key] === undefined && existingAdapterConfig[key] !== undefined) {
      merged[key] = existingAdapterConfig[key];
    }
  }
  return merged;
}

export function resolveInstructionsFilePath(candidatePath: string, adapterConfig: Record<string, unknown>) {
  const trimmed = candidatePath.trim();
  if (path.isAbsolute(trimmed)) return trimmed;
  const cwd = asNonEmptyString(adapterConfig.cwd);
  if (!cwd) throw unprocessable("Relative instructions path requires adapterConfig.cwd to be set to an absolute path");
  if (!path.isAbsolute(cwd)) throw unprocessable("adapterConfig.cwd must be an absolute path to resolve relative instructions path");
  return path.resolve(cwd, trimmed);
}

export function parseSourceIssueIds(input: { sourceIssueId?: string | null; sourceIssueIds?: string[] }): string[] {
  const values: string[] = [];
  if (Array.isArray(input.sourceIssueIds)) values.push(...input.sourceIssueIds);
  if (typeof input.sourceIssueId === "string" && input.sourceIssueId.length > 0) values.push(input.sourceIssueId);
  return Array.from(new Set(values));
}

export function redactForRestrictedAgentView(agent: Record<string, unknown> | null) {
  if (!agent) return null;
  return { ...agent, adapterConfig: {}, runtimeConfig: {} };
}

export function redactAgentConfiguration(agent: Record<string, unknown> | null) {
  if (!agent) return null;
  return {
    id: agent.id,
    companyId: agent.companyId,
    name: agent.name,
    role: agent.role,
    title: agent.title,
    status: agent.status,
    reportsTo: agent.reportsTo,
    adapterType: agent.adapterType,
    adapterConfig: redactEventPayload(agent.adapterConfig as Record<string, unknown>),
    runtimeConfig: redactEventPayload(agent.runtimeConfig as Record<string, unknown>),
    permissions: agent.permissions,
    updatedAt: agent.updatedAt,
  };
}

export function redactRevisionSnapshot(snapshot: unknown): Record<string, unknown> {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  const record = snapshot as Record<string, unknown>;
  return {
    ...record,
    adapterConfig: redactEventPayload(
      typeof record.adapterConfig === "object" && record.adapterConfig !== null
        ? (record.adapterConfig as Record<string, unknown>)
        : {},
    ),
    runtimeConfig: redactEventPayload(
      typeof record.runtimeConfig === "object" && record.runtimeConfig !== null
        ? (record.runtimeConfig as Record<string, unknown>)
        : {},
    ),
    metadata:
      typeof record.metadata === "object" && record.metadata !== null
        ? redactEventPayload(record.metadata as Record<string, unknown>)
        : record.metadata ?? null,
  };
}

export function redactConfigRevision(
  revision: Record<string, unknown> & { beforeConfig: unknown; afterConfig: unknown },
) {
  return {
    ...revision,
    beforeConfig: redactRevisionSnapshot(revision.beforeConfig),
    afterConfig: redactRevisionSnapshot(revision.afterConfig),
  };
}

export function toLeanOrgNode(node: Record<string, unknown>): Record<string, unknown> {
  const reports = Array.isArray(node.reports)
    ? (node.reports as Array<Record<string, unknown>>).map(toLeanOrgNode)
    : [];
  return {
    id: String(node.id),
    name: String(node.name),
    role: String(node.role),
    status: String(node.status),
    reports,
  };
}

export function summarizeAgentUpdateDetails(patch: Record<string, unknown>) {
  const changedTopLevelKeys = Object.keys(patch).sort();
  const details: Record<string, unknown> = { changedTopLevelKeys };
  const adapterConfigPatch = asRecord(patch.adapterConfig);
  if (adapterConfigPatch) details.changedAdapterConfigKeys = Object.keys(adapterConfigPatch).sort();
  const runtimeConfigPatch = asRecord(patch.runtimeConfig);
  if (runtimeConfigPatch) details.changedRuntimeConfigKeys = Object.keys(runtimeConfigPatch).sort();
  return details;
}

export function buildUnsupportedSkillSnapshot(adapterType: string, desiredSkills: string[] = []): AgentSkillSnapshot {
  return {
    adapterType,
    supported: false,
    mode: "unsupported",
    desiredSkills,
    entries: [],
    warnings: ["This adapter does not implement skill sync yet."],
  };
}

export function shouldMaterializeRuntimeSkillsForAdapter(adapterType: string) {
  return adapterType !== "claude_local";
}

export async function assertAdapterConfigConstraints(
  companyId: string,
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
  secretsSvc: ReturnType<typeof secretService>,
) {
  if (adapterType !== "opencode_local") return;
  const { config: runtimeConfig } = await secretsSvc.resolveAdapterConfigForRuntime(companyId, adapterConfig);
  const runtimeEnv = asRecord(runtimeConfig.env) ?? {};
  try {
    await ensureOpenCodeModelConfiguredAndAvailable({
      model: runtimeConfig.model,
      command: runtimeConfig.command,
      cwd: runtimeConfig.cwd,
      env: runtimeEnv,
    });
  } catch (err) {
    throw unprocessable(`Invalid opencode_local adapterConfig: ${err instanceof Error ? err.message : String(err)}`);
  }
}
