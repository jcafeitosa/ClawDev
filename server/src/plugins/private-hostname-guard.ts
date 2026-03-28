/**
 * Private hostname guard — Elysia plugin.
 *
 * When running in private/authenticated mode, blocks requests from
 * hostnames that are not explicitly allowed. Prevents accidental
 * exposure of the API on untrusted hostnames.
 *
 * Loopback addresses (localhost, 127.0.0.1, ::1) are always allowed.
 */

import { Elysia, status } from "elysia";

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

export function resolvePrivateHostnameAllowSet(opts: {
  allowedHostnames: string[];
  bindHost: string;
}): Set<string> {
  const allowSet = new Set<string>();
  for (const value of opts.allowedHostnames) {
    const trimmed = value.trim().toLowerCase();
    if (trimmed) allowSet.add(trimmed);
  }
  const bindHost = opts.bindHost.trim().toLowerCase();
  if (bindHost && bindHost !== "0.0.0.0") {
    allowSet.add(bindHost);
  }
  allowSet.add("localhost");
  allowSet.add("127.0.0.1");
  allowSet.add("::1");
  return allowSet;
}

export function privateHostnameGuard(opts: {
  enabled: boolean;
  allowedHostnames: string[];
  bindHost: string;
}) {
  if (!opts.enabled) {
    return new Elysia({ name: "private-hostname-guard" }).as("scoped");
  }

  const allowSet = resolvePrivateHostnameAllowSet({
    allowedHostnames: opts.allowedHostnames,
    bindHost: opts.bindHost,
  });

  return new Elysia({ name: "private-hostname-guard" })
    .derive(({ request }) => {
      const hostname = extractHostname(request.headers);

      if (!hostname) {
        return status(403, {
          error: "Missing Host header. If you want to allow a hostname, run `clawdev allowed-hostname <host>`.",
        });
      }

      if (isLoopbackHostname(hostname) || allowSet.has(hostname)) {
        return {};
      }

      return status(403, {
        error: `Hostname '${hostname}' is not allowed. Run \`clawdev allowed-hostname ${hostname}\` to allow it.`,
      });
    })
    .as("scoped");
}
