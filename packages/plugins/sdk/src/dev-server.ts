import { existsSync } from "fs";
import { mkdir, readdir, stat } from "fs/promises";
import path from "path";

export interface PluginDevServerOptions {
  /** Plugin project root. Defaults to `process.cwd()`. */
  rootDir?: string;
  /** Relative path from root to built UI assets. Defaults to `dist/ui`. */
  uiDir?: string;
  /** Bind port for local preview server. Defaults to `4177`. */
  port?: number;
  /** Bind host. Defaults to `127.0.0.1`. */
  host?: string;
}

export interface PluginDevServer {
  url: string;
  close(): Promise<void>;
}

interface Closeable {
  close(): void;
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function normalizeFilePath(baseDir: string, reqPath: string): string {
  const pathname = reqPath.split("?")[0] || "/";
  const resolved = pathname === "/" ? "/index.js" : pathname;
  const absolute = path.resolve(baseDir, `.${resolved}`);
  const normalizedBase = `${path.resolve(baseDir)}${path.sep}`;
  if (!absolute.startsWith(normalizedBase) && absolute !== path.resolve(baseDir)) {
    throw new Error("path traversal blocked");
  }
  return absolute;
}

function sendJson(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

async function ensureUiDir(uiDir: string): Promise<void> {
  if (existsSync(uiDir)) return;
  await mkdir(uiDir, { recursive: true });
}

async function listFilesRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await listFilesRecursive(abs));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function snapshotSignature(rows: Array<{ file: string; mtimeMs: number }>): string {
  return rows.map((row) => `${row.file}:${Math.trunc(row.mtimeMs)}`).join("|");
}

async function startUiWatcher(uiDir: string, onReload: (filePath: string) => void): Promise<Closeable> {
  let previous = snapshotSignature(
    (await getUiBuildSnapshot(path.dirname(uiDir), path.basename(uiDir))).map((row) => ({
      file: row.file,
      mtimeMs: row.mtimeMs,
    })),
  );

  const timer = setInterval(async () => {
    try {
      const nextRows = await getUiBuildSnapshot(path.dirname(uiDir), path.basename(uiDir));
      const next = snapshotSignature(nextRows);
      if (next === previous) return;
      previous = next;
      onReload("__snapshot__");
    } catch {
      // Ignore transient read errors while bundlers are writing files.
    }
  }, 500);

  return {
    close() {
      clearInterval(timer);
    },
  };
}

function createSseResponse(onClose: (controller: ReadableStreamDefaultController<Uint8Array>) => void) {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
      controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`));
      onClose(controller);
    },
    cancel() {
      controllerRef = null;
    },
  });

  return {
    response: new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    }),
    write(controller: ReadableStreamDefaultController<Uint8Array>, payload: string) {
      controller.enqueue(encoder.encode(payload));
    },
    get controller() {
      return controllerRef;
    },
  };
}

/**
 * Start a local static server for plugin UI assets with SSE reload events.
 *
 * Endpoint summary:
 * - `GET /__clawdev__/health` for diagnostics
 * - `GET /__clawdev__/events` for hot-reload stream
 * - Any other path serves files from the configured UI build directory
 */
export async function startPluginDevServer(options: PluginDevServerOptions = {}): Promise<PluginDevServer> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const uiDir = path.resolve(rootDir, options.uiDir ?? "dist/ui");
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4177;

  await ensureUiDir(uiDir);

  const sseClients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const encoder = new TextEncoder();

  const notifyReload = (filePath: string) => {
    const rel = path.relative(uiDir, filePath);
    const payload = JSON.stringify({ type: "reload", file: rel, at: new Date().toISOString() });
    for (const client of sseClients) {
      client.enqueue(encoder.encode(`event: reload\ndata: ${payload}\n\n`));
    }
  };

  const watcher = await startUiWatcher(uiDir, notifyReload);

  const server = Bun.serve({
    hostname: host,
    port,
    idleTimeout: 0,
    fetch(req: Request) {
      const url = new URL(req.url);

      if (url.pathname === "/__clawdev__/health") {
        return sendJson({ ok: true, rootDir, uiDir });
      }

      if (url.pathname === "/__clawdev__/events") {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            sseClients.add(controller);
            controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`));
          },
          cancel(controller) {
            sseClients.delete(controller);
          },
        });
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      }

      try {
        const filePath = normalizeFilePath(uiDir, url.pathname + url.search);
        if (!existsSync(filePath)) {
          return sendJson({ error: "Not found" }, { status: 404 });
        }
        const file = Bun.file(filePath);
        if (!file.size) {
          return sendJson({ error: "Not found" }, { status: 404 });
        }
        return new Response(file.stream(), {
          headers: {
            "Content-Type": contentType(filePath),
          },
        });
      } catch {
        return sendJson({ error: "Not found" }, { status: 404 });
      }
    },
  });

  return {
    url: `http://${host}:${server.port}`,
    async close() {
      watcher.close();
      for (const client of sseClients) {
        client.close();
      }
      server.stop();
    },
  };
}

/**
 * Return a stable file+mtime snapshot for a built plugin UI directory.
 *
 * Used by the polling watcher fallback and useful for tests that need to assert
 * whether a UI build has changed between runs.
 */
export async function getUiBuildSnapshot(rootDir: string, uiDir = "dist/ui"): Promise<Array<{ file: string; mtimeMs: number }>> {
  const baseDir = path.resolve(rootDir, uiDir);
  if (!existsSync(baseDir)) return [];
  const files = await listFilesRecursive(baseDir);
  const rows = await Promise.all(files.map(async (filePath) => {
    const fileStat = await stat(filePath);
    return {
      file: path.relative(baseDir, filePath),
      mtimeMs: fileStat.mtimeMs,
    };
  }));
  return rows.sort((a, b) => a.file.localeCompare(b.file));
}
