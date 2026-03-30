/**
 * TimescaleDB migration runner — CLI entrypoint.
 *
 * Usage:
 *   pnpm --filter @clawdev/db timescale:migrate
 */

import { resolveMigrationConnection } from "./migration-runtime.js";
import { applyTimescaleMigrations } from "./timescale-migrate-lib.js";

async function main(): Promise<void> {
  const resolved = await resolveMigrationConnection();

  console.log(`Running TimescaleDB migrations via ${resolved.source}`);

  try {
    const result = await applyTimescaleMigrations(resolved.connectionString);

    if (result.skipped) {
      console.warn(`  [skip] ${result.skipReason}`);
    } else if (result.applied === 0) {
      console.log("No pending TimescaleDB migrations");
    } else {
      console.log(`Applied ${result.applied} TimescaleDB migration(s)`);
    }
  } finally {
    await resolved.stop();
  }
}

await main();
