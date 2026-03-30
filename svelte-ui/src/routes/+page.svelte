<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";

  const session = authClient.useSession();

  onMount(async () => {
    try {
      // 1. Check instance health & bootstrap status
      const healthRes = await fetch("/api/health");
      const health = await healthRes.json();

      if (health.bootstrapStatus === "bootstrap_pending") {
        goto("/setup", { replaceState: true });
        return;
      }

      // 2. If authenticated mode and no session, redirect to auth
      if (health.deploymentMode === "authenticated" && !$session.data) {
        goto("/auth", { replaceState: true });
        return;
      }

      // 3. First-time setup: no companies → onboarding wizard
      if (!health.hasCompanies) {
        goto("/setup", { replaceState: true });
        return;
      }

      // 4. Has companies: redirect to first company dashboard
      const res = await fetch("/api/companies");
      const companies = await res.json();
      if (Array.isArray(companies) && companies.length > 0) {
        goto(`/${companies[0].slug ?? companies[0].id}/dashboard`, { replaceState: true });
      } else {
        goto("/setup", { replaceState: true });
      }
    } catch {
      goto("/setup", { replaceState: true });
    }
  });
</script>

<div class="flex h-full items-center justify-center">
  <div class="text-sm text-muted-foreground">Loading…</div>
</div>
