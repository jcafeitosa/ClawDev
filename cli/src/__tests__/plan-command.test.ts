import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildPlanScaffold, createPlanFile, formatPlanDate, normalizePlanSlug, resolvePlanPath } from "../commands/plan.js";

describe("normalizePlanSlug", () => {
  it("normalizes mixed input into a file-safe slug", () => {
    expect(normalizePlanSlug("  SDD / Feature Plan  ")).toBe("sdd-feature-plan");
  });
});

describe("formatPlanDate", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(formatPlanDate(new Date("2026-04-03T12:00:00Z"))).toBe("2026-04-03");
  });
});

describe("resolvePlanPath", () => {
  it("resolves a dated plan path under the plans directory", () => {
    expect(resolvePlanPath("New Feature", new Date("2026-04-03T12:00:00Z"), "/tmp/plans")).toBe(
      path.resolve("/tmp/plans", "2026-04-03-new-feature.md"),
    );
  });
});

describe("buildPlanScaffold", () => {
  it("replaces the default title placeholder", () => {
    expect(buildPlanScaffold("My Feature")).toContain("# My Feature — SDD Plan");
  });
});

describe("createPlanFile", () => {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "tmp-sdd-plan-"));

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a dated plan file from the template scaffold", () => {
    const result = createPlanFile({
      slug: "Issue Labels",
      title: "Issue Labels",
      dir: tempRoot,
      date: new Date("2026-04-03T12:00:00Z"),
      force: true,
    });

    expect(result.created).toBe(true);
    expect(result.path).toBe(path.resolve(tempRoot, "2026-04-03-issue-labels.md"));
    expect(fs.readFileSync(result.path, "utf8")).toContain("# Issue Labels — SDD Plan");
  });
});
