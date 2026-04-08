import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { bootstrapCeoInvite } from "./auth-bootstrap-ceo.js";
import { onboard } from "./onboard.js";
import { doctor } from "./doctor.js";
import { loadClawDevEnvFile } from "../config/env.js";
import { configExists, resolveConfigPath } from "../config/store.js";
import type { ClawDevConfig } from "../config/schema.js";
import { readConfig } from "../config/store.js";
import {
  describeLocalInstancePaths,
  resolveClawDevHomeDir,
  resolveClawDevInstanceId,
} from "../config/home.js";

interface RunOptions {
  config?: string;
  instance?: string;
  repair?: boolean;
  yes?: boolean;
}

interface StartedServer {
  apiUrl: string;
  databaseUrl: string;
  host: string;
  listenPort: number;
}

export async function runCommand(opts: RunOptions): Promise<void> {
  const instanceId = resolveClawDevInstanceId(opts.instance);
  process.env.CLAWDEV_INSTANCE_ID = instanceId;

  const homeDir = resolveClawDevHomeDir();
  fs.mkdirSync(homeDir, { recursive: true });

  const paths = describeLocalInstancePaths(instanceId);
  fs.mkdirSync(paths.instanceRoot, { recursive: true });

  const configPath = resolveConfigPath(opts.config);
  process.env.CLAWDEV_CONFIG = configPath;
  loadClawDevEnvFile(configPath);

  p.intro(pc.bgCyan(pc.black(" clawdev run ")));
  p.log.message(pc.dim(`Home: ${paths.homeDir}`));
  p.log.message(pc.dim(`Instance: ${paths.instanceId}`));
  p.log.message(pc.dim(`Config: ${configPath}`));

  if (!configExists(configPath)) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      p.log.error("No config found and terminal is non-interactive.");
      p.log.message(`Run ${pc.cyan("clawdev onboard")} once, then retry ${pc.cyan("clawdev run")}.`);
      process.exit(1);
    }

    p.log.step("No config found. Starting onboarding...");
    await onboard({ config: configPath, invokedByRun: true });
  }

  p.log.step("Running doctor checks...");
  const summary = await doctor({
    config: configPath,
    repair: opts.repair ?? true,
    yes: opts.yes ?? true,
  });

  if (summary.failed > 0) {
    p.log.error("Doctor found blocking issues. Not starting server.");
    process.exit(1);
  }

  const config = readConfig(configPath);
  if (!config) {
    p.log.error(`No config found at ${configPath}.`);
    process.exit(1);
  }

  p.log.step("Starting ClawDev server...");
  const startedServer = await startServerProcess({
    config,
    configPath,
    forwardedArgs: [],
  });

  if (shouldGenerateBootstrapInviteAfterStart(config)) {
    p.log.step("Generating bootstrap CEO invite");
    await bootstrapCeoInvite({
      config: configPath,
      dbUrl: startedServer.databaseUrl,
      baseUrl: resolveBootstrapInviteBaseUrl(config, startedServer),
    });
  }

  await startedServer.waitForExit;
}

type ServerProcessHandle = StartedServer & {
  waitForExit: Promise<{ code: number; signal: string | null }>;
};

async function findFreePort(preferredPort: number): Promise<number> {
  for (let candidate = Math.max(1, preferredPort); candidate <= 65535 && candidate < preferredPort + 20; candidate += 1) {
    const isFree = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        server.close(() => resolve(value));
      };
      server.once("error", () => finish(false));
      server.listen({ port: candidate, host: "127.0.0.1" }, () => finish(true));
    });
    if (isFree) return candidate;
  }
  return preferredPort;
}

function resolveBootstrapInviteBaseUrl(
  config: ClawDevConfig,
  startedServer: StartedServer,
): string {
  const explicitBaseUrl =
    process.env.CLAWDEV_PUBLIC_URL ??
    process.env.CLAWDEV_AUTH_PUBLIC_BASE_URL ??
    process.env.BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_BASE_URL ??
    (config.auth.baseUrlMode === "explicit" ? config.auth.publicBaseUrl : undefined);

  if (typeof explicitBaseUrl === "string" && explicitBaseUrl.trim().length > 0) {
    return explicitBaseUrl.trim().replace(/\/+$/, "");
  }

  return startedServer.apiUrl.replace(/\/api$/, "");
}

