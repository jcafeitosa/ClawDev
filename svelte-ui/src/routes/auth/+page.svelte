<script lang="ts">
  import { Box } from "lucide-svelte";
  import { authClient } from "$lib/auth-client";
  import { goto } from "$app/navigation";

  let mode: "signin" | "signup" = $state("signin");
  let email = $state("");
  let password = $state("");
  let name = $state("");
  let error = $state<string | null>(null);
  let loading = $state(false);

  const session = authClient.useSession();

  // Redirect if already authenticated
  $effect(() => {
    if ($session.data) {
      goto("/");
    }
  });

  async function handleSubmit() {
    error = null;
    loading = true;
    try {
      if (mode === "signin") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          error = result.error.message ?? "Sign in failed";
          return;
        }
      } else {
        const result = await authClient.signUp.email({ email, password, name });
        if (result.error) {
          error = result.error.message ?? "Sign up failed";
          return;
        }
      }
      goto("/");
    } catch (err) {
      error = err instanceof Error ? err.message : "An error occurred";
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex h-full items-center justify-center">
  <div class="flex flex-col items-center gap-6 w-full max-w-sm px-4">
    <div class="flex flex-col items-center gap-2">
      <Box class="size-10 text-foreground" />
      <h1 class="text-xl font-semibold">ClawDev</h1>
      <p class="text-sm text-muted-foreground">
        {mode === "signin" ? "Sign in to continue" : "Create your account"}
      </p>
    </div>

    <form class="w-full space-y-4" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {#if mode === "signup"}
        <div class="space-y-1.5">
          <label for="name" class="text-sm font-medium text-foreground">Name</label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            placeholder="Your name"
            class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      {/if}

      <div class="space-y-1.5">
        <label for="email" class="text-sm font-medium text-foreground">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          required
          placeholder="you@example.com"
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div class="space-y-1.5">
        <label for="password" class="text-sm font-medium text-foreground">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          required
          minlength="8"
          placeholder="••••••••"
          class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {#if loading}
          Signing {mode === "signin" ? "in" : "up"}…
        {:else}
          {mode === "signin" ? "Sign in" : "Create account"}
        {/if}
      </button>
    </form>

    <button
      type="button"
      class="text-sm text-muted-foreground hover:text-foreground transition-colors"
      onclick={() => { mode = mode === "signin" ? "signup" : "signin"; error = null; }}
    >
      {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
    </button>
  </div>
</div>
