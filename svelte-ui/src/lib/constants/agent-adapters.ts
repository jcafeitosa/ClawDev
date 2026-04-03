export type AgentAdapterOption = {
  value: string;
  label: string;
};

const ADAPTER_LABELS: Record<string, string> = {
  process: "Process",
  http: "HTTP",
  claude_local: "Claude (Local)",
  codex_local: "Codex (Local)",
  copilot_local: "GitHub Copilot (Local)",
  opencode_local: "OpenCode (Local)",
  pi_local: "Pi (Local)",
  cursor: "Cursor",
  openclaw_gateway: "OpenClaw Gateway",
  gemini_local: "Gemini (Local)",
};

const SUPPORTED_SELECTION_ADAPTERS: string[] = [
  "claude_local",
  "codex_local",
  "copilot_local",
  "cursor",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "openclaw_gateway",
];

export const AGENT_ADAPTER_OPTIONS: AgentAdapterOption[] = SUPPORTED_SELECTION_ADAPTERS.map((value) => ({
  value,
  label: ADAPTER_LABELS[value] ?? value,
}));
