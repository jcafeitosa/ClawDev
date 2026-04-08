import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

const bunShim = fileURLToPath(new URL("./test-bun-shim.ts", import.meta.url));

export default defineConfig({
  test: {
    projects: ["packages/db", "packages/adapters/opencode-local", "packages/shared", "server", "cli"],
    setupFiles: [bunShim],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**", "**/build/**"],
  },
});
