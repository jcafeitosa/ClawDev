#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import process from 'process';

const port = Number(process.env.CHROME_DEBUG_PORT ?? 9222);
const userDataDir = process.env.CHROME_USER_DATA_DIR ?? join(tmpdir(), `clawdev-chrome-devtools-${port}`);

const candidates = (() => {
  if (process.platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  }
  if (process.platform === 'win32') {
    return ['chrome.exe'];
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
})();

const findExecutable = (bin) => {
  if (bin.includes('/')) return existsSync(bin) ? bin : null;
  const pathParts = (process.env.PATH ?? '').split(process.platform === 'win32' ? ';' : ':');
  for (const dir of pathParts) {
    if (!dir) continue;
    const fullPath = join(dir, bin);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
};

let chromeBinary = null;
for (const candidate of candidates) {
  chromeBinary = findExecutable(candidate);
  if (chromeBinary) break;
}

if (!chromeBinary) {
  console.error(
    `Unable to find a Chrome executable. Set CHROME_DEBUG_BINARY to your Chrome path or install Chrome.`,
  );
  process.exit(1);
}

const child = spawn(
  process.env.CHROME_DEBUG_BINARY ?? chromeBinary,
  [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--new-window',
    'about:blank',
  ],
  {
    stdio: 'inherit',
    detached: false,
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 0;
});
