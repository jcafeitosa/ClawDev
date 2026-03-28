import fs from "node:fs";
import { clawdevConfigSchema, type ClawDevConfig } from "@clawdev/shared";
import { resolveClawDevConfigPath } from "./paths.js";

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
