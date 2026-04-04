<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { companyStore, resolveCompanyIdFromPrefix } from "$stores/company.svelte.js";

  onMount(() => {
    const prefix = ($page.params.companyPrefix ?? "").trim();
    const companyId = resolveCompanyIdFromPrefix(prefix) ?? companyStore.selectedCompanyId ?? null;
    const query = new URLSearchParams(window.location.search);

    if (companyId) {
      query.set("companyId", companyId);
      query.set("companyPrefix", prefix);
      query.set("step", "2");
    }

    void goto(`/onboarding${query.toString() ? `?${query.toString()}` : ""}`, {
      replaceState: true,
    });
  });
</script>

<div class="flex h-full items-center justify-center">
  <div class="text-sm text-muted-foreground">Redirecting to setup…</div>
</div>
