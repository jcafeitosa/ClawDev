import path from "path";
import fs from "fs";
import pino from "pino";
import { readConfigFile } from "../config-file.js";
import { resolveDefaultLogsDir, resolveHomeAwarePath } from "../home-paths.js";
import { getLogContext } from "./log-context.js";

const isTestEnv = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

function resolveServerLogDir(): string {
  const envOverride = process.env.CLAWDEV_LOG_DIR?.trim();
  if (envOverride) return resolveHomeAwarePath(envOverride);

  const fileLogDir = readConfigFile()?.logging.logDir?.trim();
  if (fileLogDir) return resolveHomeAwarePath(fileLogDir);

  return resolveDefaultLogsDir();
}

const logDir = resolveServerLogDir();
fs.mkdirSync(logDir, { recursive: true });

const logFile = path.join(logDir, "server.log");

const categoryPrefixes: Record<string, string> = {
  "http": "\x1b[36m[HTTP]\x1b[0m",
  "http.error": "\x1b[31m[HTTP ERR]\x1b[0m",
  "agent.run": "\x1b[35m[AGENT]\x1b[0m",
  "adapter": "\x1b[33m[ADAPTER]\x1b[0m",
  "auth": "\x1b[91m[AUTH]\x1b[0m",
  "plugin": "\x1b[34m[PLUGIN]\x1b[0m",
  "system": "\x1b[37m[SYSTEM]\x1b[0m",
  "db": "\x1b[32m[DB]\x1b[0m",
};

function formatMessage(log: any, messageKey: string): string {
  const category = log.category as string | undefined;
  const prefix = category ? (categoryPrefixes[category] ?? `[\x1b[37m${category.toUpperCase()}\x1b[0m]`) : "";
  return `${prefix} ${log[messageKey] ?? ""}`.trim();
}

const sharedOpts = {
  translateTime: "HH:MM:ss",
  ignore: "pid,hostname,category",
  singleLine: true,
};

const loggerOptions = {
  level: isTestEnv ? "silent" : "debug",
  mixin() {
    const ctx = getLogContext();
    return ctx ? { requestId: ctx.requestId, userId: ctx.userId, companyId: ctx.companyId } : {};
  },
};

export const logger = isTestEnv
  ? pino(loggerOptions)
  : pino(loggerOptions, pino.transport({
      targets: [
        {
          target: "pino-pretty",
          options: { ...sharedOpts, ignore: "pid,hostname,req,res,responseTime,requestId,userId,companyId", colorize: true, destination: 1 },
          level: "info",
        },
        {
          target: "pino-pretty",
          options: { ...sharedOpts, colorize: false, destination: logFile, mkdir: true },
          level: "debug",
        },
      ],
    }));
