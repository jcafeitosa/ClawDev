import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listCursorSkills,
  syncCursorSkills,
} from "@clawdev/adapter-cursor-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("cursor local skill sync", () => {
  const clawdevKey = "jcafeitosa/ClawDev/clawdev";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("reports configured ClawDev skills and installs them into the Cursor skills home", async () => {
    const home = await makeTempDir("clawdev-cursor-skill-sync-");
    cleanupDirs.add(home);

    const ctx = {
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        clawdevSkillSync: {
          desiredSkills: [clawdevKey],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.mode).toBe("persistent");
    expect(before.desiredSkills).toContain(clawdevKey);
    expect(before.entries.find((entry) => entry.key === clawdevKey)?.required).toBe(true);
    expect(before.entries.find((entry) => entry.key === clawdevKey)?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, [clawdevKey]);
    expect(after.entries.find((entry) => entry.key === clawdevKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "clawdev"))).isSymbolicLink()).toBe(true);
  });

  it("recognizes company-library runtime skills supplied outside the bundled ClawDev directory", async () => {
    const home = await makeTempDir("clawdev-cursor-runtime-skills-home-");
    const runtimeSkills = await makeTempDir("clawdev-cursor-runtime-skills-src-");
    cleanupDirs.add(home);
    cleanupDirs.add(runtimeSkills);

    const clawdevDir = await createSkillDir(runtimeSkills, "clawdev");
    const asciiHeartDir = await createSkillDir(runtimeSkills, "ascii-heart");

    const ctx = {
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        clawdevRuntimeSkills: [
          {
            key: "clawdev",
            runtimeName: "clawdev",
            source: clawdevDir,
            required: true,
            requiredReason: "Bundled ClawDev skills are always available for local adapters.",
          },
          {
            key: "ascii-heart",
            runtimeName: "ascii-heart",
            source: asciiHeartDir,
          },
        ],
        clawdevSkillSync: {
          desiredSkills: ["ascii-heart"],
        },
      },
    } as const;

    const before = await listCursorSkills(ctx);
    expect(before.warnings).toEqual([]);
    expect(before.desiredSkills).toEqual(["clawdev", "ascii-heart"]);
    expect(before.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("missing");

    const after = await syncCursorSkills(ctx, ["ascii-heart"]);
    expect(after.warnings).toEqual([]);
    expect(after.entries.find((entry) => entry.key === "ascii-heart")?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "ascii-heart"))).isSymbolicLink()).toBe(true);
  });

  it("keeps required bundled ClawDev skills installed even when the desired set is emptied", async () => {
    const home = await makeTempDir("clawdev-cursor-skill-prune-");
    cleanupDirs.add(home);

    const configuredCtx = {
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "cursor",
      config: {
        env: {
          HOME: home,
        },
        clawdevSkillSync: {
          desiredSkills: [clawdevKey],
        },
      },
    } as const;

    await syncCursorSkills(configuredCtx, [clawdevKey]);

    const clearedCtx = {
      ...configuredCtx,
      config: {
        env: {
          HOME: home,
        },
        clawdevSkillSync: {
          desiredSkills: [],
        },
      },
    } as const;

    const after = await syncCursorSkills(clearedCtx, []);
    expect(after.desiredSkills).toContain(clawdevKey);
    expect(after.entries.find((entry) => entry.key === clawdevKey)?.state).toBe("installed");
    expect((await fs.lstat(path.join(home, ".cursor", "skills", "clawdev"))).isSymbolicLink()).toBe(true);
  });
});
