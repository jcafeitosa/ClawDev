import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@clawdev/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createClawDevRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"clawdev"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const clawdevKey = "jcafeitosa/ClawDev/clawdev";
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("repairs a Codex ClawDev skill symlink that still points at another live checkout", async () => {
    const currentRepo = await makeTempDir("clawdev-codex-current-");
    const oldRepo = await makeTempDir("clawdev-codex-old-");
    const skillsHome = await makeTempDir("clawdev-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createClawDevRepoSkill(currentRepo, "clawdev");
    await createClawDevRepoSkill(oldRepo, "clawdev");
    await fs.symlink(path.join(oldRepo, "skills", "clawdev"), path.join(skillsHome, "clawdev"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: clawdevKey,
          runtimeName: "clawdev",
          source: path.join(currentRepo, "skills", "clawdev"),
        }],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "clawdev"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "clawdev")),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Repaired Codex skill "clawdev"'),
      }),
    );
  });

  it("preserves a custom Codex skill symlink outside ClawDev repo checkouts", async () => {
    const currentRepo = await makeTempDir("clawdev-codex-current-");
    const customRoot = await makeTempDir("clawdev-codex-custom-");
    const skillsHome = await makeTempDir("clawdev-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createClawDevRepoSkill(currentRepo, "clawdev");
    await createCustomSkill(customRoot, "clawdev");
    await fs.symlink(path.join(customRoot, "custom", "clawdev"), path.join(skillsHome, "clawdev"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: clawdevKey,
        runtimeName: "clawdev",
        source: path.join(currentRepo, "skills", "clawdev"),
      }],
    });

    expect(await fs.realpath(path.join(skillsHome, "clawdev"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "clawdev")),
    );
  });

  it("prunes broken symlinks for unavailable ClawDev repo skills before Codex starts", async () => {
    const currentRepo = await makeTempDir("clawdev-codex-current-");
    const oldRepo = await makeTempDir("clawdev-codex-old-");
    const skillsHome = await makeTempDir("clawdev-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createClawDevRepoSkill(currentRepo, "clawdev");
    await createClawDevRepoSkill(oldRepo, "agent-browser");
    const staleTarget = path.join(oldRepo, "skills", "agent-browser");
    await fs.symlink(staleTarget, path.join(skillsHome, "agent-browser"));
    await fs.rm(staleTarget, { recursive: true, force: true });

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{
          key: clawdevKey,
          runtimeName: "clawdev",
          source: path.join(currentRepo, "skills", "clawdev"),
        }],
      },
    );

    await expect(fs.lstat(path.join(skillsHome, "agent-browser"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Removed stale Codex skill "agent-browser"'),
      }),
    );
  });

  it("preserves other live ClawDev skill symlinks in the shared workspace skill directory", async () => {
    const currentRepo = await makeTempDir("clawdev-codex-current-");
    const skillsHome = await makeTempDir("clawdev-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(skillsHome);

    await createClawDevRepoSkill(currentRepo, "clawdev");
    await createClawDevRepoSkill(currentRepo, "agent-browser");
    await fs.symlink(
      path.join(currentRepo, "skills", "agent-browser"),
      path.join(skillsHome, "agent-browser"),
    );

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{
        key: clawdevKey,
        runtimeName: "clawdev",
        source: path.join(currentRepo, "skills", "clawdev"),
      }],
    });

    expect((await fs.lstat(path.join(skillsHome, "clawdev"))).isSymbolicLink()).toBe(true);
    expect((await fs.lstat(path.join(skillsHome, "agent-browser"))).isSymbolicLink()).toBe(true);
    expect(await fs.realpath(path.join(skillsHome, "agent-browser"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "agent-browser")),
    );
  });
});
