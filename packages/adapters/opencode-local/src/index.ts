export const type = "opencode_local";
export const label = "OpenCode (local)";

export const models: Array<{ id: string; label: string }> = [
  { id: "opencode/big-pickle", label: "Big Pickle" },
  { id: "opencode/gpt-5-nano", label: "GPT-5 Nano" },
  { id: "opencode/mimo-v2-omni-free", label: "Mimo v2 Omni (Free)" },
  { id: "opencode/mimo-v2-pro-free", label: "Mimo v2 Pro (Free)" },
  { id: "opencode/minimax-m2.5-free", label: "MiniMax M2.5 (Free)" },
  { id: "opencode/nemotron-3-super-free", label: "Nemotron 3 Super (Free)" },
];

export const agentConfigurationDoc = `# opencode_local agent configuration

Adapter: opencode_local
OpenCode CLI version: v1.3.5

Use when:
- You want ClawDev to run OpenCode locally as the agent runtime
- You want provider/model routing in OpenCode format (provider/model)
- You want OpenCode session resume across heartbeats

Don't use when:
- You need webhook-style external invocation (use openclaw_gateway or http)
- You only need one-shot shell commands (use process)
- OpenCode CLI is not installed on the machine

Core fields:
- cwd (string, optional): working directory for the agent process
- model (string, required): model in provider/model format (e.g. "opencode/big-pickle", "anthropic/claude-sonnet-4-6")
- variant (string, optional): model variant / reasoning effort (e.g. "high", "max", "minimal")
- promptTemplate (string, optional): prompt template
- command (string, optional): defaults to "opencode"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Session fields:
- forkSession (boolean, optional): fork session when continuing
- sessionTitle (string, optional): title for the session (--title)
- noSession (boolean, optional): equivalent to ephemeral mode

Agent fields:
- agent (string, optional): agent to use (--agent). Available: build, compaction, explore, general, plan, summary, title
- pure (boolean, optional): run without external plugins (--pure)

Execution fields:
- format (string, optional): output format — "default" or "json" (--format)
- files (string[], optional): files to attach to message (--file/-f)
- share (boolean, optional): share the session (--share)
- thinking (boolean, optional): show thinking blocks (--thinking)

Server/Remote fields:
- attach (string, optional): attach to running opencode server URL (--attach)
- password (string, optional): basic auth password (--password/-p)
- dir (string, optional): directory on remote server (--dir)
- port (number, optional): port for local server (--port)

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
- logLevel (string, optional): DEBUG | INFO | WARN | ERROR
- dangerouslySkipPermissions (boolean, optional): bypass permissions

Notes:
- Non-interactive mode is invoked via the \`opencode run\` subcommand.
- Structured output is available via --format json, which emits JSONL events.
- Model format is always provider/model (e.g. "opencode/big-pickle").
- Use \`opencode models\` to list all available models.
- Auth is configured via \`opencode providers login\`.
- Session statistics are available via \`opencode stats\`.
- Built-in agents: build, compaction, explore, general, plan, summary, title.
- Plugin support is managed via \`opencode plugin\`.
- ClawDev requires an explicit \`model\` value for \`opencode_local\` agents.
`;
