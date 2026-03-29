<script lang="ts">
  import { UserPlus, AlertCircle, Check } from "lucide-svelte";
  import { api } from "$lib/api/client";
  import { authClient } from "$lib/auth-client";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  let inviteCode = $derived($page.url.searchParams.get("code") ?? "");
  let invite = $state<any>(null);
  let loading = $state(true);
  let accepting = $state(false);
  let error = $state<string | null>(null);
  let accepted = $state(false);

  const session = authClient.useSession();

  // Load invite details
  $effect(() => {
    if (!inviteCode) {
      loading = false;
      error = "No invite code provided.";
      return;
    }

    api.api.invites({ code: inviteCode }).get()
      .then((res) => {
        invite = res.data;
      })
      .catch((err) => {
        error = err instanceof Error ? err.message : "Invalid or expired invite";
      })
      .finally(() => {
        loading = false;
      });
  });

  async function handleAccept() {
    if (!inviteCode) return;

    // Redirect to auth if not signed in
    if (!($session as any)?.data) {
      goto(`/auth?redirect=${encodeURIComponent(`/invite?code=${inviteCode}`)}`);
      return;
    }

    accepting = true;
    error = null;

    try {
      const result = await api.api.invites({ code: inviteCode }).accept.post();
      const data = result.data as any;
      accepted = true;
      const prefix = data?.companySlug ?? invite?.companySlug;
      if (prefix) {
        setTimeout(() => goto(`/${prefix}`), 1500);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to accept invite";
    } finally {
      accepting = false;
    }
  }
</script>

<div class="flex h-full items-center justify-center">
  <div class="flex flex-col items-center gap-6 w-full max-w-sm px-4">
    <div class="flex flex-col items-center gap-2">
      <UserPlus class="size-10 text-foreground" />
      <h1 class="text-xl font-semibold">You're Invited</h1>
    </div>

    {#if loading}
      <div class="w-full space-y-3">
        <div class="h-20 rounded-lg bg-muted animate-pulse"></div>
        <div class="h-9 rounded-md bg-muted animate-pulse"></div>
      </div>
    {:else if !inviteCode}
      <div class="w-full rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <p class="text-sm text-destructive">No invite code provided.</p>
        <p class="text-xs text-muted-foreground mt-1">Please use the invite link you received.</p>
      </div>
    {:else if accepted}
      <div class="w-full rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-center space-y-2">
        <Check class="size-8 text-green-500 mx-auto" />
        <p class="text-sm font-medium text-green-500">Invite accepted!</p>
        <p class="text-xs text-muted-foreground">Redirecting to company dashboard...</p>
      </div>
    {:else if invite}
      <div class="w-full rounded-lg border border-border bg-card p-4 space-y-3">
        {#if invite.inviterName}
          <div class="text-center">
            <p class="text-sm text-muted-foreground">
              <span class="font-medium text-foreground">{invite.inviterName}</span> invited you to join
            </p>
          </div>
        {/if}
        <div class="text-center">
          <p class="text-lg font-semibold text-foreground">{invite.companyName ?? "a company"}</p>
          {#if invite.role}
            <p class="text-xs text-muted-foreground mt-0.5">as {invite.role}</p>
          {/if}
        </div>
        {#if invite.expiresAt}
          <p class="text-xs text-muted-foreground text-center">
            Expires {new Date(invite.expiresAt).toLocaleDateString()}
          </p>
        {/if}
      </div>

      {#if error}
        <div class="w-full flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <AlertCircle class="size-4 text-destructive shrink-0 mt-0.5" />
          <p class="text-sm text-destructive">{error}</p>
        </div>
      {/if}

      <button
        onclick={handleAccept}
        disabled={accepting}
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {accepting ? "Accepting..." : "Accept Invite"}
      </button>

      {#if !($session as any)?.data}
        <p class="text-xs text-muted-foreground text-center">
          You'll be asked to sign in before joining.
        </p>
      {/if}
    {:else if error}
      <div class="w-full rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
        <AlertCircle class="size-5 text-destructive mx-auto mb-2" />
        <p class="text-sm text-destructive">{error}</p>
      </div>
    {/if}

    <a
      href="/"
      class="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Back to home
    </a>
  </div>
</div>
