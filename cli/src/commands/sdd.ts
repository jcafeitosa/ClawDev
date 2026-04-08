import * as fs from "fs";
import path from "path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { printClawDevCliBanner } from "../utils/banner.js";

export const DEFAULT_SDD_PLAN_TEMPLATE = `# <Feature Name> — SDD Plan

## Context

Describe the product or platform problem in one or two paragraphs.

## Goals

- Goal 1
- Goal 2
- Goal 3

## Non-Goals

- Non-goal 1
- Non-goal 2

## Spec References

- \`internal-docs/GOAL.md\`
- \`internal-docs/PRODUCT.md\`
- \`internal-docs/SPEC.md\`
- \`internal-docs/SPEC-implementation.md\`

## Architecture Decisions

- Decision 1
- Decision 2
- Decision 3

## Task Breakdown

1. Task one
2. Task two
3. Task three

## Implementation Notes

- Files to touch
- Contracts to sync
- Migrations or schema changes
- UI surfaces to update

## Verification

- \`pnpm -r typecheck\`
- \`pnpm test:run\`
- \`pnpm build\`
- Smoke test or browser validation if user-visible

## Risks

- Risk 1
- Risk 2

## Rollout

- Rollout step 1
- Rollout step 2

## Rollback

- Rollback step 1
- Rollback step 2
`;

export const DEFAULT_SDD_SPEC_TEMPLATE = `# <Feature / Product Change> — Spec

## Summary

Describe the product change in one short paragraph.

## Problem

What pain or gap exists today?

## Goals

- Goal 1
- Goal 2
- Goal 3

## Non-Goals

- Non-goal 1
- Non-goal 2

## Users and Flow

Describe who uses this and the expected flow.

## Acceptance Criteria

- Criterion 1
- Criterion 2
- Criterion 3

## Constraints

- Constraint 1
- Constraint 2

## Open Questions

- Question 1
- Question 2
`;

export const DEFAULT_SDD_ADR_TEMPLATE = `# <Decision Title> — ADR

## Status

Proposed | Accepted | Superseded

## Context

Explain the situation and why a decision is needed.

## Decision

State the chosen approach clearly.

## Alternatives Considered

- Alternative 1
- Alternative 2
- Alternative 3

## Consequences

- Benefit 1
- Tradeoff 1
- Risk 1

## Rollout

Describe how the decision will be introduced safely.

## References

- Related spec
- Related plan
- Related implementation files
`;

export const DEFAULT_SDD_TASK_TEMPLATE = `# <Feature Name> — Task Breakdown

## Goal

What this task sequence delivers.

## Dependencies

- Dependency 1
- Dependency 2

## Tasks

1. Task one
2. Task two
3. Task three

## Verification

- \`pnpm -r typecheck\`
- \`pnpm test:run\`
- \`pnpm build\`
- Smoke test if user-facing

## Risks

- Risk 1
- Risk 2
`;

function replaceHeading(
  title: string,
  template: string,
  placeholder: string,
  fallbackTitle: string,
  suffix: string,
): string {
  const normalizedTitle = title.trim() || fallbackTitle;
  return template.replace(placeholder, `# ${normalizedTitle} ${suffix}`);
}

export function normalizeSddSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatSddDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveSddBundleDir(slug: string, date = new Date(), dir = path.resolve("internal-docs", "plans")): string {
  const normalizedSlug = normalizeSddSlug(slug);
  if (!normalizedSlug) {
    throw new Error("Plan slug is required.");
  }
  return path.resolve(dir, `${formatSddDate(date)}-${normalizedSlug}`);
}

export function buildSddPlan(title: string, source = DEFAULT_SDD_PLAN_TEMPLATE): string {
  return replaceHeading(title, source, "# <Feature Name> — SDD Plan", "Feature Name", "— SDD Plan");
}

export function buildSddSpec(title: string, source = DEFAULT_SDD_SPEC_TEMPLATE): string {
  return replaceHeading(
    title,
    source,
    "# <Feature / Product Change> — Spec",
    "Feature / Product Change",
    "— Spec",
  );
}

export function buildSddAdr(title: string, source = DEFAULT_SDD_ADR_TEMPLATE): string {
  return replaceHeading(title, source, "# <Decision Title> — ADR", "Decision Title", "— ADR");
}

export function buildSddTasks(title: string, source = DEFAULT_SDD_TASK_TEMPLATE): string {
  return replaceHeading(
    title,
    source,
    "# <Feature Name> — Task Breakdown",
    "Feature Name",
    "— Task Breakdown",
  );
}

