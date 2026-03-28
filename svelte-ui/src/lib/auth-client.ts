/**
 * Better Auth client for SvelteKit.
 *
 * Uses the official `better-auth/svelte` integration which provides:
 * - Reactive session state via nano-store ($session)
 * - Type-safe sign-in/sign-up/sign-out methods
 * - Automatic cookie-based session management
 * - Real-time auth state synchronization
 *
 * This replaces the manual fetch wrapper pattern used in the legacy React UI.
 *
 * @see https://better-auth.com/docs/integrations/svelte-kit
 */

import { createAuthClient } from "better-auth/svelte";

/**
 * Auth client instance — use throughout the SvelteKit app.
 *
 * @example
 *   // In a Svelte component:
 *   import { authClient } from "$lib/auth-client";
 *   const session = authClient.useSession();
 *
 *   // Reactive session access:
 *   {#if $session.data}
 *     <p>Hello, {$session.data.user.name}</p>
 *   {/if}
 *
 *   // Sign in:
 *   await authClient.signIn.email({ email, password });
 *
 *   // Sign out:
 *   await authClient.signOut();
 */
export const authClient = createAuthClient({
  /** Base URL for auth API — uses same origin since SPA is served by Elysia. */
  baseURL: typeof window !== "undefined" ? window.location.origin : "http://localhost:3100",
});

/** Convenience re-export of the reactive session store. */
export const session = authClient.useSession();
