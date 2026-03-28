/**
 * TimescaleDB migration runner.
 *
 * Runs the SQL files in timescale-migrations/ sequentially against the
 * database. These run AFTER the standard Drizzle migrations and convert
 * regular Postgres tables into TimescaleDB hypertables with continuous
 * aggregates and compression policies.
 *
 * Usage:
 *   pnpm --filter @clawdev/db timescale:migrate
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { resolveMigrationConnection } from "./migration-runtime.js";

const MIGRATIONS_DIR = fileURLToPath(new URL("./timescale-migrations", import.meta.url));

async function main(): Promise<void> {
  const resolved = await resolveMigrationConnection();

  console.log(`Running TimescaleDB migrations via ${resolved.source}`);

  const sql = postgres(resolved.connectionString);

  try {
    // Create tracking table if it doesn't exist
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

    // List migration files
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`  [skip] ${file} (already applied)`);
        continue;
      }

      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`  [apply] ${file}`);

      await sql.unsafe(content);
      await sql`INSERT INTO __timescale_migrations (name) VALUES (${file})`;
      count++;
    }

    if (count === 0) {
      console.log("No pending TimescaleDB migrations");
    } else {
      console.log(`Applied ${count} TimescaleDB migration(s)`);
    }
  } finally {
    await sql.end();
    await resolved.stop();
  }
}

await main();
