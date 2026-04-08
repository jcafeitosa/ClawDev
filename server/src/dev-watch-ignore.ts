import path from "path";
import fs from "fs";

function toGlobstarPath(candidate: string): string {
  return `${candidate.replaceAll(path.sep, "/")}/**`;
}

function addIgnorePath(target: Set<string>, candidate: string): void {
  target.add(candidate);
  target.add(toGlobstarPath(candidate));
  try {
    const realPath = fs.realpathSync(candidate);
    target.add(realPath);
    target.add(toGlobstarPath(realPath));
  } catch {
    // Ignore paths that do not exist in the current checkout.
  }
}

export function resolveServerDevWatchIgnorePaths(serverRoot: string): string[] {
  const ignorePaths = new Set<string>([
    "**/{node_modules,bower_components,vendor}/**",
    "**/.vite-temp/**",
  ]);

  for (const relativePath of [
    "../svelte-ui/node_modules",
    "../svelte-ui/node_modules/.vite-temp",
    "../svelte-ui/.vite",
    "../svelte-ui/build",
  ]) {
    addIgnorePath(ignorePaths, path.resolve(serverRoot, relativePath));
  }

  return [...ignorePaths];
}
