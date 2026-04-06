export interface StructuredSddInput {
  summary?: string | null;
  spec: string;
  design: string;
  validation?: string | null;
  subjectLabel: string;
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function section(title: string, body: string): string {
  return `## ${title}\n${body}`;
}

export function composeStructuredSddDescription(input: StructuredSddInput): string {
  const summary = normalizeText(input.summary);
  const spec = normalizeText(input.spec);
  const design = normalizeText(input.design);
  const validation = normalizeText(input.validation);
  const sections = [
    section("Spec", spec),
    section("Design", design),
  ];

  if (summary) {
    sections.unshift(section("Overview", summary));
  }
  if (validation) {
    sections.push(section("Validation", validation));
  }

  return [`# ${normalizeText(input.subjectLabel) || "Structured delivery"}`, ...sections].join("\n\n");
}
