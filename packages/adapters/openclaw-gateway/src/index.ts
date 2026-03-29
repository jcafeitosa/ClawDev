import type { AdapterMeta } from "@clawdev/shared";

export const type = "openclaw_gateway";
export const label = "OpenClaw Gateway";

export const meta: AdapterMeta = {
  type: "openclaw_gateway",
  label: "OpenClaw Gateway",
  icon: "Globe",
  authMethods: ["api_key"],
  envVarNames: ["OPENCLAW_API_KEY"],
  docsUrl: "",
  supportsQuota: false,
  supportsHealthCheck: false,
  billingModel: "metered_api",
};

export const models: { id: string; label: string }[] = [];

export const agentConfigurationDoc = `# openclaw_gateway agent configuration

Adapter: openclaw_gateway

Use when:
- You want ClawDev to invoke OpenClaw over the Gateway WebSocket protocol.
- You want native gateway auth/connect semantics instead of HTTP /v1/responses or /hooks/*.

Don't use when:
- You only expose OpenClaw HTTP endpoints.
- Your deployment does not permit outbound WebSocket access from the ClawDev server.

Core fields:
- url (string, required): OpenClaw gateway WebSocket URL (ws:// or wss://)
- headers (object, optional): handshake headers; supports x-openclaw-token / x-openclaw-auth
- authToken (string, optional): shared gateway token override
- password (string, optional): gateway shared password, if configured

Gateway connect identity fields:
- clientId (string, optional): gateway client id (default gateway-client)
- clientMode (string, optional): gateway client mode (default backend)
- clientVersion (string, optional): client version string
- role (string, optional): gateway role (default operator)
- scopes (string[] | comma string, optional): gateway scopes (default ["operator.admin"])
- disableDeviceAuth (boolean, optional): disable signed device payload in connect params (default false)

Request behavior fields:
- payloadTemplate (object, optional): additional fields merged into gateway agent params
- workspaceRuntime (object, optional): desired runtime service intents; ClawDev forwards these in a standardized clawdev.workspaceRuntime block for remote execution environments
- timeoutSec (number, optional): adapter timeout in seconds (default 120)
- waitTimeoutMs (number, optional): agent.wait timeout override (default timeoutSec * 1000)
- autoPairOnFirstConnect (boolean, optional): on first "pairing required", attempt device.pair.list/device.pair.approve via shared auth, then retry once (default true)
- clawdevApiUrl (string, optional): absolute ClawDev base URL advertised in wake text

Session routing fields:
- sessionKeyStrategy (string, optional): issue (default), fixed, or run
- sessionKey (string, optional): fixed session key when strategy=fixed (default clawdev)

Standard outbound payload additions:
- clawdev (object): standardized ClawDev context added to every gateway agent request
- clawdev.workspace (object, optional): resolved execution workspace for this run
- clawdev.workspaces (array, optional): additional workspace hints ClawDev exposed to the run
- clawdev.workspaceRuntime (object, optional): normalized runtime service intent config for the workspace

Standard result metadata supported:
- meta.runtimeServices (array, optional): normalized adapter-managed runtime service reports
- meta.previewUrl (string, optional): shorthand single preview URL
- meta.previewUrls (string[], optional): shorthand multiple preview URLs
`;
