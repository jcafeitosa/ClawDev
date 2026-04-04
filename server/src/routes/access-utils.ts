/**
 * Utility functions for access / invite / join-request routes.
 *
 * These are pure helpers extracted so they can be unit-tested
 * independently of the Elysia route layer.
 */

import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Invite expiry
// ---------------------------------------------------------------------------

/** Returns a Date 10 minutes after the given creation timestamp (ms). */
export function companyInviteExpiresAt(createdAtMs: number): Date {
  return new Date(createdAtMs + 10 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Agent join grants
// ---------------------------------------------------------------------------

interface Grant {
  permissionKey: string;
  scope: Record<string, unknown> | null;
}

/**
 * Derives the permission grants for an agent joining via invite defaults.
 * Always ensures `tasks:assign` is present (appended if missing).
 */
export function agentJoinGrantsFromDefaults(
  defaults: { agent?: { grants?: Grant[] } } | null | undefined,
): Grant[] {
  const grants: Grant[] = defaults?.agent?.grants ? [...defaults.agent.grants] : [];
  const hasTasksAssign = grants.some((g) => g.permissionKey === "tasks:assign");
  if (!hasTasksAssign) {
    grants.push({ permissionKey: "tasks:assign", scope: null });
  }
  return grants;
}

// ---------------------------------------------------------------------------
// Agent manager resolution
// ---------------------------------------------------------------------------

interface AgentStub {
  id: string;
  role: string;
  reportsTo: string | null;
}

/**
 * Given the list of agents in a company, returns the id of the CEO that
 * should manage a newly-joined agent.
 *
 * Preference order:
 *   1. Root CEO (role === "ceo" && reportsTo === null)
 *   2. First CEO in list order
 *   3. null if no CEO exists
 */
export function resolveJoinRequestAgentManagerId(
  agents: AgentStub[],
): string | null {
  const ceos = agents.filter((a) => a.role === "ceo");
  if (ceos.length === 0) return null;
  const rootCeo = ceos.find((a) => a.reportsTo === null);
  return rootCeo ? rootCeo.id : ceos[0]!.id;
}

// ---------------------------------------------------------------------------
// Gateway defaults — accept
// ---------------------------------------------------------------------------

interface BuildAcceptOpts {
  adapterType: string;
  defaultsPayload: Record<string, unknown> | null | undefined;
  paperclipApiUrl?: unknown;
  inboundOpenClawTokenHeader?: string | null;
  inboundOpenClawAuthHeader?: string | null;
}

/**
 * Normalizes the defaults payload when an invite is accepted.
 *
 * For `openclaw_gateway` adapter type:
 *   - Unwraps wrapped header values (`{ value: "..." }` → `"..."`)
 *   - Injects `x-openclaw-token` from the inbound header when provided
 *   - Derives `x-openclaw-token` from `authorization: Bearer <token>` header
 *     when the token header isn't already set
 *
 * For other adapter types, the payload is returned unchanged.
 */
export function buildJoinDefaultsPayloadForAccept(
  opts: BuildAcceptOpts,
): Record<string, unknown> | null | undefined {
  if (opts.adapterType !== "openclaw_gateway") {
    return opts.defaultsPayload;
  }

  const payload: Record<string, unknown> = { ...(opts.defaultsPayload ?? {}) };
  if (
    typeof payload.paperclipApiUrl !== "string" ||
    payload.paperclipApiUrl.trim().length === 0
  ) {
    const paperclipApiUrl =
      typeof opts.paperclipApiUrl === "string" ? opts.paperclipApiUrl.trim() : "";
    if (paperclipApiUrl) {
      payload.paperclipApiUrl = paperclipApiUrl;
    }
  }
  let headers: Record<string, unknown> = {
    ...((payload.headers as Record<string, unknown>) ?? {}),
  };

  // Unwrap wrapped header values
  for (const [key, val] of Object.entries(headers)) {
    if (val && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
      headers[key] = (val as Record<string, unknown>).value;
    }
  }

  // Inject inbound token header
  if (opts.inboundOpenClawTokenHeader) {
    headers["x-openclaw-token"] = opts.inboundOpenClawTokenHeader;
  }

  if (opts.inboundOpenClawAuthHeader && !headers["x-openclaw-auth"]) {
    headers["x-openclaw-auth"] = opts.inboundOpenClawAuthHeader;
  }

  if (!headers["x-openclaw-token"]) {
    const authHeader =
      typeof headers["x-openclaw-auth"] === "string"
        ? headers["x-openclaw-auth"]
        : typeof headers.authorization === "string" &&
            headers.authorization.startsWith("Bearer ")
          ? headers.authorization.slice("Bearer ".length)
          : null;
    if (authHeader) {
      headers["x-openclaw-token"] = authHeader;
    }
  }

  payload.headers = headers;
  return payload;
}

// ---------------------------------------------------------------------------
// Gateway defaults — normalize for join
// ---------------------------------------------------------------------------

interface NormalizeJoinOpts {
  adapterType: string;
  defaultsPayload: Record<string, unknown>;
  deploymentMode: string;
  deploymentExposure: string;
  bindHost: string;
  allowedHostnames: string[];
}

/**
 * Normalizes agent defaults for a join request. For `openclaw_gateway`,
 * generates a persistent device key pair when device auth is enabled.
 */
export function normalizeAgentDefaultsForJoin(opts: NormalizeJoinOpts): {
  fatalErrors: string[];
  normalized: Record<string, unknown> | null;
} {
  const payload = { ...opts.defaultsPayload };
  const fatalErrors: string[] = [];

  if (opts.adapterType === "openclaw_gateway") {
    if (!payload.disableDeviceAuth) {
      payload.disableDeviceAuth = false;
      const { privateKey } = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
      });
      payload.devicePrivateKeyPem = privateKey.export({
        type: "sec1",
        format: "pem",
      });
    } else {
      payload.disableDeviceAuth = true;
      delete payload.devicePrivateKeyPem;
    }
  }

  return { fatalErrors, normalized: payload };
}

