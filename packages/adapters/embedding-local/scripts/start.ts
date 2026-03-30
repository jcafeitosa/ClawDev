#!/usr/bin/env tsx
/**
 * Start the llama-server as an OpenAI-compatible embedding endpoint.
 *
 * Usage:
 *   pnpm start                  — foreground server on port 8085
 *   PORT=9000 pnpm start        — custom port
 *   THREADS=8 pnpm start        — custom thread count
 *   pnpm start --background     — write PID file and run in background
 *
 * The server exposes:
 *   POST http://localhost:8085/v1/embeddings
 *
 * Compatible with ClawDev:
 *   EMBEDDING_PROVIDER=local
 *   EMBEDDING_BASE_URL=http://localhost:8085
 *   EMBEDDING_MODEL=Qwen3-Embedding-0.6B
 *   EMBEDDING_DIMENSIONS=1024
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import os from "node:os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BIN_DIR = path.join(ROOT, "bin");
const MODELS_DIR = path.join(ROOT, "models");
const PID_FILE = path.join(ROOT, "server.pid");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT ?? "8085", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const THREADS = parseInt(process.env.THREADS ?? String(Math.max(4, os.cpus().length - 2)), 10);
const CTX_SIZE = parseInt(process.env.CTX_SIZE ?? "512", 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "256", 10);
const UBATCH_SIZE = parseInt(process.env.UBATCH_SIZE ?? "256", 10);
const BACKGROUND = process.argv.includes("--background");

// Model config — can be overridden via env
// Mungert GGUF repo uses lowercase naming convention
const MODEL_FILENAME = process.env.MODEL_FILENAME ?? "Qwen3-Embedding-0.6B-q4_k_m.gguf";

// ---------------------------------------------------------------------------
// Find binary
// ---------------------------------------------------------------------------

function findBinary(): string {
  const binaryName = process.platform === "win32" ? "llama-server.exe" : "llama-server";

  // 1. Check local bin/
  const localBin = path.join(BIN_DIR, binaryName);
  if (fs.existsSync(localBin)) return localBin;

  // 2. Check PATH
  try {
    const which = execSync(`which ${binaryName} 2>/dev/null`, { encoding: "utf-8" }).trim();
    if (which) return which;
  } catch {
    // not found
  }

  // 3. Check brew prefix
  try {
    const prefix = execSync("brew --prefix llama.cpp 2>/dev/null", { encoding: "utf-8" }).trim();
    const brewBin = path.join(prefix, "bin", binaryName);
    if (fs.existsSync(brewBin)) return brewBin;
  } catch {
    // not via brew
  }

  throw new Error(
    `llama-server binary not found.\n` +
      `Run: pnpm setup\n` +
      `Or install via Homebrew: brew install llama.cpp`,
  );
}

// ---------------------------------------------------------------------------
// Find model
// ---------------------------------------------------------------------------

function findModel(): string {
  const modelPath = path.join(MODELS_DIR, MODEL_FILENAME);
  if (fs.existsSync(modelPath)) return modelPath;

  // Scan for any .gguf file in models/
  const ggufFiles = fs
    .readdirSync(MODELS_DIR)
    .filter((f) => f.endsWith(".gguf"))
    .map((f) => path.join(MODELS_DIR, f));

  if (ggufFiles.length > 0) {
    const found = ggufFiles[0]!;
    console.warn(`⚠  ${MODEL_FILENAME} not found, using ${path.basename(found)} instead`);
    return found;
  }

  throw new Error(
    `Model file not found: models/${MODEL_FILENAME}\n` +
      `Run: pnpm setup  (or pnpm download:model)\n` +
      `Or set MODEL_FILENAME env var to a custom .gguf path`,
  );
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

function start() {
  const binary = findBinary();
  const model = findModel();

  // llama-server args for embedding mode
  // --embeddings   enables the /v1/embeddings endpoint
  // --pooling mean uses mean pooling (required for sentence embeddings)
  const serverArgs = [
    "--model", model,
    "--host", HOST,
    "--port", String(PORT),
    "--threads", String(THREADS),
    "--ctx-size", String(CTX_SIZE),
    "--batch-size", String(BATCH_SIZE),
    "--ubatch-size", String(UBATCH_SIZE),
    "--embeddings",
    "--pooling", "mean",
    "--log-disable",           // suppress verbose llama.cpp logs
  ];

  // GPU acceleration (Metal on macOS ARM64)
  if (process.platform === "darwin") {
    serverArgs.push("--n-gpu-layers", "99"); // offload all layers to Metal
  }

  console.log("=".repeat(60));
  console.log(" ClawDev Local Embedding Server");
  console.log("=".repeat(60));
  console.log(`\nModel:    ${path.relative(ROOT, model)}`);
  console.log(`Endpoint: http://${HOST}:${PORT}/v1/embeddings`);
  console.log(`Threads:  ${THREADS}`);
  console.log(`GPU:      ${process.platform === "darwin" ? "Metal (macOS)" : "CPU only"}`);
  console.log(`\nClawDev env vars:`);
  console.log(`  EMBEDDING_PROVIDER=local`);
  console.log(`  EMBEDDING_BASE_URL=http://localhost:${PORT}`);
  console.log(`  EMBEDDING_MODEL=Qwen3-Embedding-0.6B`);
  console.log(`  EMBEDDING_DIMENSIONS=1024`);
  console.log("\n" + "-".repeat(60));
  console.log("Starting llama-server...\n");

  // Set DYLD_LIBRARY_PATH so macOS can find the bundled dylibs (libggml-metal.dylib, etc.)
  // This is required because llama-server uses @rpath for its shared libraries.
  const env = { ...process.env };
  if (process.platform === "darwin") {
    const existing = env.DYLD_LIBRARY_PATH ?? "";
    env.DYLD_LIBRARY_PATH = existing ? `${BIN_DIR}:${existing}` : BIN_DIR;
  } else {
    // Linux: LD_LIBRARY_PATH
    const existing = env.LD_LIBRARY_PATH ?? "";
    env.LD_LIBRARY_PATH = existing ? `${BIN_DIR}:${existing}` : BIN_DIR;
  }

  const child = spawn(binary, serverArgs, {
    stdio: BACKGROUND ? "ignore" : "inherit",
    detached: BACKGROUND,
    env,
  });

  if (BACKGROUND) {
    child.unref();
    fs.writeFileSync(PID_FILE, String(child.pid));
    console.log(`Server started in background (PID: ${child.pid})`);
    console.log(`PID file: ${path.relative(ROOT, PID_FILE)}`);
    console.log(`To stop: pnpm stop`);
    process.exit(0);
  }

  child.on("error", (err) => {
    console.error("❌ Failed to start llama-server:", err.message);
    process.exit(1);
  });

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n❌ llama-server exited with code ${code}`);
      process.exit(code);
    }
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nStopping llama-server...");
    child.kill("SIGTERM");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    child.kill("SIGTERM");
    process.exit(0);
  });
}

start();
