#!/usr/bin/env tsx
/**
 * Setup script for the local embedding server.
 *
 * Downloads:
 *   1. llama-server binary (from llama.cpp GitHub releases)
 *   2. Qwen3-Embedding-0.6B-Q4_K_M.gguf (from Hugging Face)
 *
 * Usage:
 *   pnpm setup              — downloads both binary + model
 *   pnpm setup --model-only — only downloads the model
 *   pnpm setup --binary-only— only downloads the binary
 */

import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BIN_DIR = path.join(ROOT, "bin");
const MODELS_DIR = path.join(ROOT, "models");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const modelOnly = args.includes("--model-only");
const binaryOnly = args.includes("--binary-only");
const doModel = !binaryOnly;
const doBinary = !modelOnly;

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

type Platform = "macos-arm64" | "macos-x86_64" | "linux-x86_64" | "linux-arm64" | "windows-x86_64";

function detectPlatform(): Platform {
  const { platform, arch } = process;
  if (platform === "darwin") {
    return arch === "arm64" ? "macos-arm64" : "macos-x86_64";
  }
  if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64" : "linux-x86_64";
  }
  if (platform === "win32") {
    return "windows-x86_64";
  }
  throw new Error(`Unsupported platform: ${platform}/${arch}`);
}

// ---------------------------------------------------------------------------
// llama.cpp release config
// ---------------------------------------------------------------------------

// Check latest at: https://github.com/ggml-org/llama.cpp/releases
const LLAMACPP_VERSION = "b5560";

const PLATFORM_ASSETS: Record<Platform, { archive: string; binary: string }> = {
  "macos-arm64": {
    archive: `llama-${LLAMACPP_VERSION}-bin-macos-arm64.zip`,
    binary: "llama-server",
  },
  "macos-x86_64": {
    archive: `llama-${LLAMACPP_VERSION}-bin-macos-x86_64.zip`,
    binary: "llama-server",
  },
  "linux-x86_64": {
    archive: `llama-${LLAMACPP_VERSION}-bin-ubuntu-x64.zip`,
    binary: "llama-server",
  },
  "linux-arm64": {
    archive: `llama-${LLAMACPP_VERSION}-bin-ubuntu-arm64.zip`,
    binary: "llama-server",
  },
  "windows-x86_64": {
    archive: `llama-${LLAMACPP_VERSION}-bin-win-avx2-x64.zip`,
    binary: "llama-server.exe",
  },
};

function getLlamaCppUrl(platform: Platform): string {
  const asset = PLATFORM_ASSETS[platform];
  return `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMACPP_VERSION}/${asset.archive}`;
}

// ---------------------------------------------------------------------------
// Model config — Qwen3-Embedding-0.6B Q4_K_M
// ---------------------------------------------------------------------------

// Mungert community GGUF repo — has Q4_K_M and other quantizations
// Official Qwen repo (Qwen/Qwen3-Embedding-0.6B-GGUF) only has Q8_0 and f16
const MODEL_FILENAME = "Qwen3-Embedding-0.6B-q4_k_m.gguf";
const MODEL_HF_REPO = "Mungert/Qwen3-Embedding-0.6B-GGUF";

// Hugging Face CDN URL for direct download
const MODEL_URL = `https://huggingface.co/${MODEL_HF_REPO}/resolve/main/${MODEL_FILENAME}`;

// Dimensions for Qwen3-Embedding-0.6B
export const QWEN3_EMBEDDING_DIMENSIONS = 1024;
export const QWEN3_EMBEDDING_MODEL_NAME = "Qwen3-Embedding-0.6B";

// ---------------------------------------------------------------------------
// Download helpers
// ---------------------------------------------------------------------------

