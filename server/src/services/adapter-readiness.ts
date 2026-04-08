import { runChildProcess } from "@clawdev/adapter-utils/server-utils";
import type { AdapterReadinessCheck } from "@clawdev/shared";
import { listServerAdapters } from "../adapters/registry.js";

const AUTO_HEAL_ADAPTERS = new Set(["codex_local", "copilot_local", "gemini_local", "opencode_local", "pi_local"]);

function splitShellCommand(commandLine: string): { command: string; args: string[] } {
  return { command: "/bin/sh", args: ["-lc", commandLine] };
}

function parseVersion(version: string | null | undefined): number[] | null {
  if (!version) return null;
  const match = version.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i += 1) {
    const delta = (va[i] ?? 0) - (vb[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

export async function checkAdapterReadiness(): Promise<AdapterReadinessCheck[]> {
  const adapters = listServerAdapters();
  return Promise.all(adapters.map(async (adapter) => {
    const readiness = adapter.readiness;
    const versionCommand = readiness?.versionCommand ?? null;
    const installCommand = readiness?.installCommand ?? null;
    const updateCommand = readiness?.upgradeCommand ?? null;
    let currentVersion: string | null = null;
    let installed = false;
    let upToDate = false;
    const automation = {
      install: readiness?.installCommand ? (AUTO_HEAL_ADAPTERS.has(adapter.type) ? "verified" : "manual") : "not_supported",
      update: readiness?.upgradeCommand ? (AUTO_HEAL_ADAPTERS.has(adapter.type) ? "verified" : "manual") : "not_supported",
    } as const;

    if (versionCommand) {
      try {
        const proc = await runChildProcess(
          `adapter-readiness-${adapter.type}-${Date.now()}`,
          "/bin/sh",
          ["-lc", versionCommand],
          {
            cwd: process.cwd(),
            env: process.env as Record<string, string>,
            timeoutSec: 20,
            graceSec: 3,
            onLog: async () => {},
          },
        );
        const output = `${proc.stdout}\n${proc.stderr}`.trim();
        currentVersion = output.length > 0 ? output.split(/\r?\n/)[0]!.trim() : null;
        installed = proc.exitCode === 0 || output.length > 0;
        upToDate = installed && (!readiness?.minimumVersion || compareVersions(currentVersion, readiness.minimumVersion) >= 0);
      } catch {
        installed = false;
        upToDate = false;
      }
    }

    return {
      adapterType: adapter.type,
      installed,
      upToDate,
      automation,
      currentVersion,
      minimumVersion: readiness?.minimumVersion ?? null,
      needsInstall: !installed,
      needsUpdate: installed && !upToDate,
      remediation: installed
        ? {
            kind: automation.update === "verified" ? "update" : "manual",
            command: versionCommand,
            installCommand,
            updateCommand,
            reason: automation.update === "verified"
              ? "Adapter update command is declared and auto-heal is enabled for this adapter."
              : "Version probe is adapter-defined; install/update automation is adapter-specific.",
          }
        : {
            kind: automation.install === "verified" ? "install" : "manual",
            command: installCommand,
            installCommand,
            updateCommand,
            reason: automation.install === "verified"
              ? "Adapter install command is declared and auto-heal is enabled for this adapter."
              : "Adapter declares no version probe; install command is the best available remediation.",
          },
    };
  }));
}

export async function remediateAdapterReadiness(adapterType: string, mode: "install" | "update" | "version" = "install") {
  const adapter = listServerAdapters().find((entry) => entry.type === adapterType);
  if (!adapter) throw new Error(`Unknown adapter type: ${adapterType}`);
  const readiness = adapter.readiness;
  if (!readiness) throw new Error(`Adapter ${adapterType} does not expose readiness commands`);

  const commandLine =
    mode === "update"
      ? readiness.upgradeCommand
      : mode === "version"
        ? readiness.versionCommand
        : readiness.installCommand;

  if (!commandLine) {
    throw new Error(`Adapter ${adapterType} does not define a ${mode} command`);
  }

  const runId = `adapter-readiness-${adapterType}-${mode}-${Date.now()}`;
  const { command, args } = splitShellCommand(commandLine);
  const proc = await runChildProcess(runId, command, args, {
    cwd: process.cwd(),
    env: process.env as Record<string, string>,
    timeoutSec: 120,
    graceSec: 3,
    onLog: async () => {},
  });

  return {
    adapterType,
    mode,
    exitCode: proc.exitCode,
    signal: proc.signal,
    timedOut: proc.timedOut,
    stdout: proc.stdout,
    stderr: proc.stderr,
  };
}
