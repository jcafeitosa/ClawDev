export const type = "gemini_local";
export const label = "Gemini CLI (local)";
export const DEFAULT_GEMINI_LOCAL_MODEL = "auto";

export const models = [
  { id: DEFAULT_GEMINI_LOCAL_MODEL, label: "Auto (recommended)", provider: "google" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", provider: "google" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "google" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite", provider: "google" },
];

export const agentConfigurationDoc = `# gemini_local agent configuration (Gemini CLI v0.35.3)

Adapter: gemini_local

Use when:
- You want ClawDev to run the Gemini CLI locally on the host machine
- You want Gemini chat sessions resumed across heartbeats with --resume
- You want ClawDev skills injected locally without polluting the global environment

Don't use when:
- You need webhook-style external invocation (use http or openclaw_gateway)
- You only need a one-shot script without an AI coding agent loop (use process)
- Gemini CLI is not installed on the machine that runs ClawDev

Core fields:
- cwd (string, optional): working directory for the agent process (created if missing when possible)
- model (string, optional): model id — "auto" (default), "gemini-2.5-pro", "gemini-2.5-flash", "gemini-3-pro-preview", etc.
- promptTemplate (string, optional): prompt template with {{agent.id}}, {{agent.name}} etc.
- bootstrapPromptTemplate (string, optional): prompt for new sessions only (not used on resume)
- instructionsFilePath (string, optional): absolute path to markdown instructions file prepended to the run prompt
- command (string, optional): defaults to "gemini"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Approval/Permission fields:
- approvalMode (string, optional): "default" | "auto_edit" | "yolo" | "plan". Default: yolo for ClawDev agents
- sandbox (boolean, optional): enable sandbox mode (default: false, passes --sandbox=none)
- allowedTools (string[], optional): tools allowed without confirmation (deprecated — use policy)
- policy (string[], optional): policy files or directories to load
- adminPolicy (string[], optional): admin policy files or directories

MCP/Extension fields:
- allowedMcpServerNames (string[], optional): restrict which MCP servers can be used
- extensions (string[], optional): specific extensions to use (default: all)
- includeDirectories (string[], optional): additional directories for workspace access

Session fields:
- (session management is automatic via --resume)

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds
- debug (boolean, optional): enable debug mode

Notes:
- Prompts passed via --prompt flag.
- Output via --output-format stream-json.
- Sessions resumed via --resume when stored session cwd matches the current cwd.
- Auth via Google OAuth (gemini settings) or GEMINI_API_KEY / GOOGLE_API_KEY env var.
- Skills injected via symlinks into \`~/.gemini/skills/\` so the CLI can discover both credentials and skills in their natural location.
- Approval mode defaults to "yolo" for unattended agent execution.
`;
