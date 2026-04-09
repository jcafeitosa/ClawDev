import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { companies, openPGliteDatabase, type PGliteDatabaseHandle } from "@clawdev/db";
import { createProviderStatusService } from "../services/provider-status.js";

describe("provider status scoping", () => {
  let db!: PGliteDatabaseHandle["db"];
  let handle: PGliteDatabaseHandle | null = null;

  beforeAll(async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawdev-provider-status-"));
    handle = await openPGliteDatabase(dataDir);
    db = handle.db;
  }, 180_000);

  afterAll(async () => {
    await handle?.stop();
  }, 180_000);

  it("lets a company-scoped status override the global fallback", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Scoped Co",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    const svc = createProviderStatusService(db);
    await svc.updateStatus("codex_local", "gpt-5.4", "available", "global ok");
    await svc.updateStatus(
      "codex_local",
      "gpt-5.4",
      "unavailable",
      "company blocked",
      { companyId },
    );

    await expect(svc.isAvailable("codex_local", "gpt-5.4")).resolves.toBe(true);
    await expect(svc.isAvailable("codex_local", "gpt-5.4", { companyId })).resolves.toBe(false);
  });

  it("prefers auth-profile status over company fallback for the same company", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Profile Co",
      issuePrefix: `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });

    const svc = createProviderStatusService(db);
    await svc.updateStatus(
      "pi_local",
      "openai/gpt-5.4",
      "unavailable",
      "company degraded",
      { companyId },
    );
    await svc.updateStatus(
      "pi_local",
      "openai/gpt-5.4",
      "available",
      "profile healthy",
      { companyId, authProfileKey: "profile-1" },
    );

    await expect(
      svc.isAvailable("pi_local", "openai/gpt-5.4", { companyId }),
    ).resolves.toBe(false);
    await expect(
      svc.isAvailable("pi_local", "openai/gpt-5.4", {
        companyId,
        authProfileKey: "profile-1",
      }),
    ).resolves.toBe(true);
  });

  it("clears expired cooldowns only within the requested scope", async () => {
    const companyA = randomUUID();
    const companyB = randomUUID();
    await db.insert(companies).values([
      {
        id: companyA,
        name: "Cooldown A",
        issuePrefix: `T${companyA.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
      {
        id: companyB,
        name: "Cooldown B",
        issuePrefix: `T${companyB.replace(/-/g, "").slice(0, 6).toUpperCase()}`,
        requireBoardApprovalForNewAgents: false,
      },
    ]);

    const svc = createProviderStatusService(db);
    const past = new Date(Date.now() - 60_000);
    await svc.markCooldown("codex_local", "gpt-5.4-mini", past, "expired-global");
    await svc.markCooldown("codex_local", "gpt-5.4-mini", past, "expired", { companyId: companyA });
    await svc.markCooldown("codex_local", "gpt-5.4-mini", past, "expired", { companyId: companyB });

    const cleared = await svc.clearExpiredCooldownsForScope({ companyId: companyA });

    expect(cleared).toBe(1);
    const globalRows = await svc.listEffectiveStatuses(undefined, "codex_local");
    const effectiveA = await svc.listEffectiveStatuses({ companyId: companyA }, "codex_local");
    const effectiveB = await svc.listEffectiveStatuses({ companyId: companyB }, "codex_local");
    expect(globalRows.find((row) => row.modelId === "gpt-5.4-mini")?.status).toBe("cooldown");
    expect(effectiveA[0]?.status).toBe("available");
    expect(effectiveB[0]?.status).toBe("cooldown");
    await expect(
      svc.isAvailable("codex_local", "gpt-5.4-mini", { companyId: companyA }),
    ).resolves.toBe(true);
  });
});
