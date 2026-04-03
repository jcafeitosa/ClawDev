import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSpecScaffold, createSpecFile, resolveSpecPath } from "../commands/spec.js";

describe("resolveSpecPath", () => {
  it("resolves a dated spec path under the spec directory", () => {
    expect(resolveSpecPath("New Feature", new Date("2026-04-03T12:00:00Z"), "/tmp/specs")).toBe(
      path.resolve("/tmp/specs", "2026-04-03-new-feature.md"),
    );
  });
});

describe("buildSpecScaffold", () => {
  it("replaces the default title placeholder", () => {
    expect(buildSpecScaffold("My Feature")).toContain("# My Feature — Spec");
  });
});

describe("createSpecFile", () => {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "tmp-sdd-spec-"));

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a dated spec file from the template scaffold", () => {
    const result = createSpecFile({
      slug: "Issue Labels",
      title: "Issue Labels",
      dir: tempRoot,
      date: new Date("2026-04-03T12:00:00Z"),
      force: true,
    });

    expect(result.created).toBe(true);
    expect(result.path).toBe(path.resolve(tempRoot, "2026-04-03-issue-labels.md"));
    expect(fs.readFileSync(result.path, "utf8")).toContain("# Issue Labels — Spec");
  });
});
