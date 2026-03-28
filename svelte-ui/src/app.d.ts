// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    interface Locals {
      /** Current session from better-auth (populated in hooks.server.ts). */
      session: {
        id: string;
        userId: string;
        expiresAt: Date;
      } | null;
      /** Current user from better-auth (populated in hooks.server.ts). */
      user: {
        id: string;
        name: string;
        email: string;
        image?: string | null;
      } | null;
    }
  }
}

export {};
