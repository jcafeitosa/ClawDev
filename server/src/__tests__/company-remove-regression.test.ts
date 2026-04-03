import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { openPGliteDatabase, companies, agents, heartbeatRuns, costEvents } from "@clawdev/db";
import { companyService } from "../services/companies.js";

describe("companyService.remove", () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  it(
    "removes companies with heartbeat runs and cost events without foreign key failures",
    async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawdev-company-remove-regression-"));
    const dbHandle = await openPGliteDatabase(dataDir);
    cleanup = dbHandle.stop;
    const db = dbHandle.db;
    const svc = companyService(db);

    const companyId = "11111111-1111-4111-8111-111111111111";
    const agentId = "22222222-2222-4222-8222-222222222222";
    const runId = "33333333-3333-4333-8333-333333333333";

    await db.insert(companies).values({
      id: companyId,
      name: "Delete Regression",
      issuePrefix: "DEL",
    });
    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "Regression Agent",
      adapterType: "codex_local",
    });
    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      status: "completed",
    });
    await db.insert(costEvents).values({
      companyId,
      agentId,
      heartbeatRunId: runId,
      provider: "openai",
      biller: "unknown",
      billingType: "unknown",
      model: "gpt-5.4",
      costCents: 123,
      occurredAt: new Date("2026-04-03T00:00:00.000Z"),
    });

    const removed = await svc.remove(companyId);

    expect(removed?.id).toBe(companyId);
    expect(await db.select().from(companies).where(eq(companies.id, companyId))).toEqual([]);
    expect(await db.select().from(agents).where(eq(agents.companyId, companyId))).toEqual([]);
    expect(await db.select().from(heartbeatRuns).where(eq(heartbeatRuns.companyId, companyId))).toEqual([]);
    expect(await db.select().from(costEvents).where(eq(costEvents.companyId, companyId))).toEqual([]);
    },
    60_000,
  );
});
