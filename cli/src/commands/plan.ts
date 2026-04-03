import * as fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { printClawDevCliBanner } from "../utils/banner.js";
import { buildSddPlan, DEFAULT_SDD_PLAN_TEMPLATE } from "./sdd.js";

export function normalizePlanSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatPlanDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolvePlanPath(slug: string, date = new Date(), dir = path.resolve("internal-docs", "plans")): string {
  const normalizedSlug = normalizePlanSlug(slug);
  if (!normalizedSlug) {
    throw new Error("Plan slug is required.");
  }
  return path.resolve(dir, `${formatPlanDate(date)}-${normalizedSlug}.md`);
}

export function buildPlanScaffold(title: string, source = DEFAULT_SDD_PLAN_TEMPLATE): string {
  return buildSddPlan(title, source);
}

export function createPlanFile(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
  date?: Date;
}): { path: string; created: boolean } {
  const targetPath = resolvePlanPath(opts.slug, opts.date, opts.dir);
  if (fs.existsSync(targetPath) && !opts.force) {
    throw new Error(`Plan already exists at ${targetPath}. Use --force to overwrite.`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const content = buildPlanScaffold(opts.title ?? opts.slug);
  fs.writeFileSync(targetPath, `${content.trimEnd()}\n`, "utf8");
  return { path: targetPath, created: true };
}

export async function planCommand(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
}): Promise<void> {
  printClawDevCliBanner();
  p.intro(pc.bgCyan(pc.black(" clawdev plan new ")));
  try {
    const result = createPlanFile({ slug: opts.slug, title: opts.title, dir: opts.dir, force: opts.force });
    p.log.success(`Created SDD plan at ${pc.bold(result.path)}`);
    p.log.message(
      `Next steps: fill in context, decisions, tasks, and verification, then link it from internal-docs/README.md if needed.`,
    );
    p.outro("Plan scaffold ready.");
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    p.outro("");
    throw error;
  }
}