function downloadFile(url: string, destPath: string, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n⬇  Downloading ${label}...`);
    console.log(`   URL: ${url}`);
    console.log(`   → ${destPath}`);

    const tmpPath = destPath + ".tmp";
    const file = fs.createWriteStream(tmpPath);

    let totalBytes = 0;
    let downloadedBytes = 0;
    let lastPct = -1;

    const request = (currentUrl: string, redirectCount = 0) => {
      if (redirectCount > 10) {
        reject(new Error("Too many redirects"));
        return;
      }

      const client = currentUrl.startsWith("https://") ? https : http;
      client
        .get(currentUrl, { headers: { "User-Agent": "clawdev-setup/1.0" } }, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            const location = res.headers.location;
            if (!location) {
              reject(new Error(`Redirect with no Location header from ${currentUrl}`));
              return;
            }
            // Handle relative redirects
            const redirectUrl = location.startsWith("http") ? location : new URL(location, currentUrl).toString();
            console.log(`   → Redirecting to ${redirectUrl.substring(0, 80)}...`);
            request(redirectUrl, redirectCount + 1);
            return;
          }

          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
            return;
          }

          totalBytes = parseInt(res.headers["content-length"] ?? "0", 10);

          res.on("data", (chunk: Buffer) => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0) {
              const pct = Math.floor((downloadedBytes / totalBytes) * 100);
              if (pct !== lastPct && pct % 5 === 0) {
                const mb = (downloadedBytes / 1024 / 1024).toFixed(1);
                const total = (totalBytes / 1024 / 1024).toFixed(1);
                process.stdout.write(`\r   ${pct}% (${mb} / ${total} MB)   `);
                lastPct = pct;
              }
            }
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close();
            process.stdout.write("\n");
            fs.renameSync(tmpPath, destPath);
            console.log(`   ✓ Saved to ${path.relative(ROOT, destPath)}`);
            resolve();
          });

          res.on("error", (err) => {
            fs.unlinkSync(tmpPath);
            reject(err);
          });
        })
        .on("error", (err) => {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          reject(err);
        });
    };

    request(url);
  });
}

// ---------------------------------------------------------------------------
// Binary setup
// ---------------------------------------------------------------------------

async function setupBinary(platform: Platform): Promise<string> {
  const asset = PLATFORM_ASSETS[platform];
  const binaryName = asset.binary;
  const binaryPath = path.join(BIN_DIR, binaryName);

  if (fs.existsSync(binaryPath)) {
    console.log(`✓ llama-server binary already exists at bin/${binaryName}`);
    return binaryPath;
  }

  // Check if llama-server is available system-wide first
  try {
    const systemPath = execSync("which llama-server 2>/dev/null || which llama-server.exe 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    if (systemPath) {
      console.log(`✓ llama-server found at system path: ${systemPath}`);
      // Create a symlink in bin/ for consistency
      fs.symlinkSync(systemPath, binaryPath);
      return binaryPath;
    }
  } catch {
    // not found system-wide
  }

  // Check if available via brew
  try {
    const brewPath = execSync("brew --prefix llama.cpp 2>/dev/null", { encoding: "utf-8" }).trim();
    if (brewPath) {
      const brewBin = path.join(brewPath, "bin", "llama-server");
      if (fs.existsSync(brewBin)) {
        console.log(`✓ llama-server found via Homebrew: ${brewBin}`);
        fs.symlinkSync(brewBin, binaryPath);
        return binaryPath;
      }
    }
  } catch {
    // not via brew
  }

  const archiveUrl = getLlamaCppUrl(platform);
  const archiveName = PLATFORM_ASSETS[platform].archive;
  const archivePath = path.join(BIN_DIR, archiveName);

  await downloadFile(archiveUrl, archivePath, `llama.cpp ${LLAMACPP_VERSION} (${platform})`);

  // Extract
  console.log(`   Extracting ${archiveName}...`);
  if (archiveName.endsWith(".zip")) {
    execSync(`cd "${BIN_DIR}" && unzip -o "${archiveName}" -d extracted_tmp`, { stdio: "inherit" });

    const extracted = path.join(BIN_DIR, "extracted_tmp");

    // Copy ALL dylibs (.dylib / .so) needed by llama-server — required for @rpath resolution
    // including libggml-metal.dylib (Apple Metal GPU acceleration)
    copySharedLibs(extracted, BIN_DIR);

    // Copy llama-server binary
    const found = findFile(extracted, binaryName);
    if (!found) {
      throw new Error(`Could not find ${binaryName} in extracted archive`);
    }
    fs.copyFileSync(found, binaryPath);
    fs.chmodSync(binaryPath, 0o755);

    // Also copy the Metal shader sources (needed at runtime on macOS)
    for (const metalFile of ["ggml-metal.metal", "ggml-metal-impl.h", "ggml-common.h"]) {
      const src = findFile(extracted, metalFile);
      if (src) {
        fs.copyFileSync(src, path.join(BIN_DIR, metalFile));
      }
    }

    // Cleanup
    fs.rmSync(extracted, { recursive: true, force: true });
    fs.unlinkSync(archivePath);
  }

  console.log(`   ✓ llama-server binary ready at bin/${binaryName} (Metal GPU support included)`);
  return binaryPath;
}

function copySharedLibs(srcDir: string, destDir: string) {
  const libExtensions = [".dylib", ".so"];
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const full = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      copySharedLibs(full, destDir);
    } else {
      const ext = path.extname(entry.name);
      if (libExtensions.includes(ext)) {
        const dest = path.join(destDir, entry.name);
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(full, dest);
        }
      }
    }
  }
}

function findFile(dir: string, name: string): string | null {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = findFile(full, name);
      if (result) return result;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Model download
// ---------------------------------------------------------------------------

async function setupModel(): Promise<string> {
  const modelPath = path.join(MODELS_DIR, MODEL_FILENAME);

  if (fs.existsSync(modelPath)) {
    const stat = fs.statSync(modelPath);
    const sizeMb = (stat.size / 1024 / 1024).toFixed(0);
    console.log(`✓ Model already exists: models/${MODEL_FILENAME} (${sizeMb} MB)`);
    return modelPath;
  }

  await downloadFile(MODEL_URL, modelPath, `Qwen3-Embedding-0.6B Q4_K_M (~500 MB)`);
  return modelPath;
}

// ---------------------------------------------------------------------------
// Config output
// ---------------------------------------------------------------------------

function writeEnvConfig(binaryPath?: string, modelPath?: string) {
  const envFile = path.join(ROOT, ".env.local");
  const lines: string[] = [
    "# Local embedding server config (generated by setup)",
    "# Add these to your server/.env or docker-compose override",
    "",
    "EMBEDDING_PROVIDER=local",
    `EMBEDDING_BASE_URL=http://localhost:8085`,
    `EMBEDDING_MODEL=${QWEN3_EMBEDDING_MODEL_NAME}`,
    `EMBEDDING_DIMENSIONS=${QWEN3_EMBEDDING_DIMENSIONS}`,
  ];
  fs.writeFileSync(envFile, lines.join("\n") + "\n");
  console.log(`\n✓ Config written to ${path.relative(ROOT, envFile)}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log(" ClawDev Local Embedding Server — Setup");
  console.log("=".repeat(60));

  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.mkdirSync(MODELS_DIR, { recursive: true });

  const platform = detectPlatform();
  console.log(`\nPlatform: ${platform}`);

  let binaryPath: string | undefined;
  let modelPath: string | undefined;

  if (doBinary) {
    binaryPath = await setupBinary(platform);
  }

  if (doModel) {
    modelPath = await setupModel();
  }

  writeEnvConfig(binaryPath, modelPath);

  console.log("\n" + "=".repeat(60));
  console.log(" Setup complete!");
  console.log("=".repeat(60));
  console.log("\nTo start the embedding server:");
  console.log("  pnpm start");
  console.log("\nOr with custom port:");
  console.log("  PORT=8085 pnpm start");
  console.log("\nEnvironment variables for ClawDev server:");
  console.log("  EMBEDDING_PROVIDER=local");
  console.log("  EMBEDDING_BASE_URL=http://localhost:8085");
  console.log(`  EMBEDDING_MODEL=${QWEN3_EMBEDDING_MODEL_NAME}`);
  console.log(`  EMBEDDING_DIMENSIONS=${QWEN3_EMBEDDING_DIMENSIONS}`);
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
