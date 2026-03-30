/**
 * TimescaleDB migration library.
 *
 * Exports `applyTimescaleMigrations` — a reusable function that runs the SQL
 * files in timescale-migrations/ sequentially, tracking applied migrations in
 * `__timescale_migrations`.
 *
 * Gracefully skips when TimescaleDB is not installed (embedded-postgres case),
 * logging a warning instead of throwing.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const MIGRATIONS_DIR = fileURLToPath(new URL("./timescale-migrations", import.meta.url));

export interface TimescaleMigrationResult {
  /** Number of migration files applied in this run. */
  applied: number;
  /** True when TimescaleDB is not installed and migrations were skipped. */
  skipped: boolean;
  /** Reason for skipping (present when skipped=true). */
  skipReason?: string;
}

/**
 * Apply pending TimescaleDB migrations against the given connection string.
 *
 * - Creates a `__timescale_migrations` tracking table if absent.
 * - Reads SQL files from `timescale-migrations/` sorted alphabetically.
 * - Idempotent: already-applied files are skipped.
 * - Gracefully handles missing TimescaleDB extension (skipped=true, no throw).
 */
export async function applyTimescaleMigrations(
  connectionString: string,
): Promise<TimescaleMigrationResult> {
  const sql = postgres(connectionString);

  try {
    // Fast-check: is the TimescaleDB extension available?
    const extensionCheck = await sql<{ installed: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM pg_available_extensions WHERE name = 'timescaledb'
      ) AS installed
    `;
    const isAvailable = extensionCheck[0]?.installed === true;

    if (!isAvailable) {
      return {
        applied: 0,
        skipped: true,
        skipReason:
          "TimescaleDB extension is not available in this PostgreSQL installation. " +
          "Use `timescale/timescaledb` Docker image or install the extension to enable hypertables.",
      };
    }

    // Create tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS __timescale_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    // Get already-applied migrations
    const applied = await sql<{ name: string }[]>`
      SELECT name FROM __timescale_migrations ORDER BY name
    `;
    const appliedSet = new Set(applied.map((r) => r.name));

    // List SQL files sorted
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;

      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");

      await sql.unsafe(content);
      await sql`INSERT INTO __timescale_migrations (name) VALUES (${file})`;
      count++;
    }

    return { applied: count, skipped: false };
  } finally {
    await sql.end();
  }
}
