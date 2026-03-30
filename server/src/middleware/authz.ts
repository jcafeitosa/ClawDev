/**
 * Authorization helpers — Elysia port of routes/authz.ts.
 *
 * Framework-agnostic authorization checks. These work with the Actor
 * type from the auth middleware rather than Express Request.
 */

import { forbidden, unauthorized } from "../errors.js";

export interface Actor {
  type: "board" | "agent" | "none";
  source?: string;
  userId?: string;
  agentId?: string;
  companyId?: string;
  runId?: string;
  isInstanceAdmin?: boolean;
  companyIds?: string[];
  keyId?: string;
}

export function assertBoard(actor: Actor) {
  if (actor.type !== "board") {
    throw forbidden("Board access required");
  }
}

export function assertInstanceAdmin(actor: Actor) {
  assertBoard(actor);
  if (actor.source === "local_implicit" || actor.isInstanceAdmin) {
    return;
  }
  throw forbidden("Instance admin access required");
}

export function assertCompanyAccess(actor: Actor, companyId: string) {
  if (actor.type === "none") {
    throw unauthorized();
  }
  if (actor.type === "agent" && actor.companyId !== companyId) {
    throw forbidden("Agent key cannot access another company");
  }
  if (actor.type === "board" && actor.source !== "local_implicit" && !actor.isInstanceAdmin) {
    const allowedCompanies = actor.companyIds ?? [];
    if (!allowedCompanies.includes(companyId)) {
      throw forbidden("User does not have access to this company");
    }
  }
}

export function getActorInfo(actor: Actor) {
  if (actor.type === "none") {
    throw unauthorized();
  }
  if (actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: actor.agentId ?? "unknown-agent",
      agentId: actor.agentId ?? null,
      runId: actor.runId ?? null,
    };
  }
  return {
    actorType: "user" as const,
    actorId: actor.userId ?? "board",
    agentId: null,
    runId: actor.runId ?? null,
  };
}
