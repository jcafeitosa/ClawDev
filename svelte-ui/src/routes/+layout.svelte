<script lang="ts">
  import "../app.css";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let { children } = $props();

  const session = authClient.useSession();

  // Redirect unauthenticated users to /auth (except on /auth itself)
  $effect(() => {
    const isAuthPage = $page.url.pathname.startsWith("/auth");
    const isPublicRoute = $page.url.pathname === "/" && !$session.data;

    if (!$session.isPending && !$session.data && !isAuthPage) {
      goto("/auth");
    }
  });
</script>

<div class="h-full">
  {#if $session.isPending}
    <div class="flex h-full items-center justify-center">
      <div class="text-sm text-muted-foreground">Loading…</div>
    </div>
  {:else}
    {@render children()}
  {/if}
</div>
