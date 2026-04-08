import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    environment: "node",
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**", "**/build/**"],
  },
});
