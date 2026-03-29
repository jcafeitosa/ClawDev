<script lang="ts">
  import { Terminal, Check, X, AlertCircle } from "lucide-svelte";
  import { api } from "$lib/api/client";
  import { authClient } from "$lib/auth-client";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  let code = $derived($page.url.searchParams.get("code") ?? "");
  let loading = $state(false);
  let error = $state<string | null>(null);
  let approved = $state(false);
  let denied = $state(false);

  const session = authClient.useSession();

  $effect(() => {
    if (!$session.data) {
      goto(`/auth?redirect=${encodeURIComponent(`/cli-auth?code=${code}`)}`);
    }
  });

  async function handleApprove() {
    if (!code) {
      error = "No auth code provided";
      return;
    }
    loading = true;
    error = null;

    try {
      await api.api["cli-auth"].post({ code, action: "approve" });
      approved = true;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to approve CLI session";
    } finally {
      loading = false;
    }
  }

  async function handleDeny() {
    if (!code) return;
    loading = true;
    error = null;

    try {
      await api.api["cli-auth"].post({ code, action: "deny" });
      denied = true;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to deny CLI session";
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex h-full items-center justify-center">
  <div class="flex flex-col items-center gap-6 w-full max-w-sm px-4">
    <div class="flex flex-col items-center gap-2">
      <Terminal class="size-10 text-foreground" />
      <h1 class="text-xl font-semibold">CLI Authentication</h1>
      <p class="text-sm text-muted-foreground text-center">
        A CLI session is requesting access to your account.
      </p>
    </div>

    {#if !code}
      <div class="w-full rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p class="text-sm text-destructive">No authentication code provided.</p>
        <p class="text-xs text-muted-foreground mt-1">Please use the link from your CLI.</p>
      </div>
    {:else if approved}
      <div class="w-full rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-center space-y-2">
        <Check class="size-8 text-green-500 mx-auto" />
        <p class="text-sm font-medium text-green-500">CLI session approved!</p>
        <p class="text-xs text-muted-foreground">You can return to your terminal. This window can be closed.</p>
      </div>
    {:else if denied}
      <div class="w-full rounded-lg border border-muted bg-muted/50 p-4 text-center space-y-2">
        <X class="size-8 text-muted-foreground mx-auto" />
        <p class="text-sm font-medium text-foreground">CLI session denied.</p>
        <p class="text-xs text-muted-foreground">The CLI will need to authenticate again.</p>
      </div>
    {:else}
      <!-- Auth code display -->
      <div class="w-full rounded-lg border border-border bg-card p-4 text-center">
        <p class="text-xs text-muted-foreground uppercase tracking-wider mb-1">Auth Code</p>
        <p class="text-lg font-mono font-semibold text-foreground tracking-widest">{code}</p>
      </div>

      <p class="text-xs text-muted-foreground text-center">
        Verify this code matches what your CLI is showing before approving.
      </p>

      {#if error}
        <div class="w-full flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-destructive">{error}</p>
        </div>
      {/if}

      <div class="w-full flex gap-3">
        <button
          onclick={handleApprove}
          disabled={loading}
          class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Processing..." : "Approve"}
        </button>
        <button
          onclick={handleDeny}
          disabled={loading}
          class="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground shadow-sm hover:bg-muted transition-colors disabled:opacity-50"
        >
          Deny
        </button>
      </div>
    {/if}
  </div>
</div>
