export const type = "claude_local";
export const label = "Claude Code (local)";

export const models = [
  { id: "opus", label: "Claude Opus (latest)", provider: "anthropic", status: "available" as const },
  { id: "sonnet", label: "Claude Sonnet (latest)", provider: "anthropic", status: "available" as const },
  { id: "haiku", label: "Claude Haiku (latest)", provider: "anthropic", status: "available" as const },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic", status: "available" as const },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", status: "available" as const },
  { id: "claude-haiku-4-6", label: "Claude Haiku 4.6", provider: "anthropic", status: "available" as const },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic", status: "available" as const },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", status: "available" as const },
];

export const agentConfigurationDoc = `# claude_local agent configuration

Adapter: claude_local

Core fields:
- cwd (string, optional): working directory for the agent process (created if missing when possible)
- model (string, optional): model alias ("opus", "sonnet", "haiku") or full name ("claude-opus-4-6"); omit or leave unset to use Claude's default selection. Do not pass "auto".
- effort (string, optional): reasoning effort -- "low", "medium", "high", or "max"
- chrome (boolean, optional): enable Claude in Chrome integration
- promptTemplate (string, optional): prompt template with {{agent.id}}, {{agent.name}} etc.
- bootstrapPromptTemplate (string, optional): prompt for new sessions only
- instructionsFilePath (string, optional): absolute path to a markdown instructions file
- command (string, optional): defaults to "claude"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Session fields:
- maxTurnsPerRun (number, optional): maximum turns per execution (--max-turns)
- noSessionPersistence (boolean, optional): disable session saving to disk
- forkSession (boolean, optional): create new session ID when resuming
- sessionName (string, optional): display name for the session (--name)

Permission fields:
- dangerouslySkipPermissions (boolean, optional): bypass all permission checks
- allowDangerouslySkipPermissions (boolean, optional): enable bypassing as an option
- permissionMode (string, optional): "acceptEdits" | "bypassPermissions" | "default" | "dontAsk" | "plan" | "auto"
- allowedTools (string[], optional): tools to auto-allow (e.g. ["Bash(git:*)", "Edit"])
- disallowedTools (string[], optional): tools to deny
- tools (string[], optional): specify available tools from built-in set (e.g. ["Bash", "Edit", "Read"])

Budget fields:
- maxBudgetUsd (number, optional): maximum dollar amount for API calls
- fallbackModel (string, optional): fallback model when primary is overloaded

System prompt fields:
- systemPrompt (string, optional): override system prompt entirely
- appendSystemPrompt (string, optional): append to default system prompt

MCP fields:
- mcpConfig (string[], optional): MCP server config JSON files or strings
- strictMcpConfig (boolean, optional): only use servers from mcpConfig
- pluginDirs (string[], optional): plugin directories to load

Directory fields:
- addDirs (string[], optional): additional directories for tool access

Agent fields:
- agent (string, optional): custom agent name (--agent)

Advanced fields:
- bare (boolean, optional): minimal mode -- skip hooks, LSP, plugin sync, auto-memory
- brief (boolean, optional): enable SendUserMessage tool
- verbose (boolean, optional): override verbose mode
- betas (string[], optional): beta headers for experimental API features

Workspace fields:
- workspaceStrategy (object, optional): { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Claude starts and exposed back via context/env
- worktree (string, optional): create git worktree for session

Output fields:
- jsonSchema (string, optional): JSON Schema for structured output validation
- disableSlashCommands (boolean, optional): disable skill resolution

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin with --print flag
- Output is streamed via --output-format stream-json
- Sessions are resumed via --resume
- Auth via claude.ai subscription, ANTHROPIC_API_KEY, or Bedrock/Vertex
- Claude auth status available via \`claude auth status --json\`
- Native CLI resources available via \`claude --help\` include:
  - agent management: \`claude agents\`
  - auth management: \`claude auth\`
  - auto-mode inspection: \`claude auto-mode\`
  - health and updater checks: \`claude doctor\`
  - native install/update: \`claude install\`, \`claude update\`, \`claude upgrade\`
  - MCP management: \`claude mcp\`
  - plugin management: \`claude plugin\`, \`claude plugins\`
  - long-lived auth token setup: \`claude setup-token\`
- Slash command / skill resolution can be disabled with \`--disable-slash-commands\`.
- When ClawDev realizes a workspace/runtime for a run, it injects CLAWDEV_WORKSPACE_* and CLAWDEV_RUNTIME_* env vars for agent-side tooling.
`;
