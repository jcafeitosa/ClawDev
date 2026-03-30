#!/usr/bin/env tsx
/**
 * Stop the background llama-server process.
 *
 * Reads the PID file written by `pnpm start --background` and sends SIGTERM.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PID_FILE = path.join(ROOT, "server.pid");

if (!fs.existsSync(PID_FILE)) {
  console.log("No PID file found — server may not be running in background.");
  process.exit(0);
}

const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
if (isNaN(pid)) {
  console.error("Invalid PID file.");
  fs.unlinkSync(PID_FILE);
  process.exit(1);
}

try {
  process.kill(pid, "SIGTERM");
  console.log(`✓ Sent SIGTERM to llama-server (PID: ${pid})`);
  fs.unlinkSync(PID_FILE);
} catch (err: any) {
  if (err.code === "ESRCH") {
    console.log(`Process ${pid} not found — already stopped.`);
    fs.unlinkSync(PID_FILE);
  } else {
    console.error("Failed to stop server:", err.message);
    process.exit(1);
  }
}
