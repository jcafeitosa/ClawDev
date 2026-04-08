import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

const bunShim = fileURLToPath(new URL("../../../test-bun-shim.ts", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [bunShim],
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**", "**/build/**"],
  },
});
