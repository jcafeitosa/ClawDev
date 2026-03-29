<script lang="ts">
  import { Building2, Plus, AlertCircle, ChevronRight } from "lucide-svelte";
  import { api } from "$lib/api/client";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";
  import { companyStore } from "$stores/company.svelte.js";

  let companies = $state<any[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let creating = $state(false);
  let showCreateForm = $state(false);
  let newCompanyName = $state("");
  let createError = $state<string | null>(null);

  const session = authClient.useSession();

  $effect(() => {
    if (!($session as any)?.data) {
      goto("/auth?redirect=/companies");
      return;
    }

    api.api.companies.get()
      .then((res) => {
        companies = (res.data as any[]) ?? [];
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Failed to load companies";
      })
      .finally(() => {
        loading = false;
      });
  });

  function selectCompany(company: any) {
    companyStore.select(company.id, "manual");
    const slug = company.slug ?? company.id;
    goto(`/${slug}`);
  }

  async function handleCreateCompany() {
    if (!newCompanyName.trim()) {
      createError = "Company name is required";
      return;
    }
    creating = true;
    createError = null;

    try {
      const result = await api.api.companies.post({ name: newCompanyName.trim() });
      const newCompany = result.data as any;
      if (newCompany?.id) {
        companyStore.select(newCompany.id, "manual");
        const slug = newCompany.slug ?? newCompany.id;
        goto(`/${slug}`);
      } else {
        // Reload company list
        const res = await api.api.companies.get();
        companies = (res.data as any[]) ?? [];
        showCreateForm = false;
        newCompanyName = "";
      }
    } catch (err) {
      createError = err instanceof Error ? err.message : "Failed to create company";
    } finally {
      creating = false;
    }
  }
</script>

<div class="flex h-full items-center justify-center">
  <div class="flex flex-col items-center gap-6 w-full max-w-lg px-4">
    <div class="flex flex-col items-center gap-2">
      <Building2 class="size-10 text-foreground" />
      <h1 class="text-xl font-semibold">Your Companies</h1>
      <p class="text-sm text-muted-foreground">Select a company to continue, or create a new one.</p>
    </div>

    {#if loading}
      <div class="w-full space-y-2">
        {#each Array(3) as _}
          <div class="h-16 rounded-lg border border-border bg-card animate-pulse"></div>
        {/each}
      </div>
    {:else if error}
      <div class="w-full flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
        <p class="text-sm text-destructive">{error}</p>
      </div>
    {:else}
      <!-- Company list -->
      {#if companies.length > 0}
        <div class="w-full divide-y divide-border rounded-lg border border-border bg-card">
          {#each companies as company}
            <button
              onclick={() => selectCompany(company)}
              class="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div class="space-y-0.5">
                <p class="text-sm font-medium text-foreground">{company.name}</p>
                <p class="text-xs text-muted-foreground">
                  {company.slug ? `/${company.slug}` : ""}
                  {#if company.agentCount != null}
                    <span class="ml-2">{company.agentCount} agent{company.agentCount === 1 ? "" : "s"}</span>
                  {/if}
                </p>
              </div>
              <ChevronRight class="size-4 text-muted-foreground" />
            </button>
          {/each}
        </div>
      {:else}
        <div class="w-full flex flex-col items-center justify-center py-8 text-center">
          <p class="text-sm text-muted-foreground">No companies yet.</p>
          <p class="text-xs text-muted-foreground mt-1">Create your first company to get started.</p>
        </div>
      {/if}

      <!-- Create company -->
      {#if showCreateForm}
        <form class="w-full space-y-3" onsubmit={(e) => { e.preventDefault(); handleCreateCompany(); }}>
          <div class="space-y-1.5">
            <label for="company-name" class="text-sm font-medium text-foreground">Company Name</label>
            <input
              id="company-name"
              type="text"
              bind:value={newCompanyName}
              required
              placeholder="e.g. My AI Agency"
              autofocus
              class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {#if createError}
            <p class="text-sm text-destructive">{createError}</p>
          {/if}

          <div class="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Company"}
            </button>
            <button
              type="button"
              onclick={() => { showCreateForm = false; createError = null; newCompanyName = ""; }}
              class="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      {:else}
        <button
          onclick={() => { showCreateForm = true; }}
          class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors"
        >
          <Plus class="size-4" />
          New Company
        </button>
      {/if}
    {/if}
  </div>
</div>
