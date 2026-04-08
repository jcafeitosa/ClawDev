import { createReadStream } from "fs";
import * as fs from "fs/promises";
import { readdir } from "fs/promises";
import { fileURLToPath } from "url";
import { spawn as nodeSpawn } from "child_process";
import http from "http";
import { Readable, Writable } from "stream";

type BunFileLike = {
  exists(): Promise<boolean>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array>;
  stat(): Promise<import("fs").Stats>;
};

type BunSpawnOptions = {
  cmd: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  stdin?: "pipe" | "inherit" | "ignore";
  stdout?: "pipe" | "inherit" | "ignore";
  stderr?: "pipe" | "inherit" | "ignore";
};

class BunGlob {
  private readonly pattern: string;

  constructor(pattern: string) {
    this.pattern = pattern;
  }

  async *scan(opts: { cwd?: string } = {}): AsyncGenerator<string> {
    const cwd = opts.cwd ?? process.cwd();
    const pattern = this.pattern.replace(/\\/g, "/");
    const match = pattern.match(/^(.*)\/\*\/([^/]+)$/);
    if (!match) return;
    const root = match[1]!;
    const leaf = match[2]!;
    const rootPath = root.startsWith("/") ? root : `${cwd.replace(/\\/g, "/")}/${root}`;
    let entries: string[];
    try {
      entries = await readdir(rootPath);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry || entry.startsWith(".")) continue;
      const candidate = `${rootPath}/${entry}/${leaf}`;
      try {
        if (await fs.access(candidate).then(() => true).catch(() => false)) {
          yield candidate;
        }
      } catch {
        // ignore
      }
    }
  }
}

function toPath(input: string | URL): string {
  return input instanceof URL ? fileURLToPath(input) : input;
}

function bunFile(input: string | URL): BunFileLike {
  const filePath = toPath(input);
  return {
    async exists() {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    async text() {
      return await fs.readFile(filePath, "utf8");
    },
    async arrayBuffer() {
      const buffer = await fs.readFile(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
    stream() {
      return Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
    },
    async stat() {
      return await fs.stat(filePath);
    },
  };
}

function bunWrite(pathOrUrl: string | URL, data: string | Uint8Array | ArrayBuffer | Blob): Promise<number> {
  const filePath = toPath(pathOrUrl);
  if (data instanceof Blob) {
    return data.arrayBuffer().then((arrayBuffer) => fs.writeFile(filePath, Buffer.from(arrayBuffer))).then(() => data.size);
  }
  return fs.writeFile(filePath, data as never).then(() => (typeof data === "string" ? Buffer.byteLength(data) : Buffer.byteLength(Buffer.from(data as ArrayBuffer | Uint8Array))));
}

function bunSpawn(options: BunSpawnOptions) {
  const [command, ...args] = options.cmd;
  let child: ReturnType<typeof nodeSpawn> | null = null;
  try {
    child = nodeSpawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: [options.stdin ?? "pipe", options.stdout ?? "pipe", options.stderr ?? "pipe"],
    });
  } catch {
    child = null;
  }

  if (!child) {
    const closed = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
    return {
      pid: undefined,
      stdout: closed,
      stderr: closed,
      stdin: {
        write() {},
        end() {},
      },
      exited: Promise.resolve(127),
      exitCode: 127,
      kill() {
        return false;
      },
    };
  }

  const closed = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  const stdout = child.stdout ? Readable.toWeb(child.stdout) as ReadableStream<Uint8Array> : closed;
  const stderr = child.stderr ? Readable.toWeb(child.stderr) as ReadableStream<Uint8Array> : closed;
  const stdin = child.stdin
    ? {
        write(chunk: string | Uint8Array) {
          child.stdin!.write(chunk);
        },
        end() {
          child.stdin!.end();
        },
      }
    : {
        write() {},
        end() {},
      };

  const exited = new Promise<number>((resolve) => {
    child.once("close", (code) => resolve(code ?? 0));
    child.once("error", () => resolve(127));
  });

  return {
    pid: child.pid,
    stdout,
    stderr,
    stdin,
    exited,
    get exitCode() {
      return child.exitCode;
    },
    kill(signal?: number | NodeJS.Signals) {
      return child.kill(signal);
    },
  };
}

if (!("Bun" in globalThis)) {
  // @ts-expect-error bun shim for node-based test runtime
  globalThis.Bun = {
    env: process.env,
    file: bunFile,
    write: bunWrite,
      spawn: bunSpawn,
      Glob: BunGlob,
      gc() {},
    serve(options: { hostname?: string; port: number; fetch: (request: Request) => Response | Promise<Response> }) {
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? "/", `http://${req.headers.host ?? `${options.hostname ?? "127.0.0.1"}:${options.port}`}`);
        const bodyChunks: Buffer[] = [];
        for await (const chunk of req) {
          bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const request = new Request(url, {
          method: req.method,
          headers: req.headers as HeadersInit,
          body: bodyChunks.length > 0 ? Buffer.concat(bodyChunks) : undefined,
        });
        const response = await options.fetch(request);
        res.statusCode = response.status;
        response.headers.forEach((value, key) => res.setHeader(key, value));
        if (!response.body) {
          res.end();
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        res.end(Buffer.from(arrayBuffer));
      });
      server.listen(options.port, options.hostname ?? "127.0.0.1");
      return {
        stop(closeConnections?: boolean) {
          if (closeConnections) {
            server.closeAllConnections?.();
            server.closeIdleConnections?.();
          }
          server.close();
        },
        fetch: options.fetch,
        hostname: options.hostname ?? "127.0.0.1",
        port: options.port,
      };
    },
  };
}
