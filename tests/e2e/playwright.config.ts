import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.CLAWDEV_E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  workers: 1,
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  // By default the webServer directive starts `pnpm dev` before tests.
  // Set PLAYWRIGHT_USE_EXTERNAL_SERVER=1 to reuse an already-running dev server.
  ...(process.env.PLAYWRIGHT_USE_EXTERNAL_SERVER
    ? {}
    : {
        webServer: {
          command: `pnpm dev`,
          url: `${BASE_URL}/api/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: "pipe",
          stderr: "pipe",
        },
      }),
  outputDir: "./test-results",
  reporter: [["list"], ["html", { open: "never", outputFolder: "./playwright-report" }]],
});
