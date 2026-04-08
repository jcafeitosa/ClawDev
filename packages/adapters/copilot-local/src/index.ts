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
- cwd (string, optional): default absolute working directory
- model (string, optional): model id with optional effort suffix "model:effort" (e.g. "gpt-5.4-mini:low", "claude-opus-4.6:high")
- effort (string, optional): reasoning effort level — "low", "medium", "high", or "xhigh". Overridden by model suffix.
- promptTemplate (string, optional): run prompt template with {{agent.id}}, {{agent.name}} etc.
- instructionsFilePath (string, optional): absolute path to markdown instructions file prepended to prompt
- command (string, optional): defaults to "copilot"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- configDir (string, optional): override Copilot config directory (--config-dir)

Permissions fields:
- yolo (boolean, optional): enable all permissions — tools, paths, URLs. Default: true for ClawDev agents
- allowAllTools (boolean, optional): auto-approve all tools without confirmation
- allowAllPaths (boolean, optional): disable file path verification
- allowAllUrls (boolean, optional): allow all URL access
- allowTools (string[], optional): specific tools to auto-approve (e.g. ["shell(git:*)", "write"])
- denyTools (string[], optional): tools to deny (takes precedence over allow)
- allowUrls (string[], optional): specific URLs/domains to allow
- denyUrls (string[], optional): URLs/domains to deny
- availableTools (string[], optional): only these tools available to the model
- excludedTools (string[], optional): these tools excluded from the model

Directory/Path fields:
- addDirs (string[], optional): additional directories to allow for file access (--add-dir)

Agent/Behavior fields:
- agent (string, optional): custom agent name to use (--agent)
- autopilot (boolean, optional): enable autopilot continuation in prompt mode
- maxAutopilotContinues (number, optional): max continuation messages in autopilot
- continueSession (boolean, optional): resume most recent session (--continue)
- noAskUser (boolean, optional): disable ask_user tool — agent works autonomously
- noCustomInstructions (boolean, optional): disable loading AGENTS.md and related files
- experimental (boolean, optional): enable experimental features
- disableParallelToolsExecution (boolean, optional): disable parallel tool execution
- disallowTempDir (boolean, optional): prevent automatic temp directory access
- enableReasoningSummaries (boolean, optional): request reasoning summaries for OpenAI models
- stream (string, optional): streaming mode, "on" or "off"
- sharePath (string, optional): write markdown share file after completion (--share)
- shareGist (boolean, optional): upload transcript to secret gist (--share-gist)
- logLevel (string, optional): cli log level (none|error|warning|info|debug|all|default)
- logDir (string, optional): cli log directory path
- pluginDirs (string[], optional): local plugin directories to load (--plugin-dir)

MCP fields:
- additionalMcpConfig (string, optional): JSON string or @filepath for additional MCP servers
- disableBuiltinMcps (boolean, optional): disable all built-in MCP servers
- disableMcpServers (string[], optional): specific MCP servers to disable
- addGithubMcpTools (string[], optional): additional GitHub MCP tools to enable
- addGithubMcpToolsets (string[], optional): additional GitHub MCP toolsets
- enableAllGithubMcpTools (boolean, optional): enable all GitHub MCP tools

BYOK fields:
- providerBaseUrl (string, optional): custom provider URL via COPILOT_PROVIDER_BASE_URL
- providerType (string, optional): "openai" | "azure" | "anthropic" via COPILOT_PROVIDER_TYPE
- providerApiKey (string, optional): API key for custom provider
- providerModel (string, optional): model name for BYOK via COPILOT_MODEL

Output fields:
- secretEnvVars (string[], optional): env var names to redact from output

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are passed via -p flag with --yolo for auto-approval by default
- Output captured via --output-format json (JSONL stream)
- Sessions resumed via --resume=<sessionId>
- Authenticate via \`copilot login\`
- BYOK via COPILOT_PROVIDER_BASE_URL + COPILOT_MODEL env vars
`;
