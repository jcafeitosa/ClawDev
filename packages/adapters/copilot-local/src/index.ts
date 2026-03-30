export const type = "copilot_local";
export const label = "GitHub Copilot (local)";

export const models = [
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "gpt-5.4", label: "GPT 5.4" },
  { id: "gpt-5.3-codex", label: "GPT 5.3 Codex" },
  { id: "gpt-5.2-codex", label: "GPT 5.2 Codex" },
  { id: "gpt-5.2", label: "GPT 5.2" },
  { id: "gpt-5.1-codex-max", label: "GPT 5.1 Codex Max" },
  { id: "gpt-5.1-codex", label: "GPT 5.1 Codex" },
  { id: "gpt-5.1", label: "GPT 5.1" },
  { id: "gpt-5.4-mini", label: "GPT 5.4 Mini" },
  { id: "gpt-5.1-codex-mini", label: "GPT 5.1 Codex Mini" },
  { id: "gpt-5-mini", label: "GPT 5 Mini" },
  { id: "gpt-4.1", label: "GPT 4.1" },
];

export const agentConfigurationDoc = `# copilot_local agent configuration

Adapter: copilot_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- model (string, optional): Copilot model id (e.g. "claude-sonnet-4.6", "gpt-5.3-codex")
- effort (string, optional): reasoning effort level — "low", "medium", "high", or "xhigh"
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "copilot"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin with -p flag and --yolo for auto-approval.
- Output is captured via --output-format json (JSONL stream).
- Sessions are resumed via --resume=<sessionId>.
- The copilot CLI must be authenticated via \`copilot login\` before use.
- BYOK mode is supported via COPILOT_PROVIDER_BASE_URL and COPILOT_MODEL env vars.
`;
