import { describe, expect, it } from "vitest";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { classifyCopilotError, execute } from "@clawdev/adapter-copilot-local/server";

async function writeFakeCopilotCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("fs");
const args = process.argv.slice(2);
const capturePath = process.env.CLAWDEV_TEST_CAPTURE_PATH;
const attemptsPath = process.env.CLAWDEV_TEST_ATTEMPTS_PATH;
let attempts = 0;
if (attemptsPath) {
  try {
    attempts = Number(fs.readFileSync(attemptsPath, "utf8")) || 0;
  } catch {}
}
attempts += 1;
if (attemptsPath) fs.writeFileSync(attemptsPath, String(attempts), "utf8");

if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify({ args }, null, 2), "utf8");
}

const hasResume = args.includes("--resume");
if (hasResume) {
  console.log(JSON.stringify({ type: "session.error", data: { message: "session not found" } }));
  process.exit(1);
}

console.log(JSON.stringify({ type: "session.tools_updated", data: { model: "gpt-5-mini" } }));
console.log(JSON.stringify({ type: "assistant.message", data: { content: "ok" } }));
console.log(JSON.stringify({ type: "result", sessionId: "copilot-session-1", data: { usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } } }));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

describe("copilot local adapter", () => {
  it("classifies runtime extract failures", () => {
    const code = classifyCopilotError(
      "Failed to extract bundled package: Error: EPERM: operation not permitted, mkdir '/tmp/.extracting-1.0.20'",
    );
    expect(code).toBe("runtime_extract_failed");
  });

  it("retries without resume when session is missing", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "clawdev-copilot-execute-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "copilot");
    const capturePath = path.join(root, "capture.json");
    const attemptsPath = path.join(root, "attempts.txt");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeCopilotCommand(commandPath);
    try {
      const result = await execute({
        runId: "run-copilot-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Copilot Agent",
          adapterType: "copilot_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: "copilot-session-stale",
          sessionParams: { sessionId: "copilot-session-stale", cwd: workspace },
          sessionDisplayId: "copilot-session-stale",
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          promptTemplate: "Run task",
          env: {
            CLAWDEV_TEST_CAPTURE_PATH: capturePath,
            CLAWDEV_TEST_ATTEMPTS_PATH: attemptsPath,
          },
          stream: "off",
          enableReasoningSummaries: true,
          disallowTempDir: true,
        },
        context: {},
        authToken: "test-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();
      expect(result.sessionId).toBe("copilot-session-1");
      const attempts = Number(await fs.readFile(attemptsPath, "utf8"));
      expect(attempts).toBe(2);
      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as { args: string[] };
      expect(capture.args).toContain("--enable-reasoning-summaries");
      expect(capture.args).toContain("--disallow-temp-dir");
      expect(capture.args).toContain("--stream");
      expect(capture.args).toContain("off");
      expect(capture.args).not.toContain("--resume");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});

