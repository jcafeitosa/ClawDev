/**
 * Log tailer — reads the server log file and emits new lines as they're appended.
 * Used by /api/logs/stream endpoint for real-time log streaming.
 */

import path from "path";
import { EventEmitter } from "events";
import { readConfigFile } from "../config-file.js";
import { resolveDefaultLogsDir, resolveHomeAwarePath } from "../home-paths.js";

export interface LogEvent {
  timestamp: string;
  level: string;
  category?: string;
  message: string;
  data?: Record<string, any>;
}

export class LogTailer extends EventEmitter {
  private logFilePath: string;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPosition = 0;

  constructor() {
    super();
    // Resolve log file path (same as in logger.ts)
    const envOverride = process.env.CLAWDEV_LOG_DIR?.trim();
    const logDir = envOverride
      ? resolveHomeAwarePath(envOverride)
      : readConfigFile()?.logging.logDir?.trim()
        ? resolveHomeAwarePath(readConfigFile()!.logging.logDir!)
        : resolveDefaultLogsDir();

    this.logFilePath = path.join(logDir, "server.log");
  }

  /**
   * Start tailing the log file from the current position.
   * Emits 'line' events with LogEvent objects.
   */
  start(): void {
    if (this.timer) return;
    void this.initialize();
    this.timer = setInterval(() => {
      void this.readNewLines();
    }, 1000);
  }

  /**
   * Stop tailing the log file.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async initialize(): Promise<void> {
    if (await Bun.file(this.logFilePath).exists()) {
      this.lastPosition = (await Bun.file(this.logFilePath).text()).length;
    }
  }

  /**
   * Read and emit new lines from the log file since last read.
   */
  private async readNewLines(): Promise<void> {
    if (!(await Bun.file(this.logFilePath).exists())) return;
    const content = await Bun.file(this.logFilePath).text();
    if (content.length < this.lastPosition) {
      // File was truncated
      this.lastPosition = 0;
    }

    const newContent = content.slice(this.lastPosition);
    const lines = newContent.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        this.emit("line", {
          timestamp: parsed.time,
          level: parsed.level,
          category: parsed.category,
          message: parsed.msg || "",
          data: {
            ...parsed,
            msg: undefined,
            time: undefined,
            level: undefined,
            category: undefined,
          },
        } as LogEvent);
      } catch {
        this.emit("line", {
          timestamp: new Date().toISOString(),
          level: "unknown",
          message: line,
        } as LogEvent);
      }
    }
    this.lastPosition = content.length;
  }

  /**
   * Get the full log file content (useful for initial load).
   */
  async readAll(): Promise<LogEvent[]> {
    if (!(await Bun.file(this.logFilePath).exists())) return [];
    const text = await Bun.file(this.logFilePath).text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    const events: LogEvent[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        events.push({
          timestamp: parsed.time,
          level: parsed.level,
          category: parsed.category,
          message: parsed.msg || "",
          data: {
            ...parsed,
            msg: undefined,
            time: undefined,
            level: undefined,
            category: undefined,
          },
        });
      } catch {
        events.push({
          timestamp: new Date().toISOString(),
          level: "unknown",
          message: line,
        });
      }
    }

    return events;
  }
}
