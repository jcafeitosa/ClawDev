import fs from "fs";
import type { ClawDevConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";
import { resolveRuntimeLikePath } from "./path-resolver.js";

export async function logCheck(config: ClawDevConfig, configPath?: string): Promise<CheckResult> {
  const logDir = await resolveRuntimeLikePath(config.logging.logDir, configPath);
  const reportedDir = logDir;

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(reportedDir, { recursive: true });
  }

  try {
    fs.accessSync(reportedDir, fs.constants.W_OK);
    return {
      name: "Log directory",
      status: "pass",
      message: `Log directory is writable: ${reportedDir}`,
    };
  } catch {
    return {
      name: "Log directory",
      status: "fail",
      message: `Log directory is not writable: ${logDir}`,
      canRepair: false,
      repairHint: "Check file permissions on the log directory",
    };
  }
}