export function createSddBundle(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
  date?: Date;
}): { path: string; created: true; files: string[] } {
  const bundleDir = resolveSddBundleDir(opts.slug, opts.date, opts.dir);
  const bundleName = path.basename(bundleDir);
  const files = [
    {
      path: path.resolve(bundleDir, "README.md"),
      content: `# ${opts.title ?? opts.slug} — SDD Bundle

This directory contains the full Spec-Driven Development package for \`${bundleName}\`.

## Files

- [Spec](./spec.md)
- [ADR](./adr.md)
- [Task breakdown](./tasks.md)
- [Plan](./plan.md)

## Suggested flow

1. Fill in \`spec.md\`.
2. Record architecture decisions in \`adr.md\`.
3. Break implementation into tasks in \`tasks.md\`.
4. Keep \`plan.md\` as the summary and rollout document.
`,
    },
    { path: path.resolve(bundleDir, "spec.md"), content: buildSddSpec(opts.title ?? opts.slug) },
    { path: path.resolve(bundleDir, "adr.md"), content: buildSddAdr(opts.title ?? opts.slug) },
    { path: path.resolve(bundleDir, "tasks.md"), content: buildSddTasks(opts.title ?? opts.slug) },
    { path: path.resolve(bundleDir, "plan.md"), content: buildSddPlan(opts.title ?? opts.slug) },
  ];

  if (!opts.force) {
    const existing = files.filter((file) => fs.existsSync(file.path));
    if (existing.length > 0) {
      throw new Error(`SDD bundle already exists at ${bundleDir}. Use --force to overwrite.`);
    }
  }

  fs.mkdirSync(bundleDir, { recursive: true });
  for (const file of files) {
    fs.mkdirSync(path.dirname(file.path), { recursive: true });
    fs.writeFileSync(file.path, `${file.content.trimEnd()}\n`, "utf8");
  }

  return { path: bundleDir, created: true, files: files.map((file) => file.path) };
}

export async function sddCommand(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
}): Promise<void> {
  printClawDevCliBanner();
  p.intro(pc.bgCyan(pc.black(" clawdev sdd new ")));
  try {
    const result = createSddBundle({ slug: opts.slug, title: opts.title, dir: opts.dir, force: opts.force });
    p.log.success(`Created SDD bundle at ${pc.bold(result.path)}`);
    for (const file of result.files) {
      p.log.message(`- ${pc.dim(file)}`);
    }
    p.log.message(
      "Next steps: fill in spec, ADR, and task breakdown, then keep the bundle linked from internal-docs/README.md if needed.",
    );
    p.outro("SDD bundle ready.");
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    p.outro("");
    throw error;
  }
}

export async function sddInitCommand(opts: {
  title?: string;
  slug?: string;
  dir?: string;
  force?: boolean;
  yes?: boolean;
} = {}): Promise<void> {
  printClawDevCliBanner();
  p.intro(pc.bgCyan(pc.black(" clawdev sdd init ")));

  const titleInput =
    opts.title ??
    (await p.text({
      message: "What is the feature or product change called?",
      placeholder: "Issue labels and documents",
    }));
  if (p.isCancel(titleInput)) {
    p.cancel("SDD setup cancelled.");
    return;
  }

  const inferredSlug = normalizeSddSlug(String(titleInput)) || "feature";
  const slugInput =
    opts.slug ??
    (await p.text({
      message: "What slug should we use for the bundle?",
      initialValue: inferredSlug,
      placeholder: inferredSlug,
    }));
  if (p.isCancel(slugInput)) {
    p.cancel("SDD setup cancelled.");
    return;
  }

  const dirInput =
    opts.dir ??
    (await p.text({
      message: "Where should the bundle live?",
      initialValue: path.resolve("internal-docs", "plans"),
      placeholder: "internal-docs/plans",
    }));
  if (p.isCancel(dirInput)) {
    p.cancel("SDD setup cancelled.");
    return;
  }

  const confirmed =
    opts.yes ??
    opts.force ??
    (await p.confirm({
      message: `Create bundle \`${formatSddDate()}-${normalizeSddSlug(String(slugInput))}\` in ${dirInput}?`,
      initialValue: true,
    }));
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("SDD setup cancelled.");
    return;
  }

  try {
    const result = createSddBundle({
      slug: String(slugInput),
      title: String(titleInput),
      dir: String(dirInput),
      force: true,
    });
    p.log.success(`Created SDD bundle at ${pc.bold(result.path)}`);
    for (const file of result.files) {
      p.log.message(`- ${pc.dim(file)}`);
    }
    p.log.message("Open the bundle README first, then fill spec → ADR → tasks → plan.");
    p.outro("SDD bundle ready.");
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    p.outro("");
    throw error;
  }
}
