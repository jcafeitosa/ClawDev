import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildAdrScaffold, createAdrFile, resolveAdrPath } from "../commands/adr.js";

describe("resolveAdrPath", () => {
  it("resolves a dated ADR path under the plans directory", () => {
    expect(resolveAdrPath("New Decision", new Date("2026-04-03T12:00:00Z"), "/tmp/plans")).toBe(
      path.resolve("/tmp/plans", "2026-04-03-new-decision-adr.md"),
    );
  });
});

describe("buildAdrScaffold", () => {
  it("replaces the default title placeholder", () => {
    expect(buildAdrScaffold("My Decision")).toContain("# My Decision — ADR");
  });
});

describe("createAdrFile", () => {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "tmp-sdd-adr-"));

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("creates a dated ADR file from the template scaffold", () => {
    const result = createAdrFile({
      slug: "Issue Labels",
      title: "Issue Labels",
      dir: tempRoot,
      date: new Date("2026-04-03T12:00:00Z"),
      force: true,
    });

    expect(result.created).toBe(true);
    expect(result.path).toBe(path.resolve(tempRoot, "2026-04-03-issue-labels-adr.md"));
    expect(fs.readFileSync(result.path, "utf8")).toContain("# Issue Labels — ADR");
  });
});
