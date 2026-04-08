<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { api } from "$lib/api";
  import { getCompanyPrefix } from "$stores/company.svelte.js";

  const session = authClient.useSession();

  onMount(async () => {
    try {
      // 1. Check instance health & bootstrap status
      const healthRes = await api("/api/health");
      const health = await healthRes.json();

      if (health.bootstrapStatus === "bootstrap_pending") {
        goto("/onboarding", { replaceState: true });
        return;
      }

      // 2. If authenticated mode and no session, redirect to auth
      if (health.deploymentMode === "authenticated" && !$session.data) {
        goto("/auth", { replaceState: true });
        return;
      }

      // 3. First-time setup: no companies -> onboarding wizard
      if (!health.hasCompanies) {
        goto("/onboarding", { replaceState: true });
        return;
      }

      // 4. Has companies: redirect to first company dashboard
      const res = await api("/api/companies");
      const companies = await res.json();
      if (Array.isArray(companies) && companies.length > 0) {
        goto(`/${getCompanyPrefix(companies[0])}/dashboard`, { replaceState: true });
      } else {
        goto("/onboarding", { replaceState: true });
      }
    } catch {
      goto("/onboarding", { replaceState: true });
    }
  });
</script>

<div class="flex min-h-screen items-center justify-center bg-[#050508]">
  <div class="flex flex-col items-center gap-3">
    <div class="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70"></div>
    <p class="text-sm text-[#64748b]">Loading...</p>
  </div>
</div>
