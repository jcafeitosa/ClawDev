import type { AdapterMeta } from "@clawdev/shared";

export const type = "copilot_local";
export const label = "GitHub Copilot (local)";

export const meta: AdapterMeta = {
  type: "copilot_local",
  label: "GitHub Copilot",
  icon: "Github",
  authMethods: ["cli_auth"],
  envVarNames: ["GITHUB_TOKEN"],
  docsUrl: "https://docs.github.com/copilot",
  supportsQuota: false,
  supportsHealthCheck: true,
  billingModel: "subscription",
};

export const models = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "o3", label: "o3" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "claude-sonnet-4", label: "Claude Sonnet 4 (via Copilot)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (via Copilot)" },
];

export const agentConfigurationDoc = `# copilot_local agent configuration

Adapter: copilot_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file injected at runtime
- model (string, optional): model id (default: gpt-4.1)
- effort (string, optional): reasoning effort passed via --effort (low|medium|high)
- promptTemplate (string, optional): run prompt template
- maxTurnsPerRun (number, optional): max turns for one run
- allowAllTools (boolean, optional): pass --allow-all-tools to copilot for auto-approval
- command (string, optional): defaults to "copilot"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Copilot starts and exposed back via context/env

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- When ClawDev realizes a workspace/runtime for a run, it injects CLAWDEV_WORKSPACE_* and CLAWDEV_RUNTIME_* env vars for agent-side tooling.
- GitHub Copilot CLI does not support stdin piping; prompts are passed via the -p flag.
- The --output-format json flag produces JSONL output with copilot-specific event types.
`;