function resolvePublicHost(host: string): string {
  const normalized = host.trim();
  if (normalized === "0.0.0.0" || normalized === "::") return "localhost";
  return normalized;
}

function buildStartedServerInfo(config: ClawDevConfig, listenPort: number): StartedServer {
  const publicHost = resolvePublicHost(config.server.host);
  return {
    host: config.server.host,
    listenPort,
    apiUrl: `http://${publicHost}:${listenPort}/api`,
    databaseUrl:
      config.database.mode === "postgres"
        ? (config.database.connectionString ?? "")
        : `postgres://clawdev:clawdev@127.0.0.1:${config.database.embeddedPostgresPort ?? 54329}/clawdev`,
  };
}

async function waitForServerHealth(apiUrl: string, child: { exitCode: number | null }): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    if (child.exitCode !== null) {
      throw new Error(`ClawDev server exited before healthcheck succeeded at ${apiUrl}/api/health.`);
    }

    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // Server is still booting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${apiUrl}/api/health.`);
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    if (err.message && err.message.trim().length > 0) return err.message;
    return err.name;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function isModuleNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: unknown }).code;
  if (code === "ERR_MODULE_NOT_FOUND") return true;
  return err.message.includes("Cannot find module");
}

function getMissingModuleSpecifier(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const packageMatch = err.message.match(/Cannot find package '([^']+)' imported from/);
  if (packageMatch?.[1]) return packageMatch[1];
  const moduleMatch = err.message.match(/Cannot find module '([^']+)'/);
  if (moduleMatch?.[1]) return moduleMatch[1];
  return null;
}

function maybeEnableUiDevMiddleware(entrypoint: string): void {
  if (process.env.CLAWDEV_UI_DEV_MIDDLEWARE !== undefined) return;
  const normalized = entrypoint.replaceAll("\\", "/");
  if (normalized.endsWith("/server/src/index.ts") || normalized.endsWith("@clawdev/server/src/index.ts")) {
    process.env.CLAWDEV_UI_DEV_MIDDLEWARE = "true";
  }
}

async function startServerProcess(input: {
  config: ClawDevConfig;
  configPath: string;
  forwardedArgs: string[];
}): Promise<ServerProcessHandle> {
  // Dev mode: try local workspace path (monorepo with tsx)
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const serverEntry = path.resolve(projectRoot, "server/src/index.ts");
  if (fs.existsSync(serverEntry)) {
    maybeEnableUiDevMiddleware(serverEntry);
    return await spawnServerChild({
      cwd: path.join(projectRoot, "server"),
      args: ["--filter", "@clawdev/server", "dev", ...input.forwardedArgs],
      config: input.config,
    });
  }

  // Production mode: import the published @clawdev/server package
  try {
    const mod = await import("@clawdev/server");
    const startedServer = await startServerFromModule(mod, "@clawdev/server");
    return {
      ...startedServer,
      waitForExit: new Promise<{ code: number; signal: NodeJS.Signals | null }>(() => undefined),
    };
  } catch (err) {
    const missingSpecifier = getMissingModuleSpecifier(err);
    const missingServerEntrypoint = !missingSpecifier || missingSpecifier === "@clawdev/server";
    if (isModuleNotFoundError(err) && missingServerEntrypoint) {
      throw new Error(
        `Could not locate a ClawDev server entrypoint.\n` +
          `Tried: ${serverEntry}, @clawdev/server\n` +
          `${formatError(err)}`,
      );
    }
    throw new Error(
      `ClawDev server failed to start.\n` +
        `${formatError(err)}`,
    );
  }
}