// ---------------------------------------------------------------------------
// Replay detection
// ---------------------------------------------------------------------------

interface ReplayCheckOpts {
  requestType: string;
  adapterType: string;
  existingJoinRequest: {
    requestType: string;
    adapterType: string;
    status: string;
  };
}

/**
 * Returns true if an openclaw_gateway agent join accept can be "replayed"
 * (i.e. the same invite accepted again), which is only allowed when the
 * existing join request is `pending_approval` or `approved`.
 */
export function canReplayOpenClawGatewayInviteAccept(
  opts: ReplayCheckOpts,
): boolean {
  if (opts.requestType !== "agent") return false;
  if (opts.adapterType !== "openclaw_gateway") return false;
  if (opts.existingJoinRequest.requestType !== "agent") return false;
  if (opts.existingJoinRequest.adapterType !== "openclaw_gateway") return false;
  return (
    opts.existingJoinRequest.status === "pending_approval" ||
    opts.existingJoinRequest.status === "approved"
  );
}

// ---------------------------------------------------------------------------
// Replay merge
// ---------------------------------------------------------------------------

/**
 * Merges the defaults payload from a replayed invite accept with the
 * existing stored payload. New fields override old ones; headers are
 * deep-merged.
 */
export function mergeJoinDefaultsPayloadForReplay(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...existing, ...incoming };

  // Deep-merge headers
  if (existing.headers || incoming.headers) {
    merged.headers = {
      ...((existing.headers as Record<string, unknown>) ?? {}),
      ...((incoming.headers as Record<string, unknown>) ?? {}),
    };
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Onboarding text document
// ---------------------------------------------------------------------------

interface OnboardingReqLike {
  protocol: string;
  header(name: string): string | undefined;
}

interface OnboardingInvite {
  id: string;
  companyId: string;
  inviteType: string;
  allowedJoinTypes: string;
  tokenHash: string;
  defaultsPayload: Record<string, unknown> | null;
  expiresAt: Date;
  invitedByUserId: string | null;
  revokedAt: Date | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DeploymentOpts {
  deploymentMode: string;
  deploymentExposure: string;
  bindHost: string;
  allowedHostnames: string[];
}

/**
 * Builds a plain-text onboarding document describing how an agent
 * should accept an invite and configure its OpenClaw gateway connection.
 */
export function buildInviteOnboardingTextDocument(
  req: OnboardingReqLike,
  token: string,
  invite: OnboardingInvite,
  opts: DeploymentOpts,
): string {
  const host = req.header("host") ?? "localhost:3100";
  const baseUrl = `${req.protocol}://${host}`;
  const acceptPath = `/api/invites/${token}/accept`;
  const claimPath = `/api/join-requests/{requestId}/claim-api-key`;
  const onboardingPath = `/api/invites/${token}/onboarding.txt`;

  const agentMessage = invite.defaultsPayload?.agentMessage as string | undefined;

  const lines: string[] = [
    "Paperclip OpenClaw Gateway Onboarding",
    "======================================",
    "",
    `Accept endpoint: ${baseUrl}${acceptPath}`,
    `Claim API key: ${baseUrl}${claimPath}`,
    `Onboarding text: ${baseUrl}${onboardingPath}`,
    "",
    "Suggested Paperclip base URLs to try:",
    `  - ${baseUrl}`,
    `  - http://${host}`,
    `  - http://host.docker.internal:${host.split(":")[1] ?? "3100"}`,
    "",
    'When joining, set adapterType "openclaw_gateway" and provide:',
    "  - paperclipApiUrl: set the first reachable candidate as agentDefaultsPayload.paperclipApiUrl",
    "  - headers.x-openclaw-token: your gateway token",
    "",
    "Gateway token unexpectedly short? Ensure you are passing the full token value.",
    "",
    "Important endpoints — Do NOT use /v1/responses or /hooks/* directly.",
    "",
    "After claiming your API key:",
    "  - Save to ~/.openclaw/workspace/paperclip-claimed-api-key.json",
    "  - Use the PAPERCLIP_API_KEY environment variable",
    "  - Use the saved token field for subsequent requests",
    "",
  ];

  if (opts.deploymentMode === "authenticated" && opts.deploymentExposure === "private") {
    lines.push(
      "Connectivity diagnostics:",
      `  This deployment binds to loopback hostname ${opts.bindHost}.`,
      "  If none are reachable, check firewall and Docker network settings.",
      "",
    );
  }

  if (agentMessage) {
    lines.push(
      "Message from inviter:",
      `  ${agentMessage}`,
      "",
    );
  }

  return lines.join("\n");
}
