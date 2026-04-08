import { clawdevConfigSchema, type ClawDevConfig } from "@clawdev/shared";
import { resolveClawDevConfigPath } from "./paths.js";

import fs from "fs";

export function readConfigFile(): ClawDevConfig | null {
  const configPath = resolveClawDevConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return clawdevConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
