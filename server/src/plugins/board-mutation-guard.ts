/**
 * Board mutation guard — Elysia plugin.
 *
 * Prevents board-session (browser) users from making mutation requests
 * unless the Origin/Referer header matches a trusted origin.
 * This protects against CSRF-like attacks on board-authenticated sessions.
 *
 * Safe methods (GET, HEAD, OPTIONS) are always allowed.
 * Agent and local_implicit actors bypass the check.
 */

import { Elysia, status } from "elysia";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function parseOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function trustedOriginsForRequest(headers: Headers, serverPort: number): Set<string> {
  const origins = new Set<string>([
    `http://localhost:${serverPort}`,
    `http://127.0.0.1:${serverPort}`,
  ]);
  const host = headers.get("host")?.trim();
  if (host) {
    origins.add(`http://${host}`.toLowerCase());
    origins.add(`https://${host}`.toLowerCase());
  }
  return origins;
}

export function boardMutationGuard(opts: { serverPort: number }) {
  return new Elysia({ name: "board-mutation-guard" })
    .derive(({ request, actor }) => {
      if (SAFE_METHODS.has(request.method.toUpperCase())) return {};
      if (!actor || actor.type !== "board") return {};

      // Local-trusted mode and board API keys are not browser-session requests
      if (actor.source === "local_implicit" || actor.source === "board_api_key") return {};

      const trusted = trustedOriginsForRequest(request.headers, opts.serverPort);
      const origin = parseOrigin(request.headers.get("origin"));
      if (origin && trusted.has(origin)) return {};

      const refererOrigin = parseOrigin(request.headers.get("referer"));
      if (refererOrigin && trusted.has(refererOrigin)) return {};

      return status(403, { error: "Board mutation requires trusted browser origin" });
    })
    .as("scoped");
}