async function spawnServerChild(input: {
  cwd: string;
  args: string[];
  config: ClawDevConfig;
}): Promise<ServerProcessHandle> {
  const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAWDEV_DB_RUNTIME: process.env.CLAWDEV_DB_RUNTIME ?? "pglite",
  };
  if (env.CLAWDEV_DB_RUNTIME === "pglite" && !env.PORT) {
    env.PORT = String(await findFreePort(input.config.server.port));
  }
  const child = Bun.spawn({
    cmd: [pnpmBin, ...input.args],
    cwd: input.cwd,
    env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  let stdoutBuffer = "";
  let stderrBuffer = "";
  let resolved = false;
  let resolvedPort: number | null = null;
  let resolveReady: ((value: ServerProcessHandle) => void) | null = null;
  let rejectReady: ((reason: Error) => void) | null = null;
  const ready = new Promise<ServerProcessHandle>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const exitPromise = child.exited.then((code) => {
    if (resolvedPort === null && !resolved) {
      rejectReady?.(
        new Error(
          `ClawDev server exited before reporting a listening port.\n` +
            `stdout:\n${stdoutBuffer}\n` +
            `stderr:\n${stderrBuffer}`,
        ),
      );
    }
    return { code, signal: child.signalCode };
  });

  function resolveStart(port: number) {
    if (resolved) return;
    resolved = true;
    resolvedPort = port;
    void (async () => {
      try {
        const startedServer = buildStartedServerInfo(input.config, port);
        await waitForServerHealth(startedServer.apiUrl, child);
        resolveReady?.({
          ...startedServer,
          waitForExit: exitPromise,
        });
      } catch (error) {
        if (child.exitCode === null) {
          child.kill("SIGTERM");
        }
        rejectReady?.(
          error instanceof Error
            ? error
            : new Error(formatError(error)),
        );
      }
    })();
  }

  const handleOutput = (chunk: unknown, stream: "stdout" | "stderr") => {
    const text = String(chunk ?? "");
    if (text.length === 0) return;
    if (stream === "stdout") {
      process.stdout.write(text);
      stdoutBuffer += text;
    } else {
      process.stderr.write(text);
      stderrBuffer += text;
    }

    const cleaned = text.replace(/\u001b\[[0-9;]*m/g, "");
    const match = cleaned.match(/Server listening on\s+.*:(\d+)/);
    if (match?.[1]) {
      const port = Number(match[1]);
      if (Number.isInteger(port) && port > 0) {
        resolveStart(port);
      }
    }
  };

  void (async () => {
    if (child.stdout) {
      const text = await new Response(child.stdout).text();
      handleOutput(text, "stdout");
    }
  })();
  void (async () => {
    if (child.stderr) {
      const text = await new Response(child.stderr).text();
      handleOutput(text, "stderr");
    }
  })();

  const signalHandler = (signal: NodeJS.Signals) => {
    if (!child.killed) {
      child.kill(signal as unknown as number);
    }
  };
  process.once("SIGINT", signalHandler);
  process.once("SIGTERM", signalHandler);

  const cleanup = () => {
    process.removeListener("SIGINT", signalHandler);
    process.removeListener("SIGTERM", signalHandler);
  };

  exitPromise.finally(cleanup).catch(() => undefined);

  const timeout = setTimeout(() => {
    if (!resolved && child.exitCode === null) {
      const parsed = stdoutBuffer.match(/Server listening on\s+.*:(\d+)/);
      if (parsed?.[1]) {
        const port = Number(parsed[1]);
        if (Number.isInteger(port) && port > 0) {
          resolveStart(port);
        }
      }
    }
  }, 250);
  timeout.unref?.();

  return await ready;
}

function shouldGenerateBootstrapInviteAfterStart(config: ClawDevConfig): boolean {
  return config.server.deploymentMode === "authenticated" && config.database.mode === "embedded-postgres";
}

async function startServerFromModule(mod: unknown, label: string): Promise<StartedServer> {
  const startServer = (mod as { startServer?: () => Promise<StartedServer> }).startServer;
  if (typeof startServer !== "function") {
    throw new Error(`ClawDev server entrypoint did not export startServer(): ${label}`);
  }
  return await startServer();
}
