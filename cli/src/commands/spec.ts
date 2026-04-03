import * as fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { printClawDevCliBanner } from "../utils/banner.js";
import { DEFAULT_SDD_SPEC_TEMPLATE, buildSddSpec, formatSddDate, normalizeSddSlug } from "./sdd.js";

export function resolveSpecPath(slug: string, date = new Date(), dir = path.resolve("internal-docs", "spec")): string {
  const normalizedSlug = normalizeSddSlug(slug);
  if (!normalizedSlug) {
    throw new Error("Spec slug is required.");
  }
  return path.resolve(dir, `${formatSddDate(date)}-${normalizedSlug}.md`);
}

export function buildSpecScaffold(title: string, source = DEFAULT_SDD_SPEC_TEMPLATE): string {
  return buildSddSpec(title, source);
}

export function createSpecFile(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
  date?: Date;
}): { path: string; created: boolean } {
  const targetPath = resolveSpecPath(opts.slug, opts.date, opts.dir);
  if (fs.existsSync(targetPath) && !opts.force) {
    throw new Error(`Spec already exists at ${targetPath}. Use --force to overwrite.`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const content = buildSpecScaffold(opts.title ?? opts.slug);
  fs.writeFileSync(targetPath, `${content.trimEnd()}\n`, "utf8");
  return { path: targetPath, created: true };
}

export async function specCommand(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
}): Promise<void> {
  printClawDevCliBanner();
  p.intro(pc.bgCyan(pc.black(" clawdev spec new ")));
  try {
    const result = createSpecFile({ slug: opts.slug, title: opts.title, dir: opts.dir, force: opts.force });
    p.log.success(`Created spec scaffold at ${pc.bold(result.path)}`);
    p.log.message(`Next steps: fill in problem, goals, acceptance criteria, and constraints.`);
    p.outro("Spec scaffold ready.");
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    p.outro("");
    throw error;
  }
}
