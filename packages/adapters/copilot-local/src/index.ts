export const type = "copilot_local";
export const label = "GitHub Copilot (local)";

const EFFORT_LEVELS = ["low", "medium", "high", "xhigh"] as const;

const BASE_MODELS = [
  { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6", provider: "anthropic" },
  { id: "claude-opus-4.6-fast", label: "Claude Opus 4.6 Fast", provider: "anthropic" },
  { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "anthropic" },
  { id: "claude-opus-4.5", label: "Claude Opus 4.5", provider: "anthropic" },
  { id: "claude-haiku-4.5", label: "Claude Haiku 4.5", provider: "anthropic" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4", provider: "anthropic" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", provider: "google" },
  { id: "gpt-5.4", label: "GPT 5.4", provider: "openai" },
  { id: "gpt-5.3-codex", label: "GPT 5.3 Codex", provider: "openai" },
  { id: "gpt-5.2-codex", label: "GPT 5.2 Codex", provider: "openai" },
  { id: "gpt-5.2", label: "GPT 5.2", provider: "openai" },
  { id: "gpt-5.1-codex-max", label: "GPT 5.1 Codex Max", provider: "openai" },
  { id: "gpt-5.1-codex", label: "GPT 5.1 Codex", provider: "openai" },
  { id: "gpt-5.1", label: "GPT 5.1", provider: "openai" },
  { id: "gpt-5.4-mini", label: "GPT 5.4 Mini", provider: "openai" },
  { id: "gpt-5.1-codex-mini", label: "GPT 5.1 Codex Mini", provider: "openai" },
  { id: "gpt-5-mini", label: "GPT 5 Mini", provider: "openai" },
  { id: "gpt-4.1", label: "GPT 4.1", provider: "openai" },
];

export { BASE_MODELS, EFFORT_LEVELS };

/**
 * Static model list including all effort variations.
 * Format: "model:effort" (e.g. "gpt-5.4-mini:low")
 * Plain model IDs (without effort) default to the provider's default effort.
 */
export const models = BASE_MODELS.flatMap((base) => [
  { id: base.id, label: `${base.label}`, provider: base.provider },
  ...EFFORT_LEVELS.map((effort) => ({
    id: `${base.id}:${effort}`,
    label: `${base.label} (${effort})`,
    provider: base.provider,
  })),
]);

export const agentConfigurationDoc = `# copilot_local agent configuration

Adapter: copilot_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- model (string, optional): Copilot model id with optional effort suffix.
  Plain model: "claude-sonnet-4.6", "gpt-5.3-codex"
  With effort: "gpt-5.4-mini:low", "claude-opus-4.6:high"
  Effort levels: low, medium, high, xhigh
- effort (string, optional): reasoning effort override — "low", "medium", "high", or "xhigh". Overridden by model suffix if present.
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "copilot"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are passed via -p flag with --yolo for auto-approval.
- Output is captured via --output-format json (JSONL stream).
- Sessions are resumed via --resume=<sessionId>.
- The copilot CLI must be authenticated via \`copilot login\` before use.
- BYOK mode is supported via COPILOT_PROVIDER_BASE_URL and COPILOT_MODEL env vars.
`;
