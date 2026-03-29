<script lang="ts">
  import { Box, ShieldCheck, AlertCircle } from "lucide-svelte";
  import { api } from "$lib/api/client";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  let token = $state($page.url.searchParams.get("token") ?? "");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let success = $state(false);

  async function handleClaim() {
    if (!token.trim()) {
      error = "Claim token is required";
      return;
    }
    loading = true;
    error = null;

    try {
      const result = await api.api["board-claim"].post({ token: token.trim() });
      if ((result as any).error) {
        error = ((result as any).error as any)?.value ?? "Claim failed";
        return;
      }
      success = true;
      setTimeout(() => goto("/"), 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to claim board";
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex h-full items-center justify-center">
  <div class="flex flex-col items-center gap-6 w-full max-w-sm px-4">
    <div class="flex flex-col items-center gap-2">
      <ShieldCheck class="size-10 text-foreground" />
      <h1 class="text-xl font-semibold">Claim Board</h1>
      <p class="text-sm text-muted-foreground">
        Enter your claim token to take ownership of this instance.
      </p>
    </div>

    {#if success}
      <div class="w-full rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-center">
        <p class="text-sm font-medium text-green-500">Board claimed successfully!</p>
        <p class="text-xs text-muted-foreground mt-1">Redirecting to dashboard...</p>
      </div>
    {:else}
      <form class="w-full space-y-4" onsubmit={(e) => { e.preventDefault(); handleClaim(); }}>
        <div class="space-y-1.5">
          <label for="claim-token" class="text-sm font-medium text-foreground">Claim Token</label>
          <input
            id="claim-token"
            type="text"
            bind:value={token}
            required
            placeholder="Enter claim token"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono"
          />
        </div>

        {#if error}
          <div class="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
            <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
            <p class="text-sm text-destructive">{error}</p>
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {#if loading}
            Claiming...
          {:else}
            Claim Board
          {/if}
        </button>
      </form>

      <a
        href="/auth"
        class="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Back to sign in
      </a>
    {/if}
  </div>
</div>
