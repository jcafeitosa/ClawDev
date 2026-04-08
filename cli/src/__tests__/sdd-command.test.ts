import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSddAdr,
  buildSddPlan,
  buildSddSpec,
  buildSddTasks,
  createSddBundle,
  formatSddDate,
  normalizeSddSlug,
  sddInitCommand,
  resolveSddBundleDir,
} from "../commands/sdd.js";

describe("normalizeSddSlug", () => {
  it("normalizes mixed input into a file-safe slug", () => {
    expect(normalizeSddSlug("  SDD / Feature Bundle  ")).toBe("sdd-feature-bundle");
  });
});

describe("formatSddDate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(formatSddDate(new Date("2026-04-03T12:00:00Z"))).toBe("2026-04-03");
  });
});

describe("resolveSddBundleDir", () => {
  it("resolves a dated bundle directory under the plans directory", () => {
    expect(resolveSddBundleDir("New Feature", new Date("2026-04-03T12:00:00Z"), "/tmp/plans")).toBe(
      path.resolve("/tmp/plans", "2026-04-03-new-feature"),
    );
  });
});

describe("buildSdd templates", () => {
  it("replaces the default title placeholder in each scaffold", () => {
    expect(buildSddPlan("My Feature")).toContain("# My Feature — SDD Plan");
    expect(buildSddSpec("My Feature")).toContain("# My Feature — Spec");
    expect(buildSddAdr("My Feature")).toContain("# My Feature — ADR");
    expect(buildSddTasks("My Feature")).toContain("# My Feature — Task Breakdown");
  });
});

describe("createSddBundle", () => {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "tmp-sdd-bundle-"));

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a dated bundle directory with spec, adr, tasks, and plan files", () => {
    const result = createSddBundle({
      slug: "Issue Labels",
      title: "Issue Labels",
      dir: tempRoot,
      date: new Date("2026-04-03T12:00:00Z"),
      force: true,
    });

    expect(result.created).toBe(true);
    expect(result.path).toBe(path.resolve(tempRoot, "2026-04-03-issue-labels"));
    expect(result.files).toHaveLength(5);
    expect(fs.readFileSync(path.resolve(result.path, "README.md"), "utf8")).toContain(
      "# Issue Labels — SDD Bundle",
    );
    expect(fs.readFileSync(path.resolve(result.path, "spec.md"), "utf8")).toContain("# Issue Labels — Spec");
    expect(fs.readFileSync(path.resolve(result.path, "adr.md"), "utf8")).toContain("# Issue Labels — ADR");
    expect(fs.readFileSync(path.resolve(result.path, "tasks.md"), "utf8")).toContain("# Issue Labels — Task Breakdown");
    expect(fs.readFileSync(path.resolve(result.path, "plan.md"), "utf8")).toContain("# Issue Labels — SDD Plan");
  });
});

describe("sddInitCommand", () => {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "tmp-sdd-init-"));
  const fixedNow = new Date("2026-04-03T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates the bundle without prompting when options are provided", async () => {
    await sddInitCommand({
      title: "Issue Labels",
      slug: "Issue Labels",
      dir: tempRoot,
      yes: true,
    });

    expect(fs.existsSync(path.resolve(tempRoot, `${formatSddDate(fixedNow)}-issue-labels`))).toBe(true);
    expect(
      fs.readFileSync(path.resolve(tempRoot, `${formatSddDate(fixedNow)}-issue-labels`, "README.md"), "utf8"),
    ).toContain("# Issue Labels — SDD Bundle");
  });
});
