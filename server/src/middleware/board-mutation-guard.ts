/**
 * CSRF protection for board mutations — Elysia port.
 *
 * Validates that write requests from board sessions come from trusted
 * browser origins. Allows safe methods (GET/HEAD/OPTIONS) and
 * non-browser auth sources (local_implicit, board_key).
 */

import type { Actor } from "./authz.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEFAULT_DEV_ORIGINS = [
  "http://localhost:3100",
  "http://127.0.0.1:3100",
];

function parseOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function trustedOriginsForRequest(headers: Headers): Set<string> {
  const origins = new Set(DEFAULT_DEV_ORIGINS.map((v) => v.toLowerCase()));
  const host = headers.get("host")?.trim();
  if (host) {
    origins.add(`http://${host}`.toLowerCase());
    origins.add(`https://${host}`.toLowerCase());
  }
  return origins;
}

function isTrustedBoardMutation(headers: Headers): boolean {
  const allowedOrigins = trustedOriginsForRequest(headers);
  const origin = parseOrigin(headers.get("origin"));
  if (origin && allowedOrigins.has(origin)) return true;

  const refererOrigin = parseOrigin(headers.get("referer"));
  if (refererOrigin && allowedOrigins.has(refererOrigin)) return true;

  return false;
}

/**
 * Check if a board mutation request should be blocked.
 * Returns an error response object if blocked, or undefined if allowed.
 */
export function checkBoardMutation(
  request: Request,
  actor?: Actor,
): { status: 403; body: { error: string } } | undefined {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return;
  if (!actor || actor.type !== "board") return;
  if (actor.source === "local_implicit" || actor.source === "board_key") return;

  if (!isTrustedBoardMutation(request.headers)) {
    return { status: 403, body: { error: "Board mutation requires trusted browser origin" } };
  }
}
