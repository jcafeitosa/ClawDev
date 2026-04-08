import * as fs from "fs";
import path from "path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { printClawDevCliBanner } from "../utils/banner.js";
import { DEFAULT_SDD_ADR_TEMPLATE, buildSddAdr, formatSddDate, normalizeSddSlug } from "./sdd.js";

export function resolveAdrPath(slug: string, date = new Date(), dir = path.resolve("internal-docs", "plans")): string {
  const normalizedSlug = normalizeSddSlug(slug);
  if (!normalizedSlug) {
    throw new Error("ADR slug is required.");
  }
  return path.resolve(dir, `${formatSddDate(date)}-${normalizedSlug}-adr.md`);
}

export function buildAdrScaffold(title: string, source = DEFAULT_SDD_ADR_TEMPLATE): string {
  return buildSddAdr(title, source);
}

export function createAdrFile(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
  date?: Date;
}): { path: string; created: boolean } {
  const targetPath = resolveAdrPath(opts.slug, opts.date, opts.dir);
  if (fs.existsSync(targetPath) && !opts.force) {
    throw new Error(`ADR already exists at ${targetPath}. Use --force to overwrite.`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const content = buildAdrScaffold(opts.title ?? opts.slug);
  fs.writeFileSync(targetPath, `${content.trimEnd()}\n`, "utf8");
  return { path: targetPath, created: true };
}

export async function adrCommand(opts: {
  slug: string;
  title?: string;
  dir?: string;
  force?: boolean;
}): Promise<void> {
  printClawDevCliBanner();
  p.intro(pc.bgCyan(pc.black(" clawdev adr new ")));
  try {
    const result = createAdrFile({ slug: opts.slug, title: opts.title, dir: opts.dir, force: opts.force });
    p.log.success(`Created ADR scaffold at ${pc.bold(result.path)}`);
    p.log.message(`Next steps: capture context, decision, alternatives, and rollout.`);
    p.outro("ADR scaffold ready.");
  } catch (error) {
    p.log.error(error instanceof Error ? error.message : String(error));
    p.outro("");
    throw error;
  }
}
