/**
 * Elysia auth middleware — validates session and attaches user to context.
 *
 * Placeholder for better-auth integration. The actual auth validation
 * will be wired up when the full auth system is migrated.
 */

import { Elysia } from "elysia";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

/**
 * Auth guard — rejects requests without a valid session.
 * Attach to routes that require authentication.
 */
export const elysiaAuth = new Elysia({ name: "auth" }).derive(
  async () => {
    const user: AuthUser | null = null;
    return { user };
  },
);

/**
 * Require authentication — use as a guard on protected routes.
 */
export const requireAuth = new Elysia({ name: "require-auth" })
  .use(elysiaAuth)
  .onBeforeHandle((ctx) => {
    const user = (ctx as { user?: AuthUser | null }).user ?? null;
    if (!user) {
      ctx.set.status = 401;
      return { error: "Unauthorized" };
    }
  });
