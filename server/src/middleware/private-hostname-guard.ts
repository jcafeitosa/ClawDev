/**
 * Hostname validation guard — Elysia port.
 *
 * In private deployments, blocks requests to non-allowlisted hostnames.
 * Ensures the server only responds on explicitly allowed hosts.
 */

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function extractHostname(headers: Headers): string | null {
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = headers.get("host")?.trim();
  const raw = forwardedHost || hostHeader;
  if (!raw) return null;

  try {
    return new URL(`http://${raw}`).hostname.trim().toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

function normalizeAllowedHostnames(values: string[]): string[] {
  const unique = new Set<string>();
  for (const value of values) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

export function resolvePrivateHostnameAllowSet(opts: {
  allowedHostnames: string[];
  bindHost: string;
}): Set<string> {
  const configuredAllow = normalizeAllowedHostnames(opts.allowedHostnames);
  const bindHost = opts.bindHost.trim().toLowerCase();
  const allowSet = new Set<string>(configuredAllow);

  if (bindHost && bindHost !== "0.0.0.0") {
    allowSet.add(bindHost);
  }
  allowSet.add("localhost");
  allowSet.add("127.0.0.1");
  allowSet.add("::1");
  return allowSet;
}

function blockedHostnameMessage(hostname: string): string {
  return (
    `Hostname '${hostname}' is not allowed for this ClawDev instance. ` +
    `If you want to allow this hostname, please run pnpm clawdev allowed-hostname ${hostname}`
  );
}

export interface PrivateHostnameGuardOptions {
  enabled: boolean;
  allowedHostnames: string[];
  bindHost: string;
}

/**
 * Check if a request should be blocked by hostname guard.
 * Returns an error response object if blocked, or undefined if allowed.
 */
export function checkPrivateHostname(
  request: Request,
  opts: PrivateHostnameGuardOptions,
): { status: 403; body: string | { error: string } } | undefined {
  if (!opts.enabled) return;

  const allowSet = resolvePrivateHostnameAllowSet(opts);
  const hostname = extractHostname(request.headers);
  const wantsJson =
    new URL(request.url).pathname.startsWith("/api") ||
    request.headers.get("accept")?.includes("application/json");

  if (!hostname) {
    const error = "Missing Host header. If you want to allow a hostname, run pnpm clawdev allowed-hostname <host>.";
    return { status: 403, body: wantsJson ? { error } : error };
  }

  if (isLoopbackHostname(hostname) || allowSet.has(hostname)) return;

  const error = blockedHostnameMessage(hostname);
  return { status: 403, body: wantsJson ? { error } : error };
}
