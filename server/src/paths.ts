import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const PAPERCLIP_CONFIG_BASENAME = "config.json";
const PAPERCLIP_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    // Check .clawdev first (new convention), then .paperclip (legacy)
    for (const dirName of [".clawdev", ".paperclip"]) {
      const candidate = path.resolve(currentDir, dirName, PAPERCLIP_CONFIG_BASENAME);
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

export function resolvePaperclipConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.CLAWDEV_CONFIG) return path.resolve(process.env.CLAWDEV_CONFIG);
  if (process.env.PAPERCLIP_CONFIG) return path.resolve(process.env.PAPERCLIP_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolvePaperclipEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolvePaperclipConfigPath(overrideConfigPath)), PAPERCLIP_ENV_FILENAME);
}
