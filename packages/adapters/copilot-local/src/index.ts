export const type = "copilot_local";
export const label = "GitHub Copilot (local)";

export const models = [
  { id: "copilot", label: "GitHub Copilot" },
];

export const agentConfigurationDoc = `# copilot_local agent configuration

Adapter: copilot_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- model (string, optional): Copilot model id
- promptTemplate (string, optional): run prompt template
- command (string, optional): defaults to "copilot"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin.
- The copilot CLI must be authenticated via \`gh auth login\` or equivalent GitHub Copilot credentials before use.
`;
