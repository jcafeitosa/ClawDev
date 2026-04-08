import path from "path";
import fs from "fs";
import { resolveDefaultConfigPath } from "./home-paths.js";

const CLAWDEV_CONFIG_BASENAME = "config.json";
const CLAWDEV_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    // Check .clawdev first (new convention), then .clawdev (legacy)
    for (const dirName of [".clawdev", ".clawdev"]) {
      const candidate = path.resolve(currentDir, dirName, CLAWDEV_CONFIG_BASENAME);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveClawDevConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.CLAWDEV_CONFIG) return path.resolve(process.env.CLAWDEV_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveClawDevEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolveClawDevConfigPath(overrideConfigPath)), CLAWDEV_ENV_FILENAME);
}
