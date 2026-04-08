export const type = "pi_local";
export const label = "Pi Bridge (multi-provider)";

export const models: Array<{ id: string; label: string }> = [];

export const agentConfigurationDoc = `# pi_local agent configuration (Pi CLI v0.63.1)

Adapter: pi_local

Use when:
- You want ClawDev to run Pi (the AI coding agent) locally as the agent runtime
- You need a multi-provider bridge for providers not covered by dedicated adapters (groq, xai, mistral, cerebras, openrouter, minimax, kimi-coding, azure)
- You want provider/model routing in Pi format (--provider <name> --model <id>)
- You want Pi session resume across heartbeats via --session
- You need Pi's tool set (read, bash, edit, write, grep, find, ls)

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- Pi CLI is not installed on the machine
- The provider has a dedicated adapter (anthropic, openai, google, github) — use those adapters instead

Core fields:
- cwd (string, optional): working directory
- model (string, optional): model pattern — supports "provider/id" format (e.g. "xai/grok-4", "mistral/devstral-medium-latest") and optional ":thinking" suffix (e.g. "groq/qwen-qwq-32b:high")
- provider (string, optional): provider name — groq, xai, mistral, cerebras, openrouter, minimax, kimi-coding, azure. Note: anthropic, openai, google are handled by dedicated adapters
- thinking (string, optional): thinking level — off, minimal, low, medium, high, xhigh
- apiKey (string, optional): API key (defaults to provider-specific env vars)
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "pi"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

System prompt fields:
- systemPrompt (string, optional): custom system prompt
- appendSystemPrompt (string, optional): append to default system prompt

Tool fields:
- tools (string, optional): comma-separated tools — read, bash, edit, write, grep, find, ls
- noTools (boolean, optional): disable all built-in tools

Session fields:
- noSession (boolean, optional): don't save session (ephemeral)
- sessionDir (string, optional): directory for session storage
- models (string, optional): comma-separated model patterns for cycling (e.g. "sonnet:high,haiku:low")

Extension fields:
- extensions (string[], optional): extension file paths to load
- noExtensions (boolean, optional): disable extension discovery
- skills (string[], optional): skill file/directory paths
- noSkills (boolean, optional): disable skills discovery
- promptTemplates (string[], optional): prompt template paths
- noPromptTemplates (boolean, optional): disable prompt template discovery

Operational fields:
- timeoutSec (number, optional): run timeout
- graceSec (number, optional): SIGTERM grace period
- verbose (boolean, optional): force verbose startup
- offline (boolean, optional): disable network operations

Notes:
- Pi acts as a multi-provider bridge — use it for providers not covered by dedicated adapters.
- Providers with dedicated adapters (anthropic, openai, google, github) should use those adapters instead.
- BYOK: set provider-specific API keys via env field (e.g. { "GROQ_API_KEY": "...", "XAI_API_KEY": "..." }).
- Available bridge providers: groq, xai, mistral, cerebras, openrouter, minimax, kimi-coding, azure.
- Model discovery via \`pi --list-models\` when API keys are configured.
- Command surface exposed by \`pi --help\` includes: \`install\`, \`remove\`, \`uninstall\`, \`update\`, \`list\`, \`config\`, \`export\`, and \`--list-models\`.
- \`--provider\`, \`--model\`, \`--api-key\`, \`--tools\`, \`--thinking\`, \`--extensions\`, \`--skills\`, \`--prompt-templates\`, \`--themes\`, \`--no-tools\`, \`--no-extensions\`, \`--no-skills\`, \`--no-prompt-templates\`, \`--no-themes\`, \`--resume\`, \`--continue\`, \`--fork\`, and \`--offline\` are the main runtime controls ClawDev maps into agent config.
`;
