import pc from "picocolors";

const CLAWDEV_ART = [
  "██████╗  █████╗ ██████╗ ███████╗██████╗  ██████╗██╗     ██╗██████╗ ",
  "██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝██║     ██║██╔══██╗",
  "██████╔╝███████║██████╔╝█████╗  ██████╔╝██║     ██║     ██║██████╔╝",
  "██╔═══╝ ██╔══██║██╔═══╝ ██╔══╝  ██╔══██╗██║     ██║     ██║██╔═══╝ ",
  "██║     ██║  ██║██║     ███████╗██║  ██║╚██████╗███████╗██║██║     ",
  "╚═╝     ╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝╚═╝     ",
] as const;

const TAGLINE = "Open-source orchestration for zero-human companies";

export function printClawDevCliBanner(): void {
  const lines = [
    "",
    ...CLAWDEV_ART.map((line) => pc.cyan(line)),
    pc.blue("  ───────────────────────────────────────────────────────"),
    pc.bold(pc.white(`  ${TAGLINE}`)),
    "",
  ];

  console.log(lines.join("\n"));
}
