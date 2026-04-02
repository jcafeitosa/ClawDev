import { mkdirSync, rmSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema/index.js";
import type { Db } from "./client.js";

const MIGRATIONS_FOLDER = fileURLToPath(new URL("./migrations", import.meta.url));

const activePGliteClients = new Map<string, PGlite>();

export type PGliteDatabaseHandle = {
  db: Db;
  dataDir: string;
  stop(): Promise<void>;
};

function normalizeDataDir(dataDir: string): string {
  const trimmed = dataDir.trim();
  if (!trimmed) throw new Error("PGlite data directory must not be empty");
  return trimmed;
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_FOLDER, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function splitMigrationStatements(content: string): string[] {
  return content
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

async function readMigrationFileContent(migrationFile: string): Promise<string> {
  return readFile(new URL(`./migrations/${migrationFile}`, import.meta.url), "utf8");
}

async function applyPGliteMigrations(client: PGlite): Promise<void> {
  const migrationFiles = await listMigrationFiles();
  for (const migrationFile of migrationFiles) {
    const migrationContent = await readMigrationFileContent(migrationFile);
    const statements = splitMigrationStatements(migrationContent);
    if (statements.length === 0) continue;

    await client.exec("BEGIN");
    try {
      for (const statement of statements) {
        await client.exec(statement);
      }
      await client.exec("COMMIT");
    } catch (error) {
      try {
        await client.exec("ROLLBACK");
      } catch {
        // Ignore rollback failures and surface the original error.
      }
      throw error;
    }
  }
}

export function encodePGliteUrl(dataDir: string): string {
  return `pglite:${encodeURIComponent(normalizeDataDir(dataDir))}`;
}

export function decodePGliteUrl(url: string): string | null {
  if (!url.startsWith("pglite:")) return null;
  try {
    return decodeURIComponent(url.slice("pglite:".length));
  } catch {
    return null;
  }
}

export function registerPGliteClient(dataDir: string, client: PGlite): void {
  activePGliteClients.set(normalizeDataDir(dataDir), client);
}

export function getRegisteredPGliteClient(dataDir: string): PGlite | undefined {
  return activePGliteClients.get(normalizeDataDir(dataDir));
}

export function unregisterPGliteClient(dataDir: string): void {
  activePGliteClients.delete(normalizeDataDir(dataDir));
}

export async function openPGliteDatabase(dataDir: string): Promise<PGliteDatabaseHandle> {
  const normalizedDataDir = normalizeDataDir(dataDir);
  rmSync(normalizedDataDir, { recursive: true, force: true });
  mkdirSync(normalizedDataDir, { recursive: true });

  const client = new PGlite(normalizedDataDir, {
    relaxedDurability: true,
  });

  await client.waitReady;
  registerPGliteClient(normalizedDataDir, client);

  const db = drizzlePglite(client, { schema });
  await applyPGliteMigrations(client);

  return {
    db: db as unknown as Db,
    dataDir: normalizedDataDir,
    stop: async () => {
      unregisterPGliteClient(normalizedDataDir);
      await client.close();
    },
  };
}

export function resolvePGliteDataDir(url: string): string | null {
  return decodePGliteUrl(url);
}
