import path from "path";
import { expandHomePrefix } from "../config/home.js";

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

export async function resolveRuntimeLikePath(value: string, configPath?: string): Promise<string> {
  const expanded = expandHomePrefix(value);
  if (path.isAbsolute(expanded)) return path.resolve(expanded);

  const cwd = process.cwd();
  const configDir = configPath ? path.dirname(configPath) : null;
  const workspaceRoot = configDir ? path.resolve(configDir, "..") : cwd;

  const candidates = unique([
    ...(configDir ? [path.resolve(configDir, expanded)] : []),
    path.resolve(workspaceRoot, "server", expanded),
    path.resolve(workspaceRoot, expanded),
    path.resolve(cwd, expanded),
  ]);

  for (const candidate of candidates) {
    if (await Bun.file(candidate).exists()) return candidate;
  }
  return candidates[0];
}
