export const type = "codex_local";
export const label = "Codex (local)";
export const DEFAULT_CODEX_LOCAL_MODEL = "gpt-5.4";
export const DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX = true;

export const models = [
  // priority 1 — recommended default
  { id: "gpt-5.4", label: "gpt-5.4", provider: "openai" },
  // priority 3
  { id: "gpt-5.4-mini", label: "gpt-5.4-mini", provider: "openai" },
  // priority 5
  { id: "gpt-5.3-codex", label: "gpt-5.3-codex", provider: "openai" },
  // priority 8
  { id: "gpt-5.2-codex", label: "gpt-5.2-codex", provider: "openai" },
  // priority 9
  { id: "gpt-5.2", label: "gpt-5.2", provider: "openai" },
  // priority 10
  { id: "gpt-5.1-codex-max", label: "gpt-5.1-codex-max", provider: "openai" },
  // priority 11 (hidden in cache)
  { id: "gpt-5.1-codex", label: "gpt-5.1-codex", provider: "openai" },
  // priority 12 (hidden in cache)
  { id: "gpt-5.1", label: "gpt-5.1", provider: "openai" },
  // priority 15 (hidden in cache)
  { id: "gpt-5-codex", label: "gpt-5-codex", provider: "openai" },
  // priority 16 (hidden in cache)
  { id: "gpt-5", label: "gpt-5", provider: "openai" },
  // priority 17 (hidden in cache)
  { id: "gpt-oss-120b", label: "gpt-oss-120b", provider: "openai" },
  // priority 18 (hidden in cache)
  { id: "gpt-oss-20b", label: "gpt-oss-20b", provider: "openai" },
  // priority 19
  { id: "gpt-5.1-codex-mini", label: "gpt-5.1-codex-mini", provider: "openai" },
  // priority 20 (hidden in cache)
  { id: "gpt-5-codex-mini", label: "gpt-5-codex-mini", provider: "openai" },
  // not in cache — kept for backward compatibility
  { id: "gpt-5.3-codex-spark", label: "gpt-5.3-codex-spark", provider: "openai" },
  { id: "o3", label: "o3", provider: "openai" },
  { id: "o4-mini", label: "o4-mini", provider: "openai" },
  { id: "gpt-5-mini", label: "gpt-5-mini", provider: "openai" },
  { id: "gpt-5-nano", label: "gpt-5-nano", provider: "openai" },
  { id: "o3-mini", label: "o3-mini", provider: "openai" },
  { id: "codex-mini-latest", label: "Codex Mini", provider: "openai" },
];

export const agentConfigurationDoc = `# codex_local agent configuration

Adapter: codex_local

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to stdin prompt at runtime
- model (string, optional): Codex model id
- modelReasoningEffort (string, optional): reasoning effort override (minimal|low|medium|high) passed via -c model_reasoning_effort=...
- promptTemplate (string, optional): run prompt template
- search (boolean, optional): run codex with --search
- dangerouslyBypassApprovalsAndSandbox (boolean, optional): run with bypass flag
- command (string, optional): defaults to "codex"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables
- workspaceStrategy (object, optional): execution workspace strategy; currently supports { type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }
- workspaceRuntime (object, optional): workspace runtime service intents; local host-managed services are realized before Codex starts and exposed back via context/env
- sandbox (string, optional): sandbox policy — "read-only", "workspace-write", or "danger-full-access"
- fullAuto (boolean, optional): convenience for auto-approve with workspace-write sandbox (equivalent to --full-auto)
- profile (string, optional): config profile name from config.toml
- addDirs (string[], optional): additional directories that should be writable alongside the workspace
- skipGitRepoCheck (boolean, optional): allow running outside a Git repository
- ephemeral (boolean, optional): run without persisting session files to disk
- features (object, optional): feature flags to enable/disable per run (e.g. { "memories": true, "web_search": false })
- ossProvider (string, optional): use local OSS model provider — "lmstudio" or "ollama"
- outputSchema (string, optional): path to JSON Schema file for structured model output

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Prompts are piped via stdin (Codex receives "-" prompt argument).
- If instructionsFilePath is configured, ClawDev prepends that file's contents to the stdin prompt on every run.
- Codex exec automatically applies repo-scoped AGENTS.md instructions from the active workspace. ClawDev cannot suppress that discovery in exec mode, so repo AGENTS.md files may still apply even when you only configured an explicit instructionsFilePath.
- ClawDev injects desired local skills into the effective CODEX_HOME/skills/ directory at execution time so Codex can discover "$clawdev" and related skills without polluting the project working directory. In managed-home mode (the default) this is ~/.clawdev/instances/<id>/companies/<companyId>/codex-home/skills/; when CODEX_HOME is explicitly overridden in adapter config, that override is used instead.
- Unless explicitly overridden in adapter config, ClawDev runs Codex with a per-company managed CODEX_HOME under the active ClawDev instance and seeds auth/config from the shared Codex home (the CODEX_HOME env var, when set, or ~/.codex).
- Some model/tool combinations reject certain effort levels (for example minimal with web search enabled).
- When ClawDev realizes a workspace/runtime for a run, it injects CLAWDEV_WORKSPACE_* and CLAWDEV_RUNTIME_* env vars for agent-side tooling.
`;
